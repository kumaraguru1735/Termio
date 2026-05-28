import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

/** Tiny JSON file store under userData for non-secret structured data. */
export function readJson<T>(name: string, fallback: T): T {
  try {
    const f = join(app.getPath('userData'), name)
    if (!existsSync(f)) return fallback
    return JSON.parse(readFileSync(f, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJson(name: string, data: unknown): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2), 'utf8')
}
