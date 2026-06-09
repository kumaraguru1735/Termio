import { useCallback, useEffect, useRef, useState } from 'react'
import TerminalView, { type TabStatus } from './TerminalView'
import type { HostConfig } from '../../../shared/types'

interface Props {
  host: HostConfig
  active: boolean
  paneIds: string[]
  /** Status of the primary pane bubbles up to the tab. */
  onStatus: (status: TabStatus) => void
  onSession?: (sessionId: string | null) => void
  onSplit: () => void
  onClosePane: (paneId: string) => void
}

/**
 * Renders one or two terminal panes for the same host. With two panes,
 * a draggable splitter sets the left-pane width as a percentage of the
 * container. Each pane is an independent SSH session.
 */
export default function SplitTerminal({
  host,
  active,
  paneIds,
  onStatus,
  onSession,
  onSplit,
  onClosePane
}: Props): JSX.Element {
  const [leftPct, setLeftPct] = useState(50)
  const [broadcast, setBroadcast] = useState(false)
  const broadcastRef = useRef(false)
  broadcastRef.current = broadcast
  const busRef = useRef<EventTarget>(new EventTarget())
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startPct: number; width: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return
    const width = containerRef.current.getBoundingClientRect().width
    dragRef.current = { startX: e.clientX, startPct: leftPct, width }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }, [leftPct])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const next = Math.max(15, Math.min(85, d.startPct + (dx / d.width) * 100))
    setLeftPct(next)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }, [])

  // When the panel layout changes, nudge a window resize so all xterm instances
  // re-fit on the new widths (TerminalView listens for window resize).
  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [leftPct, paneIds.length])

  if (paneIds.length === 1) {
    return (
      <TerminalView
        host={host}
        active={active}
        onStatus={onStatus}
        onSession={onSession}
        onSplit={onSplit}
      />
    )
  }

  // 2-pane layout. First pane reports status/session up; second pane is independent.
  const [a, b] = paneIds
  return (
    <div className={`split-row${active ? '' : ' hidden'}`} ref={containerRef}>
      <button
        className={`bcast-toggle${broadcast ? ' on' : ''}`}
        title="Broadcast typing to both panes"
        onClick={() => setBroadcast((v) => !v)}
      >
        ⌨ Broadcast {broadcast ? 'on' : 'off'}
      </button>
      <div className="split-pane" style={{ flex: `${leftPct} 1 0` }}>
        <TerminalView
          key={a}
          host={host}
          active={active}
          onStatus={onStatus}
          onSession={onSession}
          onClosePane={() => onClosePane(a)}
          bus={busRef.current}
          broadcastRef={broadcastRef}
        />
      </div>
      <div
        className="split-gutter"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag to resize"
      />
      <div className="split-pane" style={{ flex: `${100 - leftPct} 1 0` }}>
        <TerminalView
          key={b}
          host={host}
          active={active}
          // Status/session reporting from the secondary pane is dropped — the
          // tab's status reflects the primary pane only (simpler model for v1).
          onStatus={() => {}}
          onClosePane={() => onClosePane(b)}
          bus={busRef.current}
          broadcastRef={broadcastRef}
        />
      </div>
    </div>
  )
}
