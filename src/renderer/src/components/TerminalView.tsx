import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { HostConfig } from '../../../shared/types'
import { getActiveTheme, THEME_EVENT } from '../themes'
import { IconSplit, IconCross } from './icons'

export type TabStatus = 'pending' | 'connecting' | 'connected' | 'closed'

interface Props {
  host: HostConfig
  active: boolean
  onStatus: (status: TabStatus) => void
  /** Reports the live SSH session id once connected (null when it closes). */
  onSession?: (sessionId: string | null) => void
  /** When provided, renders a "split" overlay button that calls this. */
  onSplit?: () => void
  /** When provided, renders a "close pane" overlay button that calls this. */
  onClosePane?: () => void
}

/**
 * Mounts an xterm.js terminal, opens an SSH session in the main process,
 * and bridges keystrokes/output/resize over IPC. Stays mounted while
 * inactive so scrollback survives tab switches.
 */
export default function TerminalView({ host, active, onStatus, onSession, onSplit, onClosePane }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  /** Set by the connection effect; returns true when a reconnect was started. */
  const reconnectRef = useRef<() => boolean>(() => false)
  /** Retry the connection with a freshly typed secret. Set by the effect. */
  const retryAuthRef = useRef<(secret: string, kind: 'password' | 'passphrase') => void>(() => {})
  /** When set, the pane shows an inline credential prompt. */
  const [authPrompt, setAuthPrompt] = useState<{
    message: string
    kind: 'password' | 'passphrase'
  } | null>(null)
  const [authDraft, setAuthDraft] = useState('')

  // Keep latest callbacks without re-running the setup effect.
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus
  const onSessionRef = useRef(onSession)
  onSessionRef.current = onSession

  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'Menlo, "DejaVu Sans Mono", "Ubuntu Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: getActiveTheme(),
      allowProposedApi: true,
      // Right-click positions the cursor only via our handler; let a normal
      // selection happen even while an app (tmux/vim) has mouse tracking on by
      // holding the platform modifier (Alt on mac, Shift elsewhere).
      macOptionClickForcesSelection: true
    })

    const copySelection = (): boolean => {
      const sel = term.getSelection()
      if (!sel) return false
      window.api.clipboard.writeText(sel)
      term.clearSelection()
      return true
    }
    const paste = (): void => {
      const text = window.api.clipboard.readText()
      if (!text) return
      // Route through xterm so bracketed-paste mode is honoured: when the
      // remote app (tmux, vim, shells) has it enabled, the text is wrapped in
      // the paste escape markers and won't be auto-indented or interpreted as
      // typed input. Falls back to a raw write for the rare non-bracketed case.
      term.paste(text)
    }

    // OSC 52 clipboard bridge. Lets tmux copy-mode / vim / any remote program
    // read and write the system clipboard (tmux: `set -g set-clipboard on`).
    term.parser.registerOscHandler(52, (payload) => {
      const semi = payload.indexOf(';')
      if (semi === -1) return true
      const data = payload.slice(semi + 1)
      if (data === '?') {
        // Remote asks for the clipboard — answer with an OSC 52 of our own.
        const cur = window.api.clipboard.readText()
        if (sessionIdRef.current) {
          window.api.ssh.write(sessionIdRef.current, `\x1b]52;c;${b64Encode(cur)}\x07`)
        }
        return true
      }
      const text = b64Decode(data)
      if (text != null) window.api.clipboard.writeText(text)
      return true
    })

    // Copy-on-select: as soon as a selection is made (e.g. Shift+drag over
    // tmux's mouse mode) it lands in the system clipboard — no keypress needed.
    term.onSelectionChange(() => {
      const sel = term.getSelection()
      if (sel) window.api.clipboard.writeText(sel)
    })

    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type !== 'keydown') return true
      const key = ev.key.toLowerCase()
      const ctrlOrMeta = ev.ctrlKey || ev.metaKey

      // Copy. Ctrl/⌘+C copies only when text is selected, otherwise it must
      // fall through so the terminal still sends ^C (interrupt). Ctrl+Shift+C
      // and ⌘C always copy.
      if (ctrlOrMeta && key === 'c') {
        const wantCopy = ev.shiftKey || ev.metaKey || term.hasSelection()
        if (wantCopy && copySelection()) {
          ev.preventDefault()
          return false
        }
        return true // nothing selected → let ^C through
      }
      // Paste: Ctrl+V, Ctrl+Shift+V, ⌘V.
      if (ctrlOrMeta && key === 'v') {
        ev.preventDefault()
        paste()
        return false
      }
      // Enter on a closed session = quick reconnect.
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !sessionIdRef.current) {
        if (reconnectRef.current()) {
          ev.preventDefault()
          return false
        }
      }
      // Per-host backspace mode: 'ctrl-h' sends ^H instead of the default ^?.
      if (
        host.backspace === 'ctrl-h' &&
        ev.key === 'Backspace' &&
        !ev.ctrlKey &&
        !ev.altKey &&
        !ev.metaKey
      ) {
        if (sessionIdRef.current) window.api.ssh.write(sessionIdRef.current, '\x08')
        return false
      }
      return true
    })

    // Right-click: copy selection if present, otherwise paste.
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      if (!copySelection()) paste()
    }
    const containerEl = containerRef.current!
    containerEl.addEventListener('contextmenu', onContextMenu)
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current!)
    safeFit(fit)
    termRef.current = term
    fitRef.current = fit

    onStatusRef.current('connecting')

    let disposed = false
    let connecting = false
    let hadConnected = false
    let attempts = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let unsubData: (() => void) | undefined
    let unsubClosed: (() => void) | undefined

    // Registered once — writes to whichever session is current, so a
    // reconnect never double-sends keystrokes.
    term.onData((d) => {
      if (sessionIdRef.current) window.api.ssh.write(sessionIdRef.current, d)
    })

    const autoReconnect = host.autoReconnect !== false
    const RETRY_DELAYS = [2000, 4000, 8000, 15000, 30000]

    // A correct secret typed after an auth failure is reused for the rest of
    // this terminal's life (so reconnects don't ask again).
    let credOverride: { secret: string; kind: 'password' | 'passphrase' } | null = null
    const hostFor = (): HostConfig => {
      if (!credOverride) return host
      const base = { ...host, identityId: undefined }
      return credOverride.kind === 'passphrase'
        ? { ...base, passphrase: credOverride.secret }
        : { ...base, authType: 'password', password: credOverride.secret }
    }

    const scheduleReconnect = (): void => {
      if (disposed || !autoReconnect || !hadConnected) return
      if (!navigator.onLine) {
        // No point retrying into a dead network — the 'online' listener
        // below reconnects the moment the internet returns.
        term.writeln('\x1b[90m[offline — will reconnect when the network returns]\x1b[0m')
        return
      }
      if (attempts >= RETRY_DELAYS.length) {
        term.writeln('\x1b[90m[gave up — press Enter to reconnect]\x1b[0m')
        return
      }
      const delay = RETRY_DELAYS[attempts++]
      term.writeln(`\x1b[90m[reconnecting in ${Math.round(delay / 1000)}s — attempt ${attempts}]\x1b[0m`)
      retryTimer = setTimeout(() => void openSession(), delay)
    }

    const openSession = async (): Promise<void> => {
      if (disposed || connecting || sessionIdRef.current) return
      connecting = true
      setAuthPrompt(null)
      onStatusRef.current('connecting')
      term.writeln(`\x1b[90mConnecting to ${host.username}@${host.host}:${host.port} …\x1b[0m`)
      const res = await window.api.ssh.connect(hostFor())
      connecting = false
      if (disposed) {
        if (res.ok && res.sessionId) window.api.ssh.close(res.sessionId)
        return
      }
      if (!res.ok || !res.sessionId) {
        const err = res.error ?? 'unknown error'
        term.writeln(`\r\n\x1b[31m[connection failed: ${err}]\x1b[0m`)
        onStatusRef.current('closed')
        // Authentication failure → ask the user for the secret and retry,
        // rather than silently re-trying the same wrong one.
        if (/auth|password|passphrase|permission denied/i.test(err)) {
          const kind = /passphrase/i.test(err) ? 'passphrase' : 'password'
          term.writeln(`\x1b[90m[wrong ${kind} — enter it below to try again]\x1b[0m`)
          setAuthPrompt({ message: err, kind })
          return
        }
        if (autoReconnect && hadConnected) scheduleReconnect()
        else term.writeln('\x1b[90m[press Enter to retry]\x1b[0m')
        return
      }
      const id = res.sessionId
      sessionIdRef.current = id
      hadConnected = true
      attempts = 0
      onStatusRef.current('connected')
      onSessionRef.current?.(id)

      unsubData = window.api.ssh.onData(id, (d) => term.write(d))
      unsubClosed = window.api.ssh.onClosed(id, () => {
        unsubData?.()
        unsubClosed?.()
        sessionIdRef.current = null
        onStatusRef.current('closed')
        onSessionRef.current?.(null)
        term.writeln('\r\n\x1b[33m[session closed]\x1b[0m')
        if (autoReconnect) scheduleReconnect()
        else term.writeln('\x1b[90m[press Enter to reconnect]\x1b[0m')
      })
      window.api.ssh.resize(id, term.cols, term.rows)
    }

    void openSession()

    // The moment the internet comes back, reconnect immediately.
    const onOnline = (): void => {
      if (disposed || sessionIdRef.current || connecting) return
      if (!autoReconnect || !hadConnected) return
      attempts = 0
      if (retryTimer) clearTimeout(retryTimer)
      term.writeln('\x1b[90m[network restored]\x1b[0m')
      void openSession()
    }
    window.addEventListener('online', onOnline)

    // Manual reconnect with Enter once the session is closed.
    reconnectRef.current = () => {
      if (sessionIdRef.current || connecting || disposed) return false
      attempts = 0
      if (retryTimer) clearTimeout(retryTimer)
      void openSession()
      return true
    }

    // Called by the inline credential prompt with the freshly typed secret.
    retryAuthRef.current = (secret, kind) => {
      if (disposed || connecting || sessionIdRef.current || !secret) return
      credOverride = { secret, kind }
      attempts = 0
      void openSession()
    }

    // Live theme switching for already-open terminals.
    const onTheme = (): void => {
      term.options.theme = getActiveTheme()
    }
    window.addEventListener(THEME_EVENT, onTheme)

    const syncSize = (): void => {
      safeFit(fit)
      if (sessionIdRef.current) window.api.ssh.resize(sessionIdRef.current, term.cols, term.rows)
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(containerRef.current!)
    window.addEventListener('resize', syncSize)

    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      ro.disconnect()
      containerEl.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('resize', syncSize)
      window.removeEventListener('online', onOnline)
      window.removeEventListener(THEME_EVENT, onTheme)
      unsubData?.()
      unsubClosed?.()
      onSessionRef.current?.(null)
      if (sessionIdRef.current) window.api.ssh.close(sessionIdRef.current)
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refit and focus when this tab becomes active.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => {
      if (fitRef.current) safeFit(fitRef.current)
      if (!authPrompt) termRef.current?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [active, authPrompt])

  return (
    <div className={`term-pane${active ? '' : ' hidden'}`}>
      <div className="term-host" ref={containerRef} />
      {(onSplit || onClosePane) && (
        <div className="pane-overlay">
          {onSplit && (
            <button className="pane-btn" title="Split right" onClick={onSplit}>
              <IconSplit />
            </button>
          )}
          {onClosePane && (
            <button className="pane-btn" title="Close pane" onClick={onClosePane}>
              <IconCross />
            </button>
          )}
        </div>
      )}

      {authPrompt && (
        <form
          className="auth-prompt"
          onSubmit={(e) => {
            e.preventDefault()
            const secret = authDraft
            setAuthDraft('')
            retryAuthRef.current(secret, authPrompt.kind)
          }}
        >
          <div className="auth-title">
            {authPrompt.kind === 'passphrase' ? 'Key passphrase' : 'Password'} for{' '}
            <b>{host.username}@{host.host}</b>
          </div>
          <input
            type="password"
            autoFocus
            placeholder={authPrompt.kind === 'passphrase' ? 'Key passphrase' : 'Password'}
            value={authDraft}
            onChange={(e) => setAuthDraft(e.target.value)}
          />
          <button type="submit" className="btn primary sm" disabled={!authDraft}>
            Connect
          </button>
        </form>
      )}
    </div>
  )
}

function safeFit(fit: FitAddon): void {
  try {
    fit.fit()
  } catch {
    /* container not laid out yet */
  }
}

/** UTF-8 → base64 (for OSC 52 clipboard writes back to the remote). */
function b64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** base64 → UTF-8, or null if the payload is malformed. */
function b64Decode(b64: string): string | null {
  try {
    const bin = atob(b64.trim())
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
  } catch {
    return null
  }
}
