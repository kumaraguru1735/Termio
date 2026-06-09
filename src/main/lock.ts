import { ipcMain } from 'electron'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { IPC } from '../shared/types'
import { readJson, writeJson } from './jsonstore'

const FILE = 'lock.json'

interface LockData {
  salt: string
  hash: string
}

const load = (): LockData | null => readJson<LockData | null>(FILE, null)

function deriveHash(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 64)
}

/**
 * Optional app-lock screen. Stores only a scrypt hash of the passphrase — the
 * host vault itself stays encrypted by the OS keyring; this just gates the UI.
 */
export function registerLockHandlers(): void {
  ipcMain.handle(IPC.lockStatus, (): { enabled: boolean } => ({ enabled: load() !== null }))

  ipcMain.handle(IPC.lockSet, (_e, passphrase: string | null): { ok: boolean } => {
    if (!passphrase) {
      writeJson(FILE, null)
      return { ok: true }
    }
    const salt = randomBytes(16)
    writeJson(FILE, { salt: salt.toString('hex'), hash: deriveHash(passphrase, salt).toString('hex') })
    return { ok: true }
  })

  ipcMain.handle(IPC.lockVerify, (_e, passphrase: string): { ok: boolean } => {
    const data = load()
    if (!data) return { ok: true }
    const got = deriveHash(passphrase, Buffer.from(data.salt, 'hex'))
    const want = Buffer.from(data.hash, 'hex')
    return { ok: got.length === want.length && timingSafeEqual(got, want) }
  })
}
