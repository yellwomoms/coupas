import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { apiRoutes } from './routes/api'

type Bindings = {
  DB: D1Database
  OPENAI_API_KEY: string
  ELEVENLABS_API_KEY: string
  N8N_WEBHOOK_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// API 라우트
app.route('/api', apiRoutes)

// 메인 대시보드 (SPA)
app.get('/', (c) => {
  return c.html(getMainHTML())
})

// 404 fallback -> SPA
app.notFound((c) => {
  return c.html(getMainHTML())
})

function getMainHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Studio - 페르소나 쇼츠 자동생성</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/style.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
</head>
<body class="bg-gray-950 text-white min-h-screen">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
}

export default app
