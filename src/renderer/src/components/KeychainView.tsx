import { useEffect, useState } from 'react'
import type { KeyFile } from '../../../shared/types'
import { IconKey } from './icons'

/** Read-only listing of private keys discovered in ~/.ssh. */
export default function KeychainView(): JSX.Element {
  const [keys, setKeys] = useState<KeyFile[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void window.api.keys.list().then((k) => {
      setKeys(k)
      setLoaded(true)
    })
  }, [])

  return (
    <div className="section-view">
      <h2>Keychain</h2>
      <p className="section-sub">Private keys found in <code>~/.ssh</code>. Select one per host under its “Key” auth.</p>
      {loaded && keys.length === 0 && <div className="empty-hint">No keys found in ~/.ssh.</div>}
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
    </div>
  )
}
