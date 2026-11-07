# Dukan Yantra Windows desktop app

The Electron shell packages the existing Vite application; it does not create a separate data store or Firebase project. The installed app uses the Firebase web configuration compiled into the existing frontend and the same authenticated cloud data as the website.

## Requirements

- Node.js 22.12 or later (the current development environment uses Node.js 24).
- npm.
- Windows 10 or Windows 11 for the NSIS installer.

## Development

```powershell
npm install
npm run electron:dev
```

Electron starts Vite on an available loopback port and opens the existing React app in a secured desktop window.

## Build and launch the unpacked app

```powershell
npm run electron:dir
```

This runs the existing production Vite build and packages an unpacked Windows app under `release/win-unpacked/`. Launch `Dukan Yantra.exe` there to smoke-test the packaged build before installer creation.

## Create the Windows installer

```powershell
npm run electron:build
```

The NSIS installer is written to `release/Dukan Yantra Setup.exe`. It creates desktop and Start Menu shortcuts, allows the user to select an install directory, and preserves app data when uninstalled. No installer is uploaded or deployed by this command.

The installer is currently unsigned. For customer distribution, obtain and configure a trusted Windows code-signing certificate; do not advise users to bypass SmartScreen warnings.

## Website download link

The `/install` page only displays a download link on detected Windows 10/11 when a real HTTPS installer URL is configured at Vite build time:

```dotenv
VITE_WINDOWS_INSTALLER_URL=https://downloads.example.com/Dukan%20Yantra%20Setup.exe
VITE_WINDOWS_INSTALLER_SIZE=120 MB
```

The values above are examples, not working links. Do not configure them until the generated installer has been published at a verified URL. Electron installers are large; host the release asset on a public GitHub Release or a dedicated object-storage/CDN download host rather than bundling it into the Vercel static deployment. This repository does not currently have a configured public installer release URL. Set the size string only after measuring the hosted artifact. Rebuild and deploy the website after configuring the URL.

## Runtime and security notes

- Production Electron serves the Vite build from a loopback-only HTTP server. This preserves React pathname routing and a localhost web origin for Firebase Auth; it does not use `file://`.
- Electron uses context isolation, sandboxing, disabled Node integration, a restrictive Content Security Policy, and a preload bridge exposing only the app version and desktop marker.
- External HTTP(S) links open in the system browser. Only Firebase/Google authentication popup hosts are allowed in app-managed popup windows.
- The packaged app contains the compiled client and the minimal Electron shell only; its runtime package does not include the website's development/build dependencies. The existing Express service is not packaged: its current endpoints are legacy username/password session routes and the active unified app does not call them. The postal lookup's server request has a public-service fallback.
- Firebase web configuration remains client configuration; no service-account credentials or `.env` files are packaged. Firebase persistence, rules, and the existing PWA remain unchanged.
- The Electron app does not implement a separate updater. A verified update host/feed and code signing are prerequisites before adding an update mechanism.

## Manual Windows validation

On clean Windows 10 and Windows 11 machines:

1. Install from `Dukan Yantra Setup.exe`; verify directory selection and Start Menu/Desktop shortcuts.
2. Launch from each shortcut and check sign-in, Google sign-in, dashboard routes, billing, invoice generation, inventory, customer management, and cloud sync.
3. Disconnect the network and verify the connectivity indicator and transaction guards; reconnect and verify recovery.
4. Open an external link and verify it opens in the default browser.
5. Uninstall from Windows Apps and verify the app is removed while user data remains unless the user removes it separately.
