import { useEffect, useState } from 'react'
import type { KeyFile } from '../../../shared/types'
import { IconKey, IconPlus } from './icons'
import KeyGenDialog from './KeyGenDialog'

/** Read-only listing of private keys discovered in ~/.ssh, plus a generator. */
export default function KeychainView(): JSX.Element {
  const [keys, setKeys] = useState<KeyFile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [genOpen, setGenOpen] = useState(false)

  const refresh = async (): Promise<void> => {
    const k = await window.api.keys.list()
    setKeys(k)
    setLoaded(true)
  }
  useEffect(() => { void refresh() }, [])

  return (
    <div className="section-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h2 style={{ flex: 1 }}>Keychain</h2>
        <button className="btn primary sm" onClick={() => setGenOpen(true)}>
          <IconPlus style={{ width: 13, height: 13, marginRight: 4 }} /> Generate key
        </button>
      </div>
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
    </div>
  )
}
