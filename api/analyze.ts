// Vercel 서버리스 함수: GET /api/analyze?q=<주소 또는 username>
// 키는 Vercel 프로젝트 환경변수에만 둔다 (README 참고).
import { analyzeRequest } from '../server/http.js'

export function GET(req: Request) {
  return analyzeRequest(req)
}

export function OPTIONS(req: Request) {
  return analyzeRequest(req)
}
