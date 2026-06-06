import { useState } from 'react'
import { THEMES, getThemeId, setThemeId, getAppTheme, setAppTheme, type AppTheme } from '../themes'

/** App settings: themes, encrypted vault sync, and the anti-Termius posture. */
export default function SettingsView(): JSX.Element {
  const [theme, setTheme] = useState(getThemeId())
  const [appTheme, setAppThemeState] = useState<AppTheme>(getAppTheme())
  const [passphrase, setPassphrase] = useState('')
  const [syncMsg, setSyncMsg] = useState('')
  const [syncErr, setSyncErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const pick = (id: string): void => {
    setThemeId(id)
    setTheme(id)
  }

  const doExport = async (): Promise<void> => {
    if (!passphrase) return setMsg('Enter a passphrase first.', true)
    setBusy(true)
    const r = await window.api.sync.export(passphrase)
    setBusy(false)
    if (r.cancelled) return
    if (r.ok) setMsg(`Exported encrypted vault to ${r.path}`, false)
    else setMsg(r.error ?? 'export failed', true)
  }

  const doImport = async (): Promise<void> => {
    if (!passphrase) return setMsg('Enter the vault passphrase first.', true)
    setBusy(true)
    const r = await window.api.sync.import(passphrase)
    setBusy(false)
    if (r.cancelled) return
    if (r.ok && r.counts)
      setMsg(
        `Imported ${r.counts.hosts} hosts, ${r.counts.snippets} snippets, ${r.counts.forwards} forwards. Restart sections to see changes.`,
        false
      )
    else setMsg(r.error ?? 'import failed', true)
  }

  function setMsg(m: string, err: boolean): void {
    setSyncMsg(m)
    setSyncErr(err)
  }

  return (
    <div className="section-view">
      <h2>Settings</h2>

      <h3 style={{ margin: '8px 0 10px', fontSize: 14 }}>Interface</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        {(['light', 'dark'] as AppTheme[]).map((t) => (
          <button
            key={t}
            className={`btn sm${appTheme === t ? ' primary' : ''}`}
            onClick={() => {
              setAppTheme(t)
              setAppThemeState(t)
            }}
          >
            {t === 'light' ? '☀ Light' : '🌙 Dark'}
          </button>
        ))}
      </div>

      <h3 style={{ margin: '18px 0 10px', fontSize: 14 }}>Terminal theme</h3>
      <p className="section-sub" style={{ marginBottom: 8 }}>Applies instantly — open terminals included.</p>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-card${theme === t.id ? ' active' : ''}`}
            onClick={() => pick(t.id)}
            style={{ background: t.theme.background, color: t.theme.foreground }}
          >
            <span className="theme-sample">
              <span style={{ color: t.theme.green }}>user@host</span>:<span style={{ color: t.theme.blue }}>~</span>$ ls
            </span>
            <span className="theme-name">{t.name}</span>
          </button>
        ))}
      </div>

      <h3 style={{ margin: '22px 0 10px', fontSize: 14 }}>Encrypted backup &amp; sync</h3>
      <p className="section-sub" style={{ marginBottom: 10 }}>
        Export an end-to-end-encrypted <code>.tvault</code> (AES-256-GCM, scrypt). Point it at a
        Dropbox/Nextcloud/git folder for sync that no one but you can read — never a paywall.
      </p>
      <div className="pf-form" style={{ maxWidth: 560 }}>
        <input
          type="password"
          style={{ flex: 1 }}
          placeholder="Vault passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <button className="btn primary sm" disabled={busy} onClick={doExport}>
          Export…
        </button>
        <button className="btn sm" disabled={busy} onClick={doImport}>
          Import…
        </button>
      </div>
      {syncMsg && (
        <div className={syncErr ? 'error-text' : ''} style={{ marginTop: 10, color: syncErr ? undefined : 'var(--green)', maxWidth: 560 }}>
          {syncMsg}
        </div>
      )}

      <h3 style={{ margin: '22px 0 10px', fontSize: 14 }}>Updates &amp; data</h3>
      <div className="list-card" style={{ maxWidth: 560 }}>
        <div className="list-row">
          <div className="list-meta">
            <div className="list-name">Auto-update</div>
            <div className="list-sub">Off by design — no forced restarts that lose your work.</div>
          </div>
          <span className="badge ok">disabled</span>
        </div>
        <div className="list-row">
          <div className="list-meta">
            <div className="list-name">Hosts &amp; credentials</div>
            <div className="list-sub">Stored locally, encrypted (OS keyring). Never synced unless you opt in.</div>
          </div>
          <span className="badge ok">local-first</span>
        </div>
      </div>
    </div>
  )
}
