const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const isDevelopment = process.argv.includes("--dev") && !app.isPackaged;
let developmentUrl;
const packagedDist = path.join(process.resourcesPath, "dist");
const trustedExternalPopupHosts = [
  (hostname) => hostname.endsWith(".firebaseapp.com"),
  (hostname) => hostname.endsWith(".web.app"),
  (hostname) => hostname === "accounts.google.com",
];

let mainWindow;
let developmentServer;
let localServer;
let localOrigin;

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://*.firebaseapp.com https://accounts.google.com",
  "frame-src 'self' https://*.firebaseapp.com https://*.web.app https://accounts.google.com https://*.google.com https://maps.googleapis.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://maps.googleapis.com",
  "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.google.com https://api.postalpincode.in https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://images.unsplash.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
].join("; ");

function isAllowedApplicationUrl(rawUrl) {
  if (!localOrigin) return false;
  try {
    const url = new URL(rawUrl);
    return url.origin === localOrigin;
  } catch {
    return false;
  }
}

function isDevelopmentUrl(rawUrl) {
  if (!isDevelopment) return false;
  try {
    return new URL(rawUrl).origin === developmentUrl;
  } catch {
    return false;
  }
}

function isTrustedAuthPopup(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" &&
      trustedExternalPopupHosts.some((matchesHost) => matchesHost(url.hostname));
  } catch {
    return false;
  }
}

function openExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") {
      void shell.openExternal(url.href);
    }
  } catch {
    // Invalid and non-web URLs are intentionally ignored.
  }
}

function isLocalRequest(request) {
  const host = String(request.headers.host || "").toLowerCase();
  return host === "localhost" || host.startsWith("localhost:") ||
    host === "127.0.0.1" || host.startsWith("127.0.0.1:");
}

function sendText(response, status, message) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(message);
}

function startPackagedServer() {
  localServer = http.createServer(async (request, response) => {
    if (!isLocalRequest(request)) {
      sendText(response, 403, "Forbidden");
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method Not Allowed");
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      sendText(response, 400, "Bad Request");
      return;
    }

    const requestedFile = path.resolve(packagedDist, `.${requestPath}`);
    const isInsideDist = requestedFile === packagedDist || requestedFile.startsWith(`${packagedDist}${path.sep}`);
    if (!isInsideDist) {
      sendText(response, 403, "Forbidden");
      return;
    }

    let filePath = requestedFile;
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      if (requestPath.startsWith("/api/") || path.extname(requestPath)) {
        sendText(response, 404, "Not Found");
        return;
      }
      filePath = path.join(packagedDist, "index.html");
    }

    let contents;
    try {
      contents = await fs.promises.readFile(filePath);
    } catch {
      sendText(response, 404, "Not Found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": path.extname(filePath) === ".html" ? "no-store" : "public, max-age=31536000, immutable",
      "Content-Security-Policy": contentSecurityPolicy,
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  });

  return new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(0, "localhost", () => {
      const address = localServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine the local application server address."));
        return;
      }
      localOrigin = `http://localhost:${address.port}`;
      resolve(localOrigin);
    });
  });
}

async function startDevelopmentServer() {
  const port = await new Promise((resolve, reject) => {
    const portServer = net.createServer();
    portServer.once("error", reject);
    portServer.listen(0, "127.0.0.1", () => {
      const address = portServer.address();
      portServer.close((error) => {
        if (error) reject(error);
        else if (!address || typeof address === "string") reject(new Error("Could not reserve a Vite port."));
        else resolve(address.port);
      });
    });
  });
  developmentUrl = `http://127.0.0.1:${port}`;

  const npmCli = process.env.npm_execpath;
  const nodeExecutable = process.env.npm_node_execpath;
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const command = nodeExecutable && npmCli ? nodeExecutable : npmCommand;
  const args = nodeExecutable && npmCli
    ? [npmCli, "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]
    : ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  developmentServer = spawn(
    command,
    args,
    {
      cwd: app.getAppPath(),
      env: { ...process.env, BROWSER: "none" },
      stdio: "inherit",
      shell: !(nodeExecutable && npmCli) && process.platform === "win32",
    }
  );
  developmentServer.once("error", (error) => {
    dialog.showErrorBox("Dukan Yantra", `Could not start the Vite development server.\n\n${error.message}`);
    app.quit();
  });
  developmentServer.once("exit", (code) => {
    if (code !== null && code !== 0 && !app.isQuitting) {
      dialog.showErrorBox("Dukan Yantra", `The Vite development server exited with code ${code}.`);
      app.quit();
    }
  });
}

async function waitForDevelopmentServer() {
  const timeoutAt = Date.now() + 30_000;
  let lastError;
  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(developmentUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
      lastError = new Error(`Vite returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Vite did not become available within 30 seconds. ${lastError instanceof Error ? lastError.message : ""}`);
}

function configurePermissions() {
  const appSession = session.defaultSession;
  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    let trustedOrigin = false;
    try {
      trustedOrigin = isAllowedApplicationUrl(webContents.getURL()) ||
        (isDevelopment && new URL(webContents.getURL()).origin === developmentUrl);
    } catch {
      trustedOrigin = false;
    }

    const cameraOnly = permission === "media" &&
      details.mediaTypes?.includes("video") &&
      !details.mediaTypes?.includes("audio");
    callback(trustedOrigin && (cameraOnly || permission === "geolocation"));
  });
}

function configureNavigationProtection() {
  app.on("web-contents-created", (_event, webContents) => {
    webContents.on("will-navigate", (event, targetUrl) => {
      if (targetUrl === "about:blank" || isAllowedApplicationUrl(targetUrl) ||
          isDevelopmentUrl(targetUrl) || isTrustedAuthPopup(targetUrl)) return;
      event.preventDefault();
      openExternal(targetUrl);
    });
  });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: "Dukan Yantra",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icons", "dukanyantra.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl === "about:blank" || isAllowedApplicationUrl(targetUrl) ||
        isDevelopmentUrl(targetUrl) || isTrustedAuthPopup(targetUrl)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        },
      };
    }
    openExternal(targetUrl);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  void mainWindow.loadURL(url);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId("com.dukanyantra.desktop");
    ipcMain.handle("desktop:get-version", () => app.getVersion());
    configurePermissions();
    configureNavigationProtection();

    try {
      if (isDevelopment) {
        await startDevelopmentServer();
        await waitForDevelopmentServer();
        localOrigin = developmentUrl;
      } else {
        localOrigin = await startPackagedServer();
      }
      createWindow(localOrigin);
    } catch (error) {
      dialog.showErrorBox(
        "Dukan Yantra could not start",
        error instanceof Error ? error.message : String(error)
      );
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && localOrigin) createWindow(localOrigin);
    });
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    if (developmentServer && !developmentServer.killed) developmentServer.kill();
    if (localServer) localServer.close();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
