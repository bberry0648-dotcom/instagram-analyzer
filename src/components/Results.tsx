import type { AccountData } from '../../shared/types'
import { KIND_LABEL, VIRAL_RATIO, type Analysis, type Pattern } from '../lib/analyze'
import { date, num } from '../lib/format'
import { PostCard, PostGrid } from './PostCard'
import { Card, Empty, Section, Stat } from './ui'

const SOURCE_LABEL = { meta: 'Instagram 공식 API (Business Discovery)', apify: 'Apify Instagram Scraper' }

export function Results({ data, a }: { data: AccountData; a: Analysis }) {
  const { profile } = data
  const s = a.summary
  const hide = new Set(data.unavailableMetrics)

  return (
    <div>
      {/* Account Summary */}
      <Section title="Account Summary" sub={`${date(s.periodFrom)} ~ ${date(s.periodTo)} 게시물 기준`}>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{profile.fullName || profile.username}</p>
              <a
                href={`https://www.instagram.com/${profile.username}/`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-link hover:underline"
              >
                @{profile.username}
              </a>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            {profile.followers !== null && <Stat label="팔로워" value={num(profile.followers)} />}
            <Stat label="분석한 게시물" value={`${s.analyzed}개`} hint={profile.totalPosts ? `전체 ${num(profile.totalPosts)}개 중` : undefined} />
            {s.averages.likes !== undefined && <Stat label="평균 좋아요" value={num(s.averages.likes)} hint={`${s.samples.likes}개 기준`} />}
            {s.averages.comments !== undefined && <Stat label="평균 댓글" value={num(s.averages.comments)} hint={`${s.samples.comments}개 기준`} />}
            {!hide.has('views') && s.averages.views !== undefined && (
              <Stat label="평균 조회수" value={num(s.averages.views)} hint={`영상 ${s.samples.views}개 기준`} />
            )}
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs text-muted">형식 비율</p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas">
              {s.kindShare.map((k, i) => (
                <div
                  key={k.kind}
                  style={{ width: `${k.pct}%` }}
                  className={['bg-ink', 'bg-action', 'bg-muted', 'bg-line'][i % 4]}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {s.kindShare.map((k, i) => (
                <span key={k.kind} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${['bg-ink', 'bg-action', 'bg-muted', 'bg-line'][i % 4]}`} />
                  {KIND_LABEL[k.kind]} <span className="tabular-nums text-muted">{Math.round(k.pct)}% ({k.count})</span>
                </span>
              ))}
            </div>
          </div>
          {a.notes.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-line/60 pt-3 text-xs text-muted">
              {a.notes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      {/* Viral Posts */}
      <Section title="Viral Posts" sub={`이 계정 평균의 ${VIRAL_RATIO}배 이상 반응을 얻은 게시물 · ${a.viral.length}개`}>
        {a.viral.length ? (
          <PostGrid>
            {a.viral.map((v) => (
              <PostCard key={v.post.id} post={v.post} highlight={v.lines} />
            ))}
          </PostGrid>
        ) : (
          <Empty>계정 평균의 {VIRAL_RATIO}배를 넘은 게시물이 없습니다. 반응이 고르게 나오는 계정입니다.</Empty>
        )}
      </Section>

      {/* Top Posts */}
      <Section title="Top Posts" sub={`좋아요·댓글·조회수·최근성·형식을 함께 보고 고른 대표 게시물 ${a.top.length}개`}>
        <PostGrid>
          {a.top.map((t) => (
            <PostCard key={t.post.id} post={t.post} badges={t.reasons} />
          ))}
        </PostGrid>
      </Section>

      {/* Viral Pattern */}
      <Section title="Viral Pattern" sub="이 계정 안에서 평균 반응(1.0배)과 비교">
        {a.patterns.length ? (
          <Card className="divide-y divide-line/60">
            {a.patterns.map((p) => (
              <PatternRow key={p.text} p={p} />
            ))}
          </Card>
        ) : (
          <Empty>표본 기준(그룹당 5개 이상, 1.3배 이상 차이)을 넘는 뚜렷한 공통점이 없습니다.</Empty>
        )}
        <p className="mt-2 text-xs text-muted">
          사진·영상 속 인물이나 장면은 분석하지 않습니다. 숫자·형식·캡션·해시태그·게시 요일만 봅니다.
        </p>
      </Section>

      {/* Content Insight */}
      <Section title="Content Insight">
        <div className="grid gap-3 md:grid-cols-2">
          <InsightBox title="잘되는 콘텐츠" items={a.insight.works} />
          <InsightBox title="반응이 약한 콘텐츠" items={a.insight.weak} />
          <InsightBox title="반복되는 바이럴 패턴" items={a.insight.repeating} />
          <InsightBox title="참고할 만한 콘텐츠" items={a.insight.references} />
        </div>
      </Section>

      <p className="mt-10 text-xs text-muted">
        데이터 출처: {SOURCE_LABEL[data.source]} · 수집 {date(data.fetchedAt)}
        {hide.has('views') && ' · 이 출처는 다른 계정의 조회수를 주지 않습니다'}
      </p>
    </div>
  )
}

function PatternRow({ p }: { p: Pattern }) {
  return (
    <div className="p-4">
      <p className="font-medium">{p.text}</p>
      <p className="mt-1 text-xs text-muted">{p.evidence}</p>
    </div>
  )
}

function InsightBox({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted">·</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">데이터로 확인되는 내용이 없습니다.</p>
      )}
    </Card>
  )
}
