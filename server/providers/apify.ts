// Apify "Instagram Scraper" (apify/instagram-scraper) — 유료 서드파티 수집기.
// 공식 API로는 개인 계정·조회수를 받을 수 없어서 두는 대안. 공개 계정이면 개인/비즈니스 구분 없이 동작한다.
// https://apify.com/apify/instagram-scraper
import type { AccountData, MediaKind, Post, Profile } from '../../shared/types.js'
import { FetchError, type FetchOptions } from './types.js'

interface ApifyItem {
  error?: string
  errorDescription?: string
  // details
  username?: string
  fullName?: string
  followersCount?: number
  postsCount?: number
  profilePicUrl?: string
  private?: boolean
  // posts
  id?: string
  type?: 'Image' | 'Video' | 'Sidecar'
  productType?: string
  shortCode?: string
  url?: string
  caption?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  timestamp?: string
  displayUrl?: string
}

const ACTOR = 'apify~instagram-scraper'

async function runActor(input: Record<string, unknown>): Promise<ApifyItem[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new FetchError('not_configured', 'APIFY_TOKEN 미설정')
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new FetchError('upstream', `Apify ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as ApifyItem[]
}

function kindOf(i: ApifyItem): MediaKind {
  if (i.productType === 'clips') return 'reel'
  if (i.type === 'Sidecar') return 'carousel'
  if (i.type === 'Video') return 'video'
  return 'image'
}

function toPost(i: ApifyItem): Post {
  // likesCount -1 은 "좋아요 숨김" 표시다. 0으로 바꾸지 않는다.
  const likes = typeof i.likesCount === 'number' && i.likesCount >= 0 ? i.likesCount : null
  const views = i.videoPlayCount ?? i.videoViewCount
  return {
    id: i.id ?? i.shortCode ?? '',
    permalink: i.url ?? (i.shortCode ? `https://www.instagram.com/p/${i.shortCode}/` : ''),
    kind: kindOf(i),
    timestamp: i.timestamp ?? '',
    caption: i.caption ?? '',
    likes,
    comments: typeof i.commentsCount === 'number' && i.commentsCount >= 0 ? i.commentsCount : null,
    views: typeof views === 'number' && views > 0 ? views : null,
    thumbnailUrl: i.displayUrl ?? null,
  }
}

export async function fetchFromApify(username: string, opts: FetchOptions): Promise<AccountData> {
  const directUrls = [`https://www.instagram.com/${username}/`]
  const [details, postItems] = await Promise.all([
    runActor({ directUrls, resultsType: 'details', resultsLimit: 1 }),
    runActor({
      directUrls,
      resultsType: 'posts',
      resultsLimit: opts.maxPosts,
      onlyPostsNewerThan: opts.since.toISOString().slice(0, 10),
    }),
  ])

  const d = details.find((i) => i.username)
  const err = details.find((i) => i.error) ?? postItems.find((i) => i.error)
  if (!d) throw new FetchError('not_available', err?.errorDescription ?? '계정을 찾을 수 없습니다.')
  if (d.private) throw new FetchError('not_available', '비공개 계정입니다.')

  const profile: Profile = {
    username: d.username!,
    fullName: d.fullName || null,
    followers: d.followersCount ?? null,
    totalPosts: d.postsCount ?? null,
    profilePicUrl: d.profilePicUrl ?? null,
  }

  const posts = postItems.filter((i) => !i.error && i.timestamp).map(toPost)
  return { profile, posts, source: 'apify', unavailableMetrics: [], fetchedAt: new Date().toISOString() }
}
