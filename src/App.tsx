import { useMemo, useRef, useState } from 'react'
import type { AccountData } from '../shared/types'
import { parseUsername } from '../shared/username'
import { Results } from './components/Results'
import { analyze } from './lib/analyze'
import { AnalyzeError, fetchAccount } from './lib/api'
import { dateTime, ago } from './lib/format'
import { deleteSaved, getSnapshots, listSaved, saveSnapshot } from './lib/saved'

type State =
  | { status: 'idle' }
  | { status: 'loading'; username: string }
  | { status: 'error'; message: string; reason?: string }
  | {
      status: 'done'
      /** 최신순 수집본 */
      snapshots: AccountData[]
      /** 지금 보고 있는 수집본 */
      index: number
      /** 저장본을 연 것인지(크레딧 안 씀), 방금 새로 받은 것인지 */
      fromSaved: boolean
      /** 브라우저 저장에 성공했는지 */
      stored: boolean
    }

export default function App() {
  const [input, setInput] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const [saved, setSaved] = useState(listSaved)
  const abortRef = useRef<AbortController | null>(null)

  const current = state.status === 'done' ? state.snapshots[state.index] : null
  const previous = state.status === 'done' ? (state.snapshots[state.index + 1] ?? null) : null
  const analysis = useMemo(() => (current ? analyze(current) : null), [current])
  const prevAnalysis = useMemo(() => (previous ? analyze(previous) : null), [previous])

  function openSaved(username: string): boolean {
    const snapshots = getSnapshots(username)
    if (!snapshots.length) return false
    abortRef.current?.abort()
    setInput(username)
    setState({ status: 'done', snapshots, index: 0, fromSaved: true, stored: true })
    return true
  }

  async function fetchNew(username: string) {
    setInput(username)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: 'loading', username })
    try {
      const data = await fetchAccount(username, ctrl.signal)
      const { saved: stored, snapshots } = saveSnapshot(data)
      setSaved(listSaved())
      setState({ status: 'done', snapshots, index: 0, fromSaved: false, stored })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const err = e instanceof AnalyzeError ? e : new AnalyzeError('알 수 없는 오류가 났습니다.')
      setState({ status: 'error', message: err.message, reason: err.reason })
    }
  }

  function submit(raw: string) {
    const username = parseUsername(raw)
    if (!username) {
      setState({ status: 'error', message: 'Instagram 주소, @username, username 중 하나로 입력해 주세요.' })
      return
    }
    // 저장된 결과가 있으면 크레딧을 쓰지 않고 그것부터 보여 준다 (새로 분석은 결과 위 버튼으로)
    if (!openSaved(username)) fetchNew(username)
  }

  function remove(username: string) {
    deleteSaved(username)
    setSaved(listSaved())
    if (current?.profile.username === username) setState({ status: 'idle' })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Instagram Analyzer</h1>
        <p className="mt-1 text-sm text-muted">최근 약 6개월 게시물로 이 계정에서 반응이 좋았던 콘텐츠를 찾습니다.</p>
      </header>

      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://www.instagram.com/nike/ · @nike · nike"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full min-w-0 shrink-0 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-action sm:w-auto sm:flex-1"
        />
        <button
          type="submit"
          disabled={state.status === 'loading'}
          className="h-12 rounded-full bg-action px-7 text-base font-medium text-white disabled:opacity-50"
        >
          {state.status === 'loading' ? '분석 중…' : 'Analyze'}
        </button>
      </form>

      {saved.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">저장된 분석</span>
          {saved.map((s) => (
            <span key={s.username} className="flex items-center rounded-full border border-line bg-surface">
              <button
                type="button"
                onClick={() => openSaved(s.username)}
                title={`${dateTime(s.latest)} 수집 · 저장본 ${s.count}개`}
                className="py-1 pl-3 pr-1 hover:text-action"
              >
                @{s.username} <span className="text-xs text-muted">{ago(s.latest)}</span>
              </button>
              <button
                type="button"
                aria-label={`${s.username} 저장본 지우기`}
                onClick={() => remove(s.username)}
                className="px-2 py-1 text-muted hover:text-ink"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {state.status === 'loading' && (
        <p className="mt-10 text-sm text-muted">
          @{state.username} 게시물을 모으는 중입니다. 게시물이 많으면 1~2분 걸릴 수 있습니다.
        </p>
      )}

      {state.status === 'error' && (
        <div className="mt-10 rounded-2xl border border-weak/30 bg-surface p-5">
          <p className="font-medium text-weak">{state.message}</p>
          {state.reason && <p className="mt-1 text-sm text-muted">{state.reason}</p>}
        </div>
      )}

      {state.status === 'done' && current && analysis && (
        <>
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">
                {state.fromSaved && state.index === 0 ? '저장된 결과' : state.index > 0 ? '지난 결과' : '방금 분석한 결과'}
                <span className="font-normal text-muted"> · {dateTime(current.fetchedAt)} 수집 ({ago(current.fetchedAt)})</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {state.stored
                  ? '이 브라우저에 저장돼 있어 다시 볼 때 크레딧이 들지 않습니다.'
                  : '브라우저 저장 공간이 부족해 이번 결과는 저장하지 못했습니다.'}
                {state.fromSaved && ' 오래된 썸네일은 인스타 쪽 주소가 만료돼 안 보일 수 있습니다.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {state.snapshots.length > 1 && (
                <select
                  value={state.index}
                  onChange={(e) => setState({ ...state, index: Number(e.target.value) })}
                  aria-label="수집본 선택"
                  className="h-9 rounded-full border border-line bg-surface px-3 text-sm"
                >
                  {state.snapshots.map((s, i) => (
                    <option key={s.fetchedAt} value={i}>
                      {dateTime(s.fetchedAt)}
                      {i === 0 ? ' (최신)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => fetchNew(current.profile.username)}
                className="h-9 rounded-full border border-link px-4 text-sm text-link"
              >
                새로 분석 (크레딧 1회)
              </button>
            </div>
          </div>
          <Results data={current} a={analysis} prev={previous && prevAnalysis ? { data: previous, a: prevAnalysis } : null} />
        </>
      )}
    </div>
  )
}
