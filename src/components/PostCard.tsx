import { useState } from 'react'
import { cleanCaption, KIND_LABEL, type ScoredPost } from '../lib/analyze'
import { imageUrl } from '../lib/api'
import { date, num } from '../lib/format'

interface Props {
  post: ScoredPost
  /** 카드 위쪽에 강조해서 보여 줄 줄 (바이럴 배수, 선정 이유 등) */
  badges?: string[]
  highlight?: string[]
}

export function PostCard({ post, badges = [], highlight = [] }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const src = imageUrl(post.thumbnailUrl)
  const caption = cleanCaption(post.caption)

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-surface">
      <a href={post.permalink} target="_blank" rel="noreferrer" className="relative block aspect-square shrink-0 overflow-hidden bg-canvas">
        {src && !imgFailed ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-muted">썸네일 없음</span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-white">
          {KIND_LABEL[post.kind]}
        </span>
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {highlight.length > 0 && (
          <ul className="space-y-0.5">
            {highlight.map((h) => (
              <li key={h} className="text-sm font-semibold text-good">
                {h}
              </li>
            ))}
          </ul>
        )}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted">
                {b}
              </span>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-3 gap-1 text-center">
          {(
            [
              ['좋아요', post.likes],
              ['댓글', post.comments],
              ['조회수', post.views],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded-lg bg-canvas py-1.5">
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className="text-[13px] font-semibold tabular-nums sm:text-sm">{num(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="line-clamp-2 text-sm text-ink/80">{caption || '(캡션 없음)'}</p>
        <div className="mt-auto flex items-center justify-between pt-1 text-xs">
          <span className="text-muted">{date(post.timestamp)}</span>
          <a href={post.permalink} target="_blank" rel="noreferrer" className="text-link hover:underline">
            원본 보기 ↗
          </a>
        </div>
      </div>
    </article>
  )
}

export function PostGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
}
