import { useState } from 'react'
import type { KeyFile } from '../../../shared/types'
import { IconKey, IconLock } from './icons'

interface Props {
  onGenerated: (key: KeyFile) => void
  onClose: () => void
}

export default function KeyGenDialog({ onGenerated, onClose }: Props): JSX.Element {
  const [name, setName] = useState('id_ed25519_termio')
  const [type, setType] = useState<'ed25519' | 'rsa-4096'>('ed25519')
  const [passphrase, setPassphrase] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    setBusy(true)
    setError('')
    const r = await window.api.keys.generate({
      name: name.trim(),
      type,
      passphrase: passphrase || undefined,
      comment: comment.trim() || undefined
    })
    setBusy(false)
    if (!r.ok || !r.key) return setError(r.error ?? 'failed')
    onGenerated(r.key)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Generate SSH key</h3>
        <p className="section-sub" style={{ marginBottom: 14 }}>
          Written to <code>~/.ssh/&lt;name&gt;</code> with mode 0600 (private) and 0644 (public).
        </p>
        {error && <div className="error-text">{error}</div>}

        <div className="field">
          <label>File name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="id_ed25519_termio"
          />
        </div>

        <div className="field">
          <label>Algorithm</label>
          <div className="seg">
            <button
              type="button"
              className={type === 'ed25519' ? 'active' : ''}
              onClick={() => setType('ed25519')}
            >
              Ed25519 (recommended)
            </button>
            <button
              type="button"
              className={type === 'rsa-4096' ? 'active' : ''}
              onClick={() => setType('rsa-4096')}
            >
              RSA 4096
            </button>
          </div>
        </div>

        <div className="field">
          <label>Passphrase (optional)</label>
          <div className="fld" style={{ marginBottom: 0 }}>
            <IconLock />
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="leave empty for no passphrase"
            />
          </div>
        </div>

        <div className="field">
          <label>Comment (optional)</label>
          <div className="fld" style={{ marginBottom: 0 }}>
            <IconKey />
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="user@machine"
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>
    </div>
  )
}
