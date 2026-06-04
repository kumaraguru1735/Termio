import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { existsSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { Client, type ClientChannel } from 'ssh2'
import { IPC, type HostConfig, type SshConnectResult } from '../shared/types'
import { loadHosts, upsertHost, deleteHost } from './store'
import { listKnownHosts, deleteKnownHost, listSshKeys } from './knownhosts'
import { establishConnection } from './ssh-common'
import { registerSftpHandlers, closeAllSftp } from './sftp'
import { registerPortForwardHandlers, closeAllForwards } from './portforward'
import { registerSnippetHandlers } from './snippets'
import { registerSyncHandlers } from './sync'
import { registerActivityHandlers, logHost } from './activity'
import { registerPromptHandlers } from './prompts'
import { registerKeyGenHandlers } from './keygen'

/** Live SSH sessions keyed by sessionId. */
interface Session {
  client: Client
  stream: ClientChannel
}
const sessions = new Map<string, Session>()

// A terminal/SFTP app gains nothing from GPU compositing, and disabling it
// sidesteps Electron GPU-process crashes on some Linux GPU stacks.
app.disableHardwareAcceleration()

// One-time userData migration: if a previous build wrote to the old
// "termina" directory, move it to the current name so the encrypted host
// store survives the rename.
try {
  const oldDir = join(app.getPath('appData'), 'termina')
  const newDir = app.getPath('userData')
  if (existsSync(oldDir) && !existsSync(newDir)) renameSync(oldDir, newDir)
} catch {
  /* migration is best-effort */
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 800,
    minHeight: 520,
    backgroundColor: '#21252e',
    show: false,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev; load the file in prod.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerSshHandlers(): void {
  ipcMain.handle(IPC.sshConnect, async (event, cfg: HostConfig): Promise<SshConnectResult> => {
    const sessionId = randomUUID()
    const wc = event.sender
    const getHostById = (id: string): HostConfig | undefined => loadHosts().find((h) => h.id === id)

    let client: Client
    try {
      client = await establishConnection(cfg, getHostById)
    } catch (err) {
      logHost(cfg, 'terminal', 'failed', (err as Error).message)
      return { ok: false, error: (err as Error).message }
    }

    return new Promise<SshConnectResult>((resolve) => {
      // Per-host environment variables are passed to the shell request; many
      // servers ignore vars outside their AcceptEnv list — sent best-effort.
      client.shell({ term: 'xterm-256color' }, { env: cfg.env }, (err, stream) => {
        if (err) {
          client.end()
          logHost(cfg, 'terminal', 'failed', err.message)
          return resolve({ ok: false, error: err.message })
        }
        sessions.set(sessionId, { client, stream })
        logHost(cfg, 'terminal', 'connected')

        stream.on('data', (d: Buffer) => {
          if (!wc.isDestroyed()) wc.send(IPC.sshData(sessionId), d.toString('utf8'))
        })
        stream.stderr.on('data', (d: Buffer) => {
          if (!wc.isDestroyed()) wc.send(IPC.sshData(sessionId), d.toString('utf8'))
        })
        stream.on('close', () => {
          sessions.delete(sessionId)
          client.end()
          logHost(cfg, 'terminal', 'disconnected')
          if (!wc.isDestroyed()) wc.send(IPC.sshClosed(sessionId))
        })

        // Run the startup snippet once the shell is ready (small delay so it
        // lands after the server's banner/prompt).
        if (cfg.startupSnippet?.trim()) {
          setTimeout(() => {
            const text = cfg.startupSnippet!.replace(/\r?\n/g, '\n')
            stream.write(text.endsWith('\n') ? text : text + '\n')
          }, 350)
        }

        resolve({ ok: true, sessionId })
      })
    })
  })

  ipcMain.on(IPC.sshWrite, (_e, sessionId: string, data: string) => {
    sessions.get(sessionId)?.stream.write(data)
  })

  ipcMain.on(IPC.sshResize, (_e, sessionId: string, cols: number, rows: number) => {
    sessions.get(sessionId)?.stream.setWindow(rows, cols, 0, 0)
  })

  ipcMain.on(IPC.sshClose, (_e, sessionId: string) => {
    const s = sessions.get(sessionId)
    if (s) {
      s.stream.end()
      s.client.end()
      sessions.delete(sessionId)
    }
  })
}

function registerHostHandlers(): void {
  ipcMain.handle(IPC.hostsList, (): HostConfig[] => loadHosts())
  ipcMain.handle(IPC.hostsUpsert, (_e, host: HostConfig): HostConfig[] => upsertHost(host))
  ipcMain.handle(IPC.hostsDelete, (_e, id: string): HostConfig[] => deleteHost(id))

  ipcMain.handle(IPC.keysList, () => listSshKeys())
  ipcMain.handle(IPC.knownHostsList, () => listKnownHosts())
  ipcMain.handle(IPC.knownHostsDelete, (_e, id: string) => deleteKnownHost(id))

  ipcMain.on(IPC.windowMinimize, () => mainWindow?.minimize())
  ipcMain.on(IPC.windowMaximize, () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on(IPC.windowClose, () => mainWindow?.close())

  ipcMain.handle(IPC.keyBrowse, async (): Promise<string | null> => {
    const res = await dialog.showOpenDialog({
      title: 'Select private key',
      defaultPath: join(app.getPath('home'), '.ssh'),
      properties: ['openFile', 'showHiddenFiles']
    })
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
}

// Enforce a single running instance: a second launch (e.g. clicking the app
// icon again) focuses the existing window instead of opening a duplicate.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerSshHandlers()
    registerHostHandlers()
    registerSftpHandlers()
    registerPortForwardHandlers()
    registerSnippetHandlers()
    registerSyncHandlers()
    registerActivityHandlers()
    registerPromptHandlers()
    registerKeyGenHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  for (const { client } of sessions.values()) client.end()
  sessions.clear()
  closeAllSftp()
  closeAllForwards()
  if (process.platform !== 'darwin') app.quit()
})
