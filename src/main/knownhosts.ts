import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createHash } from 'crypto'
import type { KnownHost, KeyFile } from '../shared/types'

const dir = app.getPath('userData')
const file = join(dir, 'known_hosts.json')

export function listKnownHosts(): KnownHost[] {
  try {
    if (!existsSync(file)) return []
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return []
  }
}

function save(list: KnownHost[]): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(list, null, 2), 'utf8')
}

/** OpenSSH-style SHA256 fingerprint of a host key buffer. */
export function fingerprintOf(key: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
}

export type VerifyResult = 'ok' | 'new' | 'changed'

/**
 * Trust-on-first-use verification. Returns 'ok' if the key matches a stored
 * one, 'new' if unseen (and stores it), or 'changed' if it differs from what
 * we trusted before (caller must reject — possible MITM).
 */
export function verifyAndRecord(host: string, port: number, algo: string, key: Buffer): VerifyResult {
  const id = `${host}:${port}`
  const fp = fingerprintOf(key)
  const list = listKnownHosts()
  const existing = list.find((k) => k.id === id)
  if (!existing) {
    list.push({ id, algo, fingerprint: fp, addedAt: Date.now() })
    save(list)
    return 'new'
  }
  if (existing.fingerprint !== fp) return 'changed'
  return 'ok'
}

export function deleteKnownHost(id: string): KnownHost[] {
  const list = listKnownHosts().filter((k) => k.id !== id)
  save(list)
  return list
}

/** Discover private keys in ~/.ssh for the Keychain section. */
export function listSshKeys(): KeyFile[] {
  const sshDir = join(homedir(), '.ssh')
  try {
    const files = readdirSync(sshDir)
    const skip = new Set(['known_hosts', 'known_hosts.old', 'config', 'authorized_keys'])
    return files
      .filter((f) => !f.endsWith('.pub') && !skip.has(f))
      .map((f) => ({
        name: f,
        path: join(sshDir, f),
        hasPublic: files.includes(`${f}.pub`)
      }))
  } catch {
    return []
  }
}
