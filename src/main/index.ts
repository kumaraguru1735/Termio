import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { existsSync, renameSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { Client, type ClientChannel } from 'ssh2'
import { IPC, type HostConfig, type Identity, type SshConnectResult } from '../shared/types'
import { loadHosts, upsertHost, deleteHost, loadIdentities, upsertIdentity, deleteIdentity } from './store'
import { listKnownHosts, deleteKnownHost, listSshKeys } from './knownhosts'
import { establishConnection } from './ssh-common'
import { registerSftpHandlers, closeAllSftp } from './sftp'
import { registerPortForwardHandlers, closeAllForwards } from './portforward'
import { registerSnippetHandlers } from './snippets'
import { registerSyncHandlers } from './sync'
import { registerActivityHandlers, logHost } from './activity'
import { registerPromptHandlers } from './prompts'
import { registerKeyGenHandlers } from './keygen'
import { registerLockHandlers } from './lock'
import { registerTerminalHandlers, closeAllTerminals } from './terminals'
import { makeZmodemBridge } from './zmodem'

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
/** Pending Web Serial port-selection callback, resolved by the renderer picker. */
let pendingSerialChoose: ((portId: string) => void) | null = null

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

  // Web Serial support: grant access and route port selection to a renderer
  // picker (Electron requires the app to choose a port via the callback).
  const ses = mainWindow.webContents.session
  ses.setPermissionCheckHandler((_wc, perm) => perm === 'serial' || true)
  ses.setDevicePermissionHandler(() => true)
  ses.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault()
    pendingSerialChoose = callback
    mainWindow?.webContents.send(
      IPC.serialAsk,
      portList.map((p) => ({
        portId: p.portId,
        name: p.portName || p.displayName || p.portId,
        vid: p.vendorId,
        pid: p.productId
      }))
    )
  })

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

        // ZMODEM bridge: sz/rz on the remote drive file transfers via dialogs.
        // Non-ZMODEM output passes straight through to the terminal.
        const zmodem = makeZmodemBridge(sessionId, wc, (buf) => stream.write(buf))
        stream.on('data', (d: Buffer) => {
          if (!wc.isDestroyed()) zmodem.consume(d)
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

/** Parse ~/.ssh/config and add any concrete Host entries not already saved. */
function importSshConfig(): { ok: boolean; added: number; error?: string } {
  const path = join(homedir(), '.ssh', 'config')
  if (!existsSync(path)) return { ok: false, added: 0, error: 'No ~/.ssh/config found' }
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (err) {
    return { ok: false, added: 0, error: (err as Error).message }
  }
  const expand = (p: string): string => (p.startsWith('~') ? join(homedir(), p.slice(1)) : p)

  interface Block { patterns: string[]; fields: Record<string, string> }
  const blocks: Block[] = []
  let cur: Block | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(\S+)[\s=]+(.+)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'host') {
      if (cur) blocks.push(cur)
      cur = { patterns: val.split(/\s+/), fields: {} }
    } else if (cur) {
      cur.fields[key] = val
    }
  }
  if (cur) blocks.push(cur)

  const existing = loadHosts()
  let added = 0
  for (const b of blocks) {
    const name = b.patterns.find((p) => !p.includes('*') && !p.includes('?'))
    if (!name) continue
    if (existing.some((h) => h.label === name)) continue
    const keyFile = b.fields['identityfile']
    const cfg: HostConfig = {
      id: randomUUID(),
      label: name,
      host: b.fields['hostname'] || name,
      port: parseInt(b.fields['port'] || '22', 10) || 22,
      username: b.fields['user'] || 'root',
      authType: keyFile ? 'key' : 'agent',
      privateKeyPath: keyFile ? expand(keyFile) : undefined,
      group: 'Imported'
    }
    upsertHost(cfg)
    existing.push(cfg)
    added++
  }
  return { ok: true, added }
}

function registerHostHandlers(): void {
  ipcMain.handle(IPC.hostsList, (): HostConfig[] => loadHosts())
  ipcMain.handle(IPC.hostsUpsert, (_e, host: HostConfig): HostConfig[] => upsertHost(host))
  ipcMain.handle(IPC.hostsDelete, (_e, id: string): HostConfig[] => deleteHost(id))

  ipcMain.handle(IPC.identitiesList, (): Identity[] => loadIdentities())
  ipcMain.handle(IPC.identitiesUpsert, (_e, identity: Identity): Identity[] => upsertIdentity(identity))
  ipcMain.handle(IPC.identitiesDelete, (_e, id: string): Identity[] => deleteIdentity(id))

  ipcMain.handle(IPC.sshConfigImport, () => importSshConfig())

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
    registerLockHandlers()
    registerTerminalHandlers()
    ipcMain.on(IPC.serialChoose, (_e, portId: string) => {
      pendingSerialChoose?.(portId || '')
      pendingSerialChoose = null
    })
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
  closeAllTerminals()
  if (process.platform !== 'darwin') app.quit()
})
