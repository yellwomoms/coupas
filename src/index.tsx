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

  <!-- ① preconnect로 DNS/TCP 선연결 -->
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preconnect" href="https://fastly.jsdelivr.net" crossorigin>

  <!-- ② axios 대체: fetch 기반 경량 래퍼 (외부 CDN 제거 → 즉시 사용 가능) -->
  <script>
  const axios = {
    async _req(method, url, data, cfg, retries = 1) {
      const opts = { method, headers: { 'Content-Type': 'application/json', ...(cfg&&cfg.headers) } }
      if (data !== undefined) opts.body = JSON.stringify(data)
      let r
      try { r = await fetch(url, opts) } catch(netErr) {
        if (retries > 0) {
          await new Promise(res => setTimeout(res, 600))
          return axios._req(method, url, data, cfg, retries - 1)
        }
        throw netErr
      }
      // JSON 파싱 시도, 실패 시 텍스트로 에러 throw
      const ct = r.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const d = await r.json()
        // worker 재시작 감지 (ok:false + 특정 메시지)
        if (!r.ok && retries > 0 && method !== 'GET') {
          // 서버 에러지만 JSON 반환 → 그냥 반환
        }
        return { data: d, status: r.status }
      }
      // JSON이 아닌 응답 (worker 재시작, 네트워크 에러 등)
      const text = await r.text()
      if (retries > 0 && (text.includes('restarted') || text.includes('try again') || r.status >= 500)) {
        // worker 재시작으로 인한 일시적 오류 → 재시도
        await new Promise(res => setTimeout(res, 800))
        return axios._req(method, url, data, cfg, retries - 1)
      }
      throw new Error(text.substring(0, 120) || \`HTTP \${r.status}\`)
    },
    get:    (url, cfg)       => axios._req('GET',    url, undefined, cfg),
    post:   (url, data, cfg) => axios._req('POST',   url, data, cfg),
    patch:  (url, data, cfg) => axios._req('PATCH',  url, data, cfg),
    delete: (url, cfg)       => axios._req('DELETE', url, undefined, cfg),
  }
  </script>

  <!-- ③ Tailwind: defer (렌더링 차단 없음) -->
  <script src="https://cdn.tailwindcss.com" defer></script>

  <!-- ④ FontAwesome: 비동기 로드 -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"
        media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"></noscript>

  <!-- ⑤ 폰트: font-display:swap (렌더링 차단 없음) -->
  <style>
    @font-face { font-family:'BMJUA'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMJUA.woff') format('woff'); font-weight:normal; font-display:swap; }
    @font-face { font-family:'GmarketSansBold'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff') format('woff'); font-weight:700; font-display:swap; }
    @font-face { font-family:'NanumSquareRound'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NanumSquareRound.woff') format('woff'); font-weight:normal; font-display:swap; }
    @font-face { font-family:'NanumSquareExtraBold'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NanumSquareRoundEB.woff') format('woff'); font-weight:800; font-display:swap; }
    @font-face { font-family:'Nanum Pen Script'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2107@1.1/NanumSquareNeoLight.woff') format('woff'); font-weight:normal; font-display:swap; }
    @font-face { font-family:'Nanum Brush Script'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2107@1.1/NanumSquareNeoBold.woff') format('woff'); font-weight:normal; font-display:swap; }
    .font-nanum-pen   { font-family:'Nanum Pen Script',cursive; }
    .font-nanum-brush { font-family:'Nanum Brush Script',cursive; }
  </style>
  <link href="/static/style.css" rel="stylesheet">

  <!-- ⑥ FFmpeg: defer (영상합성 시에만 사용 - 로딩 차단 안함) -->
  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js" defer></script>
</head>
<body class="bg-gray-950 text-white min-h-screen">
  <!-- 인라인 초기 로딩 화면: JS 파싱 전에도 즉시 표시 -->
  <div id="app">
    <div style="min-height:100vh;background:#0d0820;display:flex;flex-direction:column">
      <div style="background:#110926;border-bottom:1px solid #2a1f4a;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.5rem">
        <div style="width:28px;height:28px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem">🤖</div>
        <div>
          <div style="font-size:0.95rem;font-weight:700;color:#f8f8f8">AI Studio</div>
          <div style="font-size:0.65rem;color:#6b7280">페르소나 기반 쇼츠 자동생성 · Typecast TTS</div>
        </div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center">
          <div style="width:36px;height:36px;border:3px solid rgba(124,58,237,0.3);border-top-color:#a855f7;border-radius:50%;animation:_spin 0.8s linear infinite;margin:0 auto 1rem"></div>
          <div style="color:#a78bfa;font-size:0.9rem;font-weight:600">로딩 중...</div>
          <div style="color:#6b7280;font-size:0.72rem;margin-top:0.3rem">페르소나와 설정을 불러오고 있어요</div>
        </div>
      </div>
    </div>
    <style>@keyframes _spin{to{transform:rotate(360deg)}}</style>
  </div>
  <script src="/static/app.js?v=20260420d"></script>
</body>
</html>`
}

export default app
