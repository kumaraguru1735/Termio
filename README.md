# Termio

An open, **local-first** SSH/SFTP client with a Termius-style UI — built to never
paywall sync and never lose your saved hosts to a forced auto-update.

Stack: **Electron + electron-vite + React + TypeScript**, terminal via
**xterm.js**, SSH via **ssh2**.

## Features

- Terminal sessions and SFTP file browsing in tabbed workspaces
- Encrypted local host store (OS keyring via Electron `safeStorage`)
- Password, private key and SSH-agent auth, with TOFU host-key verification
- Tags, parent groups, startup snippets, environment variables per host
- SSH jump-host chaining + SOCKS5 proxy support
- Port forwarding (local → remote tunnels), saved snippets, themes
- End-to-end-encrypted vault export/import (`.tvault`, AES-256-GCM + scrypt)
  — point it at any folder you already sync for true self-hosted sync
- **No auto-updater** — never a forced restart that wipes your work

## Develop

```bash
npm install
npm run dev          # launch with hot reload
```

## Build & package

```bash
npm run build        # compile to out/
npm start            # preview the production build
npm run pack         # unpacked app in release/linux-unpacked/
npm run dist         # build release/*.deb and release/*.AppImage
```

## Try it

A public read-only SSH test host is preloaded
(`demo@test.rebex.net` / `password`) so you can verify a live session immediately.

## License

MIT
