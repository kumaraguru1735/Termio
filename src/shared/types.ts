// Types shared across main, preload, and renderer processes.

export type AuthType = 'password' | 'key' | 'agent'

export type BackspaceMode = 'default' | 'ctrl-h'
export type ProxyType = 'none' | 'socks5'

/**
 * A reusable credential set (Termius-style "identity"). Hosts reference one
 * by id so a password/key change propagates to every host using it.
 */
export interface Identity {
  id: string
  /** Display name, e.g. "prod-deploy" or "personal ed25519". */
  name: string
  username: string
  authType: AuthType
  /** Stored encrypted at rest (same store mechanism as hosts). */
  password?: string
  privateKeyPath?: string
  passphrase?: string
}

export interface HostConfig {
  id: string
  label: string
  host: string
  port: number
  username: string
  authType: AuthType
  /** Stored encrypted at rest via the host store (safeStorage). */
  password?: string
  /** Path to a private key file (authType === 'key'). */
  privateKeyPath?: string
  /** Optional passphrase for the private key (encrypted at rest). */
  passphrase?: string
  group?: string
  /** Free-form labels. */
  tags?: string[]
  /** Terminal backspace key: default sends ^? (0x7f), ctrl-h sends ^H (0x08). */
  backspace?: BackspaceMode
  /** Forward your local SSH agent to the remote (requires authType === 'agent' or an agent socket). */
  agentForward?: boolean
  /** Commands to run automatically once the shell is ready. */
  startupSnippet?: string
  /** Id of another saved host to use as a jump (proxy) host. */
  jumpHostId?: string
  /** Connect through a SOCKS5 proxy. */
  proxy?: { type: ProxyType; host: string; port: number }
  /** Environment variables to send before opening the shell (server must allow). */
  env?: Record<string, string>
  /** Use a saved identity's credentials instead of the inline ones. */
  identityId?: string
  /** Reconnect automatically after an unexpected drop / network restore (default on). */
  autoReconnect?: boolean
}

export interface KnownHost {
  /** `${host}:${port}` */
  id: string
  algo: string
  /** SHA256 base64 fingerprint, OpenSSH style. */
  fingerprint: string
  addedAt: number
}

export interface KeyFile {
  name: string
  path: string
  hasPublic: boolean
}

export interface FileEntry {
  name: string
  type: 'dir' | 'file' | 'link'
  size: number
  modified: number
}

export interface DirListing {
  ok: boolean
  path: string
  entries: FileEntry[]
  error?: string
}

export interface SftpResult {
  ok: boolean
  error?: string
}

export interface PortForward {
  id: string
  name: string
  /** Which saved host provides the SSH tunnel. */
  hostId: string
  /** Local listen port on 127.0.0.1. */
  bindPort: number
  /** Destination reachable from the SSH server. */
  destHost: string
  destPort: number
}

export interface Snippet {
  id: string
  name: string
  command: string
}

export type ActivityKind =
  | 'terminal'
  | 'sftp'
  | 'portforward'
  | 'hostkey-new'
  | 'hostkey-changed'

export type ActivityEvent =
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'accepted'
  | 'refused'

export interface ActivityRecord {
  id: string
  ts: number
  host: string
  port: number
  username?: string
  label?: string
  kind: ActivityKind
  event: ActivityEvent
  detail?: string
}

export interface SyncResult {
  ok: boolean
  /** File path written/read (export/import). */
  path?: string
  /** Restored counts on import. */
  counts?: { hosts: number; snippets: number; forwards: number; knownHosts: number }
  error?: string
  /** True when the user cancelled the file dialog. */
  cancelled?: boolean
}

export interface SshConnectResult {
  ok: boolean
  /** Present when ok === true; identifies the live session for write/resize/close. */
  sessionId?: string
  error?: string
}

/** Channels the preload bridge exposes to the renderer. */
export const IPC = {
  sshConnect: 'ssh:connect',
  sshWrite: 'ssh:write',
  sshResize: 'ssh:resize',
  sshClose: 'ssh:close',
  // Per-session push channels are suffixed with the sessionId:
  sshData: (id: string) => `ssh:data:${id}`,
  sshClosed: (id: string) => `ssh:closed:${id}`,
  // Host store
  hostsList: 'hosts:list',
  hostsUpsert: 'hosts:upsert',
  hostsDelete: 'hosts:delete',
  // Reusable credentials (identities)
  identitiesList: 'identities:list',
  identitiesUpsert: 'identities:upsert',
  identitiesDelete: 'identities:delete',
  // Keys / known hosts (Phase 4)
  keysList: 'keys:list',
  keyBrowse: 'keys:browse',
  knownHostsList: 'knownhosts:list',
  knownHostsDelete: 'knownhosts:delete',
  // SFTP (Phase 5)
  sftpConnect: 'sftp:connect',
  sftpList: 'sftp:list',
  sftpDownload: 'sftp:download',
  sftpUpload: 'sftp:upload',
  sftpMkdir: 'sftp:mkdir',
  sftpDelete: 'sftp:delete',
  sftpRename: 'sftp:rename',
  sftpClose: 'sftp:close',
  // Local filesystem (for the SFTP local pane)
  localList: 'local:list',
  localHome: 'local:home',
  // Port forwarding (Phase 6)
  pfList: 'pf:list',
  pfSave: 'pf:save',
  pfDelete: 'pf:delete',
  pfStart: 'pf:start',
  pfStop: 'pf:stop',
  pfActive: 'pf:active',
  // Snippets (Phase 6)
  snipList: 'snip:list',
  snipSave: 'snip:save',
  snipDelete: 'snip:delete',
  // Encrypted vault sync (Phase 7)
  syncExport: 'sync:export',
  syncImport: 'sync:import',
  // Window controls (custom title bar)
  windowMinimize: 'win:min',
  windowMaximize: 'win:max',
  windowClose: 'win:close',
  // Activity log
  activityList: 'activity:list',
  activityClear: 'activity:clear',
  // Host-key changed prompt (main → renderer / renderer → main)
  hostkeyChangedAsk: 'hostkey:changed-ask',
  hostkeyChangedAnswer: 'hostkey:changed-answer',
  // SSH key generation
  keyGenerate: 'keys:generate'
} as const
