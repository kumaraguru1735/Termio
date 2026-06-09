import { useState } from 'react'
import { IconLock } from './icons'

interface Props {
  onUnlock: () => void
}

/** Full-window gate shown at launch when an app-lock passphrase is set. */
export default function LockScreen({ onUnlock }: Props): JSX.Element {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (!value || busy) return
    setBusy(true)
    const r = await window.api.lock.verify(value)
    setBusy(false)
    if (r.ok) onUnlock()
    else {
      setError(true)
      setValue('')
    }
  }

  return (
    <div className="lock-screen">
      <form
        className="lock-card"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="lock-ic"><IconLock /></div>
        <h2>Termio is locked</h2>
        <p className="section-sub">Enter your passphrase to continue.</p>
        <input
          autoFocus
          type="password"
          placeholder="Passphrase"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false) }}
        />
        {error && <div className="error-text">Incorrect passphrase.</div>}
        <button type="submit" className="btn primary" disabled={!value || busy}>
          Unlock
        </button>
      </form>
    </div>
  )
}
