// 화면 → 수집 서버 호출. 키는 서버에만 있고, 여기엔 서버 주소만 있다.
import type { AccountData, ApiError } from '../../shared/types'

// 로컬 개발: 비워 두면 Vite 서버의 /api/analyze 를 쓴다.
// GitHub Pages 빌드: .env.production 의 VITE_API_BASE (Vercel 주소, 비밀 아님)
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export const NOT_AVAILABLE = '이 계정은 현재 자동으로 데이터를 가져올 수 없습니다.'

export class AnalyzeError extends Error {
  reason?: string
  constructor(message: string, reason?: string) {
    super(message)
    this.reason = reason
  }
}

export async function fetchAccount(input: string, signal?: AbortSignal): Promise<AccountData> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/analyze?q=${encodeURIComponent(input)}`, { signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new AnalyzeError(NOT_AVAILABLE, '수집 서버에 연결하지 못했습니다.')
  }
  const body = (await res.json().catch(() => null)) as AccountData | ApiError | null
  if (!res.ok || !body || 'error' in body) {
    const err = body && 'error' in body ? body : null
    throw new AnalyzeError(err?.error ?? NOT_AVAILABLE, err?.reason ?? `서버 응답 ${res.status}`)
  }
  return body
}

/** 인스타 CDN 이미지는 다른 사이트에서 바로 못 불러올 때가 있어 서버를 거친다 */
export function imageUrl(src: string | null): string | null {
  if (!src) return null
  return `${API_BASE}/api/image?url=${encodeURIComponent(src)}`
}
