import { ipcMain } from 'electron'
import { existsSync, writeFileSync, mkdirSync, chmodSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { utils as sshUtils } from 'ssh2'
import { IPC, type KeyFile } from '../shared/types'

export interface KeyGenRequest {
  name: string
  type: 'ed25519' | 'rsa-4096'
  passphrase?: string
  comment?: string
}

export interface KeyGenResult {
  ok: boolean
  key?: KeyFile
  error?: string
}

/** Strip path separators and other risky characters from a user-supplied name. */
function sanitizeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64)
}

export function registerKeyGenHandlers(): void {
  ipcMain.handle(IPC.keyGenerate, async (_e, req: KeyGenRequest): Promise<KeyGenResult> => {
    const safe = sanitizeName(req.name || '')
    if (!safe) return { ok: false, error: 'Pick a name (letters, digits, _ - .).' }

    const sshDir = join(homedir(), '.ssh')
    try {
      if (!existsSync(sshDir)) mkdirSync(sshDir, { mode: 0o700, recursive: true })
    } catch (err) {
      return { ok: false, error: `cannot create ~/.ssh: ${(err as Error).message}` }
    }

    const privPath = join(sshDir, safe)
    const pubPath = join(sshDir, safe + '.pub')
    if (existsSync(privPath) || existsSync(pubPath)) {
      return { ok: false, error: 'A key with that name already exists in ~/.ssh.' }
    }

    let pair: { private: string; public: string }
    try {
      // ssh2 v1.x supports ed25519 + rsa/ecdsa/dsa. We expose only the two
      // sane defaults for a desktop UI; passphrase encrypts the private file.
      const opts: { bits?: number; passphrase?: string; comment?: string } = {}
      if (req.passphrase) opts.passphrase = req.passphrase
      if (req.comment) opts.comment = req.comment
      if (req.type === 'rsa-4096') {
        opts.bits = 4096
        // sshUtils types are loose; cast for the call.
        pair = (sshUtils as unknown as {
          generateKeyPairSync: (t: string, o: typeof opts) => { private: string; public: string }
        }).generateKeyPairSync('rsa', opts)
      } else {
        pair = (sshUtils as unknown as {
          generateKeyPairSync: (t: string, o: typeof opts) => { private: string; public: string }
        }).generateKeyPairSync('ed25519', opts)
      }
    } catch (err) {
      return { ok: false, error: `keygen failed: ${(err as Error).message}` }
    }

    try {
      writeFileSync(privPath, pair.private + (pair.private.endsWith('\n') ? '' : '\n'), { mode: 0o600 })
      writeFileSync(pubPath, pair.public + (pair.public.endsWith('\n') ? '' : '\n'), { mode: 0o644 })
      // writeFileSync's mode is umask-affected on some platforms — pin it explicitly.
      try { chmodSync(privPath, 0o600); chmodSync(pubPath, 0o644) } catch { /* best-effort */ }
    } catch (err) {
      return { ok: false, error: `failed to write key files: ${(err as Error).message}` }
    }

    const key: KeyFile = { name: safe, path: privPath, hasPublic: true }
    return { ok: true, key }
  })
}
