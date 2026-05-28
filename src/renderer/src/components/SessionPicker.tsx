import { useMemo, useState } from 'react'
import type { HostConfig } from '../../../shared/types'
import { IconHosts, IconTerminal, IconSftp } from './icons'

interface Props {
  active: boolean
  kind: 'terminal' | 'sftp'
  hosts: HostConfig[]
  /** Called when a host is picked — caller binds the tab + starts the session. */
  onPick: (host: HostConfig) => void
  /** Quick-connect target (user@host) for ephemeral one-off connections. */
  onQuickConnect: (raw: string) => void
  onNewHost: () => void
}

/**
 * Empty workspace shown for a newly-opened "New Terminal" / "New SFTP" tab
 * before a host is selected. Mirrors Termius's "Connect to host" state.
 */
export default function SessionPicker({
  active,
  kind,
  hosts,
  onPick,
  onQuickConnect,
  onNewHost
}: Props): JSX.Element {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return hosts
    return hosts.filter(
      (h) =>
        h.label.toLowerCase().includes(s) ||
        h.host.toLowerCase().includes(s) ||
        h.username.toLowerCase().includes(s)
    )
  }, [hosts, q])
  const canConnect = /\S/.test(q) && /[.@]/.test(q)
  const kindLabel = kind === 'sftp' ? 'SFTP' : 'Terminal'
  const KindIcon = kind === 'sftp' ? IconSftp : IconTerminal

  return (
    <div className={`session-picker${active ? '' : ' hidden'}`}>
      <div className="picker-header">
        <div className="picker-title">
          <span className="picker-kind"><KindIcon /></span>
          New {kindLabel} session — pick a host to begin
        </div>
      </div>

      <div className="searchbar" style={{ margin: '0 24px 12px' }}>
        <input
          placeholder={`Find a host or ssh user@hostname…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canConnect && onQuickConnect(q)}
        />
        <button
          className={`connect-btn${canConnect ? ' enabled' : ''}`}
          disabled={!canConnect}
          onClick={() => onQuickConnect(q)}
        >
          Connect
        </button>
      </div>

      <div className="picker-grid">
        {filtered.length === 0 && (
          <div className="picker-empty">
            <div className="big-ic"><IconHosts /></div>
            <h3>No hosts yet</h3>
            <p>Add one to start a {kindLabel.toLowerCase()} session.</p>
            <button className="btn primary" onClick={onNewHost}>+ New host</button>
          </div>
        )}
        <div className="cards-grid">
          {filtered.map((h) => (
            <button
              key={h.id}
              className="host-card picker-card"
              onClick={() => onPick(h)}
              title={`Open ${kindLabel} for ${h.label}`}
            >
              <div className="host-card-icon"><IconHosts /></div>
              <div className="host-card-meta">
                <div className="host-card-name">{h.label}</div>
                <div className="host-card-sub">
                  {h.username}@{h.host}:{h.port}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
