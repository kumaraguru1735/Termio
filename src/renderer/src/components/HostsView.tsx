import { useMemo, useState } from 'react'
import type { HostConfig } from '../../../shared/types'
import {
  IconHosts,
  IconEdit,
  IconTrash,
  IconPlay,
  IconSftp,
  IconTerminal,
  IconSerial,
  IconChevronDown,
  IconGrid,
  IconTag,
  IconCalendar
} from './icons'

interface Props {
  active: boolean
  hosts: HostConfig[]
  openAs: 'terminal' | 'sftp'
  onOpenAsChange: (k: 'terminal' | 'sftp') => void
  onOpen: (host: HostConfig, kind: 'terminal' | 'sftp') => void
  onQuickConnect: (raw: string) => void
  onNewHost: () => void
  onEdit: (host: HostConfig) => void
  onDelete: (id: string) => void
  onImportConfig: () => void
}

/** Main Hosts view: search + toolbar + host cards grid (Termius layout). */
export default function HostsView({
  active,
  hosts,
  openAs,
  onOpenAsChange,
  onOpen,
  onQuickConnect,
  onNewHost,
  onEdit,
  onDelete,
  onImportConfig
}: Props): JSX.Element {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return hosts
    return hosts.filter(
      (h) =>
        h.label.toLowerCase().includes(q) ||
        h.host.toLowerCase().includes(q) ||
        h.username.toLowerCase().includes(q)
    )
  }, [hosts, query])

  const groups = useMemo(() => {
    return filtered.reduce<Record<string, HostConfig[]>>((acc, h) => {
      const g = h.group ?? 'Hosts'
      ;(acc[g] ??= []).push(h)
      return acc
    }, {})
  }, [filtered])

  // Quick-connect is enabled when the query looks like a host / user@host.
  const canConnect = /\S/.test(query) && /[.@]/.test(query)

  return (
    <div className={`hosts-view${active ? '' : ' hidden'}`}>
      <div className="searchbar">
        <input
          placeholder="Find a host or ssh user@hostname…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canConnect && onQuickConnect(query)}
        />
        <button
          className={`connect-btn${canConnect ? ' enabled' : ''}`}
          disabled={!canConnect}
          onClick={() => onQuickConnect(query)}
        >
          Connect
        </button>
      </div>

      <div className="host-toolbar">
        <button className="btn-newhost" onClick={onNewHost}>
          + New host
          <IconChevronDown style={{ width: 13, height: 13 }} />
        </button>
        <button className="tool-pill" title="Import hosts from ~/.ssh/config" onClick={onImportConfig}>
          Import SSH config
        </button>
        <button
          className={`tool-pill${openAs === 'terminal' ? ' active' : ''}`}
          onClick={() => onOpenAsChange('terminal')}
          title="Double-click opens a terminal"
        >
          <IconTerminal /> Terminal
        </button>
        <button
          className={`tool-pill${openAs === 'sftp' ? ' active' : ''}`}
          onClick={() => onOpenAsChange('sftp')}
          title="Double-click opens SFTP"
        >
          <IconSftp /> SFTP
        </button>
        <button className="tool-pill" title="Serial (coming soon)">
          <IconSerial /> Serial
        </button>
        <span className="spacer" />
        <div className="view-icons">
          <button className="active" title="Grid">
            <IconGrid />
          </button>
          <button title="Tags">
            <IconTag />
          </button>
          <button title="Calendar">
            <IconCalendar />
          </button>
        </div>
      </div>

      <div className="hosts-scroll">
        {filtered.length === 0 && (
          <div className="hosts-empty">
            <div className="hosts-empty-icon"><IconHosts /></div>
            <h3>{query ? 'No hosts match' : 'No hosts yet'}</h3>
            <p>
              {query
                ? 'Try a different search term.'
                : 'Save your first server to connect with a click — encrypted at rest, never auto-synced.'}
            </p>
            {!query && (
              <button className="btn primary" onClick={onNewHost}>+ Add your first host</button>
            )}
          </div>
        )}
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="group-head">{group}</div>
            <div className="cards-grid">
              {items.map((h) => (
                <div
                  key={h.id}
                  className="host-card"
                  onDoubleClick={() => onOpen(h, openAs)}
                  title={`Double-click to open ${openAs === 'sftp' ? 'SFTP' : 'Terminal'}`}
                >
                  <div className="host-card-icon">
                    <IconHosts />
                  </div>
                  <div className="host-card-meta">
                    <div className="host-card-name">{h.label}</div>
                    <div className="host-card-sub">
                      {h.username ? `${h.username}@${h.host}` : h.host} · ssh
                      {h.jumpHostId ? ' · via jump' : ''}
                      {h.proxy && h.proxy.type !== 'none' ? ` · ${h.proxy.type}` : ''}
                    </div>
                    {h.tags && h.tags.length > 0 && (
                      <div className="card-tags">
                        {h.tags.slice(0, 4).map((t) => (
                          <span key={t} className="card-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="host-card-actions">
                    <button className="icon-btn" title="Terminal" onClick={(e) => { e.stopPropagation(); onOpen(h, 'terminal') }}>
                      <IconPlay />
                    </button>
                    <button className="icon-btn" title="SFTP" onClick={(e) => { e.stopPropagation(); onOpen(h, 'sftp') }}>
                      <IconSftp />
                    </button>
                    <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(h) }}>
                      <IconEdit />
                    </button>
                    <button className="icon-btn danger" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(h.id) }}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
