import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { HostConfig } from '../../../shared/types'
import { getActiveTheme } from '../themes'
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

    term.writeln(`\x1b[90mConnecting to ${host.username}@${host.host}:${host.port} …\x1b[0m`)
    onStatusRef.current('connecting')

    let disposed = false
    let unsubData: (() => void) | undefined
    let unsubClosed: (() => void) | undefined

    ;(async () => {
      const res = await window.api.ssh.connect(host)
      if (disposed) {
        if (res.ok && res.sessionId) window.api.ssh.close(res.sessionId)
        return
      }
      if (!res.ok || !res.sessionId) {
        term.writeln(`\r\n\x1b[31m[connection failed: ${res.error ?? 'unknown error'}]\x1b[0m`)
        onStatusRef.current('closed')
        return
      }
      const id = res.sessionId
      sessionIdRef.current = id
      onStatusRef.current('connected')
      onSessionRef.current?.(id)

      unsubData = window.api.ssh.onData(id, (d) => term.write(d))
      unsubClosed = window.api.ssh.onClosed(id, () => {
        onStatusRef.current('closed')
        onSessionRef.current?.(null)
        term.writeln('\r\n\x1b[33m[session closed]\x1b[0m')
      })
      term.onData((d) => window.api.ssh.write(id, d))
      window.api.ssh.resize(id, term.cols, term.rows)
    })()

    const syncSize = (): void => {
      safeFit(fit)
      if (sessionIdRef.current) window.api.ssh.resize(sessionIdRef.current, term.cols, term.rows)
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(containerRef.current!)
    window.addEventListener('resize', syncSize)

    return () => {
      disposed = true
      ro.disconnect()
      containerEl.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('resize', syncSize)
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
      termRef.current?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [active])

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
