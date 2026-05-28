import { useEffect, useState } from 'react'
import type { ActivityRecord, ActivityEvent, ActivityKind } from '../../../shared/types'
import { IconLogs, IconTrash } from './icons'

const eventLabel: Record<ActivityEvent, string> = {
  connected: 'connected',
  disconnected: 'disconnected',
  failed: 'failed',
  accepted: 'accepted',
  refused: 'refused'
}
const kindLabel: Record<ActivityKind, string> = {
  terminal: 'Terminal',
  sftp: 'SFTP',
  portforward: 'Port forward',
  'hostkey-new': 'Host key (new)',
  'hostkey-changed': 'Host key (changed)'
}

function relTime(ms: number): string {
  const s = (Date.now() - ms) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ms).toLocaleString()
}

export default function LogsView(): JSX.Element {
  const [items, setItems] = useState<ActivityRecord[]>([])

  const refresh = async (): Promise<void> => setItems(await window.api.activity.list())
  useEffect(() => {
    void refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [])

  const clear = async (): Promise<void> => setItems(await window.api.activity.clear())

  return (
    <div className="section-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h2 style={{ flex: 1 }}>Logs</h2>
        {items.length > 0 && (
          <button className="btn sm" onClick={clear} title="Clear all activity">
            <IconTrash style={{ width: 14, height: 14, marginRight: 4 }} /> Clear
          </button>
        )}
      </div>
      <p className="section-sub">Recent connections, disconnections, and security events. Local only.</p>

      {items.length === 0 ? (
        <div className="empty-hint">No activity yet — connect to a host to see events here.</div>
      ) : (
        <div className="list-card">
          {items.map((r) => (
            <div key={r.id} className="list-row">
              <span className="list-icon"><IconLogs /></span>
              <div className="list-meta">
                <div className="list-name">
                  {r.label ?? r.host}
                  <span style={{ color: 'var(--nav-dim)', fontWeight: 400, marginLeft: 6 }}>
                    · {kindLabel[r.kind]} · {eventLabel[r.event]}
                  </span>
                </div>
                <div className="list-sub mono">
                  {r.username ? `${r.username}@` : ''}{r.host}:{r.port}
                  {r.detail ? `  —  ${r.detail}` : ''}
                </div>
              </div>
              <span className="badge" title={new Date(r.ts).toLocaleString()}>{relTime(r.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
