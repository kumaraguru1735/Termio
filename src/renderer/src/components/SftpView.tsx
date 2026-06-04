import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { FileEntry, HostConfig } from '../../../shared/types'
import type { TabStatus } from './TerminalView'
import { IconFolder, IconChevronRight } from './icons'

interface Props {
  host: HostConfig
  active: boolean
  onStatus: (status: TabStatus) => void
}

const joinPath = (base: string, name: string): string =>
  base.endsWith('/') ? base + name : base + '/' + name
const parentOf = (path: string): string => {
  if (path === '/' || path === '') return '/'
  const t = path.replace(/\/+$/, '')
  const i = t.lastIndexOf('/')
  return i <= 0 ? '/' : t.slice(0, i)
}
const fmtSize = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(1)} GB`
}
const fmtDate = (ms: number): string =>
  ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''
const crumbsOf = (path: string): string[] => path.split('/').filter(Boolean)

interface Pane {
  path: string
  entries: FileEntry[]
  selected: string | null
  error: string
}
const empty: Pane = { path: '', entries: [], selected: null, error: '' }

export default function SftpView({ host, active, onStatus }: Props): JSX.Element {
  const sessionRef = useRef<string | null>(null)
  const [local, setLocal] = useState<Pane>(empty)
  const [remote, setRemote] = useState<Pane>(empty)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState('')

  const loadLocal = async (path: string): Promise<void> => {
    const r = await window.api.local.list(path)
    setLocal((p) => ({ ...p, path: r.path, entries: r.entries, error: r.ok ? '' : r.error ?? '' }))
  }
  const loadRemote = async (path: string): Promise<void> => {
    const id = sessionRef.current
    if (!id) return
    const r = await window.api.sftp.list(id, path)
    setRemote((p) => ({ ...p, path: r.path, entries: r.entries, error: r.ok ? '' : r.error ?? '' }))
  }

  useEffect(() => {
    let disposed = false
    onStatus('connecting')
    void (async () => {
      const home = await window.api.local.home()
      await loadLocal(home)
      const res = await window.api.sftp.connect(host)
      if (disposed) {
        if (res.ok && res.sessionId) void window.api.sftp.close(res.sessionId)
        return
      }
      if (!res.ok || !res.sessionId) {
        setFatal(res.error ?? 'connection failed')
        onStatus('closed')
        return
      }
      sessionRef.current = res.sessionId
      setConnected(true)
      onStatus('connected')
      await loadRemote('.')
    })()
    return () => {
      disposed = true
      if (sessionRef.current) void window.api.sftp.close(sessionRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const withBusy = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  // Upload one or more local files (given by absolute path) into the current remote dir.
  const doUpload = (items: { localPath: string; name: string }[]): Promise<void> =>
    withBusy(async () => {
      const id = sessionRef.current
      if (!id || items.length === 0) return
      for (const it of items) {
        const r = await window.api.sftp.upload(id, it.localPath, joinPath(remote.path, it.name))
        if (!r.ok) setRemote((p) => ({ ...p, error: r.error ?? `upload failed: ${it.name}` }))
      }
      await loadRemote(remote.path)
    })
  // Download one or more remote files (given by absolute path) into the current local dir.
  const doDownload = (items: { remotePath: string; name: string }[]): Promise<void> =>
    withBusy(async () => {
      const id = sessionRef.current
      if (!id || items.length === 0) return
      for (const it of items) {
        const r = await window.api.sftp.download(id, it.remotePath, joinPath(local.path, it.name))
        if (!r.ok) setLocal((p) => ({ ...p, error: r.error ?? `download failed: ${it.name}` }))
      }
      await loadLocal(local.path)
    })

  const upload = (): Promise<void> =>
    local.selected
      ? doUpload([{ localPath: joinPath(local.path, local.selected), name: local.selected }])
      : Promise.resolve()
  const download = (): Promise<void> =>
    remote.selected
      ? doDownload([{ remotePath: joinPath(remote.path, remote.selected), name: remote.selected }])
      : Promise.resolve()

  // ---- Drag & drop ----
  type Side = 'local' | 'remote'
  const dragRef = useRef<{ side: Side; name: string; type: FileEntry['type'] } | null>(null)
  const [dragOver, setDragOver] = useState<Side | null>(null)
  const baseName = (p: string): string => p.split(/[\\/]/).pop() || p

  const onRowDragStart = (side: Side, e: FileEntry) => (): void => {
    dragRef.current = { side, name: e.name, type: e.type }
  }
  const onRowDragEnd = (): void => {
    dragRef.current = null
    setDragOver(null)
  }
  const allowDrop = (side: Side) => (ev: DragEvent): void => {
    const item = dragRef.current
    const hasFiles = Array.from(ev.dataTransfer.types).includes('Files')
    // Allow OS files onto remote, and cross-pane internal drags.
    if ((hasFiles && side === 'remote') || (item && item.side !== side)) {
      ev.preventDefault()
      ev.dataTransfer.dropEffect = hasFiles ? 'copy' : 'move'
      if (dragOver !== side) setDragOver(side)
    }
  }
  const onDrop = (side: Side) => (ev: DragEvent): void => {
    ev.preventDefault()
    setDragOver(null)
    const files = Array.from(ev.dataTransfer.files)
    if (files.length > 0) {
      if (side !== 'remote') return // local-pane OS drops aren't supported (no local copy API)
      const items = files
        .map((f) => window.api.files.pathFor(f))
        .filter(Boolean)
        .map((p) => ({ localPath: p, name: baseName(p) }))
      if (items.length) void doUpload(items)
      return
    }
    const item = dragRef.current
    dragRef.current = null
    if (!item || item.side === side) return
    if (item.type === 'dir') {
      const setErr = side === 'remote' ? setRemote : setLocal
      setErr((p) => ({ ...p, error: 'folders are not supported yet — drag individual files' }))
      return
    }
    if (side === 'remote') void doUpload([{ localPath: joinPath(local.path, item.name), name: item.name }])
    else void doDownload([{ remotePath: joinPath(remote.path, item.name), name: item.name }])
  }

  const renderFm = (
    side: Side,
    title: string,
    pane: Pane,
    navigate: (p: string) => void,
    select: (n: string) => void,
    actions: JSX.Element
  ): JSX.Element => {
    const segs = crumbsOf(pane.path)
    return (
      <div
        className={`sftp-side${dragOver === side ? ' drag-over' : ''}`}
        onDragOver={allowDrop(side)}
        onDragLeave={() => setDragOver((d) => (d === side ? null : d))}
        onDrop={onDrop(side)}
      >
        <div className="sftp-bar">
          <span className="loc">
            <IconFolder /> {title}
          </span>
          <span className="spacer" />
          {actions}
        </div>
        <div className="crumbs">
          <button className="nav-btn" onClick={() => navigate(parentOf(pane.path))}>↑</button>
          <button className="crumb" onClick={() => navigate('/')}>
            <IconFolder />/
          </button>
          {segs.map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <IconChevronRight className="crumb-sep" style={{ width: 13, height: 13 }} />
              <button className="crumb" onClick={() => navigate('/' + segs.slice(0, i + 1).join('/'))}>
                {s}
              </button>
            </span>
          ))}
        </div>
        <div className="fm-head">
          <span>Name</span>
          <span>Date Modified</span>
          <span>Size</span>
          <span>Kind</span>
        </div>
        <div className="fm-list">
          {pane.error && <div className="empty-hint" style={{ padding: '14px 18px' }}>{pane.error}</div>}
          {pane.entries.map((e) => (
            <div
              key={e.name}
              className={`fm-row${pane.selected === e.name ? ' selected' : ''}`}
              draggable={e.type !== 'dir'}
              onDragStart={onRowDragStart(side, e)}
              onDragEnd={onRowDragEnd}
              onClick={() => select(e.name)}
              onDoubleClick={() => e.type === 'dir' && navigate(joinPath(pane.path, e.name))}
            >
              <span className="fm-name">
                <span className="ic">{e.type === 'dir' ? '📁' : e.type === 'link' ? '🔗' : '📄'}</span>
                <span className="nm">{e.name}</span>
              </span>
              <span className="fm-col">{fmtDate(e.modified)}</span>
              <span className="fm-col">{e.type === 'dir' ? '— —' : fmtSize(e.size)}</span>
              <span className="fm-col">{e.type === 'dir' ? 'folder' : 'file'}</span>
            </div>
          ))}
        </div>
        {busy && <div className="sftp-busy">working…</div>}
      </div>
    )
  }

  return (
    <div className={`sftp-wrap${active ? '' : ' hidden'}`}>
      {renderFm(
        'local',
        'Local',
        local,
        (p) => void loadLocal(p),
        (n) => setLocal((s) => ({ ...s, selected: n })),
        <button className="act" disabled={busy || !local.selected} onClick={upload}>
          Upload →
        </button>
      )}
      {connected ? (
        renderFm(
          'remote',
          'Remote',
          remote,
          (p) => void loadRemote(p),
          (n) => setRemote((s) => ({ ...s, selected: n })),
          <button className="act" disabled={busy || !remote.selected} onClick={download}>
            ← Download
          </button>
        )
      ) : (
        <div className="sftp-side">
          <div className="sftp-empty">
            <div className="big-ic">📁</div>
            <h3>{fatal ? 'Connection failed' : 'Connecting to host…'}</h3>
            <p>
              {fatal
                ? fatal
                : `Opening SFTP to ${host.username}@${host.host}…`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
