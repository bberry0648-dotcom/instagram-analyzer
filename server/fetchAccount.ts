// 요청 하나를 처리하는 공통 로직. Vercel 함수(api/analyze.ts)와 로컬 개발 서버(vite.config.ts)가 같이 쓴다.
import type { AccountData, ApiError, ProviderId } from '../shared/types.js'
import { parseUsername } from '../shared/username.js'
import { fetchFromApify } from './providers/apify.js'
import { fetchFromMeta } from './providers/meta.js'
import { FetchError, type FetchOptions } from './providers/types.js'

export const NOT_AVAILABLE_MESSAGE = '이 계정은 현재 자동으로 데이터를 가져올 수 없습니다.'

const PROVIDERS: Record<ProviderId, (u: string, o: FetchOptions) => Promise<AccountData>> = {
  meta: fetchFromMeta,
  apify: fetchFromApify,
}

/** 환경변수가 채워진 공급자만, 공식 API 우선 순서로 */
export function configuredProviders(): ProviderId[] {
  const list: ProviderId[] = []
  if (process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID) list.push('meta')
  if (process.env.APIFY_TOKEN) list.push('apify')
  return list
}

// 같은 계정을 연달아 조회할 때 유료 호출을 아끼는 짧은 캐시 (인스턴스가 살아 있는 동안만)
const cache = new Map<string, { at: number; data: AccountData }>()
const CACHE_MS = 30 * 60 * 1000

export async function handleAnalyze(
  rawInput: string | null,
): Promise<{ status: number; body: AccountData | ApiError }> {
  const username = rawInput ? parseUsername(rawInput) : null
  if (!username) return { status: 400, body: { error: 'Instagram 주소나 username 형식이 올바르지 않습니다.' } }

  const providers = configuredProviders()
  if (providers.length === 0) {
    return {
      status: 503,
      body: { error: NOT_AVAILABLE_MESSAGE, reason: '서버에 Instagram 데이터 공급자 키가 설정되지 않았습니다. (README의 “데이터 연결” 참고)' },
    }
  }

  const hit = cache.get(username)
  if (hit && Date.now() - hit.at < CACHE_MS) return { status: 200, body: hit.data }

  const since = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000) // 약 6개월
  const opts: FetchOptions = { since, maxPosts: Number(process.env.MAX_POSTS) || 150 }

  const reasons: string[] = []
  for (const id of providers) {
    try {
      const data = await PROVIDERS[id](username, opts)
      if (data.posts.length === 0) {
        reasons.push(`${id}: 게시물을 한 건도 받지 못했습니다.`)
        continue
      }
      cache.set(username, { at: Date.now(), data })
      return { status: 200, body: data }
    } catch (e) {
      const msg = e instanceof FetchError ? e.message : e instanceof Error ? e.message : String(e)
      reasons.push(`${id}: ${msg}`)
    }
  }
  return { status: 502, body: { error: NOT_AVAILABLE_MESSAGE, reason: reasons.join(' / ') } }
}
