import { useEffect, useState } from 'react'
import type { Identity, KeyFile } from '../../../shared/types'
import { IconKey, IconPlus, IconUser } from './icons'
import KeyGenDialog from './KeyGenDialog'

/** Keychain: reusable identities (credentials) + keys discovered in ~/.ssh. */
export default function KeychainView(): JSX.Element {
  const [keys, setKeys] = useState<KeyFile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [identities, setIdentities] = useState<Identity[]>([])
  /** null = closed, '' = creating new, otherwise the id being edited. */
  const [editingId, setEditingId] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    const [k, ids] = await Promise.all([window.api.keys.list(), window.api.identities.list()])
    setKeys(k)
    setIdentities(ids)
    setLoaded(true)
  }
  useEffect(() => { void refresh() }, [])

  const removeIdentity = async (id: string): Promise<void> => {
    setIdentities(await window.api.identities.remove(id))
  }

  return (
    <div className="section-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h2 style={{ flex: 1 }}>Keychain</h2>
        <button className="btn sm" onClick={() => setEditingId('')}>
          <IconPlus style={{ width: 13, height: 13, marginRight: 4 }} /> New identity
        </button>
        <button className="btn primary sm" onClick={() => setGenOpen(true)}>
          <IconPlus style={{ width: 13, height: 13, marginRight: 4 }} /> Generate key
        </button>
      </div>

      <h3 style={{ margin: '10px 0 6px', fontSize: 14 }}>Identities</h3>
      <p className="section-sub">
        Reusable credentials — set a username + password/key once and pick it on any host.
        Changing it here updates every host that uses it.
      </p>
      {loaded && identities.length === 0 && (
        <div className="empty-hint">No identities yet — create one to stop repeating credentials.</div>
      )}
      <div className="list-card">
        {identities.map((i) => (
          <div key={i.id} className="list-row">
            <span className="list-icon"><IconUser /></span>
            <div className="list-meta">
              <div className="list-name">{i.name}</div>
              <div className="list-sub">
                {i.username} · {i.authType === 'key' ? i.privateKeyPath : i.authType}
              </div>
            </div>
            <button className="btn sm" onClick={() => setEditingId(i.id)}>Edit</button>
            <button className="btn sm danger-btn" onClick={() => void removeIdentity(i.id)}>Delete</button>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '20px 0 6px', fontSize: 14 }}>Keys</h3>
      <p className="section-sub">Private keys found in <code>~/.ssh</code>. Select one per host under its "Key" auth.</p>
      {loaded && keys.length === 0 && (
        <div className="empty-hint">No keys found in ~/.ssh — generate one to get started.</div>
      )}
      <div className="list-card">
        {keys.map((k) => (
          <div key={k.path} className="list-row">
            <span className="list-icon"><IconKey /></span>
            <div className="list-meta">
              <div className="list-name">{k.name}</div>
              <div className="list-sub">{k.path}</div>
            </div>
            <span className={`badge ${k.hasPublic ? 'ok' : ''}`}>
              {k.hasPublic ? 'has .pub' : 'private only'}
            </span>
          </div>
        ))}
      </div>

      {genOpen && (
        <KeyGenDialog
          onGenerated={async () => { setGenOpen(false); await refresh() }}
          onClose={() => setGenOpen(false)}
        />
      )}

      {editingId !== null && (
        <IdentityDialog
          initial={identities.find((i) => i.id === editingId)}
          keys={keys}
          onSaved={async () => { setEditingId(null); await refresh() }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

interface IdentityDialogProps {
  initial?: Identity
  keys: KeyFile[]
  onSaved: () => void
  onClose: () => void
}

function IdentityDialog({ initial, keys, onSaved, onClose }: IdentityDialogProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [authType, setAuthType] = useState<Identity['authType']>(initial?.authType ?? 'password')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [privateKeyPath, setPrivateKeyPath] = useState(initial?.privateKeyPath ?? '')
  const [passphrase, setPassphrase] = useState(initial?.passphrase ?? '')
  const [error, setError] = useState('')

  const browse = async (): Promise<void> => {
    const p = await window.api.keys.browse()
    if (p) setPrivateKeyPath(p)
  }

  const save = async (): Promise<void> => {
    if (!name.trim() || !username.trim()) return setError('Name and username are required.')
    if (authType === 'key' && !privateKeyPath.trim()) return setError('Pick a private key file.')
    await window.api.identities.upsert({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      username: username.trim(),
      authType,
      password: authType === 'password' ? password : undefined,
      privateKeyPath: authType === 'key' ? privateKeyPath.trim() : undefined,
      passphrase: authType === 'key' && passphrase ? passphrase : undefined
    })
    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <h3 style={{ marginBottom: 12 }}>{initial ? 'Edit identity' : 'New identity'}</h3>
        <div className="fld">
          <input autoFocus placeholder="Name (e.g. prod-deploy)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="fld">
          <IconUser />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="fld">
          <span className="lbl flex1">Auth</span>
          <select className="pill-select" value={authType} onChange={(e) => setAuthType(e.target.value as Identity['authType'])}>
            <option value="password">Password</option>
            <option value="key">Key</option>
            <option value="agent">SSH agent</option>
          </select>
        </div>
        {authType === 'password' && (
          <div className="fld">
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {authType === 'key' && (
          <>
            <div className="fld">
              <IconKey />
              <input
                placeholder="~/.ssh/id_ed25519"
                value={privateKeyPath}
                onChange={(e) => setPrivateKeyPath(e.target.value)}
                list="keychain-keys"
              />
              <datalist id="keychain-keys">
                {keys.map((k) => <option key={k.path} value={k.path} />)}
              </datalist>
              <span className="suffix link" onClick={browse}>browse</span>
            </div>
            <div className="fld">
              <input type="password" placeholder="Key passphrase (optional)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            </div>
          </>
        )}
        {error && <div className="error-text">{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn sm" onClick={onClose}>Cancel</button>
          <button className="btn primary sm" onClick={() => void save()}>Save</button>
        </div>
      </div>
    </div>
  )
}
