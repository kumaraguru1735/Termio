import { useEffect, useState } from 'react'
import type { ForwardKind, HostConfig, PortForward } from '../../../shared/types'
import { IconTrash } from './icons'

interface Props {
  hosts: HostConfig[]
}

const blank = (hostId: string): PortForward => ({
  id: crypto.randomUUID(),
  name: '',
  kind: 'local',
  hostId,
  bindPort: 8080,
  destHost: '127.0.0.1',
  destPort: 80
})

const describe = (r: PortForward): string => {
  const kind = r.kind ?? 'local'
  if (kind === 'remote') return `server:${r.bindPort} → ${r.destHost}:${r.destPort} (reverse)`
  if (kind === 'dynamic') return `socks5 127.0.0.1:${r.bindPort}`
  return `127.0.0.1:${r.bindPort} → ${r.destHost}:${r.destPort}`
}

/** Local port-forwarding manager: 127.0.0.1:bindPort → destHost:destPort via a host's SSH tunnel. */
export default function PortForwardView({ hosts }: Props): JSX.Element {
  const [rules, setRules] = useState<PortForward[]>([])
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [draft, setDraft] = useState<PortForward>(blank(hosts[0]?.id ?? ''))
  const [error, setError] = useState('')

  const refresh = async (): Promise<void> => {
    setRules(await window.api.pf.list())
    setActiveIds(await window.api.pf.active())
  }
  useEffect(() => {
    void refresh()
  }, [])

  const add = async (): Promise<void> => {
    if (!draft.hostId) return setError('Add a host first.')
    setRules(await window.api.pf.save({ ...draft, name: draft.name || `:${draft.bindPort}` }))
    setDraft(blank(hosts[0]?.id ?? ''))
    setError('')
  }

  const toggle = async (rule: PortForward): Promise<void> => {
    if (activeIds.includes(rule.id)) {
      await window.api.pf.stop(rule.id)
    } else {
      const r = await window.api.pf.start(rule.id)
      if (!r.ok) setError(`${rule.name}: ${r.error}`)
    }
    setActiveIds(await window.api.pf.active())
  }

  const remove = async (id: string): Promise<void> => {
    setRules(await window.api.pf.remove(id))
    setActiveIds(await window.api.pf.active())
  }

  const hostLabel = (id: string): string => hosts.find((h) => h.id === id)?.label ?? '(missing host)'

  return (
    <div className="section-view">
      <h2>Port Forwarding</h2>
      <p className="section-sub">
        <b>Local</b> (-L): expose a remote service on your machine. <b>Remote</b> (-R): expose a
        local service on the server. <b>Dynamic</b> (-D): a SOCKS5 proxy through the tunnel.
      </p>
      {error && <div className="error-text">{error}</div>}

      <div className="pf-form">
        <select
          value={draft.kind ?? 'local'}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as ForwardKind })}
        >
          <option value="local">Local -L</option>
          <option value="remote">Remote -R</option>
          <option value="dynamic">Dynamic -D</option>
        </select>
        <input
          style={{ flex: 2 }}
          placeholder="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <select value={draft.hostId} onChange={(e) => setDraft({ ...draft, hostId: e.target.value })}>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
        <input
          style={{ width: 80 }}
          placeholder={draft.kind === 'remote' ? 'Remote' : 'Local'}
          value={draft.bindPort}
          onChange={(e) => setDraft({ ...draft, bindPort: parseInt(e.target.value) || 0 })}
        />
        {draft.kind !== 'dynamic' && (
          <>
            <span className="pf-arrow">→</span>
            <input
              style={{ flex: 1 }}
              placeholder="dest host"
              value={draft.destHost}
              onChange={(e) => setDraft({ ...draft, destHost: e.target.value })}
            />
            <input
              style={{ width: 70 }}
              placeholder="port"
              value={draft.destPort}
              onChange={(e) => setDraft({ ...draft, destPort: parseInt(e.target.value) || 0 })}
            />
          </>
        )}
        <button className="btn primary sm" onClick={add}>
          Add
        </button>
      </div>

      <div className="list-card" style={{ marginTop: 16 }}>
        {rules.length === 0 && <div className="empty-hint">No forwards configured.</div>}
        {rules.map((r) => {
          const on = activeIds.includes(r.id)
          return (
            <div key={r.id} className="list-row">
              <span className={`status-dot ${on ? 'connected' : 'closed'}`} />
              <div className="list-meta">
                <div className="list-name">{r.name}</div>
                <div className="list-sub mono">
                  {describe(r)} · via {hostLabel(r.hostId)}
                </div>
              </div>
              <button className={`btn sm ${on ? '' : 'primary'}`} onClick={() => toggle(r)}>
                {on ? 'Stop' : 'Start'}
              </button>
              <button className="icon-btn danger" title="Delete" onClick={() => remove(r.id)}>
                <IconTrash />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
