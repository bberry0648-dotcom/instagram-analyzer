// 수집된 게시물(AccountData)만 가지고 계산한다. 화면 코드·수집 코드와 분리된 순수 함수들.
// 원칙: 데이터에 없는 건 말하지 않는다. 표본이 작으면 패턴을 내지 않는다.
import type { AccountData, MediaKind, Post } from '../../shared/types'

export type Metric = 'likes' | 'comments' | 'views'

export const KIND_LABEL: Record<MediaKind, string> = {
  reel: 'Reels',
  carousel: 'Carousel',
  image: 'Image',
  video: 'Video',
}
const METRIC_LABEL: Record<Metric, string> = { likes: '좋아요', comments: '댓글', views: '조회수' }

/** 평균 대비 이 배수 이상이면 바이럴 */
export const VIRAL_RATIO = 2
/** 지표 평균을 믿으려면 최소 이만큼의 게시물이 필요 */
const MIN_SAMPLE = 5
/** 두 그룹 차이를 "패턴"이라 부르려면 이 배수 이상 */
const PATTERN_GAP = 1.3

export interface ScoredPost extends Post {
  /** 계정 평균 대비 배수. 값이 없거나 표본이 부족하면 없음 */
  ratios: Partial<Record<Metric, number>>
  /** 있는 배수들의 평균 = 이 계정 기준 반응 점수 (1 = 평균) */
  score: number | null
  hashtags: string[]
}

export interface Summary {
  analyzed: number
  periodFrom: string | null
  periodTo: string | null
  averages: Partial<Record<Metric, number>>
  /** 평균을 낸 게시물 수 */
  samples: Record<Metric, number>
  kindShare: Array<{ kind: MediaKind; count: number; pct: number }>
}

export interface ViralPost {
  post: ScoredPost
  /** "평균 좋아요보다 2.7배 높음" */
  lines: string[]
  maxRatio: number
}

export type Pick = '좋아요 상위' | '댓글 상위' | '조회수 상위' | '평균 이상' | '최근' | '형식별 대표'

export interface TopPost {
  post: ScoredPost
  reasons: Pick[]
}

export interface Pattern {
  text: string
  /** 근거가 된 숫자 */
  evidence: string
  /** 양(+)이면 잘되는 쪽, 음(-)이면 약한 쪽 신호 */
  tone: 'strong' | 'weak' | 'neutral'
}

export interface Insight {
  works: string[]
  weak: string[]
  repeating: string[]
  references: string[]
}

export interface Analysis {
  summary: Summary
  posts: ScoredPost[]
  viral: ViralPost[]
  top: TopPost[]
  patterns: Pattern[]
  insight: Insight
  /** 분석을 제한한 이유 (표본 부족 등) — 화면에 그대로 보여 준다 */
  notes: string[]
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
// 패턴 비교는 중앙값으로 한다 — 초대형 게시물 하나가 그룹 전체를 대표하지 않도록
const median = (xs: number[]) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round1 = (x: number) => Math.round(x * 10) / 10
const fmtX = (x: number) => `${round1(x).toFixed(1)}배`

/** 줄 맞춤용 보이지 않는 문자(⠀ 등)를 걷어낸 한 줄 캡션 */
export function cleanCaption(caption: string) {
  return caption.replace(/[\u2800\u3164\u115f\u1160\u200b-\u200d\ufeff]/g, ' ').replace(/\s+/g, ' ').trim()
}

function hashtagsOf(caption: string): string[] {
  return [...new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.toLowerCase()))]
}

function computeAverages(posts: Post[]) {
  const averages: Partial<Record<Metric, number>> = {}
  const samples: Record<Metric, number> = { likes: 0, comments: 0, views: 0 }
  for (const m of ['likes', 'comments', 'views'] as Metric[]) {
    const vals = posts.map((p) => p[m]).filter((v): v is number => typeof v === 'number')
    samples[m] = vals.length
    if (vals.length) averages[m] = mean(vals)
  }
  return { averages, samples }
}

function score(posts: Post[], averages: Summary['averages'], samples: Summary['samples']): ScoredPost[] {
  return posts.map((p) => {
    const ratios: ScoredPost['ratios'] = {}
    for (const m of ['likes', 'comments', 'views'] as Metric[]) {
      const v = p[m]
      const avg = averages[m]
      if (typeof v === 'number' && avg && avg > 0 && samples[m] >= MIN_SAMPLE) ratios[m] = v / avg
    }
    const rs = Object.values(ratios)
    return { ...p, ratios, score: rs.length ? mean(rs) : null, hashtags: hashtagsOf(p.caption) }
  })
}

function summarize(posts: Post[]): Summary {
  const { averages, samples } = computeAverages(posts)
  const counts = new Map<MediaKind, number>()
  for (const p of posts) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1)
  const kindShare = [...counts]
    .map(([kind, count]) => ({ kind, count, pct: (count / posts.length) * 100 }))
    .sort((a, b) => b.count - a.count)
  const times = posts.map((p) => p.timestamp).filter(Boolean).sort()
  return {
    analyzed: posts.length,
    periodFrom: times[0] ?? null,
    periodTo: times.at(-1) ?? null,
    averages,
    samples,
    kindShare,
  }
}

function findViral(posts: ScoredPost[]): ViralPost[] {
  const out: ViralPost[] = []
  for (const post of posts) {
    const hits = (Object.entries(post.ratios) as [Metric, number][]).filter(([, r]) => r >= VIRAL_RATIO)
    if (!hits.length) continue
    hits.sort((a, b) => b[1] - a[1])
    out.push({
      post,
      lines: hits.map(([m, r]) => `평균 ${METRIC_LABEL[m]}보다 ${fmtX(r)} 높음`),
      maxRatio: hits[0][1],
    })
  }
  return out.sort((a, b) => b.maxRatio - a.maxRatio)
}

const byScore = (a: ScoredPost, b: ScoredPost) => (b.score ?? -1) - (a.score ?? -1)

function pickTop(posts: ScoredPost[], max = 20, min = 10): TopPost[] {
  const chosen = new Map<string, TopPost>()
  const add = (p: ScoredPost | undefined, why: Pick) => {
    if (!p) return
    const cur = chosen.get(p.id)
    if (cur) {
      if (!cur.reasons.includes(why)) cur.reasons.push(why)
    } else if (chosen.size < max) chosen.set(p.id, { post: p, reasons: [why] })
  }
  const topBy = (m: Metric, n: number, pool = posts) =>
    pool
      .filter((p) => typeof p[m] === 'number')
      .sort((a, b) => (b[m] as number) - (a[m] as number))
      .slice(0, n)

  topBy('likes', 5).forEach((p) => add(p, '좋아요 상위'))
  topBy('comments', 4).forEach((p) => add(p, '댓글 상위'))
  topBy('views', 4).forEach((p) => add(p, '조회수 상위'))
  // 형식마다 반응이 가장 좋은 1개 — 계정이 어떤 형식들을 쓰는지 대표
  for (const kind of new Set(posts.map((p) => p.kind))) {
    add(posts.filter((p) => p.kind === kind).sort(byScore)[0], '형식별 대표')
  }
  // 최근 게시물 중 평균 이상인 것 우선, 없으면 가장 최근 것
  const recent = [...posts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6)
  const recentGood = recent.filter((p) => (p.score ?? 0) >= 1)
  ;(recentGood.length ? recentGood.slice(0, 3) : recent.slice(0, 2)).forEach((p) => add(p, '최근'))
  // 나머지는 평균 이상 반응 순으로 채움
  const aboveAvg = posts.filter((p) => (p.score ?? 0) >= 1).sort(byScore)
  for (const p of aboveAvg) {
    if (chosen.size >= max) break
    add(p, '평균 이상')
  }
  if (chosen.size < min) posts.sort(byScore).forEach((p) => chosen.size < min && add(p, '평균 이상'))

  return [...chosen.values()].sort((a, b) => byScore(a.post, b.post))
}

interface Group {
  label: string
  posts: ScoredPost[]
}

/** 두 그룹의 중앙 점수를 비교. 표본·차이가 기준을 넘을 때만 결과를 낸다 */
function compare(a: Group, b: Group, metric?: Metric) {
  const val = (p: ScoredPost) => (metric ? p.ratios[metric] : p.score)
  const va = a.posts.map(val).filter((v): v is number => typeof v === 'number')
  const vb = b.posts.map(val).filter((v): v is number => typeof v === 'number')
  if (va.length < MIN_SAMPLE || vb.length < MIN_SAMPLE) return null
  const ma = median(va)
  const mb = median(vb)
  if (!(ma > 0 && mb > 0)) return null
  const [hi, lo, mh, ml, nh, nl] = ma >= mb ? [a, b, ma, mb, va.length, vb.length] : [b, a, mb, ma, vb.length, va.length]
  const gap = mh / ml
  if (gap < PATTERN_GAP) return null
  return { hi, lo, gap, evidence: `${hi.label} ${nh}개 중앙값 ${fmtX(mh)} vs ${lo.label} ${nl}개 중앙값 ${fmtX(ml)} (계정 평균 = 1.0배)` }
}

function findPatterns(posts: ScoredPost[], viral: ViralPost[]): { patterns: Pattern[]; facts: Record<string, string> } {
  const patterns: Pattern[] = []
  const facts: Record<string, string> = {}
  const scored = posts.filter((p) => p.score !== null)

  // 1) 형식별 반응
  const kinds = [...new Set(scored.map((p) => p.kind))]
    .map((k) => ({ label: KIND_LABEL[k], posts: scored.filter((p) => p.kind === k) }))
    .filter((g) => g.posts.length >= MIN_SAMPLE)
    .map((g) => ({ ...g, avg: median(g.posts.map((p) => p.score!)) }))
    .sort((a, b) => b.avg - a.avg)
  if (kinds.length >= 2) {
    const c = compare(kinds[0], kinds.at(-1)!)
    if (c) {
      patterns.push({ text: `${c.hi.label} 반응이 ${c.lo.label}보다 ${fmtX(c.gap)} 높음`, evidence: c.evidence, tone: 'strong' })
      facts.bestKind = c.hi.label
      facts.worstKind = c.lo.label
    }
  }
  // 1-b) 댓글만 따로: 댓글을 가장 많이 끌어내는 형식
  const byComments = [...new Set(scored.map((p) => p.kind))]
    .map((k) => ({ label: KIND_LABEL[k], posts: scored.filter((p) => p.kind === k) }))
    .filter((g) => g.posts.filter((p) => p.ratios.comments !== undefined).length >= MIN_SAMPLE)
    .map((g) => ({ ...g, avg: median(g.posts.map((p) => p.ratios.comments).filter((v): v is number => v !== undefined)) }))
    .sort((a, b) => b.avg - a.avg)
  if (byComments.length >= 2 && byComments[0].label !== facts.bestKind) {
    const c = compare(byComments[0], byComments.at(-1)!, 'comments')
    if (c) patterns.push({ text: `댓글 반응은 ${c.hi.label}가 가장 높음`, evidence: `댓글 기준 · ${c.evidence}`, tone: 'strong' })
  }

  // 2) 캡션 길이 (계정 안의 중앙값으로 짧은/긴 그룹)
  const lens = scored.map((p) => p.caption.length).sort((a, b) => a - b)
  if (lens.length >= MIN_SAMPLE * 2) {
    const mid = lens[Math.floor(lens.length / 2)]
    const c = compare(
      { label: `짧은 캡션(${mid}자 미만)`, posts: scored.filter((p) => p.caption.length < mid) },
      { label: `긴 캡션(${mid}자 이상)`, posts: scored.filter((p) => p.caption.length >= mid) },
    )
    if (c) {
      const short = c.hi.label.startsWith('짧은')
      patterns.push({ text: `${short ? '짧은' : '긴'} 캡션 게시물의 반응이 더 강함`, evidence: c.evidence, tone: 'strong' })
      facts.caption = short ? '짧은 캡션' : '긴 캡션'
    }
  }

  // 3) 해시태그 사용
  const c3 = compare(
    { label: '해시태그 3개 이상', posts: scored.filter((p) => p.hashtags.length >= 3) },
    { label: '해시태그 2개 이하', posts: scored.filter((p) => p.hashtags.length < 3) },
  )
  if (c3) patterns.push({ text: `${c3.hi.label} 게시물의 반응이 더 높음`, evidence: c3.evidence, tone: 'neutral' })

  // 4) 캡션에 질문이 있으면 댓글이 느는가
  const c4 = compare(
    { label: '캡션에 질문(?) 있음', posts: scored.filter((p) => /\?|？/.test(p.caption)) },
    { label: '질문 없음', posts: scored.filter((p) => !/\?|？/.test(p.caption)) },
    'comments',
  )
  if (c4) {
    patterns.push({
      text: c4.hi.label.startsWith('캡션에') ? '캡션에서 질문을 던진 게시물의 댓글이 더 많음' : '질문형 캡션이 댓글을 더 끌어내지는 않음',
      evidence: `댓글 기준 · ${c4.evidence}`,
      tone: 'neutral',
    })
  }

  // 5) 요일 (브라우저 시간대 기준)
  if (scored.length >= 20) {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const groups = days
      .map((d, i) => ({ label: `${d}요일`, posts: scored.filter((p) => new Date(p.timestamp).getDay() === i) }))
      .filter((g) => g.posts.length >= MIN_SAMPLE)
      .map((g) => ({ ...g, mid: median(g.posts.map((p) => p.score!)) }))
      .sort((a, b) => b.mid - a.mid)
    const overall = median(scored.map((p) => p.score!))
    if (groups.length >= 3 && groups[0].mid / overall >= 1.5) {
      patterns.push({
        text: `${groups[0].label} 게시물 반응이 가장 좋음`,
        evidence: `${groups[0].label} ${groups[0].posts.length}개 중앙값 ${fmtX(groups[0].mid)} vs 전체 중앙값 ${fmtX(overall)}`,
        tone: 'neutral',
      })
    }
  }

  // 6) 바이럴 게시물 구성
  if (viral.length >= 3) {
    const counts = new Map<string, number>()
    viral.forEach((v) => counts.set(KIND_LABEL[v.post.kind], (counts.get(KIND_LABEL[v.post.kind]) ?? 0) + 1))
    const [kind, n] = [...counts].sort((a, b) => b[1] - a[1])[0]
    const baseShare = posts.filter((p) => KIND_LABEL[p.kind] === kind).length / posts.length
    const viralShare = n / viral.length
    if (viralShare >= 0.5 && viralShare > baseShare + 0.1) {
      patterns.push({
        text: `바이럴 게시물은 ${kind}에 몰려 있음`,
        evidence: `바이럴 ${viral.length}개 중 ${n}개(${Math.round(viralShare * 100)}%) · 전체 게시물 중 ${kind} 비중은 ${Math.round(baseShare * 100)}%`,
        tone: 'strong',
      })
      facts.viralKind = kind
    }
    // 바이럴 게시물에 반복되는 해시태그 — 계정이 거의 모든 글에 다는 태그(브랜드명 등)는 빼고,
    // 바이럴에서 전체보다 확실히 더 자주 보이는 태그만
    const tagCount = new Map<string, number>()
    viral.forEach((v) => v.post.hashtags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)))
    const shareAll = (t: string) => posts.filter((p) => p.hashtags.includes(t)).length / posts.length
    const repeated = [...tagCount]
      .filter(([t, c]) => c >= 2 && shareAll(t) < 0.7 && c / viral.length >= shareAll(t) + 0.25)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    if (repeated.length) {
      patterns.push({
        text: `바이럴 게시물에 자주 붙은 해시태그: ${repeated.map(([t]) => t).join(' ')}`,
        evidence: repeated
          .map(([t, c]) => `${t} 바이럴 ${c}/${viral.length}개 · 전체 ${Math.round(shareAll(t) * 100)}%`)
          .join(', '),
        tone: 'neutral',
      })
      facts.viralTags = repeated.map(([t]) => t).join(' ')
    }
  }

  return { patterns, facts }
}

function excerpt(caption: string, n = 40) {
  const line = cleanCaption(caption)
  if (!line) return '(캡션 없음)'
  const chars = Array.from(line) // 이모지·꾸밈 글자가 반으로 잘리지 않도록
  return chars.length > n ? `${chars.slice(0, n).join('')}…` : line
}

function buildInsight(posts: ScoredPost[], viral: ViralPost[], patterns: Pattern[], facts: Record<string, string>): Insight {
  const works: string[] = []
  const weak: string[] = []
  const repeating: string[] = []
  const references: string[] = []

  if (facts.bestKind) works.push(`${facts.bestKind} 형식 — ${patterns.find((p) => p.text.startsWith(facts.bestKind))?.evidence}`)
  if (facts.caption) works.push(`${facts.caption} 게시물`)
  patterns
    .filter((p) => p.text.startsWith('댓글 반응은') || p.text.startsWith('캡션에서 질문'))
    .forEach((p) => works.push(p.text))

  if (facts.worstKind) weak.push(`${facts.worstKind} 형식 — 계정 안에서 반응이 가장 낮은 형식`)
  const scored = posts.filter((p) => p.score !== null).sort(byScore)
  if (scored.length >= 10) {
    const bottom = scored.slice(-Math.max(3, Math.floor(scored.length * 0.2)))
    const counts = new Map<MediaKind, number>()
    bottom.forEach((p) => counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1))
    const [kind, n] = [...counts].sort((a, b) => b[1] - a[1])[0]
    const base = posts.filter((p) => p.kind === kind).length / posts.length
    // 원래 많이 올리는 형식이면 하위권에도 많은 게 당연하다 — 비중보다 확실히 높을 때만
    if (n >= 3 && n / bottom.length >= base + 0.15 && KIND_LABEL[kind] !== facts.bestKind) {
      weak.push(`반응 하위 ${bottom.length}개 중 ${n}개가 ${KIND_LABEL[kind]} (전체 비중 ${Math.round(base * 100)}%)`)
    }
  }

  if (facts.viralKind) repeating.push(`바이럴의 절반 이상이 ${facts.viralKind}`)
  if (facts.viralTags) repeating.push(`바이럴 게시물에 ${facts.viralTags} 해시태그가 반복`)
  if (viral.length && !repeating.length) repeating.push(`바이럴 ${viral.length}개에서 형식·해시태그의 뚜렷한 공통점은 확인되지 않음`)

  // 참고할 방식: 실제로 가장 반응이 컸던 게시물들을 근거로 가리킨다
  const best = viral.length
    ? viral.map((v) => ({ post: v.post, ratio: v.maxRatio }))
    : scored.filter((p) => (p.score ?? 0) > 1).map((p) => ({ post: p, ratio: p.score! }))
  for (const { post, ratio } of best.slice(0, 5)) {
    references.push(`${KIND_LABEL[post.kind]} · “${excerpt(post.caption)}” — 계정 평균의 ${fmtX(ratio)} 반응`)
  }

  return { works, weak, repeating, references }
}

export function analyze(data: AccountData): Analysis {
  const notes: string[] = []
  const posts = [...data.posts].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const summary = summarize(posts)
  const scoredPosts = score(posts, summary.averages, summary.samples)

  for (const m of ['likes', 'comments', 'views'] as Metric[]) {
    const n = summary.samples[m]
    if (n > 0 && n < MIN_SAMPLE) notes.push(`${METRIC_LABEL[m]} 값이 있는 게시물이 ${n}개뿐이라 ${METRIC_LABEL[m]} 기준 비교는 하지 않았습니다.`)
  }
  const coveredDays = summary.periodFrom ? (Date.now() - new Date(summary.periodFrom).getTime()) / 86_400_000 : 0
  if (data.postLimit && posts.length >= data.postLimit && summary.periodFrom && coveredDays < 150) {
    notes.push(`한 번에 가져오는 게시물 상한(${data.postLimit}개) 때문에 ${summary.periodFrom.slice(0, 10)} 이후 게시물만 분석했습니다.`)
  }
  if (posts.length < MIN_SAMPLE * 2) notes.push(`게시물이 ${posts.length}개라 패턴 분석에는 표본이 부족합니다.`)
  const hiddenLikes = posts.filter((p) => p.likes === null).length
  if (hiddenLikes && !data.unavailableMetrics.includes('likes'))
    notes.push(`좋아요 수를 숨긴 게시물 ${hiddenLikes}개는 좋아요 평균에서 뺐습니다.`)

  const viral = findViral(scoredPosts)
  const top = pickTop(scoredPosts)
  const { patterns, facts } = findPatterns(scoredPosts, viral)
  const insight = buildInsight(scoredPosts, viral, patterns, facts)

  return { summary, posts: scoredPosts, viral, top, patterns, insight, notes }
}
