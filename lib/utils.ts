import type { Product } from './types'

export function displayName(p: Product | undefined): string {
  if (!p) return '未知'
  return p.internal_name || p.full_name || p.id
}

export function pct(num: number, den: number): number {
  return den ? Math.round(num / den * 100) : 0
}

// Medal rendered inline in JSX — components import this and render it directly
export function medalEmoji(i: number): string {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return String(i + 1)
}

export function medalLabel(i: number): string {
  return i < 3 ? ['第1名','第2名','第3名'][i] : `第${i+1}名`
}
