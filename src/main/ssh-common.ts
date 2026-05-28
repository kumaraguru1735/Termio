import { readFileSync } from 'fs'
import { connect as netConnect, type Socket } from 'net'
import { Client, type ConnectConfig } from 'ssh2'
import type { HostConfig } from '../shared/types'
import { verifyAndRecord } from './knownhosts'

/** Build ssh2 connect options from a stored host config. */
export function buildConnectConfig(cfg: HostConfig): ConnectConfig {
  const base: ConnectConfig = {
    host: cfg.host,
    port: cfg.port || 22,
    username: cfg.username,
    readyTimeout: 20000
  }
  if (cfg.authType === 'agent') {
    base.agent = process.env.SSH_AUTH_SOCK
  } else if (cfg.authType === 'key' && cfg.privateKeyPath) {
    base.privateKey = readFileSync(cfg.privateKeyPath)
    if (cfg.passphrase) base.passphrase = cfg.passphrase
  } else {
    base.password = cfg.password
  }
  // Agent forwarding piggy-backs on the local SSH agent.
  if (cfg.agentForward && process.env.SSH_AUTH_SOCK) {
    base.agent = base.agent ?? process.env.SSH_AUTH_SOCK
    base.agentForward = true
  }
  return base
}

export function makeHostVerifier(cfg: HostConfig): {
  verifier: (key: Buffer) => boolean
  changed: () => boolean
} {
  let changed = false
  return {
    changed: () => changed,
    verifier: (key: Buffer): boolean => {
      const result = verifyAndRecord(cfg.host, cfg.port || 22, 'host-key', key)
      if (result === 'changed') {
        changed = true
        return false
      }
      return true
    }
  }
}

export const HOST_KEY_CHANGED_MSG =
  'host key changed — possible MITM; refused (clear it under Known Hosts to re-trust)'

/**
 * Open a TCP socket to the target via a SOCKS5 proxy (no auth).
 * Used as the underlying `sock` for ssh2.connect when cfg.proxy is set.
 */
function socks5Connect(
  proxyHost: string,
  proxyPort: number,
  dstHost: string,
  dstPort: number
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = netConnect(proxyPort, proxyHost)
    const fail = (err: Error): void => { sock.destroy(); reject(err) }
    sock.on('error', fail)
    sock.once('connect', () => {
      // Greeting: VER=5, NMETHODS=1, METHOD=0 (no auth)
      sock.write(Buffer.from([0x05, 0x01, 0x00]))
      sock.once('data', (greet: Buffer) => {
        if (greet[0] !== 0x05 || greet[1] !== 0x00) return fail(new Error('SOCKS5 method rejected'))
        // CONNECT request: VER=5, CMD=1 (connect), RSV=0, ATYP=3 (domain), len, host, port
        const hostBuf = Buffer.from(dstHost, 'ascii')
        const req = Buffer.concat([
          Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
          hostBuf,
          Buffer.from([dstPort >> 8, dstPort & 0xff])
        ])
        sock.write(req)
        sock.once('data', (reply: Buffer) => {
          if (reply[0] !== 0x05 || reply[1] !== 0x00)
            return fail(new Error(`SOCKS5 CONNECT failed (code ${reply[1]})`))
          sock.removeListener('error', fail)
          resolve(sock)
        })
      })
    })
  })
}

/**
 * Establish an ssh2 connection, applying proxy and/or jump-host chaining if
 * configured. Returns the live, ready Client. Caller is responsible for
 * end()ing it when done.
 */
export async function establishConnection(
  cfg: HostConfig,
  getHostById: (id: string) => HostConfig | undefined
): Promise<Client> {
  let sock: Socket | undefined

  if (cfg.proxy && cfg.proxy.type === 'socks5' && cfg.proxy.host) {
    sock = await socks5Connect(cfg.proxy.host, cfg.proxy.port || 1080, cfg.host, cfg.port || 22)
  } else if (cfg.jumpHostId) {
    const jump = getHostById(cfg.jumpHostId)
    if (!jump) throw new Error('jump host not found in store')
    const jumpClient = await establishConnection(jump, getHostById)
    sock = await new Promise<Socket>((resolve, reject) => {
      jumpClient.forwardOut('127.0.0.1', 0, cfg.host, cfg.port || 22, (err, stream) => {
        if (err) return reject(err)
        // ssh2 ClientChannel is duplex; cast for ssh2.connect's sock option.
        resolve(stream as unknown as Socket)
      })
    })
    // Keep jumpClient alive for the tunnel lifetime; it ends when sock ends.
    sock.on('close', () => jumpClient.end())
  }

  const config = buildConnectConfig(cfg)
  if (sock) (config as ConnectConfig & { sock?: Socket }).sock = sock
  const hv = makeHostVerifier(cfg)
  config.hostVerifier = hv.verifier

  const client = new Client()
  return await new Promise<Client>((resolve, reject) => {
    let settled = false
    client
      .on('ready', () => {
        settled = true
        resolve(client)
      })
      .on('error', (err) => {
        if (settled) return
        settled = true
        reject(new Error(hv.changed() ? HOST_KEY_CHANGED_MSG : err.message))
      })
      .on('close', () => {
        if (!settled) {
          settled = true
          reject(new Error('connection closed before ready'))
        }
      })
      .connect(config)
  })
}
