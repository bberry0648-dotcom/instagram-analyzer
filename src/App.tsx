import { useMemo, useRef, useState } from 'react'
import type { AccountData } from '../shared/types'
import { parseUsername } from '../shared/username'
import { Results } from './components/Results'
import { analyze } from './lib/analyze'
import { AnalyzeError, fetchAccount } from './lib/api'
import { loadRecent, removeRecent, saveRecent } from './lib/recent'

type State =
  | { status: 'idle' }
  | { status: 'loading'; username: string }
  | { status: 'error'; message: string; reason?: string }
  | { status: 'done'; data: AccountData }

export default function App() {
  const [input, setInput] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const [recent, setRecent] = useState(loadRecent)
  const abortRef = useRef<AbortController | null>(null)

  const analysis = useMemo(() => (state.status === 'done' ? analyze(state.data) : null), [state])

  async function run(raw: string) {
    const username = parseUsername(raw)
    if (!username) {
      setState({ status: 'error', message: 'Instagram 주소, @username, username 중 하나로 입력해 주세요.' })
      return
    }
    setInput(username)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: 'loading', username })
    try {
      const data = await fetchAccount(username, ctrl.signal)
      setRecent(saveRecent(username))
      setState({ status: 'done', data })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const err = e instanceof AnalyzeError ? e : new AnalyzeError('알 수 없는 오류가 났습니다.')
      setState({ status: 'error', message: err.message, reason: err.reason })
    }
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
          run(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://www.instagram.com/nike/ · @nike · nike"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-action"
        />
        <button
          type="submit"
          disabled={state.status === 'loading'}
          className="h-12 rounded-full bg-action px-7 text-base font-medium text-white disabled:opacity-50"
        >
          {state.status === 'loading' ? '분석 중…' : 'Analyze'}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">최근 검색</span>
          {recent.map((u) => (
            <span key={u} className="flex items-center rounded-full border border-line bg-surface">
              <button type="button" onClick={() => run(u)} className="py-1 pl-3 pr-1 hover:text-action">
                @{u}
              </button>
              <button
                type="button"
                aria-label={`${u} 지우기`}
                onClick={() => setRecent(removeRecent(u))}
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

      {state.status === 'done' && analysis && <Results data={state.data} a={analysis} />}
    </div>
  )
}
