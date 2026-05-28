import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { HostConfig } from '../shared/types'

/**
 * Local-first host store. Persists to userData/hosts.dat, encrypted with
 * Electron safeStorage (OS keyring on Linux/macOS, DPAPI on Windows) when
 * available, falling back to plaintext JSON otherwise (dev / no keyring).
 *
 * This is the deliberate anti-Termius: data lives on disk, owned by the user,
 * and survives restarts/updates — nothing is held only in memory or behind a
 * paywalled cloud.
 */

const dir = app.getPath('userData')
const file = join(dir, 'hosts.dat')

function ensureDir(): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function loadHosts(): HostConfig[] {
  try {
    if (!existsSync(file)) return []
    const raw = readFileSync(file)
    let json: string
    if (safeStorage.isEncryptionAvailable() && !raw.slice(0, 1).equals(Buffer.from('['))) {
      json = safeStorage.decryptString(raw)
    } else {
      json = raw.toString('utf8')
    }
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[store] failed to load hosts:', err)
    return []
  }
}

export function saveHosts(hosts: HostConfig[]): void {
  ensureDir()
  const json = JSON.stringify(hosts, null, 2)
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(file, safeStorage.encryptString(json))
  } else {
    writeFileSync(file, json, 'utf8')
  }
}

export function upsertHost(host: HostConfig): HostConfig[] {
  const hosts = loadHosts()
  const i = hosts.findIndex((h) => h.id === host.id)
  if (i >= 0) hosts[i] = host
  else hosts.push(host)
  saveHosts(hosts)
  return hosts
}

export function deleteHost(id: string): HostConfig[] {
  const hosts = loadHosts().filter((h) => h.id !== id)
  saveHosts(hosts)
  return hosts
}
