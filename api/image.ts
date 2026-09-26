// Vercel 서버리스 함수: GET /api/image?url=<인스타 CDN 이미지 주소>
import { imageRequest } from '../server/http.js'

export function GET(req: Request) {
  return imageRequest(req)
}
