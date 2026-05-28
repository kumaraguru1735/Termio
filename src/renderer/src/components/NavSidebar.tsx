import {
  IconHosts,
  IconKey,
  IconPortForward,
  IconSnippets,
  IconKnownHosts,
  IconLogs,
  IconSettings
} from './icons'

export type NavSection =
  | 'hosts'
  | 'keychain'
  | 'portforward'
  | 'snippets'
  | 'knownhosts'
  | 'logs'
  | 'settings'

const ITEMS: { id: NavSection; label: string; Icon: typeof IconHosts }[] = [
  { id: 'hosts', label: 'Hosts', Icon: IconHosts },
  { id: 'keychain', label: 'Keychain', Icon: IconKey },
  { id: 'portforward', label: 'Port Forwarding', Icon: IconPortForward },
  { id: 'snippets', label: 'Snippets', Icon: IconSnippets },
  { id: 'knownhosts', label: 'Known Hosts', Icon: IconKnownHosts },
  { id: 'logs', label: 'Logs', Icon: IconLogs }
]

interface Props {
  active: NavSection
  showing: boolean // is a section (vs a tab) currently in the main area
  onSelect: (s: NavSection) => void
}

/** Light, labeled left navigation — matches Termius's sidebar. */
export default function NavSidebar({ active, showing, onSelect }: Props): JSX.Element {
  return (
    <nav className="nav">
      {ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`nav-item${showing && active === id ? ' active' : ''}`}
          onClick={() => onSelect(id)}
        >
          <Icon />
          {label}
        </button>
      ))}
      <div className="spacer" />
      <div className="nav-foot">
        <button
          className={`nav-item${showing && active === 'settings' ? ' active' : ''}`}
          style={{ flex: 1, marginBottom: 0 }}
          onClick={() => onSelect('settings')}
        >
          <IconSettings />
          Settings
        </button>
        <button className="nav-avatar" title="Account">
          CS
        </button>
      </div>
    </nav>
  )
}
