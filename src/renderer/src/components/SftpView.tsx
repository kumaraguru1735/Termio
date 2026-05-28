import { useEffect, useRef, useState } from 'react'
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
  const upload = (): Promise<void> => withBusy(async () => {
    const id = sessionRef.current
    if (!id || !local.selected) return
    const r = await window.api.sftp.upload(id, joinPath(local.path, local.selected), joinPath(remote.path, local.selected))
    if (!r.ok) setLocal((p) => ({ ...p, error: r.error ?? 'upload failed' }))
    await loadRemote(remote.path)
  })
  const download = (): Promise<void> => withBusy(async () => {
    const id = sessionRef.current
    if (!id || !remote.selected) return
    const r = await window.api.sftp.download(id, joinPath(remote.path, remote.selected), joinPath(local.path, remote.selected))
    if (!r.ok) setRemote((p) => ({ ...p, error: r.error ?? 'download failed' }))
    await loadLocal(local.path)
  })

  const renderFm = (
    title: string,
    pane: Pane,
    navigate: (p: string) => void,
    select: (n: string) => void,
    actions: JSX.Element
  ): JSX.Element => {
    const segs = crumbsOf(pane.path)
    return (
      <div className="sftp-side">
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
