import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { apiRoutes } from './routes/api'

type Bindings = {
  DB: D1Database
  OPENAI_API_KEY: string
  TYPECAST_API_KEY: string
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
  <!-- 한국어 폰트: 나눔 손글씨 2종 + 배민체 + G마켓산스 -->
  <link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&family=Nanum+Brush+Script&display=swap" rel="stylesheet">
  <style>
    /* 배민 주아체 */
    @font-face { font-family:'BMJUA'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMJUA.woff') format('woff'); font-weight:normal; }
    /* G마켓산스 Bold */
    @font-face { font-family:'GmarketSansBold'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff') format('woff'); font-weight:700; }
    /* 나눔스퀘어라운드 */
    @font-face { font-family:'NanumSquareRound'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NanumSquareRound.woff') format('woff'); font-weight:normal; }
    @font-face { font-family:'NanumSquareExtraBold'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NanumSquareRoundEB.woff') format('woff'); font-weight:800; }
    /* 구글 폰트 alias */
    .font-nanum-pen    { font-family:'Nanum Pen Script',cursive; }
    .font-nanum-brush  { font-family:'Nanum Brush Script',cursive; }
  </style>
  <link href="/static/style.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <!-- FFmpeg.wasm: webm → mp4 변환용 -->
  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>
</head>
<body class="bg-gray-950 text-white min-h-screen">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
}

export default app
