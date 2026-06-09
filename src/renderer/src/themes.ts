import type { ITheme } from '@xterm/xterm'

export interface TermTheme {
  id: string
  name: string
  theme: ITheme
}

export const THEMES: TermTheme[] = [
  {
    id: 'termio-dark',
    name: 'Termio Dark',
    theme: {
      background: '#050b19',
      foreground: '#e6e8ec',
      cursor: '#2091f6',
      selectionBackground: '#2f3440',
      green: '#21b568',
      blue: '#2091f6',
      cyan: '#00c2a8',
      red: '#f25e61',
      yellow: '#f2c94c',
      magenta: '#c678dd'
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    theme: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
      brightBlack: '#6272a4',
      red: '#ff5555',
      brightRed: '#ff6e6e',
      green: '#50fa7b',
      brightGreen: '#69ff94',
      yellow: '#f1fa8c',
      brightYellow: '#ffffa5',
      blue: '#bd93f9',
      brightBlue: '#d6acff',
      magenta: '#ff79c6',
      brightMagenta: '#ff92df',
      cyan: '#8be9fd',
      brightCyan: '#a4ffff',
      white: '#f8f8f2',
      brightWhite: '#ffffff'
    }
  },
  {
    id: 'nord',
    name: 'Nord',
    theme: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      brightBlack: '#4c566a',
      red: '#bf616a',
      brightRed: '#bf616a',
      green: '#a3be8c',
      brightGreen: '#a3be8c',
      yellow: '#ebcb8b',
      brightYellow: '#ebcb8b',
      blue: '#81a1c1',
      brightBlue: '#81a1c1',
      magenta: '#b48ead',
      brightMagenta: '#b48ead',
      cyan: '#88c0d0',
      brightCyan: '#8fbcbb',
      white: '#e5e9f0',
      brightWhite: '#eceff4'
    }
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    theme: {
      background: '#282c34',
      foreground: '#abb2bf',
      cursor: '#528bff',
      selectionBackground: '#3e4451',
      black: '#1e2127',
      brightBlack: '#5c6370',
      red: '#e06c75',
      brightRed: '#e06c75',
      green: '#98c379',
      brightGreen: '#98c379',
      yellow: '#e5c07b',
      brightYellow: '#d19a66',
      blue: '#61afef',
      brightBlue: '#61afef',
      magenta: '#c678dd',
      brightMagenta: '#c678dd',
      cyan: '#56b6c2',
      brightCyan: '#56b6c2',
      white: '#abb2bf',
      brightWhite: '#ffffff'
    }
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    theme: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#ebdbb2',
      selectionBackground: '#504945',
      black: '#282828',
      brightBlack: '#928374',
      red: '#cc241d',
      brightRed: '#fb4934',
      green: '#98971a',
      brightGreen: '#b8bb26',
      yellow: '#d79921',
      brightYellow: '#fabd2f',
      blue: '#458588',
      brightBlue: '#83a598',
      magenta: '#b16286',
      brightMagenta: '#d3869b',
      cyan: '#689d6a',
      brightCyan: '#8ec07c',
      white: '#a89984',
      brightWhite: '#ebdbb2'
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    theme: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      selectionBackground: '#33467c',
      black: '#15161e',
      brightBlack: '#414868',
      red: '#f7768e',
      brightRed: '#f7768e',
      green: '#9ece6a',
      brightGreen: '#9ece6a',
      yellow: '#e0af68',
      brightYellow: '#e0af68',
      blue: '#7aa2f7',
      brightBlue: '#7aa2f7',
      magenta: '#bb9af7',
      brightMagenta: '#bb9af7',
      cyan: '#7dcfff',
      brightCyan: '#7dcfff',
      white: '#a9b1d6',
      brightWhite: '#c0caf5'
    }
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    theme: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#45475a',
      black: '#45475a',
      brightBlack: '#585b70',
      red: '#f38ba8',
      brightRed: '#f38ba8',
      green: '#a6e3a1',
      brightGreen: '#a6e3a1',
      yellow: '#f9e2af',
      brightYellow: '#f9e2af',
      blue: '#89b4fa',
      brightBlue: '#89b4fa',
      magenta: '#f5c2e7',
      brightMagenta: '#f5c2e7',
      cyan: '#94e2d5',
      brightCyan: '#94e2d5',
      white: '#bac2de',
      brightWhite: '#a6adc8'
    }
  },
  {
    id: 'monokai',
    name: 'Monokai',
    theme: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      selectionBackground: '#49483e',
      black: '#272822',
      brightBlack: '#75715e',
      red: '#f92672',
      brightRed: '#f92672',
      green: '#a6e22e',
      brightGreen: '#a6e22e',
      yellow: '#f4bf75',
      brightYellow: '#e6db74',
      blue: '#66d9ef',
      brightBlue: '#66d9ef',
      magenta: '#ae81ff',
      brightMagenta: '#ae81ff',
      cyan: '#a1efe4',
      brightCyan: '#a1efe4',
      white: '#f8f8f2',
      brightWhite: '#f9f8f5'
    }
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    theme: {
      background: '#002b36',
      foreground: '#93a1a1',
      cursor: '#93a1a1',
      green: '#859900',
      blue: '#268bd2',
      cyan: '#2aa198',
      red: '#dc322f',
      yellow: '#b58900',
      magenta: '#d33682'
    }
  },
  {
    id: 'light',
    name: 'Solarized Light',
    theme: {
      background: '#fdf6e3',
      foreground: '#586e75',
      cursor: '#586e75',
      green: '#859900',
      blue: '#268bd2',
      cyan: '#2aa198',
      red: '#dc322f',
      yellow: '#b58900',
      magenta: '#d33682'
    }
  }
]

const KEY = 'termio.theme'
/** Fired on window whenever the terminal or app theme changes. */
export const THEME_EVENT = 'termio:theme'

export function getThemeId(): string {
  return localStorage.getItem(KEY) ?? 'termio-dark'
}
export function setThemeId(id: string): void {
  localStorage.setItem(KEY, id)
  window.dispatchEvent(new Event(THEME_EVENT))
}
export function getActiveTheme(): ITheme {
  return (THEMES.find((t) => t.id === getThemeId()) ?? THEMES[0]).theme
}

// ---- Terminal font ----

export const DEFAULT_FONT_FAMILY = 'Menlo, "DejaVu Sans Mono", "Ubuntu Mono", monospace'
export const FONT_CHOICES = [
  DEFAULT_FONT_FAMILY,
  '"JetBrains Mono", monospace',
  '"Fira Code", monospace',
  '"Cascadia Code", monospace',
  '"Source Code Pro", monospace',
  'Consolas, monospace',
  '"Courier New", monospace'
]
const FONT_SIZE_KEY = 'termio.fontSize'
const FONT_FAMILY_KEY = 'termio.fontFamily'

export function getFontSize(): number {
  const n = parseInt(localStorage.getItem(FONT_SIZE_KEY) ?? '', 10)
  return Number.isFinite(n) && n >= 8 && n <= 32 ? n : 13
}
export function setFontSize(n: number): void {
  localStorage.setItem(FONT_SIZE_KEY, String(Math.min(32, Math.max(8, Math.round(n)))))
  window.dispatchEvent(new Event(THEME_EVENT))
}
export function getFontFamily(): string {
  return localStorage.getItem(FONT_FAMILY_KEY) || DEFAULT_FONT_FAMILY
}
export function setFontFamily(s: string): void {
  localStorage.setItem(FONT_FAMILY_KEY, s || DEFAULT_FONT_FAMILY)
  window.dispatchEvent(new Event(THEME_EVENT))
}

// ---- App-wide UI theme (light/dark chrome around the terminal) ----

export type AppTheme = 'light' | 'dark'
const APP_KEY = 'termio.appTheme'

export function getAppTheme(): AppTheme {
  return localStorage.getItem(APP_KEY) === 'dark' ? 'dark' : 'light'
}
export function setAppTheme(t: AppTheme): void {
  localStorage.setItem(APP_KEY, t)
  applyAppTheme()
  window.dispatchEvent(new Event(THEME_EVENT))
}
/** Sets the data attribute that the CSS variable overrides key off. */
export function applyAppTheme(): void {
  document.documentElement.dataset.appTheme = getAppTheme()
}
