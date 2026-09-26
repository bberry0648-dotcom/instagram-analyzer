// 분석 결과(수집 원본)를 이 브라우저에 저장한다 — 다시 볼 때 크레딧을 쓰지 않도록.
// 계정마다 최근 몇 번의 수집본을 남겨 두고, 지난번과 비교하는 데 쓴다.
// 다른 기기·브라우저와는 공유되지 않는다.
import type { AccountData } from '../../shared/types'

const KEY = 'ig-analyzer:saved:v1'
const OLD_RECENT_KEY = 'ig-analyzer:recent'
/** 계정당 남길 수집본 수 */
const PER_ACCOUNT = 3

type Store = Record<string, AccountData[]> // username → 최신순

export interface SavedAccount {
  username: string
  fullName: string | null
  latest: string // 가장 최근 수집 시각
  count: number
}

function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

/** 저장 공간이 모자라면 가장 오래된 수집본부터 지우고 다시 시도한다 */
function write(store: Store): boolean {
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store))
      return true
    } catch {
      let oldest: { user: string; at: string } | null = null
      for (const [user, snaps] of Object.entries(store)) {
        const last = snaps.at(-1)
        if (last && (!oldest || last.fetchedAt < oldest.at)) oldest = { user, at: last.fetchedAt }
      }
      if (!oldest) return false
      store[oldest.user].pop()
      if (!store[oldest.user].length) delete store[oldest.user]
    }
  }
}

export function listSaved(): SavedAccount[] {
  try {
    localStorage.removeItem(OLD_RECENT_KEY) // 예전 "최근 검색"(이름만 저장)은 이 목록으로 대체됨
  } catch {
    // 무시
  }
  return Object.entries(read())
    .filter(([, snaps]) => snaps.length)
    .map(([username, snaps]) => ({
      username,
      fullName: snaps[0].profile.fullName,
      latest: snaps[0].fetchedAt,
      count: snaps.length,
    }))
    .sort((a, b) => b.latest.localeCompare(a.latest))
}

/** 최신순 수집본 목록 */
export function getSnapshots(username: string): AccountData[] {
  return read()[username] ?? []
}

export function saveSnapshot(data: AccountData): { saved: boolean; snapshots: AccountData[] } {
  const store = read()
  const username = data.profile.username
  // 서버 캐시(30분)에서 같은 수집본이 다시 오면 중복 저장하지 않는다
  const rest = (store[username] ?? []).filter((s) => s.fetchedAt !== data.fetchedAt)
  store[username] = [data, ...rest].slice(0, PER_ACCOUNT)
  write(store)
  // 공간이 모자라 방금 것까지 밀려났을 수 있으니, 실제로 들어갔는지 다시 읽어 확인한다
  const after = read()[username] ?? []
  const saved = after[0]?.fetchedAt === data.fetchedAt
  return { saved, snapshots: saved ? after : [data] }
}

export function deleteSaved(username: string) {
  const store = read()
  delete store[username]
  write(store)
}
