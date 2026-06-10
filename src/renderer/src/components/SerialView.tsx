import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { getActiveTheme, getFontFamily, getFontSize, THEME_EVENT } from '../themes'
import type { TabStatus } from './TerminalView'

interface Props {
  active: boolean
  onStatus: (s: TabStatus) => void
}

const BAUDS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

/* eslint-disable @typescript-eslint/no-explicit-any */
const serial = (): any => (navigator as any).serial

/** Serial console over the Web Serial API (no native module). */
export default function SerialView({ active, onStatus }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const portRef = useRef<any>(null)
  const writerRef = useRef<any>(null)
  const readerRef = useRef<any>(null)
  const [baud, setBaud] = useState(115200)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = new Terminal({
      fontFamily: getFontFamily(),
      fontSize: getFontSize(),
      cursorBlink: true,
      theme: getActiveTheme(),
      convertEol: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current!)
    try { fit.fit() } catch { /* not laid out */ }
    termRef.current = term
    fitRef.current = fit
    term.writeln('\x1b[90mSerial console — pick a baud rate and Connect.\x1b[0m')
    onStatus('pending')

    term.onData((d) => {
      const w = writerRef.current
      if (w) void w.write(new TextEncoder().encode(d))
    })

    const onTheme = (): void => {
      term.options.theme = getActiveTheme()
      term.options.fontFamily = getFontFamily()
      term.options.fontSize = getFontSize()
      try { fit.fit() } catch { /* */ }
    }
    window.addEventListener(THEME_EVENT, onTheme)
    const onResize = (): void => { try { fit.fit() } catch { /* */ } }
    const ro = new ResizeObserver(onResize)
    ro.observe(containerRef.current!)
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener(THEME_EVENT, onTheme)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      void disconnect()
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (active) setTimeout(() => { try { fitRef.current?.fit() } catch { /* */ } finally { termRef.current?.focus() } }, 0)
  }, [active])

  const pump = async (): Promise<void> => {
    const port = portRef.current
    if (!port?.readable) return
    const reader = port.readable.getReader()
    readerRef.current = reader
    const dec = new TextDecoder()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) termRef.current?.write(dec.decode(value))
      }
    } catch {
      /* read loop ended (disconnect) */
    } finally {
      reader.releaseLock()
    }
  }

  const connect = async (): Promise<void> => {
    setError('')
    if (!serial()) return setError('Web Serial is not available in this build.')
    try {
      // Reuse a previously granted port, else prompt (handled by the app picker).
      const granted = await serial().getPorts()
      const port = granted[0] ?? (await serial().requestPort())
      await port.open({ baudRate: baud })
      portRef.current = port
      writerRef.current = port.writable.getWriter()
      setConnected(true)
      onStatus('connected')
      termRef.current?.writeln(`\x1b[90m[connected @ ${baud} baud]\x1b[0m`)
      termRef.current?.focus()
      void pump()
    } catch (e) {
      setError((e as Error).message)
      onStatus('closed')
    }
  }

  const disconnect = async (): Promise<void> => {
    try { await readerRef.current?.cancel() } catch { /* */ }
    try { writerRef.current?.releaseLock() } catch { /* */ }
    try { await portRef.current?.close() } catch { /* */ }
    readerRef.current = null
    writerRef.current = null
    portRef.current = null
    if (connected) termRef.current?.writeln('\r\n\x1b[33m[disconnected]\x1b[0m')
    setConnected(false)
    onStatus('closed')
  }

  return (
    <div className={`term-pane${active ? '' : ' hidden'}`}>
      <div className="serial-bar">
        <span>Baud</span>
        <select value={baud} onChange={(e) => setBaud(parseInt(e.target.value, 10))} disabled={connected}>
          {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {connected ? (
          <button className="btn sm danger-btn" onClick={() => void disconnect()}>Disconnect</button>
        ) : (
          <button className="btn sm primary" onClick={() => void connect()}>Connect…</button>
        )}
        {error && <span className="serial-err">{error}</span>}
      </div>
      <div className="serial-host" ref={containerRef} />
    </div>
  )
}
