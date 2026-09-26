export interface FetchOptions {
  /** 이 날짜보다 오래된 게시물은 더 가져오지 않는다 */
  since: Date
  maxPosts: number
}

export type FetchErrorKind =
  | 'not_configured' // 키가 없음
  | 'not_available' // 비공개·개인 계정·존재하지 않음 등 이 계정은 못 가져옴
  | 'upstream' // 공급자 쪽 오류·한도 초과

export class FetchError extends Error {
  kind: FetchErrorKind
  constructor(kind: FetchErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}
