import { useEffect, useState } from 'react'
import TopBar, { type TopTab, type NewTabKind } from './components/TopBar'
import NavSidebar, { type NavSection } from './components/NavSidebar'
import HostsView from './components/HostsView'
import NewHostPanel from './components/NewHostPanel'
import TerminalView, { type TabStatus } from './components/TerminalView'
import SplitTerminal from './components/SplitTerminal'
import SftpView from './components/SftpView'
import SerialView from './components/SerialView'
import SessionPicker from './components/SessionPicker'
import KeychainView from './components/KeychainView'
import KnownHostsView from './components/KnownHostsView'
import PortForwardView from './components/PortForwardView'
import SnippetsView from './components/SnippetsView'
import SettingsView from './components/SettingsView'
import LogsView from './components/LogsView'
import HostKeyChangedDialog, { type HostKeyPrompt } from './components/HostKeyChangedDialog'
import KbInteractiveDialog from './components/KbInteractiveDialog'
import LockScreen from './components/LockScreen'
import type { HostConfig, KbInteractivePrompt, SerialPortInfo } from '../../shared/types'

type TabKind = 'terminal' | 'sftp' | 'local' | 'serial'
interface Tab {
  tabId: string
  /** null while the tab is "pending" — waiting for the user to pick a host. */
  host: HostConfig | null
  kind: TabKind
  status: TabStatus
  /** Terminal panes (split view). At least one entry; second present when split. */
  paneIds: string[]
}

export default function App(): JSX.Element {
  const [view, setView] = useState<NavSection>('hosts')
  const [showingTab, setShowingTab] = useState(false)
  const [hosts, setHosts] = useState<HostConfig[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [tabSessions, setTabSessions] = useState<Record<string, string | null>>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<HostConfig | null>(null)
  /** Default action when a host card is double-clicked. Driven by the + menu. */
  const [openAs, setOpenAs] = useState<'terminal' | 'sftp'>('terminal')
  /** Queue of pending host-key-changed prompts (one shown at a time). */
  const [hkPrompts, setHkPrompts] = useState<HostKeyPrompt[]>([])
  /** Queue of pending keyboard-interactive (2FA) prompts. */
  const [kbiPrompts, setKbiPrompts] = useState<KbInteractivePrompt[]>([])
  /** null = checking, true = locked (show lock screen), false = unlocked. */
  const [locked, setLocked] = useState<boolean | null>(null)
  /** Pending Web Serial port choices (shown as a picker). */
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[] | null>(null)

  useEffect(() => {
    return window.api.serial.onAsk((ports) => setSerialPorts(ports))
  }, [])

  const chooseSerial = (portId: string): void => {
    window.api.serial.choose(portId)
    setSerialPorts(null)
  }

  useEffect(() => {
    void window.api.lock.status().then((s) => setLocked(s.enabled))
  }, [])

  useEffect(() => {
    return window.api.hostkey.onAsk((p) => setHkPrompts((q) => [...q, p]))
  }, [])

  useEffect(() => {
    return window.api.kbi.onAsk((p) => setKbiPrompts((q) => [...q, p]))
  }, [])

  const answerHostKey = (promptId: string, accept: boolean): void => {
    window.api.hostkey.answer(promptId, accept)
    setHkPrompts((q) => q.filter((p) => p.promptId !== promptId))
  }

  const answerKbi = (promptId: string, answers: string[] | null): void => {
    window.api.kbi.answer(promptId, answers)
    setKbiPrompts((q) => q.filter((p) => p.promptId !== promptId))
  }

  useEffect(() => {
    void (async () => {
      let list = await window.api.hosts.list()
      if (list.length === 0) {
        list = await window.api.hosts.upsert({
          id: crypto.randomUUID(),
          label: 'Demo (test.rebex.net)',
          host: 'test.rebex.net',
          port: 22,
          username: 'demo',
          authType: 'password',
          password: 'password',
          group: 'Hosts'
        })
      }
      setHosts(list)
    })()
  }, [])

  const openHost = (host: HostConfig, kind: TabKind = 'terminal'): void => {
    const tabId = crypto.randomUUID()
    setTabs((t) => [...t, { tabId, host, kind, status: 'connecting', paneIds: [crypto.randomUUID()] }])
    setActiveTabId(tabId)
    setShowingTab(true)
    setPanelOpen(false)
  }

  const splitTabPane = (tabId: string): void => {
    setTabs((prev) => prev.map((t) =>
      t.tabId === tabId && t.kind === 'terminal' && t.paneIds.length < 2
        ? { ...t, paneIds: [...t.paneIds, crypto.randomUUID()] }
        : t
    ))
  }

  const closeTabPane = (tabId: string, paneId: string): void => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.tabId === tabId)
      if (!tab) return prev
      const next = tab.paneIds.filter((p) => p !== paneId)
      if (next.length === 0) {
        // No panes left — close the whole tab.
        const trimmed = prev.filter((t) => t.tabId !== tabId)
        setActiveTabId((cur) => (cur === tabId ? (trimmed[trimmed.length - 1]?.tabId ?? null) : cur))
        if (trimmed.length === 0) setShowingTab(false)
        return trimmed
      }
      return prev.map((t) => (t.tabId === tabId ? { ...t, paneIds: next } : t))
    })
  }

  /** Bind a pending tab to a chosen host — starts the session. */
  const bindTab = (tabId: string, host: HostConfig): void => {
    setTabs((prev) =>
      prev.map((t) => (t.tabId === tabId ? { ...t, host, status: 'connecting' } : t))
    )
  }

  const quickConnect = (raw: string): void => {
    const s = raw.trim()
    const at = s.indexOf('@')
    const user = at >= 0 ? s.slice(0, at) : 'root'
    const rest = at >= 0 ? s.slice(at + 1) : s
    const [h, p] = rest.split(':')
    openHost(
      {
        id: crypto.randomUUID(),
        label: s,
        host: h,
        port: parseInt(p, 10) || 22,
        username: user,
        authType: 'agent'
      },
      'terminal'
    )
  }

  const closeTab = (tabId: string): void => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.tabId !== tabId)
      setActiveTabId((cur) => {
        if (cur !== tabId) return cur
        const fallback = next[next.length - 1]?.tabId ?? null
        if (!fallback) setShowingTab(false)
        return fallback
      })
      return next
    })
  }

  const setStatus = (tabId: string, status: TabStatus): void =>
    setTabs((prev) => prev.map((t) => (t.tabId === tabId ? { ...t, status } : t)))

  const saveHost = async (host: HostConfig, connect: boolean): Promise<void> => {
    const list = await window.api.hosts.upsert(host)
    setHosts(list)
    setPanelOpen(false)
    setEditing(null)
    if (connect) openHost(host, 'terminal')
  }

  const removeHost = async (id: string): Promise<void> => {
    setHosts(await window.api.hosts.remove(id))
  }

  const importSshConfig = async (): Promise<void> => {
    const r = await window.api.sshConfig.import()
    if (r.ok) setHosts(await window.api.hosts.list())
    // eslint-disable-next-line no-alert
    alert(r.ok ? `Imported ${r.added} host(s) from ~/.ssh/config.` : r.error ?? 'Import failed.')
  }

  const selectNav = (s: NavSection): void => {
    setView(s)
    setShowingTab(false)
    setPanelOpen(false)
  }

  const topTabs: TopTab[] = tabs.map((t) => ({
    tabId: t.tabId,
    title: t.host ? t.host.label : `New ${t.kind === 'sftp' ? 'SFTP' : 'Terminal'}`,
    kind: t.kind,
    status: t.status
  }))

  // Snippet "Run" target = active terminal tab's session.
  const activeTab = tabs.find((t) => t.tabId === activeTabId)
  const activeTermSession =
    showingTab && activeTab?.kind === 'terminal' ? tabSessions[activeTab.tabId] ?? null : null
  const runInActiveTerminal = activeTermSession
    ? (cmd: string): void => {
        window.api.ssh.write(activeTermSession, cmd + '\n')
        setShowingTab(true)
      }
    : undefined

  const sectionVisible = (s: NavSection): boolean => !showingTab && view === s

  if (locked === null) return <div className="app" />
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />

  return (
    <div className="app">
      <TopBar
        tabs={topTabs}
        activeTabId={activeTabId}
        showingTab={showingTab}
        onSelectTab={(id) => {
          setActiveTabId(id)
          setShowingTab(true)
        }}
        onCloseTab={closeTab}
        onNewTab={(kind: NewTabKind) => {
          if (kind === 'host') {
            setEditing(null)
            setPanelOpen(true)
            setShowingTab(false)
            setView('hosts')
            return
          }
          const tabId = crypto.randomUUID()
          if (kind === 'local' || kind === 'serial') {
            // Local shell / serial console need no host — open immediately.
            const synthetic: HostConfig = {
              id: `${kind}-${tabId}`,
              label: kind === 'local' ? 'Local shell' : 'Serial console',
              host: '', port: 0, username: '', authType: 'agent'
            }
            setTabs((t) => [
              ...t,
              { tabId, host: synthetic, kind, status: 'connecting', paneIds: [crypto.randomUUID()] }
            ])
            setActiveTabId(tabId)
            setShowingTab(true)
            setPanelOpen(false)
            return
          }
          // Create a real new tab in the top bar, pending until a host is picked.
          setTabs((t) => [...t, { tabId, host: null, kind, status: 'pending', paneIds: [crypto.randomUUID()] }])
          setActiveTabId(tabId)
          setOpenAs(kind)
          setShowingTab(true)
          setPanelOpen(false)
        }}
      />

      <div className="body">
        <NavSidebar active={view} showing={!showingTab} onSelect={selectNav} />

        <main className="main">
          <div className="content">
            {/* Tab panes — always mounted so sessions persist across view switches. */}
            {tabs.map((t) => {
              const isActive = showingTab && t.tabId === activeTabId
              if (!t.host) {
                return (
                  <SessionPicker
                    key={t.tabId}
                    kind={t.kind === 'sftp' ? 'sftp' : 'terminal'}
                    active={isActive}
                    hosts={hosts}
                    onPick={(h) => bindTab(t.tabId, h)}
                    onQuickConnect={(raw) => {
                      const s = raw.trim()
                      const at = s.indexOf('@')
                      const user = at >= 0 ? s.slice(0, at) : 'root'
                      const rest = at >= 0 ? s.slice(at + 1) : s
                      const [h, p] = rest.split(':')
                      bindTab(t.tabId, {
                        id: crypto.randomUUID(),
                        label: s,
                        host: h,
                        port: parseInt(p, 10) || 22,
                        username: user,
                        authType: 'agent'
                      })
                    }}
                    onNewHost={() => {
                      setEditing(null)
                      setPanelOpen(true)
                      setShowingTab(false)
                      setView('hosts')
                    }}
                  />
                )
              }
              if (t.kind === 'sftp') {
                return (
                  <SftpView
                    key={t.tabId}
                    host={t.host}
                    active={isActive}
                    onStatus={(s) => setStatus(t.tabId, s)}
                  />
                )
              }
              if (t.kind === 'local') {
                return (
                  <TerminalView
                    key={t.tabId}
                    host={t.host}
                    active={isActive}
                    localShell
                    onStatus={(s) => setStatus(t.tabId, s)}
                  />
                )
              }
              if (t.kind === 'serial') {
                return (
                  <SerialView
                    key={t.tabId}
                    active={isActive}
                    onStatus={(s) => setStatus(t.tabId, s)}
                  />
                )
              }
              return (
                <SplitTerminal
                  key={t.tabId}
                  host={t.host}
                  active={isActive}
                  paneIds={t.paneIds}
                  onStatus={(s) => setStatus(t.tabId, s)}
                  onSession={(sid) => setTabSessions((m) => ({ ...m, [t.tabId]: sid }))}
                  onSplit={() => splitTabPane(t.tabId)}
                  onClosePane={(paneId) => closeTabPane(t.tabId, paneId)}
                />
              )
            })}

            <HostsView
              active={sectionVisible('hosts')}
              hosts={hosts}
              openAs={openAs}
              onOpenAsChange={setOpenAs}
              onOpen={openHost}
              onQuickConnect={quickConnect}
              onNewHost={() => {
                setEditing(null)
                setPanelOpen(true)
                setShowingTab(false)
                setView('hosts')
              }}
              onEdit={(h) => {
                setEditing(h)
                setPanelOpen(true)
                setShowingTab(false)
                setView('hosts')
              }}
              onDelete={removeHost}
              onImportConfig={importSshConfig}
            />

            {sectionVisible('keychain') && <KeychainView />}
            {sectionVisible('knownhosts') && <KnownHostsView />}
            {sectionVisible('portforward') && <PortForwardView hosts={hosts} />}
            {sectionVisible('snippets') && <SnippetsView onRun={runInActiveTerminal} />}
            {sectionVisible('settings') && <SettingsView />}
            {sectionVisible('logs') && <LogsView />}
          </div>
        </main>

        {panelOpen && (
          <NewHostPanel
            hosts={hosts}
            initial={editing ?? undefined}
            onSave={saveHost}
            onClose={() => {
              setPanelOpen(false)
              setEditing(null)
            }}
          />
        )}
      </div>

      {hkPrompts.length > 0 && (
        <HostKeyChangedDialog prompt={hkPrompts[0]} onAnswer={answerHostKey} />
      )}

      {kbiPrompts.length > 0 && (
        <KbInteractiveDialog prompt={kbiPrompts[0]} onAnswer={answerKbi} />
      )}

      {serialPorts && (
        <div className="modal-backdrop" onMouseDown={() => chooseSerial('')}>
          <div className="modal" style={{ width: 400 }} onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 10 }}>Select a serial port</h3>
            {serialPorts.length === 0 && <p className="section-sub">No serial ports detected.</p>}
            <div className="list-card">
              {serialPorts.map((p) => (
                <button key={p.portId} className="list-row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }} onClick={() => chooseSerial(p.portId)}>
                  <div className="list-meta">
                    <div className="list-name">{p.name}</div>
                    {(p.vid || p.pid) && <div className="list-sub mono">{p.vid}:{p.pid}</div>}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn sm" onClick={() => chooseSerial('')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
