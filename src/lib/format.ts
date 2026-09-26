export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1).replace(/\.0$/, '')}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1).replace(/\.0$/, '')}만`
  return Math.round(n).toLocaleString('ko-KR')
}

export function date(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '–' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
