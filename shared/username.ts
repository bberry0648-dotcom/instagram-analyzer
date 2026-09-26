// "https://www.instagram.com/nike/", "instagram.com/nike?igsh=..", "@nike", "nike" → "nike"
// 인스타 사용자 이름 규칙: 영문·숫자·마침표·밑줄, 30자 이하, 마침표로 시작/끝나지 않음.
const USERNAME_RE = /^(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/

const RESERVED = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv'])

export function parseUsername(input: string): string | null {
  let s = input.trim()
  if (!s) return null

  if (/instagram\.com/i.test(s)) {
    try {
      const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null
      const first = url.pathname.split('/').filter(Boolean)[0]
      if (!first || RESERVED.has(first.toLowerCase())) return null
      s = first
    } catch {
      return null
    }
  }

  s = s.replace(/^@/, '').toLowerCase()
  return USERNAME_RE.test(s) ? s : null
}
