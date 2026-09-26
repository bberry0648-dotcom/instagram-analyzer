// 공식 Instagram Graph API — Business Discovery
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
//
// 조건: 내 인스타 "프로페셔널(비즈니스/크리에이터)" 계정 + 연결된 페이스북 페이지 + 액세스 토큰.
// 한계: 상대 계정도 비즈니스/크리에이터여야 하고, 다른 계정의 영상 조회수는 주지 않는다.
import type { AccountData, MediaKind, Post } from '../../shared/types.js'
import { FetchError, type FetchOptions } from './types.js'

interface MetaMedia {
  id: string
  caption?: string
  like_count?: number
  comments_count?: number
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type?: 'FEED' | 'REELS' | 'AD' | 'STORY'
  permalink?: string
  timestamp?: string
  media_url?: string
  thumbnail_url?: string
}

interface MetaResponse {
  business_discovery?: {
    username: string
    name?: string
    followers_count?: number
    media_count?: number
    profile_picture_url?: string
    media?: { data: MetaMedia[]; paging?: { cursors?: { after?: string } } }
  }
  error?: { message: string; code?: number; error_subcode?: number }
}

const MEDIA_FIELDS =
  'id,caption,like_count,comments_count,media_type,media_product_type,permalink,timestamp,media_url,thumbnail_url'
const PAGE_SIZE = 50

function kindOf(m: MetaMedia): MediaKind {
  if (m.media_product_type === 'REELS') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (m.media_type === 'VIDEO') return 'video'
  return 'image'
}

function toPost(m: MetaMedia): Post {
  const kind = kindOf(m)
  return {
    id: m.id,
    permalink: m.permalink ?? '',
    kind,
    timestamp: m.timestamp ?? '',
    caption: m.caption ?? '',
    likes: typeof m.like_count === 'number' ? m.like_count : null,
    comments: typeof m.comments_count === 'number' ? m.comments_count : null,
    views: null,
    thumbnailUrl: (kind === 'reel' || kind === 'video' ? m.thumbnail_url : m.media_url) ?? m.thumbnail_url ?? null,
  }
}

export async function fetchFromMeta(username: string, opts: FetchOptions): Promise<AccountData> {
  const token = process.env.META_ACCESS_TOKEN
  const igUserId = process.env.META_IG_USER_ID
  const version = process.env.META_GRAPH_VERSION || 'v23.0'
  if (!token || !igUserId) throw new FetchError('not_configured', 'META_ACCESS_TOKEN / META_IG_USER_ID 미설정')

  const posts: Post[] = []
  let after: string | undefined
  let profile: AccountData['profile'] | null = null

  // 커서 페이징: 기간(since)보다 오래된 글이 나오거나 상한(maxPosts)에 닿으면 멈춘다.
  for (let page = 0; page < 20; page++) {
    const media = `media${after ? `.after(${after})` : ''}.limit(${PAGE_SIZE}){${MEDIA_FIELDS}}`
    const fields = `business_discovery.username(${username}){username,name,followers_count,media_count,profile_picture_url,${media}}`
    const url = `https://graph.facebook.com/${version}/${igUserId}?fields=${encodeURIComponent(fields)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const json = (await res.json()) as MetaResponse

    if (json.error) {
      // 110 / 2207013 류: 대상이 개인 계정이거나 존재하지 않음
      const notFound = json.error.code === 110 || /cannot be found|not.*business|does not exist/i.test(json.error.message)
      throw new FetchError(notFound ? 'not_available' : 'upstream', `Meta API: ${json.error.message}`)
    }
    const bd = json.business_discovery
    if (!bd) throw new FetchError('not_available', 'Meta API가 계정 정보를 돌려주지 않았습니다.')

    profile ??= {
      username: bd.username,
      fullName: bd.name ?? null,
      followers: bd.followers_count ?? null,
      totalPosts: bd.media_count ?? null,
      profilePicUrl: bd.profile_picture_url ?? null,
    }

    const batch = (bd.media?.data ?? []).map(toPost)
    posts.push(...batch)
    after = bd.media?.paging?.cursors?.after
    const oldest = batch.at(-1)?.timestamp
    if (!after || batch.length === 0 || posts.length >= opts.maxPosts) break
    if (oldest && new Date(oldest) < opts.since) break
  }

  return {
    profile: profile!,
    posts: posts.slice(0, opts.maxPosts),
    source: 'meta',
    unavailableMetrics: ['views'],
    fetchedAt: new Date().toISOString(),
  }
}
