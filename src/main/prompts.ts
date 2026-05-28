import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC } from '../shared/types'

export interface HostKeyChangedAsk {
  promptId: string
  host: string
  port: number
  label?: string
  oldFingerprint: string
  newFingerprint: string
}

const pending = new Map<string, (accept: boolean) => void>()

export function registerPromptHandlers(): void {
  ipcMain.on(IPC.hostkeyChangedAnswer, (_e, payload: { promptId: string; accept: boolean }) => {
    const resolve = pending.get(payload.promptId)
    if (!resolve) return
    pending.delete(payload.promptId)
    resolve(!!payload.accept)
  })
}

/**
 * Ask the renderer whether to trust a new host key. Returns true if the user
 * accepted, false on refusal or no answer within 60s.
 */
export function askHostKeyChanged(p: Omit<HostKeyChangedAsk, 'promptId'>): Promise<boolean> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return Promise.resolve(false)
  const promptId = randomUUID()
  return new Promise<boolean>((resolve) => {
    pending.set(promptId, resolve)
    win.webContents.send(IPC.hostkeyChangedAsk, { promptId, ...p } satisfies HostKeyChangedAsk)
    // Safety: if no answer within 60s, refuse.
    setTimeout(() => {
      if (pending.has(promptId)) {
        pending.delete(promptId)
        resolve(false)
      }
    }, 60_000)
  })
}
