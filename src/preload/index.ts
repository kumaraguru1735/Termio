import { clipboard, contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type HostConfig,
  type SshConnectResult,
  type KnownHost,
  type KeyFile,
  type Identity,
  type DirListing,
  type SftpResult,
  type PortForward,
  type Snippet,
  type SyncResult,
  type ActivityRecord,
  type KbInteractivePrompt,
  type SerialPortInfo
} from '../shared/types'

const api = {
  ssh: {
    connect: (cfg: HostConfig): Promise<SshConnectResult> =>
      ipcRenderer.invoke(IPC.sshConnect, cfg),

    write: (sessionId: string, data: string): void => {
      ipcRenderer.send(IPC.sshWrite, sessionId, data)
    },

    resize: (sessionId: string, cols: number, rows: number): void => {
      ipcRenderer.send(IPC.sshResize, sessionId, cols, rows)
    },

    close: (sessionId: string): void => {
      ipcRenderer.send(IPC.sshClose, sessionId)
    },

    /** Subscribe to terminal output for a session. Returns an unsubscribe fn. */
    onData: (sessionId: string, cb: (data: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, data: string): void => cb(data)
      ipcRenderer.on(IPC.sshData(sessionId), handler)
      return () => ipcRenderer.removeListener(IPC.sshData(sessionId), handler)
    },

    /** Subscribe to the session-closed event. Returns an unsubscribe fn. */
    onClosed: (sessionId: string, cb: () => void): (() => void) => {
      const handler = (): void => cb()
      ipcRenderer.on(IPC.sshClosed(sessionId), handler)
      return () => ipcRenderer.removeListener(IPC.sshClosed(sessionId), handler)
    }
  },

  hosts: {
    list: (): Promise<HostConfig[]> => ipcRenderer.invoke(IPC.hostsList),
    upsert: (host: HostConfig): Promise<HostConfig[]> => ipcRenderer.invoke(IPC.hostsUpsert, host),
    remove: (id: string): Promise<HostConfig[]> => ipcRenderer.invoke(IPC.hostsDelete, id)
  },

  identities: {
    list: (): Promise<Identity[]> => ipcRenderer.invoke(IPC.identitiesList),
    upsert: (identity: Identity): Promise<Identity[]> =>
      ipcRenderer.invoke(IPC.identitiesUpsert, identity),
    remove: (id: string): Promise<Identity[]> => ipcRenderer.invoke(IPC.identitiesDelete, id)
  },

  keys: {
    list: (): Promise<KeyFile[]> => ipcRenderer.invoke(IPC.keysList),
    browse: (): Promise<string | null> => ipcRenderer.invoke(IPC.keyBrowse),
    generate: (req: {
      name: string
      type: 'ed25519' | 'rsa-4096'
      passphrase?: string
      comment?: string
    }): Promise<{ ok: boolean; key?: KeyFile; error?: string }> =>
      ipcRenderer.invoke(IPC.keyGenerate, req)
  },

  knownHosts: {
    list: (): Promise<KnownHost[]> => ipcRenderer.invoke(IPC.knownHostsList),
    remove: (id: string): Promise<KnownHost[]> => ipcRenderer.invoke(IPC.knownHostsDelete, id)
  },

  sftp: {
    connect: (cfg: HostConfig): Promise<SshConnectResult> => ipcRenderer.invoke(IPC.sftpConnect, cfg),
    list: (sessionId: string, path: string): Promise<DirListing> =>
      ipcRenderer.invoke(IPC.sftpList, sessionId, path),
    download: (sessionId: string, remotePath: string, localPath: string): Promise<SftpResult> =>
      ipcRenderer.invoke(IPC.sftpDownload, sessionId, remotePath, localPath),
    upload: (sessionId: string, localPath: string, remotePath: string): Promise<SftpResult> =>
      ipcRenderer.invoke(IPC.sftpUpload, sessionId, localPath, remotePath),
    mkdir: (sessionId: string, path: string): Promise<SftpResult> =>
      ipcRenderer.invoke(IPC.sftpMkdir, sessionId, path),
    remove: (sessionId: string, path: string, isDir: boolean): Promise<SftpResult> =>
      ipcRenderer.invoke(IPC.sftpDelete, sessionId, path, isDir),
    rename: (sessionId: string, from: string, to: string): Promise<SftpResult> =>
      ipcRenderer.invoke(IPC.sftpRename, sessionId, from, to),
    close: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.sftpClose, sessionId)
  },

  local: {
    home: (): Promise<string> => ipcRenderer.invoke(IPC.localHome),
    list: (path: string): Promise<DirListing> => ipcRenderer.invoke(IPC.localList, path)
  },

  /** Non-SSH terminals: local shell, telnet, mosh. Output/close arrive on the
   *  same channels as SSH, so use window.api.ssh.onData/onClosed to subscribe. */
  term: {
    openLocal: (): Promise<{ ok: boolean; sessionId?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.termOpenLocal),
    openTelnet: (host: string, port: number): Promise<{ ok: boolean; sessionId?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.termOpenTelnet, host, port),
    openMosh: (target: string, extra: string[]): Promise<{ ok: boolean; sessionId?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.termOpenMosh, target, extra),
    write: (sessionId: string, data: string): void => ipcRenderer.send(IPC.termWrite, sessionId, data),
    resize: (sessionId: string, cols: number, rows: number): void =>
      ipcRenderer.send(IPC.termResize, sessionId, cols, rows),
    close: (sessionId: string): void => ipcRenderer.send(IPC.termClose, sessionId)
  },

  files: {
    /** Resolve the absolute filesystem path of a File dropped from the OS. */
    pathFor: (file: File): string => webUtils.getPathForFile(file)
  },

  clipboard: {
    writeText: (text: string): void => clipboard.writeText(text),
    readText: (): string => clipboard.readText()
  },

  pf: {
    list: (): Promise<PortForward[]> => ipcRenderer.invoke(IPC.pfList),
    save: (rule: PortForward): Promise<PortForward[]> => ipcRenderer.invoke(IPC.pfSave, rule),
    remove: (id: string): Promise<PortForward[]> => ipcRenderer.invoke(IPC.pfDelete, id),
    start: (id: string): Promise<SftpResult> => ipcRenderer.invoke(IPC.pfStart, id),
    stop: (id: string): Promise<string[]> => ipcRenderer.invoke(IPC.pfStop, id),
    active: (): Promise<string[]> => ipcRenderer.invoke(IPC.pfActive)
  },

  snippets: {
    list: (): Promise<Snippet[]> => ipcRenderer.invoke(IPC.snipList),
    save: (snip: Snippet): Promise<Snippet[]> => ipcRenderer.invoke(IPC.snipSave, snip),
    remove: (id: string): Promise<Snippet[]> => ipcRenderer.invoke(IPC.snipDelete, id)
  },

  sync: {
    export: (passphrase: string): Promise<SyncResult> => ipcRenderer.invoke(IPC.syncExport, passphrase),
    import: (passphrase: string): Promise<SyncResult> => ipcRenderer.invoke(IPC.syncImport, passphrase)
  },

  window: {
    minimize: (): void => ipcRenderer.send(IPC.windowMinimize),
    maximize: (): void => ipcRenderer.send(IPC.windowMaximize),
    close: (): void => ipcRenderer.send(IPC.windowClose)
  },

  activity: {
    list: (): Promise<ActivityRecord[]> => ipcRenderer.invoke(IPC.activityList),
    clear: (): Promise<ActivityRecord[]> => ipcRenderer.invoke(IPC.activityClear)
  },

  hostkey: {
    /** Subscribe to incoming "host key changed" prompts from main. */
    onAsk: (
      cb: (p: {
        promptId: string
        host: string
        port: number
        label?: string
        oldFingerprint: string
        newFingerprint: string
      }) => void
    ): (() => void) => {
      const h = (_e: IpcRendererEvent, p: unknown): void => cb(p as Parameters<typeof cb>[0])
      ipcRenderer.on(IPC.hostkeyChangedAsk, h)
      return () => ipcRenderer.removeListener(IPC.hostkeyChangedAsk, h)
    },
    answer: (promptId: string, accept: boolean): void => {
      ipcRenderer.send(IPC.hostkeyChangedAnswer, { promptId, accept })
    }
  },

  kbi: {
    /** Subscribe to incoming keyboard-interactive (2FA) challenges. */
    onAsk: (cb: (p: KbInteractivePrompt) => void): (() => void) => {
      const h = (_e: IpcRendererEvent, p: unknown): void => cb(p as KbInteractivePrompt)
      ipcRenderer.on(IPC.kbInteractiveAsk, h)
      return () => ipcRenderer.removeListener(IPC.kbInteractiveAsk, h)
    },
    answer: (promptId: string, answers: string[] | null): void => {
      ipcRenderer.send(IPC.kbInteractiveAnswer, { promptId, answers })
    }
  },

  sshConfig: {
    import: (): Promise<{ ok: boolean; added: number; error?: string }> =>
      ipcRenderer.invoke(IPC.sshConfigImport)
  },

  lock: {
    status: (): Promise<{ enabled: boolean }> => ipcRenderer.invoke(IPC.lockStatus),
    set: (passphrase: string | null): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.lockSet, passphrase),
    verify: (passphrase: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.lockVerify, passphrase)
  },

  serial: {
    /** Subscribe to the port list when the OS prompts for a serial choice. */
    onAsk: (cb: (ports: SerialPortInfo[]) => void): (() => void) => {
      const h = (_e: IpcRendererEvent, ports: unknown): void => cb(ports as SerialPortInfo[])
      ipcRenderer.on(IPC.serialAsk, h)
      return () => ipcRenderer.removeListener(IPC.serialAsk, h)
    },
    choose: (portId: string): void => ipcRenderer.send(IPC.serialChoose, portId)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
