import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC, type ActivityRecord, type ActivityKind, type ActivityEvent, type HostConfig } from '../shared/types'
import { readJson, writeJson } from './jsonstore'

const FILE = 'activity.json'
const CAP = 500 // keep most recent N events

function read(): ActivityRecord[] {
  return readJson<ActivityRecord[]>(FILE, [])
}

/** Append a single record; trims to the cap. Best-effort, never throws. */
export function logActivity(
  partial: Omit<ActivityRecord, 'id' | 'ts'> & { ts?: number }
): void {
  try {
    const rec: ActivityRecord = { id: randomUUID(), ts: partial.ts ?? Date.now(), ...partial }
    const list = read()
    list.push(rec)
    if (list.length > CAP) list.splice(0, list.length - CAP)
    writeJson(FILE, list)
  } catch {
    /* logging must never break a connection */
  }
}

/** Convenience: log a connect/disconnect lifecycle event for a host. */
export function logHost(
  cfg: HostConfig,
  kind: ActivityKind,
  event: ActivityEvent,
  detail?: string
): void {
  logActivity({
    host: cfg.host,
    port: cfg.port ?? 22,
    username: cfg.username,
    label: cfg.label,
    kind,
    event,
    detail
  })
}

export function registerActivityHandlers(): void {
  ipcMain.handle(IPC.activityList, (): ActivityRecord[] => {
    // Return newest-first to match the UI's natural reading order.
    return read().slice().reverse()
  })
  ipcMain.handle(IPC.activityClear, (): ActivityRecord[] => {
    writeJson(FILE, [])
    return []
  })
}
