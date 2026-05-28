import { ipcMain } from 'electron'
import { createServer, type Server } from 'net'
import type { Client } from 'ssh2'
import { IPC, type HostConfig, type PortForward, type SftpResult } from '../shared/types'
import { readJson, writeJson } from './jsonstore'
import { loadHosts } from './store'
import { establishConnection } from './ssh-common'

const FILE = 'forwards.json'

interface Active {
  client: Client
  server: Server
}
const active = new Map<string, Active>()

function listRules(): PortForward[] {
  return readJson<PortForward[]>(FILE, [])
}

function stop(id: string): void {
  const a = active.get(id)
  if (a) {
    a.server.close()
    a.client.end()
    active.delete(id)
  }
}

/** Open the SSH tunnel and a local TCP listener that pipes through forwardOut. */
async function start(rule: PortForward): Promise<SftpResult> {
  const host = loadHosts().find((h) => h.id === rule.hostId)
  if (!host) return { ok: false, error: 'host for this forward no longer exists' }

  const getHostById = (id: string): HostConfig | undefined => loadHosts().find((h) => h.id === id)
  let client: Client
  try {
    client = await establishConnection(host, getHostById)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  return new Promise<SftpResult>((resolve) => {
    const server = createServer((socket) => {
      client.forwardOut(
        '127.0.0.1',
        socket.remotePort ?? 0,
        rule.destHost,
        rule.destPort,
        (err, stream) => {
          if (err) {
            socket.destroy()
            return
          }
          socket.pipe(stream).pipe(socket)
        }
      )
    })
    server.once('error', (err) => {
      client.end()
      resolve({ ok: false, error: err.message })
    })
    server.listen(rule.bindPort, '127.0.0.1', () => {
      active.set(rule.id, { client, server })
      resolve({ ok: true })
    })
  })
}

export function closeAllForwards(): void {
  for (const id of [...active.keys()]) stop(id)
}

export function registerPortForwardHandlers(): void {
  ipcMain.handle(IPC.pfList, (): PortForward[] => listRules())
  ipcMain.handle(IPC.pfActive, (): string[] => [...active.keys()])

  ipcMain.handle(IPC.pfSave, (_e, rule: PortForward): PortForward[] => {
    const rules = listRules()
    const i = rules.findIndex((r) => r.id === rule.id)
    if (i >= 0) rules[i] = rule
    else rules.push(rule)
    writeJson(FILE, rules)
    return rules
  })

  ipcMain.handle(IPC.pfDelete, (_e, id: string): PortForward[] => {
    stop(id)
    const rules = listRules().filter((r) => r.id !== id)
    writeJson(FILE, rules)
    return rules
  })

  ipcMain.handle(IPC.pfStart, (_e, id: string): Promise<SftpResult> => {
    const rule = listRules().find((r) => r.id === id)
    if (!rule) return Promise.resolve({ ok: false, error: 'rule not found' })
    if (active.has(id)) return Promise.resolve({ ok: true })
    return start(rule)
  })

  ipcMain.handle(IPC.pfStop, (_e, id: string): string[] => {
    stop(id)
    return [...active.keys()]
  })
}
