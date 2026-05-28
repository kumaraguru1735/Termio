import { IconKnownHosts } from './icons'

export interface HostKeyPrompt {
  promptId: string
  host: string
  port: number
  label?: string
  oldFingerprint: string
  newFingerprint: string
}

interface Props {
  prompt: HostKeyPrompt
  onAnswer: (promptId: string, accept: boolean) => void
}

/**
 * Modal shown when an incoming SSH connection presents a host key that
 * differs from what we previously trusted. The user must choose:
 *   - Refuse (default safe choice) — the connection is aborted.
 *   - Trust new key — known_hosts is updated and the connection proceeds.
 */
export default function HostKeyChangedDialog({ prompt, onAnswer }: Props): JSX.Element {
  return (
    <div className="modal-backdrop hk-backdrop">
      <div className="hk-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="hk-head">
          <div className="hk-icon"><IconKnownHosts /></div>
          <div>
            <h3>Remote host key has changed</h3>
            <div className="hk-sub">
              {prompt.label ? `${prompt.label} — ` : ''}
              <span className="mono">{prompt.host}:{prompt.port}</span>
            </div>
          </div>
        </div>

        <div className="hk-body">
          <p>
            The server presented a host key different from the one Termio recorded the
            last time you connected. This can be a legitimate server-key rotation —
            <strong> or it can be a man-in-the-middle attack</strong>. Verify the new
            fingerprint out-of-band before trusting it.
          </p>

          <div className="hk-fp">
            <div className="hk-fp-row">
              <span className="hk-fp-label">Previously trusted</span>
              <span className="mono hk-fp-val">{prompt.oldFingerprint}</span>
            </div>
            <div className="hk-fp-row">
              <span className="hk-fp-label new">New key</span>
              <span className="mono hk-fp-val new">{prompt.newFingerprint}</span>
            </div>
          </div>
        </div>

        <div className="hk-actions">
          <button className="btn" onClick={() => onAnswer(prompt.promptId, false)}>
            Refuse (safe)
          </button>
          <button className="btn primary danger-primary" onClick={() => onAnswer(prompt.promptId, true)}>
            Trust new key
          </button>
        </div>
      </div>
    </div>
  )
}
