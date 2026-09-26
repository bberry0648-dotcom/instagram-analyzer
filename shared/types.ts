// 서버(수집)와 화면(분석·표시)이 함께 쓰는 정규화된 데이터 형태.
// 공급자마다 응답 모양이 달라서, 수집 쪽에서 이 형태로 맞춘 뒤 넘긴다.

export type MediaKind = 'reel' | 'carousel' | 'image' | 'video'

export interface Post {
  id: string
  permalink: string
  kind: MediaKind
  /** ISO 8601 */
  timestamp: string
  caption: string
  /** 좋아요를 숨긴 게시물이거나 공급자가 주지 않으면 null (0으로 채우지 않는다) */
  likes: number | null
  comments: number | null
  /** 영상 조회수. 공급자가 주지 않으면 null */
  views: number | null
  thumbnailUrl: string | null
}

export interface Profile {
  username: string
  fullName: string | null
  followers: number | null
  totalPosts: number | null
  profilePicUrl: string | null
}

export type ProviderId = 'meta' | 'apify'

export interface AccountData {
  profile: Profile
  posts: Post[]
  source: ProviderId
  /** 공급자가 원천적으로 주지 않는 지표 (화면에서 숨긴다) */
  unavailableMetrics: Array<'likes' | 'comments' | 'views' | 'followers'>
  fetchedAt: string
  /** 한 번에 가져오는 최대 게시물 수 (상한에 걸렸는지 화면에서 알리기 위해) */
  postLimit?: number
}

export interface ApiError {
  error: string
  /** 사용자에게 보여 줄 구체적인 이유 */
  reason?: string
}
