import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// 로컬 개발(npm run dev)에서는 /api/analyze · /api/image 를 Vite 서버가 직접 처리한다.
// .env.local 의 키는 Node 쪽 process.env 로만 들어가고, 브라우저 번들에는 VITE_ 접두사만 들어간다.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const route = req.url?.split('?')[0]
        if (route !== '/analyze' && route !== '/image') return next()
        const mod = await server.ssrLoadModule('/server/http.ts')
        const handler = route === '/analyze' ? mod.analyzeRequest : mod.imageRequest
        const url = `http://${req.headers.host}${req.originalUrl}`
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
        const response: Response = await handler(new Request(url, { method: req.method, headers }))
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    base: mode === 'production' ? '/instagram-analyzer/' : '/',
    plugins: [react(), tailwindcss(), localApi()],
  }
})
