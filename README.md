# Instagram Analyzer

개인용 Instagram 계정 분석 도구. 계정 주소(또는 `@username`, `username`)를 넣으면 최근 약 6개월 게시물을 모아
이 계정 **내부 평균** 대비 반응이 좋았던 게시물·패턴을 보여 준다.

- 화면: https://bberry0648-dotcom.github.io/instagram-analyzer/ (GitHub Pages, 정적)
- 수집 API: https://instagram-analyzer-ochre.vercel.app/api/analyze?q=nike (Vercel 서버리스)

## 구조

```
src/            화면 (React + Tailwind). 수집 코드 없음
  lib/analyze.ts  평균·바이럴·대표 게시물·패턴 계산 (순수 함수)
  lib/api.ts      수집 API 호출
server/         수집 (키를 쓰는 곳 — 브라우저에 안 실림)
  providers/meta.ts   공식 Instagram Graph API · Business Discovery
  providers/apify.ts  Apify Instagram Scraper
  fetchAccount.ts     공급자 선택(공식 우선) · 30분 캐시
api/            Vercel 함수 진입점 (analyze, image 썸네일 중계)
shared/         서버·화면 공통 타입, username 추출
```

## 데이터 연결

키는 **Vercel 환경변수**(배포)와 `.env.local`(로컬)에만 둔다. 저장소에는 `.env.example`만 있다.
둘 다 넣으면 공식 API를 먼저 쓰고, 안 되는 계정(개인 계정 등)은 Apify로 넘어간다.

| 방법 | 조회 가능한 계정 | 조회수 | 준비물 |
|---|---|---|---|
| A. 공식 Graph API (Business Discovery) | 비즈니스·크리에이터 계정만 | 안 줌 | 내 프로페셔널 IG 계정 + 연결된 페이스북 페이지 + Meta 앱 토큰 |
| B. Apify Instagram Scraper | 공개 계정 전부 | 줌 | apify.com 가입 → Settings › API & Integrations 의 토큰 |

```bash
# 배포 서버에 키 넣기 (Apify 예시)
npx vercel env add APIFY_TOKEN production
npx vercel deploy --prod
```

키가 없거나, 비공개·존재하지 않는 계정이면 화면에 “이 계정은 현재 자동으로 데이터를 가져올 수 없습니다.”와 이유가 뜬다.
가짜·임의 숫자로 채우지 않는다.

## 분석 기준

- **바이럴**: 좋아요·댓글·조회수 중 하나라도 계정 평균의 2배 이상 (그 지표 값이 있는 게시물 5개 이상일 때만)
- **대표 게시물(10~20개, 중복 제거)**: 좋아요 상위 5 · 댓글 상위 4 · 조회수 상위 4 · 형식별 최고 1 · 최근 게시물 · 평균 이상 순
- **패턴**: 두 그룹이 각각 5개 이상이고 평균 반응 차이가 1.3배 이상일 때만 표시 (형식, 캡션 길이, 해시태그 수, 질문형 캡션, 요일, 바이럴 구성, 반복 해시태그)
- 사진·영상 속 인물·장면은 분석하지 않는다.

## 개발 · 배포

```bash
npm install
cp .env.example .env.local   # 키 채우기
npm run dev                  # 화면 + /api 가 같이 뜸

npm run deploy:api           # Vercel (수집 API)
npm run deploy:pages         # GitHub Pages (화면, gh-pages 브랜치)
```
