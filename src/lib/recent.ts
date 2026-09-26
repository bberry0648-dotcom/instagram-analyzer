// 최근 검색한 username만 이 브라우저에 저장한다 (분석 결과는 저장하지 않음).
const KEY = 'ig-analyzer:recent'
const MAX = 8

export function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function saveRecent(username: string): string[] {
  const next = [username, ...loadRecent().filter((u) => u !== username)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 저장이 막힌 브라우저(시크릿 모드 등)는 그냥 넘어간다
  }
  return next
}

export function removeRecent(username: string): string[] {
  const next = loadRecent().filter((u) => u !== username)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 무시
  }
  return next
}
