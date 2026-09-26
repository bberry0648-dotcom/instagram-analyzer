export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1).replace(/\.0$/, '')}억`
  if (n >= 10_000_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1).replace(/\.0$/, '')}만`
  return Math.round(n).toLocaleString('ko-KR')
}

export function date(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '–' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function dateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ago(iso: string): string {
  const min = (Date.now() - new Date(iso).getTime()) / 60_000
  if (!(min >= 0)) return ''
  if (min < 1) return '방금'
  if (min < 60) return `${Math.floor(min)}분 전`
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`
  return `${Math.floor(min / 60 / 24)}일 전`
}

/** 지난번 대비 변화율. 비교할 값이 없으면 null */
export function change(now: number | null | undefined, before: number | null | undefined): string | null {
  if (typeof now !== 'number' || typeof before !== 'number' || before <= 0) return null
  const pct = ((now - before) / before) * 100
  if (Math.abs(pct) < 0.5) return '±0%'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`
}
