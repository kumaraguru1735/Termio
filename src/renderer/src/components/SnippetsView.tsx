import { useEffect, useState } from 'react'
import type { Snippet } from '../../../shared/types'
import { IconTrash, IconPlay } from './icons'

interface Props {
  /** Sends the snippet to the active terminal; undefined when none is focused. */
  onRun?: (command: string) => void
}

/** Saved commands. “Run” pipes the command into the active terminal session. */
export default function SnippetsView({ onRun }: Props): JSX.Element {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')

  useEffect(() => {
    void window.api.snippets.list().then(setSnippets)
  }, [])

  const add = async (): Promise<void> => {
    if (!command.trim()) return
    setSnippets(
      await window.api.snippets.save({
        id: crypto.randomUUID(),
        name: name.trim() || command.trim().slice(0, 24),
        command: command.trim()
      })
    )
    setName('')
    setCommand('')
  }

  const remove = async (id: string): Promise<void> => {
    setSnippets(await window.api.snippets.remove(id))
  }

  return (
    <div className="section-view">
      <h2>Snippets</h2>
      <p className="section-sub">
        Saved commands. {onRun ? 'Run sends them to the focused terminal.' : 'Open a terminal to run them.'}
      </p>

      <div className="pf-form">
        <input
          style={{ flex: 1 }}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          style={{ flex: 3, fontFamily: 'monospace' }}
          placeholder="command to run…"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn primary sm" onClick={add}>
          Save
        </button>
      </div>

      <div className="list-card" style={{ marginTop: 16 }}>
        {snippets.length === 0 && <div className="empty-hint">No snippets yet.</div>}
        {snippets.map((s) => (
          <div key={s.id} className="list-row">
            <div className="list-meta">
              <div className="list-name">{s.name}</div>
              <div className="list-sub mono">{s.command}</div>
            </div>
            <button
              className="btn sm primary"
              disabled={!onRun}
              title={onRun ? 'Run in active terminal' : 'No active terminal'}
              onClick={() => onRun?.(s.command)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconPlay style={{ width: 13, height: 13 }} /> Run
              </span>
            </button>
            <button className="icon-btn danger" title="Delete" onClick={() => remove(s.id)}>
              <IconTrash />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
