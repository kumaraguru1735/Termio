import { ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { connect as netConnect, type Socket } from 'net'
import { homedir } from 'os'
import * as pty from 'node-pty'
import { IPC } from '../shared/types'

/** A non-SSH terminal transport: local shell, telnet, or mosh. */
interface TermSession {
  write(data: string): void
  resize(cols: number, rows: number): void
  close(): void
}

const sessions = new Map<string, TermSession>()

export function closeAllTerminals(): void {
  for (const s of sessions.values()) s.close()
  sessions.clear()
}

function emit(wc: WebContents, id: string, data: string): void {
  if (!wc.isDestroyed()) wc.send(IPC.sshData(id), data)
}
function emitClosed(wc: WebContents, id: string): void {
  sessions.delete(id)
  if (!wc.isDestroyed()) wc.send(IPC.sshClosed(id))
}

/** Spawn a process under a real PTY (local shell, or a wrapper like mosh). */
function spawnPty(
  wc: WebContents,
  file: string,
  args: string[],
  cwd: string
): { ok: true; sessionId: string } {
  const sessionId = randomUUID()
  const term = pty.spawn(file, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' }
  })
  term.onData((d) => emit(wc, sessionId, d))
  term.onExit(() => emitClosed(wc, sessionId))
  sessions.set(sessionId, {
    write: (data) => term.write(data),
    resize: (cols, rows) => {
      try {
        term.resize(Math.max(1, cols), Math.max(1, rows))
      } catch {
        /* pty already gone */
      }
    },
    close: () => term.kill()
  })
  return { ok: true, sessionId }
}

/** Minimal Telnet client: strips/answers IAC negotiation, passes data through. */
function openTelnet(wc: WebContents, host: string, port: number): { ok: true; sessionId: string } {
  const sessionId = randomUUID()
  const sock: Socket = netConnect(port || 23, host)
  const IAC = 255, DO = 253, DONT = 254, WILL = 251, WONT = 252, SB = 250, SE = 240
  // Refuse every option the server offers; this gives a plain line-mode session
  // that works for switches/routers/BBSes without full option support.
  const reply = (cmd: number, opt: number): void => {
    const ans = cmd === DO ? WONT : cmd === WILL ? DONT : 0
    if (ans) sock.write(Buffer.from([IAC, ans, opt]))
  }
  sock.on('data', (buf: Buffer) => {
    const out: number[] = []
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === IAC) {
        const cmd = buf[++i]
        if (cmd === SB) {
          while (i < buf.length && !(buf[i] === IAC && buf[i + 1] === SE)) i++
          i++
        } else if (cmd === DO || cmd === DONT || cmd === WILL || cmd === WONT) {
          reply(cmd, buf[++i])
        }
      } else {
        out.push(buf[i])
      }
    }
    if (out.length) emit(wc, sessionId, Buffer.from(out).toString('utf8'))
  })
  sock.on('connect', () => emit(wc, sessionId, `\x1b[90m[telnet connected to ${host}:${port || 23}]\x1b[0m\r\n`))
  sock.on('error', (err) => emit(wc, sessionId, `\r\n\x1b[31m[telnet error: ${err.message}]\x1b[0m\r\n`))
  sock.on('close', () => emitClosed(wc, sessionId))
  sessions.set(sessionId, {
    write: (data) => sock.write(data),
    resize: () => {},
    close: () => sock.destroy()
  })
  return { ok: true, sessionId }
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC.termOpenLocal, (e) => {
    const shell = process.env.SHELL || '/bin/bash'
    return spawnPty(e.sender, shell, [], homedir())
  })

  ipcMain.handle(IPC.termOpenTelnet, (e, host: string, port: number) =>
    openTelnet(e.sender, host, port)
  )

  ipcMain.handle(IPC.termOpenMosh, (e, target: string, extra: string[]) => {
    // Run the system `mosh` wrapper inside a PTY; it handles its own SSH
    // bootstrap + UDP. Requires `mosh` to be installed on this machine.
    return spawnPty(e.sender, 'mosh', [...(extra ?? []), target], homedir())
  })

  ipcMain.on(IPC.termWrite, (_e, id: string, data: string) => sessions.get(id)?.write(data))
  ipcMain.on(IPC.termResize, (_e, id: string, cols: number, rows: number) =>
    sessions.get(id)?.resize(cols, rows)
  )
  ipcMain.on(IPC.termClose, (_e, id: string) => {
    const s = sessions.get(id)
    if (s) {
      s.close()
      sessions.delete(id)
    }
  })
}
