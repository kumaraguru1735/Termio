import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC, type KbInteractivePrompt } from '../shared/types'

export interface HostKeyChangedAsk {
  promptId: string
  host: string
  port: number
  label?: string
  oldFingerprint: string
  newFingerprint: string
}

const pending = new Map<string, (accept: boolean) => void>()
const pendingKbi = new Map<string, (answers: string[] | null) => void>()

export function registerPromptHandlers(): void {
  ipcMain.on(IPC.hostkeyChangedAnswer, (_e, payload: { promptId: string; accept: boolean }) => {
    const resolve = pending.get(payload.promptId)
    if (!resolve) return
    pending.delete(payload.promptId)
    resolve(!!payload.accept)
  })

  ipcMain.on(
    IPC.kbInteractiveAnswer,
    (_e, payload: { promptId: string; answers: string[] | null }) => {
      const resolve = pendingKbi.get(payload.promptId)
      if (!resolve) return
      pendingKbi.delete(payload.promptId)
      resolve(payload.answers)
    }
  )
}

/**
 * Ask the renderer to answer a keyboard-interactive (2FA/MFA) challenge.
 * Returns the answers in prompt order, or null if cancelled / no answer in 2m.
 */
export function askKeyboardInteractive(
  p: Omit<KbInteractivePrompt, 'promptId'>
): Promise<string[] | null> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return Promise.resolve(null)
  const promptId = randomUUID()
  return new Promise<string[] | null>((resolve) => {
    pendingKbi.set(promptId, resolve)
    win.webContents.send(IPC.kbInteractiveAsk, { promptId, ...p } satisfies KbInteractivePrompt)
    setTimeout(() => {
      if (pendingKbi.has(promptId)) {
        pendingKbi.delete(promptId)
        resolve(null)
      }
    }, 120_000)
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
