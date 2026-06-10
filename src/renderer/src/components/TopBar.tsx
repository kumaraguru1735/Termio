import { useEffect, useRef, useState } from 'react'
import {
  IconMenu,
  IconChevronDown,
  IconPlus,
  IconSftp,
  IconTerminal,
  IconHosts,
  IconBell,
  IconMinimize,
  IconMaximize,
  IconCross
} from './icons'
import type { TabStatus } from './TerminalView'

export interface TopTab {
  tabId: string
  title: string
  kind: 'terminal' | 'sftp' | 'local' | 'serial'
  status: TabStatus
}

export type NewTabKind = 'terminal' | 'sftp' | 'host' | 'local' | 'serial'

interface Props {
  tabs: TopTab[]
  activeTabId: string | null
  showingTab: boolean
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewTab: (kind: NewTabKind) => void
}

/** Dark Termius-style title bar: hamburger, Vault selector, session tabs, +. */
export default function TopBar({
  tabs,
  activeTabId,
  showingTab,
  onSelectTab,
  onCloseTab,
  onNewTab
}: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const pick = (k: NewTabKind): void => {
    setMenuOpen(false)
    onNewTab(k)
  }

  return (
    <div className="topbar">
      <button className="hamburger" title="Menu">
        <IconMenu />
      </button>
      <span className="brand" title="Termio">
        <span className="brand-mark" />
        Termio
      </span>
      <button className="vault-chip" title="Vault">
        <span className="vk" />
        Vaults
        <IconChevronDown style={{ width: 13, height: 13 }} />
      </button>
      <div className="top-tabs">
        {tabs.map((t) => (
          <button
            key={t.tabId}
            className={`top-tab${showingTab && t.tabId === activeTabId ? ' active' : ''}`}
            onClick={() => onSelectTab(t.tabId)}
          >
            {t.kind === 'sftp' ? (
              <IconSftp style={{ width: 14, height: 14 }} />
            ) : (
              <IconTerminal style={{ width: 14, height: 14 }} />
            )}
            <span className="ttl">{t.title}</span>
            <span className={`status-dot ${t.status}`} />
            <span
              className="x"
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(t.tabId)
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>
      <div className="top-add-wrap" ref={menuRef}>
        <button className="top-add" title="New tab" onClick={() => setMenuOpen((o) => !o)}>
          <IconPlus style={{ width: 15, height: 15 }} />
        </button>
        {menuOpen && (
          <div className="popover">
            <button className="popover-item" onClick={() => pick('terminal')}>
              <IconTerminal /> <span>New Terminal session</span>
            </button>
            <button className="popover-item" onClick={() => pick('sftp')}>
              <IconSftp /> <span>New SFTP session</span>
            </button>
            <button className="popover-item" onClick={() => pick('local')}>
              <IconTerminal /> <span>New Local shell</span>
            </button>
            <button className="popover-item" onClick={() => pick('serial')}>
              <IconTerminal /> <span>New Serial console</span>
            </button>
            <div className="popover-sep" />
            <button className="popover-item" onClick={() => pick('host')}>
              <IconHosts /> <span>New Host…</span>
            </button>
          </div>
        )}
      </div>
      <span className="spacer" />
      <div className="win-btns">
        <button title="Notifications"><IconBell style={{ width: 16, height: 16 }} /></button>
        <button title="Minimize" onClick={() => window.api.window.minimize()}>
          <IconMinimize style={{ width: 14, height: 14 }} />
        </button>
        <button title="Maximize" onClick={() => window.api.window.maximize()}>
          <IconMaximize style={{ width: 12, height: 12 }} />
        </button>
        <button className="closeb" title="Close" onClick={() => window.api.window.close()}>
          <IconCross style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  )
}
