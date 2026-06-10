import * as Zmodem from 'zmodem.js'
import { dialog, type WebContents } from 'electron'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { basename } from 'path'
import { IPC } from '../shared/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ZmodemBridge {
  /** Feed raw bytes from the SSH stream; non-ZMODEM data passes through. */
  consume(buf: Buffer): void
}

/**
 * Wrap an SSH shell's output in a ZMODEM sentry so that `sz` (download) and
 * `rz` (upload) run on the remote drive file transfers through native dialogs.
 * All binary handling stays in main; the renderer keeps its plain text path.
 */
export function makeZmodemBridge(
  sessionId: string,
  wc: WebContents,
  writeToRemote: (data: Buffer) => void
): ZmodemBridge {
  const toTerminal = (octets: ArrayLike<number>): void => {
    if (!wc.isDestroyed()) wc.send(IPC.sshData(sessionId), Buffer.from(octets as Uint8Array).toString('utf8'))
  }
  const status = (msg: string): void => toTerminal(Buffer.from(`\r\n\x1b[36m[zmodem] ${msg}\x1b[0m\r\n`))

  const sentry = new Zmodem.Sentry({
    to_terminal: (octets: ArrayLike<number>) => toTerminal(octets),
    sender: (octets: ArrayLike<number>) => writeToRemote(Buffer.from(octets as Uint8Array)),
    on_retract: () => {},
    on_detect: (detection: any) => {
      const z = detection.confirm()
      if (z.type === 'send') void handleSend(z, status)
      else void handleReceive(z, status)
    }
  })

  return {
    consume(buf: Buffer): void {
      try {
        sentry.consume(buf)
      } catch (e) {
        status(`error: ${(e as Error).message}`)
      }
    }
  }
}

/** Remote ran `sz` — it is offering files; save each via a dialog. */
function handleReceive(z: any, status: (m: string) => void): void {
  z.on('offer', (xfer: any) => {
    const det = xfer.get_details()
    const save = dialog.showSaveDialogSync({
      defaultPath: det.name,
      title: `Save ${det.name} (${det.size} bytes)`
    })
    if (!save) {
      xfer.skip()
      status(`skipped ${det.name}`)
      return
    }
    xfer
      .accept()
      .then(() => {
        const payloads: Uint8Array[] = xfer.get_payloads()
        writeFileSync(save, Buffer.concat(payloads.map((p) => Buffer.from(p))))
        status(`saved ${det.name} → ${save}`)
      })
      .catch((e: Error) => status(`receive error: ${e.message}`))
  })
  z.start()
}

/** Remote ran `rz` — pick local files and send them. */
async function handleSend(z: any, status: (m: string) => void): Promise<void> {
  const files = dialog.showOpenDialogSync({
    properties: ['openFile', 'multiSelections'],
    title: 'Send files to remote (rz)'
  })
  if (!files || files.length === 0) {
    z.close()
    status('upload cancelled')
    return
  }
  try {
    for (const f of files) {
      const data = readFileSync(f)
      const st = statSync(f)
      const xfer = await z.send_offer({
        name: basename(f),
        size: data.length,
        mtime: Math.floor(st.mtimeMs / 1000),
        mode: st.mode & 0o777
      })
      if (!xfer) {
        status(`receiver skipped ${basename(f)}`)
        continue
      }
      xfer.send(data)
      await xfer.end()
      status(`sent ${basename(f)}`)
    }
  } catch (e) {
    status(`send error: ${(e as Error).message}`)
  }
  z.close()
}
