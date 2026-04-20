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

// 메인 대시보드 (SPA) — init 데이터 인라인 주입으로 첫 로딩 제거
app.get('/', async (c) => {
  // 초기 데이터를 SSR로 미리 가져와 HTML에 인라인 삽입
  let initData = null
  try {
    const [personasR, presetsR, voicesR, prodPresetsR] = await c.env.DB.batch([
      c.env.DB.prepare('SELECT * FROM personas ORDER BY id'),
      c.env.DB.prepare('SELECT * FROM subtitle_presets ORDER BY id'),
      c.env.DB.prepare('SELECT * FROM tts_voices ORDER BY id'),
      c.env.DB.prepare('SELECT * FROM production_presets ORDER BY is_default DESC, id ASC'),
    ])
    initData = {
      personas:          personasR.results    || [],
      subtitlePresets:   presetsR.results     || [],
      ttsVoices:         voicesR.results      || [],
      productionPresets: prodPresetsR.results || [],
      settings: {
        has_openai:   !!c.env.OPENAI_API_KEY,
        has_typecast: !!c.env.TYPECAST_API_KEY,
        has_n8n:      !!c.env.N8N_WEBHOOK_URL,
        tts_provider: 'typecast'
      }
    }
  } catch(e) { /* DB 실패 시 클라이언트가 /api/init 호출로 폴백 */ }

  return c.html(getMainHTML(initData))
})

// 404 fallback -> SPA
app.notFound((c) => {
  return c.html(getMainHTML(null))
})

function getMainHTML(initData: any): string {
  const inlineScript = initData
    ? `<script>window.__INIT_DATA__=${JSON.stringify(initData).replace(/<\/script>/gi,'<\\/script>')}</script>`
    : ''
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

  <!-- ③ Tailwind CDN 제거 — 실제 사용 클래스가 거의 없어 인라인 CSS로 대체 -->
  <style>
    .bg-gray-950 { background-color: #030712; }
    .text-white  { color: #ffffff; }
    .min-h-screen { min-height: 100vh; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .gap-2 { gap: 0.5rem; }
    .font-bold { font-weight: 700; }
    .text-sm { font-size: 0.875rem; }
    .text-xs { font-size: 0.75rem; }
    .mr-1 { margin-right: 0.25rem; }
    .ml-1 { margin-left: 0.25rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .p-2 { padding: 0.5rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .rounded { border-radius: 0.25rem; }
    .w-full { width: 100%; }
    .cursor-pointer { cursor: pointer; }
    .opacity-70 { opacity: 0.7; }
  </style>

  <!-- ④ FontAwesome: preload 비동기 로드 (렌더링 차단 없음) -->
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" as="style" onload="this.rel='stylesheet'">
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
  ${inlineScript}
  <link href="/static/style.css" rel="stylesheet">

  <!-- ⑥ FFmpeg: 영상 합성 버튼 클릭 시에만 동적 로드 (초기 로드 전혀 없음) -->
  <script>
  window._ffmpegLoaded = false
  window.loadFFmpeg = function() {
    if (window._ffmpegLoaded) return Promise.resolve()
    window._ffmpegLoaded = true
    return new Promise((resolve, reject) => {
      const s1 = document.createElement('script')
      s1.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'
      s1.onload = () => {
        const s2 = document.createElement('script')
        s2.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js'
        s2.onload = resolve
        s2.onerror = reject
        document.head.appendChild(s2)
      }
      s1.onerror = reject
      document.head.appendChild(s1)
    })
  }
  </script>
</head>
<body style="background:#030712;color:#fff;min-height:100vh;">
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
  <script src="/static/app.js?v=20260421" defer></script>
</body>
</html>`
}

export default app
