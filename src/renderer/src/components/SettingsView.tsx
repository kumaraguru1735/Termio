import { useEffect, useState } from 'react'
import {
  THEMES,
  getThemeId,
  setThemeId,
  getAppTheme,
  setAppTheme,
  type AppTheme,
  FONT_CHOICES,
  getFontFamily,
  setFontFamily,
  getFontSize,
  setFontSize
} from '../themes'

/** App settings: themes, fonts, encrypted vault sync, and the anti-Termius posture. */
export default function SettingsView(): JSX.Element {
  const [theme, setTheme] = useState(getThemeId())
  const [appTheme, setAppThemeState] = useState<AppTheme>(getAppTheme())
  const [fontSize, setFontSizeState] = useState(getFontSize())
  const [fontFamily, setFontFamilyState] = useState(getFontFamily())
  const [lockEnabled, setLockEnabled] = useState(false)
  const [lockPass, setLockPass] = useState('')
  const [lockMsg, setLockMsg] = useState('')

  useEffect(() => {
    void window.api.lock.status().then((s) => setLockEnabled(s.enabled))
  }, [])

  const enableLock = async (): Promise<void> => {
    if (lockPass.length < 4) return setLockMsg('Use at least 4 characters.')
    await window.api.lock.set(lockPass)
    setLockEnabled(true)
    setLockPass('')
    setLockMsg('App lock enabled — you’ll be asked for it next launch.')
  }
  const disableLock = async (): Promise<void> => {
    await window.api.lock.set(null)
    setLockEnabled(false)
    setLockPass('')
    setLockMsg('App lock disabled.')
  }
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

      <h3 style={{ margin: '18px 0 10px', fontSize: 14 }}>Terminal font</h3>
      <div className="pf-form" style={{ maxWidth: 560, marginBottom: 4 }}>
        <select
          style={{ flex: 1 }}
          value={fontFamily}
          onChange={(e) => { setFontFamily(e.target.value); setFontFamilyState(e.target.value) }}
        >
          {FONT_CHOICES.map((f) => (
            <option key={f} value={f}>{f.replace(/"/g, '').split(',')[0]}</option>
          ))}
        </select>
        <button className="btn sm" onClick={() => { const n = fontSize - 1; setFontSize(n); setFontSizeState(getFontSize()) }}>−</button>
        <span style={{ minWidth: 54, textAlign: 'center', alignSelf: 'center' }}>{fontSize} px</span>
        <button className="btn sm" onClick={() => { const n = fontSize + 1; setFontSize(n); setFontSizeState(getFontSize()) }}>+</button>
      </div>
      <p className="section-sub" style={{ marginBottom: 12 }}>Ctrl/⌘ with + − 0 also zooms inside a terminal.</p>

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

      <h3 style={{ margin: '22px 0 10px', fontSize: 14 }}>App lock</h3>
      <p className="section-sub" style={{ marginBottom: 10 }}>
        Require a passphrase when Termio launches. Your hosts are already encrypted by the OS
        keyring — this adds a screen lock on top.
      </p>
      <div className="pf-form" style={{ maxWidth: 560 }}>
        {lockEnabled ? (
          <button className="btn danger-btn sm" onClick={disableLock}>Disable app lock</button>
        ) : (
          <>
            <input
              type="password"
              style={{ flex: 1 }}
              placeholder="New lock passphrase"
              value={lockPass}
              onChange={(e) => setLockPass(e.target.value)}
            />
            <button className="btn primary sm" onClick={enableLock}>Enable lock</button>
          </>
        )}
      </div>
      {lockMsg && <div style={{ marginTop: 8, color: 'var(--green)', maxWidth: 560 }}>{lockMsg}</div>}

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
