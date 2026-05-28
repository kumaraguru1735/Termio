// Minimal inline SVG icon set (stroke-based, inherits currentColor).
import type { SVGProps } from 'react'

type I = (p: SVGProps<SVGSVGElement>) => JSX.Element
const svg =
  (path: JSX.Element): I =>
  (p) =>
    (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...p}
      >
        {path}
      </svg>
    )

export const IconHosts = svg(
  <>
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <path d="M7 7h.01M7 17h.01" />
  </>
)
export const IconSftp = svg(
  <>
    <path d="M3 7l2-2h5l2 2h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
    <path d="M12 11v5M9.5 13.5L12 11l2.5 2.5" />
  </>
)
export const IconPortForward = svg(
  <>
    <path d="M4 12h10M11 8l4 4-4 4" />
    <circle cx="19" cy="12" r="2" />
  </>
)
export const IconSnippets = svg(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6l1.5 1.5M4 18l1.5 1.5M3.5 12H5" />
  </>
)
export const IconKey = svg(
  <>
    <circle cx="8" cy="8" r="4" />
    <path d="M11 11l8 8M16 16l2-2M19 19l1.5-1.5" />
  </>
)
export const IconKnownHosts = svg(
  <>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </>
)
export const IconSettings = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-2.4 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6 2 2 0 1 1 13 4.6V5a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 11a2 2 0 1 1 0 4z" />
  </>
)
export const IconEdit = svg(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </>
)
export const IconTrash = svg(
  <>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
  </>
)
export const IconPlay = svg(<path d="M7 5l12 7-12 7V5z" />)
export const IconTerminal = svg(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9l3 3-3 3M13 15h4" />
  </>
)
export const IconSerial = svg(
  <>
    <rect x="4" y="8" width="16" height="8" rx="2" />
    <path d="M8 8V6M16 8V6M8 18v-2M16 18v-2" />
  </>
)
export const IconLogs = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
)
export const IconGrid = svg(
  <>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </>
)
export const IconTag = svg(
  <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.3" />
  </>
)
export const IconCalendar = svg(
  <>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </>
)
export const IconFolder = svg(
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
)
export const IconChevronDown = svg(<path d="M6 9l6 6 6-6" />)
export const IconChevronRight = svg(<path d="M9 6l6 6-6 6" />)
export const IconMenu = svg(<path d="M4 6h16M4 12h16M4 18h16" />)
export const IconUser = svg(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </>
)
export const IconLock = svg(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>
)
export const IconPlus = svg(<path d="M12 5v14M5 12h14" />)
export const IconBell = svg(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </>
)
export const IconMinimize = svg(<path d="M5 18h14" />)
export const IconMaximize = svg(<rect x="5" y="5" width="14" height="14" rx="1" />)
export const IconCross = svg(<path d="M6 6l12 12M6 18L18 6" />)
