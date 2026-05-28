import { useEffect, useState } from 'react'
import type { KnownHost } from '../../../shared/types'
import { IconKnownHosts, IconTrash } from './icons'

/** Lists trusted host-key fingerprints (TOFU store) with the ability to forget them. */
export default function KnownHostsView(): JSX.Element {
  const [items, setItems] = useState<KnownHost[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void window.api.knownHosts.list().then((k) => {
      setItems(k)
      setLoaded(true)
    })
  }, [])

  const forget = async (id: string): Promise<void> => {
    setItems(await window.api.knownHosts.remove(id))
  }

  return (
    <div className="section-view">
      <h2>Known Hosts</h2>
      <p className="section-sub">
        Host keys trusted on first connect. Remove one to re-trust on next connect.
      </p>
      {loaded && items.length === 0 && (
        <div className="empty-hint">No trusted hosts yet — connect to a server to record its key.</div>
      )}
      <div className="list-card">
        {items.map((k) => (
          <div key={k.id} className="list-row">
            <span className="list-icon"><IconKnownHosts /></span>
            <div className="list-meta">
              <div className="list-name">{k.id}</div>
              <div className="list-sub mono">{k.fingerprint}</div>
            </div>
            <button className="icon-btn danger" title="Forget" onClick={() => forget(k.id)}>
              <IconTrash />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
