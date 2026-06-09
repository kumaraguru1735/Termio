import { ipcMain } from 'electron'
import { createServer, connect as netConnect, type Server, type Socket } from 'net'
import type { Client } from 'ssh2'
import { IPC, type HostConfig, type PortForward, type SftpResult } from '../shared/types'
import { readJson, writeJson } from './jsonstore'
import { loadHosts } from './store'
import { establishConnection } from './ssh-common'

const FILE = 'forwards.json'

interface Active {
  client: Client
  /** Local listener for -L and -D; absent for -R. */
  server?: Server
}
const active = new Map<string, Active>()

function listRules(): PortForward[] {
  return readJson<PortForward[]>(FILE, [])
}

function stop(id: string): void {
  const a = active.get(id)
  if (a) {
    a.server?.close()
    a.client.end()
    active.delete(id)
  }
}

/** -L: local listener piped to destHost:destPort through the server. */
function startLocal(rule: PortForward, client: Client): Promise<SftpResult> {
  return new Promise<SftpResult>((resolve) => {
    const server = createServer((socket) => {
      client.forwardOut('127.0.0.1', socket.remotePort ?? 0, rule.destHost, rule.destPort, (err, stream) => {
        if (err) return void socket.destroy()
        socket.pipe(stream).pipe(socket)
      })
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

/** -R: server listens on bindPort; each connection pipes to destHost:destPort here. */
function startRemote(rule: PortForward, client: Client): Promise<SftpResult> {
  return new Promise<SftpResult>((resolve) => {
    client.on('tcp connection', (_info, accept) => {
      const stream = accept()
      const local = netConnect(rule.destPort, rule.destHost || '127.0.0.1')
      local.on('error', () => stream.end())
      stream.on('error', () => local.destroy())
      stream.pipe(local).pipe(stream)
    })
    client.forwardIn('127.0.0.1', rule.bindPort, (err) => {
      if (err) {
        client.end()
        return resolve({ ok: false, error: err.message })
      }
      active.set(rule.id, { client })
      resolve({ ok: true })
    })
  })
}

/** -D: minimal SOCKS5 server on bindPort, each CONNECT forwarded via the tunnel. */
function startDynamic(rule: PortForward, client: Client): Promise<SftpResult> {
  return new Promise<SftpResult>((resolve) => {
    const server = createServer((socket) => handleSocks(socket, client))
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

/** Speak just enough SOCKS5 (no auth, CONNECT) to tunnel a browser/app. */
function handleSocks(socket: Socket, client: Client): void {
  socket.once('data', (greeting: Buffer) => {
    if (greeting[0] !== 0x05) return void socket.destroy()
    socket.write(Buffer.from([0x05, 0x00])) // no-auth
    socket.once('data', (req: Buffer) => {
      if (req[0] !== 0x05 || req[1] !== 0x01) return void socket.destroy() // CONNECT only
      const atyp = req[3]
      let host: string
      let off: number
      if (atyp === 0x01) {
        host = `${req[4]}.${req[5]}.${req[6]}.${req[7]}`
        off = 8
      } else if (atyp === 0x03) {
        const len = req[4]
        host = req.slice(5, 5 + len).toString('ascii')
        off = 5 + len
      } else {
        return void socket.destroy() // IPv6 unsupported
      }
      const port = req.readUInt16BE(off)
      client.forwardOut('127.0.0.1', socket.remotePort ?? 0, host, port, (err, stream) => {
        // Reply: succeeded/failure, bound addr 0.0.0.0:0
        const reply = Buffer.from([0x05, err ? 0x05 : 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
        socket.write(reply)
        if (err) return void socket.destroy()
        socket.pipe(stream).pipe(socket)
      })
    })
  })
  socket.on('error', () => socket.destroy())
}

/** Open the SSH tunnel and the listener/forward appropriate to the rule kind. */
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

  const kind = rule.kind ?? 'local'
  if (kind === 'remote') return startRemote(rule, client)
  if (kind === 'dynamic') return startDynamic(rule, client)
  return startLocal(rule, client)
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
