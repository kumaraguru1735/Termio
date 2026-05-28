import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join, posix } from 'path'
import { Client, type SFTPWrapper } from 'ssh2'
import {
  IPC,
  type HostConfig,
  type FileEntry,
  type DirListing,
  type SftpResult,
  type SshConnectResult
} from '../shared/types'
import { establishConnection } from './ssh-common'
import { loadHosts } from './store'

interface SftpSession {
  client: Client
  sftp: SFTPWrapper
}
const sessions = new Map<string, SftpSession>()

export function closeAllSftp(): void {
  for (const s of sessions.values()) s.client.end()
  sessions.clear()
}

function typeOf(mode: number): FileEntry['type'] {
  // POSIX file-type bits.
  const fmt = mode & 0o170000
  if (fmt === 0o040000) return 'dir'
  if (fmt === 0o120000) return 'link'
  return 'file'
}

export function registerSftpHandlers(): void {
  ipcMain.handle(IPC.sftpConnect, async (_e, cfg: HostConfig): Promise<SshConnectResult> => {
    const sessionId = randomUUID()
    const getHostById = (id: string): HostConfig | undefined => loadHosts().find((h) => h.id === id)
    let client: Client
    try {
      client = await establishConnection(cfg, getHostById)
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    return new Promise<SshConnectResult>((resolve) => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          return resolve({ ok: false, error: err.message })
        }
        sessions.set(sessionId, { client, sftp })
        client.once('close', () => sessions.delete(sessionId))
        resolve({ ok: true, sessionId })
      })
    })
  })

  ipcMain.handle(IPC.sftpList, async (_e, sessionId: string, path: string): Promise<DirListing> => {
    const s = sessions.get(sessionId)
    if (!s) return { ok: false, path, entries: [], error: 'session not found' }
    return new Promise<DirListing>((resolve) => {
      // Resolve '.' / relative paths to an absolute one first.
      s.sftp.realpath(path || '.', (rerr, abs) => {
        const target = rerr ? path || '.' : abs
        s.sftp.readdir(target, (err, list) => {
          if (err) return resolve({ ok: false, path: target, entries: [], error: err.message })
          const entries: FileEntry[] = list
            .map((item) => ({
              name: item.filename,
              type: typeOf(item.attrs.mode),
              size: item.attrs.size,
              modified: item.attrs.mtime * 1000
            }))
            .sort((a, b) => {
              if (a.type === 'dir' && b.type !== 'dir') return -1
              if (a.type !== 'dir' && b.type === 'dir') return 1
              return a.name.localeCompare(b.name)
            })
          resolve({ ok: true, path: target, entries })
        })
      })
    })
  })

  ipcMain.handle(
    IPC.sftpDownload,
    async (_e, sessionId: string, remotePath: string, localPath: string): Promise<SftpResult> => {
      const s = sessions.get(sessionId)
      if (!s) return { ok: false, error: 'session not found' }
      return new Promise<SftpResult>((resolve) => {
        s.sftp.fastGet(remotePath, localPath, (err) =>
          resolve(err ? { ok: false, error: err.message } : { ok: true })
        )
      })
    }
  )

  ipcMain.handle(
    IPC.sftpUpload,
    async (_e, sessionId: string, localPath: string, remotePath: string): Promise<SftpResult> => {
      const s = sessions.get(sessionId)
      if (!s) return { ok: false, error: 'session not found' }
      return new Promise<SftpResult>((resolve) => {
        s.sftp.fastPut(localPath, remotePath, (err) =>
          resolve(err ? { ok: false, error: err.message } : { ok: true })
        )
      })
    }
  )

  ipcMain.handle(IPC.sftpMkdir, async (_e, sessionId: string, path: string): Promise<SftpResult> => {
    const s = sessions.get(sessionId)
    if (!s) return { ok: false, error: 'session not found' }
    return new Promise<SftpResult>((resolve) => {
      s.sftp.mkdir(path, (err) => resolve(err ? { ok: false, error: err.message } : { ok: true }))
    })
  })

  ipcMain.handle(
    IPC.sftpDelete,
    async (_e, sessionId: string, path: string, isDir: boolean): Promise<SftpResult> => {
      const s = sessions.get(sessionId)
      if (!s) return { ok: false, error: 'session not found' }
      return new Promise<SftpResult>((resolve) => {
        const cb = (err: Error | null | undefined): void =>
          resolve(err ? { ok: false, error: err.message } : { ok: true })
        if (isDir) s.sftp.rmdir(path, cb)
        else s.sftp.unlink(path, cb)
      })
    }
  )

  ipcMain.handle(
    IPC.sftpRename,
    async (_e, sessionId: string, from: string, to: string): Promise<SftpResult> => {
      const s = sessions.get(sessionId)
      if (!s) return { ok: false, error: 'session not found' }
      return new Promise<SftpResult>((resolve) => {
        s.sftp.rename(from, to, (err) =>
          resolve(err ? { ok: false, error: err.message } : { ok: true })
        )
      })
    }
  )

  ipcMain.handle(IPC.sftpClose, (_e, sessionId: string): void => {
    sessions.get(sessionId)?.client.end()
    sessions.delete(sessionId)
  })

  // ---- Local filesystem (for the SFTP local pane) ----
  ipcMain.handle(IPC.localHome, (): string => homedir())

  ipcMain.handle(IPC.localList, (_e, path: string): DirListing => {
    try {
      const names = readdirSync(path)
      const entries: FileEntry[] = names
        .map((name) => {
          try {
            const st = statSync(join(path, name))
            return {
              name,
              type: (st.isDirectory() ? 'dir' : st.isSymbolicLink() ? 'link' : 'file') as FileEntry['type'],
              size: st.size,
              modified: st.mtimeMs
            }
          } catch {
            return { name, type: 'file' as const, size: 0, modified: 0 }
          }
        })
        .sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1
          if (a.type !== 'dir' && b.type === 'dir') return 1
          return a.name.localeCompare(b.name)
        })
      return { ok: true, path, entries }
    } catch (err) {
      return { ok: false, path, entries: [], error: (err as Error).message }
    }
  })
}

/** Exposed for the renderer to build remote paths consistently (POSIX). */
export const remoteJoin = posix.join
