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

## Create the Windows web installer

```powershell
npm run electron:build
```

This creates `release/nsis-web/Dukan Yantra Setup.exe`, a small NSIS web installer, and `release/nsis-web/dukan-yantra-desktop-<version>-x64.nsis.7z`, the separate app package. The setup downloads that package from the configured GitHub release during installation, so users need an internet connection. It creates desktop and Start Menu shortcuts, allows the user to select an install directory, and preserves app data when uninstalled.

Publish both generated assets to the GitHub release for the matching app version. The web installer looks for the package at the release URL computed from the GitHub publish configuration in `electron/package.json`; publishing only the setup executable will leave installation incomplete. The installer payload excludes the website's copy of any prior setup executable to prevent recursively bundling it.

To keep the setup under 25 MB, check the size of `release/nsis-web/Dukan Yantra Setup.exe` after each build. The `.nsis.7z` payload is the full application and is expected to be larger.

The installer is currently unsigned. For customer distribution, obtain and configure a trusted Windows code-signing certificate; do not advise users to bypass SmartScreen warnings.

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
