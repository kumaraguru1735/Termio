import { app, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'
import {
  IPC,
  type SyncResult,
  type HostConfig,
  type Snippet,
  type PortForward,
  type KnownHost
} from '../shared/types'
import { loadHosts, saveHosts } from './store'
import { listKnownHosts } from './knownhosts'
import { readJson, writeJson } from './jsonstore'

interface Vault {
  hosts: HostConfig[]
  snippets: Snippet[]
  forwards: PortForward[]
  knownHosts: KnownHost[]
}

interface Envelope {
  termio_vault: 1
  kdf: 'scrypt'
  salt: string
  iv: string
  tag: string
  data: string
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 })
}

function encryptVault(vault: Vault, passphrase: string): Envelope {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(passphrase, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(vault), 'utf8')
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return {
    termio_vault: 1,
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  }
}

function decryptVault(env: Envelope, passphrase: string): Vault {
  const salt = Buffer.from(env.salt, 'base64')
  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'))
  const out = Buffer.concat([
    decipher.update(Buffer.from(env.data, 'base64')),
    decipher.final()
  ])
  return JSON.parse(out.toString('utf8')) as Vault
}

function gatherVault(): Vault {
  return {
    hosts: loadHosts(),
    snippets: readJson<Snippet[]>('snippets.json', []),
    forwards: readJson<PortForward[]>('forwards.json', []),
    knownHosts: listKnownHosts()
  }
}

function restoreVault(v: Vault): SyncResult['counts'] {
  saveHosts(v.hosts ?? [])
  writeJson('snippets.json', v.snippets ?? [])
  writeJson('forwards.json', v.forwards ?? [])
  writeJson('known_hosts.json', v.knownHosts ?? [])
  return {
    hosts: v.hosts?.length ?? 0,
    snippets: v.snippets?.length ?? 0,
    forwards: v.forwards?.length ?? 0,
    knownHosts: v.knownHosts?.length ?? 0
  }
}

export function registerSyncHandlers(): void {
  ipcMain.handle(IPC.syncExport, async (_e, passphrase: string): Promise<SyncResult> => {
    if (!passphrase) return { ok: false, error: 'a passphrase is required' }
    const res = await dialog.showSaveDialog({
      title: 'Export encrypted vault',
      defaultPath: join(app.getPath('documents'), 'termio-vault.tvault'),
      filters: [{ name: 'Termio Vault', extensions: ['tvault'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, cancelled: true }
    try {
      const env = encryptVault(gatherVault(), passphrase)
      writeFileSync(res.filePath, JSON.stringify(env), 'utf8')
      return { ok: true, path: res.filePath }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.syncImport, async (_e, passphrase: string): Promise<SyncResult> => {
    if (!passphrase) return { ok: false, error: 'a passphrase is required' }
    const res = await dialog.showOpenDialog({
      title: 'Import encrypted vault',
      defaultPath: app.getPath('documents'),
      filters: [{ name: 'Termio Vault', extensions: ['tvault'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return { ok: false, cancelled: true }
    try {
      const env = JSON.parse(readFileSync(res.filePaths[0], 'utf8')) as Envelope
      if (env.termio_vault !== 1) return { ok: false, error: 'not a Termina vault file' }
      const vault = decryptVault(env, passphrase)
      const counts = restoreVault(vault)
      return { ok: true, path: res.filePaths[0], counts }
    } catch {
      // GCM auth failure (wrong passphrase / tampering) lands here.
      return { ok: false, error: 'decryption failed — wrong passphrase or corrupted file' }
    }
  })
}
