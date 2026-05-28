import { ipcMain } from 'electron'
import { IPC, type Snippet } from '../shared/types'
import { readJson, writeJson } from './jsonstore'

const FILE = 'snippets.json'

const SEED: Snippet[] = [
  { id: 'seed-1', name: 'Disk usage', command: 'df -h' },
  { id: 'seed-2', name: 'Top processes', command: 'ps aux --sort=-%cpu | head' },
  { id: 'seed-3', name: 'Listening ports', command: 'ss -tulpn' }
]

function list(): Snippet[] {
  const s = readJson<Snippet[] | null>(FILE, null)
  if (s === null) {
    writeJson(FILE, SEED)
    return SEED
  }
  return s
}

export function registerSnippetHandlers(): void {
  ipcMain.handle(IPC.snipList, (): Snippet[] => list())

  ipcMain.handle(IPC.snipSave, (_e, snip: Snippet): Snippet[] => {
    const all = list()
    const i = all.findIndex((s) => s.id === snip.id)
    if (i >= 0) all[i] = snip
    else all.push(snip)
    writeJson(FILE, all)
    return all
  })

  ipcMain.handle(IPC.snipDelete, (_e, id: string): Snippet[] => {
    const all = list().filter((s) => s.id !== id)
    writeJson(FILE, all)
    return all
  })
}
