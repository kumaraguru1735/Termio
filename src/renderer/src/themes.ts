import type { ITheme } from '@xterm/xterm'

export interface TermTheme {
  id: string
  name: string
  theme: ITheme
}

export const THEMES: TermTheme[] = [
  {
    id: 'termio-dark',
    name: 'Termina Dark',
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
    id: 'dracula',
    name: 'Dracula',
    theme: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#bd93f9',
      green: '#50fa7b',
      blue: '#8be9fd',
      cyan: '#8be9fd',
      red: '#ff5555',
      yellow: '#f1fa8c',
      magenta: '#ff79c6'
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

export function getThemeId(): string {
  return localStorage.getItem(KEY) ?? 'termio-dark'
}
export function setThemeId(id: string): void {
  localStorage.setItem(KEY, id)
}
export function getActiveTheme(): ITheme {
  return (THEMES.find((t) => t.id === getThemeId()) ?? THEMES[0]).theme
}
