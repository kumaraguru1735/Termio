import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { BackspaceMode, HostConfig, Identity, Protocol, ProxyType } from '../../../shared/types'
import {
  IconHosts,
  IconUser,
  IconLock,
  IconKey,
  IconSnippets,
  IconPortForward,
  IconChevronDown,
  IconChevronRight
} from './icons'

interface Props {
  hosts: HostConfig[]
  initial?: HostConfig
  onSave: (host: HostConfig, connect: boolean) => void
  onClose: () => void
}

const setIn = <T,>(setter: Dispatch<SetStateAction<T>>) => (v: T): void => setter(v)

/** Termius-style right panel — every field here is real and persists. */
export default function NewHostPanel({ hosts, initial, onSave, onClose }: Props): JSX.Element {
  const [host, setHost] = useState(initial?.host ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [group, setGroup] = useState(initial?.group ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [backspace, setBackspace] = useState<BackspaceMode>(initial?.backspace ?? 'default')
  const [protocol, setProtocol] = useState<Protocol>(initial?.protocol ?? 'ssh')
  const [port, setPort] = useState(String(initial?.port ?? 22))
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [showPw, setShowPw] = useState(false)
  const [keyOpen, setKeyOpen] = useState(!!initial?.privateKeyPath)
  const [privateKeyPath, setPrivateKeyPath] = useState(initial?.privateKeyPath ?? '')
  const [passphrase, setPassphrase] = useState(initial?.passphrase ?? '')
  const [agentForward, setAgentForward] = useState(!!initial?.agentForward)
  const [autoReconnect, setAutoReconnect] = useState(initial?.autoReconnect !== false)
  const [identityId, setIdentityId] = useState(initial?.identityId ?? '')
  const [identities, setIdentities] = useState<Identity[]>([])
  const [startupSnippet, setStartupSnippet] = useState(initial?.startupSnippet ?? '')
  const [jumpHostId, setJumpHostId] = useState(initial?.jumpHostId ?? '')
  const [proxyType, setProxyType] = useState<ProxyType>(initial?.proxy?.type ?? 'none')
  const [proxyHost, setProxyHost] = useState(initial?.proxy?.host ?? '')
  const [proxyPort, setProxyPort] = useState(String(initial?.proxy?.port ?? 1080))
  const [envRows, setEnvRows] = useState<{ k: string; v: string }[]>(
    Object.entries(initial?.env ?? {}).map(([k, v]) => ({ k, v }))
  )
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({
    snippet: !!initial?.startupSnippet,
    chain: !!initial?.jumpHostId,
    proxy: !!initial?.proxy && initial.proxy.type !== 'none',
    env: (initial?.env && Object.keys(initial.env).length > 0) || false
  })
  const [error, setError] = useState('')

  const toggle = (k: string): void => setOpenRows((m) => ({ ...m, [k]: !m[k] }))

  useEffect(() => {
    void window.api.identities.list().then(setIdentities)
  }, [])

  const browse = async (): Promise<void> => {
    const p = await window.api.keys.browse()
    if (p) setPrivateKeyPath(p)
  }

  const addTag = (): void => {
    const t = tagDraft.trim().replace(/,$/, '')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagDraft('')
  }

  const build = (): HostConfig | null => {
    if (!host.trim() || (!identityId && !username.trim())) {
      setError(identityId ? 'Address is required.' : 'Address and username are required.')
      return null
    }
    const authType = privateKeyPath.trim() ? 'key' : password ? 'password' : 'agent'
    const env: Record<string, string> = {}
    for (const { k, v } of envRows) if (k.trim()) env[k.trim()] = v
    return {
      id: initial?.id ?? crypto.randomUUID(),
      label: label.trim() || host.trim(),
      host: host.trim(),
      port: parseInt(port, 10) || 22,
      username: username.trim(),
      authType,
      password: authType === 'password' ? password : undefined,
      privateKeyPath: authType === 'key' ? privateKeyPath.trim() : undefined,
      passphrase: authType === 'key' && passphrase ? passphrase : undefined,
      group: group.trim() || undefined,
      tags: tags.length ? tags : undefined,
      backspace: backspace === 'default' ? undefined : backspace,
      agentForward: agentForward || undefined,
      startupSnippet: startupSnippet.trim() ? startupSnippet : undefined,
      jumpHostId: jumpHostId || undefined,
      proxy:
        proxyType !== 'none' && proxyHost.trim()
          ? { type: proxyType, host: proxyHost.trim(), port: parseInt(proxyPort, 10) || 1080 }
          : undefined,
      env: Object.keys(env).length ? env : undefined,
      identityId: identityId || undefined,
      // Default is on — only persist the opt-out.
      autoReconnect: autoReconnect ? undefined : false,
      protocol: protocol === 'ssh' ? undefined : protocol
    }
  }

  const canConnect = host.trim().length > 0 && (identityId !== '' || username.trim().length > 0)
  const otherHosts = hosts.filter((h) => h.id !== initial?.id)

  return (
    <div className="right-panel">
      <div className="rp-head">
        <div>
          <h3>{initial ? 'Edit Host' : 'New Host'}</h3>
          <div className="vault-sub">Personal vault</div>
        </div>
        <button className="rp-x" onClick={onClose} title="Close">›</button>
      </div>

      <div className="rp-body">
        <div className="rp-section">Address</div>
        <div className="rp-address">
          <span className="addr-icon"><IconHosts /></span>
          <div className="fld" style={{ flex: 1, marginBottom: 0 }}>
            <input autoFocus placeholder="IP or Hostname" value={host} onChange={(e) => setHost(e.target.value)} />
          </div>
        </div>

        <div className="rp-section">General</div>
        <div className="fld">
          <span className="lbl flex1">Protocol</span>
          <select
            className="pill-select"
            value={protocol}
            onChange={(e) => {
              const p = e.target.value as Protocol
              setProtocol(p)
              if (p === 'telnet' && port === '22') setPort('23')
              if (p !== 'telnet' && port === '23') setPort('22')
            }}
          >
            <option value="ssh">SSH</option>
            <option value="telnet">Telnet</option>
            <option value="mosh">Mosh</option>
          </select>
        </div>
        <div className="fld">
          <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="fld">
          <input placeholder="Parent Group" value={group} onChange={(e) => setGroup(e.target.value)} />
        </div>

        {/* Tags */}
        <div className="fld fld-multi">
          <div className="chips">
            {tags.map((t) => (
              <span key={t} className="chip">
                {t}
                <button onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
              </span>
            ))}
            <input
              className="chip-in"
              placeholder={tags.length ? '' : 'Tags (press Enter)'}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                if (e.key === 'Backspace' && !tagDraft && tags.length) setTags(tags.slice(0, -1))
              }}
              onBlur={addTag}
            />
          </div>
        </div>

        {/* Backspace */}
        <div className="fld">
          <span className="lbl flex1">Backspace</span>
          <select
            className="pill-select"
            value={backspace}
            onChange={(e) => setBackspace(e.target.value as BackspaceMode)}
          >
            <option value="default">Default ^?</option>
            <option value="ctrl-h">Ctrl-H ^H</option>
          </select>
        </div>

        <div className="ssh-port">
          SSH on
          <input value={port} onChange={(e) => setPort(e.target.value)} />
          port
        </div>

        <div className="rp-section">Credentials</div>
        {identities.length > 0 && (
          <div className="fld">
            <IconKey />
            <span className="lbl">Identity</span>
            <select
              className="pill-select"
              style={{ flex: 1 }}
              value={identityId}
              onChange={(e) => setIdentityId(e.target.value)}
            >
              <option value="">(enter manually)</option>
              {identities.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.username} ({i.authType})
                </option>
              ))}
            </select>
          </div>
        )}
        {identityId !== '' ? (
          <div className="fld muted">
            <IconUser />
            <span className="lbl flex1">
              Credentials come from “{identities.find((i) => i.id === identityId)?.name ?? '…'}”
            </span>
          </div>
        ) : (
          <>
        <div className="fld">
          <IconUser />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="fld">
          <IconLock />
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="suffix link" onClick={() => setShowPw((s) => !s)}>
            {showPw ? 'hide' : 'show'}
          </span>
        </div>

        {!keyOpen ? (
          <div className="fld muted clickable" onClick={() => setKeyOpen(true)}>
            <IconKey />
            <span className="lbl flex1">SSH ID, Key, Certificate, FIDO2</span>
            <span className="suffix">+</span>
          </div>
        ) : (
          <>
            <div className="fld">
              <IconKey />
              <input
                placeholder="~/.ssh/id_ed25519"
                value={privateKeyPath}
                onChange={(e) => setPrivateKeyPath(e.target.value)}
              />
              <span className="suffix link" onClick={browse}>browse</span>
              {privateKeyPath && (
                <span
                  className="suffix link"
                  onClick={() => { setPrivateKeyPath(''); setKeyOpen(false) }}
                >clear</span>
              )}
            </div>
            <div className="fld">
              <IconLock />
              <input
                type="password"
                placeholder="Key passphrase (optional)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
          </>
        )}
          </>
        )}

        {/* Agent Forwarding */}
        <div className="fld clickable" onClick={() => setAgentForward((v) => !v)}>
          <span className="lbl flex1">Agent Forwarding</span>
          <span className={`suffix ${agentForward ? 'on' : ''}`}>
            {agentForward ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Auto-reconnect */}
        <div className="fld clickable" onClick={() => setAutoReconnect((v) => !v)}>
          <span className="lbl flex1">Auto-reconnect</span>
          <span className={`suffix ${autoReconnect ? 'on' : ''}`}>
            {autoReconnect ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Startup snippet */}
        <Expander
          icon={<IconSnippets />}
          label="Startup snippet"
          summary={startupSnippet ? startupSnippet.split('\n')[0].slice(0, 24) : ''}
          open={openRows.snippet}
          onToggle={() => toggle('snippet')}
        >
          <textarea
            className="rp-textarea"
            placeholder="cd /var/log && tail -f syslog"
            value={startupSnippet}
            onChange={(e) => setStartupSnippet(e.target.value)}
            rows={3}
          />
        </Expander>

        {/* Host Chaining */}
        <Expander
          icon={<IconHosts />}
          label="Host Chaining"
          summary={hosts.find((h) => h.id === jumpHostId)?.label ?? ''}
          open={openRows.chain}
          onToggle={() => toggle('chain')}
        >
          <select
            className="rp-select"
            value={jumpHostId}
            onChange={(e) => setJumpHostId(e.target.value)}
          >
            <option value="">(none — direct)</option>
            {otherHosts.map((h) => (
              <option key={h.id} value={h.id}>{h.label} ({h.host})</option>
            ))}
          </select>
        </Expander>

        {/* Proxy */}
        <Expander
          icon={<IconPortForward />}
          label="Proxy"
          summary={proxyType !== 'none' && proxyHost ? `${proxyType}: ${proxyHost}:${proxyPort}` : ''}
          open={openRows.proxy}
          onToggle={() => toggle('proxy')}
        >
          <select
            className="rp-select"
            value={proxyType}
            onChange={(e) => setProxyType(e.target.value as ProxyType)}
            style={{ marginBottom: 6 }}
          >
            <option value="none">None</option>
            <option value="socks5">SOCKS5</option>
          </select>
          {proxyType !== 'none' && (
            <div className="proxy-row">
              <input
                placeholder="proxy host"
                value={proxyHost}
                onChange={(e) => setProxyHost(e.target.value)}
              />
              <input
                placeholder="port"
                value={proxyPort}
                onChange={(e) => setProxyPort(e.target.value)}
                style={{ width: 76 }}
              />
            </div>
          )}
        </Expander>

        {/* Environment Variable */}
        <Expander
          icon={undefined}
          label="Environment Variable"
          summary={envRows.length ? `${envRows.length} set` : ''}
          open={openRows.env}
          onToggle={() => toggle('env')}
        >
          {envRows.map((row, i) => (
            <div className="env-row" key={i}>
              <input
                placeholder="NAME"
                value={row.k}
                onChange={(e) => setEnvRows(envRows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))}
              />
              <input
                placeholder="value"
                value={row.v}
                onChange={(e) => setEnvRows(envRows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))}
              />
              <button className="rm-btn" onClick={() => setEnvRows(envRows.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button
            className="add-mini"
            onClick={() => setEnvRows([...envRows, { k: '', v: '' }])}
          >
            + Add variable
          </button>
        </Expander>

        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="rp-foot">
        <button
          className="btn"
          style={{ width: '100%', marginBottom: 8 }}
          onClick={() => { const h = build(); if (h) onSave(h, false) }}
        >
          Save
        </button>
        <button
          className={`connect-full${canConnect ? ' enabled' : ''}`}
          disabled={!canConnect}
          onClick={() => { const h = build(); if (h) onSave(h, true) }}
        >
          Connect
        </button>
      </div>
    </div>
  )
}

interface ExpanderProps {
  icon?: JSX.Element
  label: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}
function Expander({ icon, label, summary, open, onToggle, children }: ExpanderProps): JSX.Element {
  return (
    <div className="expander">
      <div className={`fld clickable${summary ? ' has-val' : ''}`} onClick={onToggle}>
        {icon}
        <span className="lbl flex1">{label}</span>
        {summary && <span className="suffix on" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>}
        {open ? <IconChevronDown style={{ width: 14, height: 14, color: '#8a909c' }} /> : <IconChevronRight style={{ width: 14, height: 14, color: '#8a909c' }} />}
      </div>
      {open && <div className="expander-body">{children}</div>}
    </div>
  )
}
