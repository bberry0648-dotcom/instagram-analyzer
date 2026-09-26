// Request → Response 어댑터. 배포(Vercel)와 로컬(Vite 미들웨어) 모두 이걸 거친다.
import { handleAnalyze } from './fetchAccount.js'

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://bberry0648-dotcom.github.io')
    .split(',')
    .map((s) => s.trim())
  const ok = origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  return ok
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'content-type, x-app-passcode',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        Vary: 'Origin',
      }
    : {}
}

export async function analyzeRequest(req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } })

  // 배포된 API 주소가 알려져도 남이 유료 호출을 쓰지 못하도록 거는 간단한 암호 (선택)
  const passcode = process.env.APP_PASSCODE
  if (passcode && req.headers.get('x-app-passcode') !== passcode) {
    return json(401, { error: '접속 암호가 필요합니다.' })
  }

  const q = new URL(req.url).searchParams.get('q')
  const { status, body } = await handleAnalyze(q)
  return json(status, body)
}

// 썸네일 중계: 인스타 CDN은 다른 사이트에서의 이미지 로드를 막는 경우가 있다.
// 인스타·페이스북 CDN 주소만 통과시킨다 (아무 주소나 대신 받아 주는 프록시가 되지 않도록).
const IMAGE_HOST_RE = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i

export async function imageRequest(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('url')
  let target: URL
  try {
    target = new URL(raw ?? '')
  } catch {
    return new Response('bad url', { status: 400 })
  }
  if (target.protocol !== 'https:' || !IMAGE_HOST_RE.test(target.hostname)) return new Response('host not allowed', { status: 403 })

  const upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const type = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !type.startsWith('image/')) return new Response('image unavailable', { status: 502 })
  return new Response(upstream.body, {
    status: 200,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' },
  })
}
