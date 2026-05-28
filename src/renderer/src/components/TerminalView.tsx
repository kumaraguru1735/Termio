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
      allowProposedApi: true
    })

    // Per-host backspace mode: 'ctrl-h' sends ^H instead of the default ^?.
    if (host.backspace === 'ctrl-h') {
      term.attachCustomKeyEventHandler((ev) => {
        if (ev.type === 'keydown' && ev.key === 'Backspace' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
          if (sessionIdRef.current) window.api.ssh.write(sessionIdRef.current, '\x08')
          return false
        }
        return true
      })
    }
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
