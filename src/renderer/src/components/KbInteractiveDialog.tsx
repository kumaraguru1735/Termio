import { useState } from 'react'
import type { KbInteractivePrompt } from '../../../shared/types'
import { IconLock } from './icons'

interface Props {
  prompt: KbInteractivePrompt
  onAnswer: (promptId: string, answers: string[] | null) => void
}

/**
 * Modal for keyboard-interactive auth (2FA/MFA, OTP). The server supplies one
 * or more prompts; we collect a response for each and send them back in order.
 */
export default function KbInteractiveDialog({ prompt, onAnswer }: Props): JSX.Element {
  const [answers, setAnswers] = useState<string[]>(prompt.prompts.map(() => ''))

  const submit = (): void => onAnswer(prompt.promptId, answers)

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="hk-head" style={{ marginBottom: 10 }}>
          <div className="hk-icon"><IconLock /></div>
          <div>
            <h3>{prompt.name || 'Two-factor authentication'}</h3>
            <div className="hk-sub">
              {prompt.label ? `${prompt.label} — ` : ''}
              <span className="mono">{prompt.host}</span>
            </div>
          </div>
        </div>

        {prompt.instructions && (
          <p className="section-sub" style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>
            {prompt.instructions}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {prompt.prompts.map((p, i) => (
            <div className="fld" key={i}>
              <span className="lbl" style={{ minWidth: 0, flex: '0 0 auto', marginRight: 8 }}>
                {p.prompt.trim() || 'Response'}
              </span>
              <input
                autoFocus={i === 0}
                type={p.echo ? 'text' : 'password'}
                value={answers[i]}
                onChange={(e) =>
                  setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))
                }
              />
            </div>
          ))}
          {prompt.prompts.length === 0 && (
            <p className="section-sub">The server requires confirmation to continue.</p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" className="btn sm" onClick={() => onAnswer(prompt.promptId, null)}>
              Cancel
            </button>
            <button type="submit" className="btn primary sm">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
