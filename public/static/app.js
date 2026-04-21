/* ================================================================
   AI Studio - 페르소나 쇼츠 자동생성 프론트엔드
   ================================================================ */
/* axios 래퍼는 index.tsx <script> 블록에 선언되어 있음 — 여기서 중복 선언 금지 */

const App = {
  // ── 상태 ──────────────────────────────────────────────────────
  state: {
    personas: [],
    subtitlePresets: [],
    ttsVoices: [],
    jobs: [],
    settings: { has_openai: false, has_typecast: false, has_n8n: false, tts_provider: 'typecast' },

    // 현재 작업 폼
    form: {
      source_url: '',
      platform: 'douyin',
      context_text: '',
      persona_id: null,
      subtitle_preset_id: 1,
      tts_voice_id: 1,
      value_keywords: [],
      product_number: '',    // 제품번호 (CTA용)
      // Typecast 전용 옵션
      tts_emotion: 'smart',
      tts_speed: 1.0
    },

    // 현재 작업 결과
    currentJob: null,
    isGenerating: false,
    isGeneratingTTS: false,
    isRendering: false,           // 영상 렌더링 중
    // ── 중단 컨트롤러 ──
    _scriptAbortCtrl: null,       // 대본 생성 중단용
    _ttsAbortCtrl: null,          // TTS 생성 중단용
    activeTab: 'workspace',       // workspace | history | preview | cost
    editingScript: false,
    currentAudio: null,
    playbackSpeed: 1.0,           // 오디오 재생 속도
    subtitleColor: '#ffffff',     // 자막 글자색
    subtitleBgBar: true,          // 자막 배경 바

    // ── 자막 상세 설정 ─────────────────────────────────────
    subtitleFont: 'NanumSquareRound',
    subtitleFontSize: 41,
    subtitlePosition: 'middle',
    subtitleFontColor: '#FFFFFF',       // 글자 색
    subtitleBgColor: 'rgba(0,0,0,0.65)', // 배경 색
    subtitleBgOpacity: 0.65,            // 배경 불투명도
    subtitleStrokeColor: '#000000',     // 외곽선 색
    subtitleStrokeWidth: 2,             // 외곽선 두께

    // ── 제작 프리셋 ────────────────────────────────────────
    productionPresets: [],
    selectedProductionPresetId: null
  },

  // ── 사용 가능한 폰트 목록 ──────────────────────────────────────
  fontOptions: [
    { value: 'NanumSquareRound',      label: '나눔스퀘어 라운드',    sample: '가나다ABC',  category: '고딕' },
    { value: 'NanumSquareExtraBold',  label: '나눔스퀘어 ExtraBold', sample: '가나다ABC',  category: '고딕' },
    { value: 'BMJUA',                 label: '배민 주아체',           sample: '가나다ABC',  category: '배민' },
    { value: 'GmarketSansBold',       label: 'G마켓산스 Bold',        sample: '가나다ABC',  category: '고딕' },
    { value: 'NanumMyeongjo',         label: '나눔명조',              sample: '가나다ABC',  category: '명조' },
    { value: 'Nanum Pen Script',        label: '나눔손글씨 다행체',     sample: '가나다ABC',  category: '손글씨', handwriting: true },
    { value: 'Nanum Brush Script',      label: '나눔손글씨 맛있는체', sample: '가나다ABC',  category: '손글씨', handwriting: true },
    { value: 'sans-serif',            label: '기본 고딕 (시스템)',    sample: '가나다ABC',  category: '기본' }
  ],

  // ── Typecast 감정 옵션 ─────────────────────────────────────────
  emotionOptions: [
    { value: 'smart',    label: '🧠 스마트 (자동)', desc: '문맥을 분석해 최적 감정 자동 적용' },
    { value: 'normal',   label: '😐 일반',          desc: '차분하고 자연스러운 톤' },
    { value: 'happy',    label: '😊 기쁨',          desc: '밝고 따뜻한 긍정적 톤' },
    { value: 'toneup',   label: '🔥 업비트',        desc: '생동감 넘치는 에너제틱 톤' },
    { value: 'sad',      label: '🥺 공감',          desc: '부드러운 공감과 감성 톤' },
    { value: 'whisper',  label: '🤫 속삭임',        desc: '친밀하고 은밀한 속삭임 톤' },
    { value: 'tonedown', label: '🎓 진지함',        desc: '신뢰감 있는 차분한 전문가 톤' },
    { value: 'angry',    label: '😤 강조',          desc: '강렬하고 단호한 강조 톤' }
  ],

  // ── 가치 키워드 옵션 ──────────────────────────────────────────
  keywordOptions: [
    '피부 개선', '시간 절약', '삶의 질 상승', '가성비 최강',
    '공간 절약', '성분 안전', '임상 검증', '편의성',
    '수면 개선', '스트레스 해소', '자기관리', '육아 필수'
  ],

  // ── 초기화 ────────────────────────────────────────────────────
  async init() {
    // 스켈레톤 로딩 화면 즉시 표시
    this._showSkeletonLoader()
    // 데이터 로드 → 완료 즉시 전체 렌더링
    await this.loadInitialData()
    this.bindEvents()
  },

  _showSkeletonLoader() {
    document.getElementById('app').innerHTML = `
      <header class="header">
        <div class="logo">
          <i class="fas fa-robot" style="color:var(--accent-light)"></i>
          <div><div class="logo-title">AI Studio</div><div class="logo-sub">페르소나 기반 쇼츠 자동생성 · Typecast TTS</div></div>
        </div>
      </header>
      <div class="main-layout" style="display:flex;gap:1rem;padding:1rem">
        <div style="flex:0 0 320px;display:flex;flex-direction:column;gap:0.75rem">
          <!-- 스켈레톤: 페르소나 영역 -->
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.25rem">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:0.75rem">페르소나 선택</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem">
              ${[1,2,3,4,5,6].map(() => `
                <div style="height:72px;background:var(--bg-secondary);border-radius:10px;animation:skeleton-pulse 1.2s ease-in-out infinite"></div>
              `).join('')}
            </div>
          </div>
          <!-- 스켈레톤: 입력 영역 -->
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.25rem;display:flex;flex-direction:column;gap:0.6rem">
            ${[1,2,3].map(() => `<div style="height:36px;background:var(--bg-secondary);border-radius:7px;animation:skeleton-pulse 1.2s ease-in-out infinite"></div>`).join('')}
          </div>
        </div>
        <div style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.25rem;display:flex;align-items:center;justify-content:center">
          <div style="text-align:center;color:var(--text-muted)">
            <span class="spinner" style="width:24px;height:24px;display:inline-block;margin-bottom:0.75rem"></span>
            <div style="font-size:0.82rem">데이터 로딩 중...</div>
          </div>
        </div>
      </div>
      <style>
        @keyframes skeleton-pulse {
          0%,100% { opacity:0.4 }
          50% { opacity:0.9 }
        }
      </style>
    `
  },

  async loadInitialData() {
    try {
      // SSR 인라인 데이터가 있으면 API 호출 없이 즉시 사용 (로딩 0ms)
      let d
      if (window.__INIT_DATA__) {
        d = window.__INIT_DATA__
        window.__INIT_DATA__ = null // 메모리 해제
      } else {
        // 폴백: API 호출
        let res
        try {
          res = await axios.get('/api/init')
        } catch (fetchErr) {
          console.error('/api/init 네트워크 오류:', fetchErr)
          // API 자체가 실패해도 빈 데이터로 앱을 표시
          d = { personas:[], subtitlePresets:[], ttsVoices:[], settings:{}, productionPresets:[] }
        }
        if (!d) d = res?.data?.data || { personas:[], subtitlePresets:[], ttsVoices:[], settings:{}, productionPresets:[] }
      }

      this.state.personas          = d.personas          || []
      this.state.subtitlePresets   = d.subtitlePresets   || []
      this.state.ttsVoices         = d.ttsVoices         || []
      this.state.settings          = d.settings          || {}
      this.state.productionPresets = d.productionPresets || []
      // jobs는 히스토리 탭 클릭 시 lazy load (초기 렌더링 속도 개선)
      this.state.jobs = []
      this.state._jobsLoaded = false

      // 기본값 세팅
      if (this.state.subtitlePresets.length > 0) {
        const def = this.state.subtitlePresets.find(p => p.is_default) || this.state.subtitlePresets[0]
        this.state.form.subtitle_preset_id = def.id
      }
      if (this.state.ttsVoices.length > 0) {
        const def = this.state.ttsVoices.find(v => v.is_default) || this.state.ttsVoices[0]
        this.state.form.tts_voice_id = def.id
      }

      // 기본 제작 프리셋 적용
      if (this.state.productionPresets.length > 0) {
        const defPreset = this.state.productionPresets.find(p => p.is_default) || this.state.productionPresets[0]
        this.applyProductionPreset(defPreset, false)
      }

      this.rerender()
    } catch (e) {
      console.error('초기 데이터 로딩 실패:', e)
      // 실패해도 빈 상태로 앱 표시 (로딩 화면에서 멈추지 않도록)
      this.rerender()
      this.showToast('데이터 로딩 실패. 새로고침해주세요.', 'error')
    }
  },

  // ── 렌더링 ────────────────────────────────────────────────────
  renderApp() {
    document.getElementById('app').innerHTML = this.getAppHTML()
  },

  rerender() {
    const app = document.getElementById('app')
    app.innerHTML = this.getAppHTML()
    this.bindEvents()
    // ── 자막 위치 select 강제 동기화 (middle 기본값 보장) ─────────
    const pos = this.state.subtitlePosition || 'middle'
    ;['subtitlePosition','subtitlePositionResynth','subtitlePositionNoTTS'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.value = pos
    })
  },

  getAppHTML() {
    return `
      ${this.getHeaderHTML()}
      <div class="main-layout">
        ${this.getLeftPanelHTML()}
        ${this.getRightPanelHTML()}
      </div>
      <div class="toast-container" id="toastContainer"></div>
    `
  },

  getHeaderHTML() {
    const { settings } = this.state
    return `
      <header class="header">
        <div class="logo">
          <div class="logo-icon">🎬</div>
          <div>
            <div class="logo-text">AI Studio</div>
            <div class="logo-sub">페르소나 기반 쇼츠 자동생성 · Typecast TTS</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          ${!settings.has_openai ? `<span style="font-size:0.72rem;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:0.3rem 0.6rem;border-radius:6px;">
            <i class="fas fa-exclamation-triangle" style="margin-right:4px;"></i>OpenAI 키 미설정
          </span>` : `<span style="font-size:0.72rem;color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.6rem;border-radius:6px;">
            <i class="fas fa-check-circle" style="margin-right:4px;"></i>OpenAI 연결
          </span>`}
          ${!settings.has_typecast ? `<span style="font-size:0.72rem;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:0.3rem 0.6rem;border-radius:6px;">
            <i class="fas fa-microphone-slash" style="margin-right:4px;"></i>Typecast 키 미설정
          </span>` : `<span style="font-size:0.72rem;color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.6rem;border-radius:6px;">
            <i class="fas fa-microphone" style="margin-right:4px;"></i>Typecast 연결
          </span>`}
          ${settings.has_n8n ? `<span style="font-size:0.72rem;color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.6rem;border-radius:6px;">
            <i class="fas fa-check-circle" style="margin-right:4px;"></i>n8n 연결됨
          </span>` : ''}
          <span style="font-size:0.72rem;color:var(--text-muted)">${new Date().toLocaleDateString('ko-KR')}</span>
        </div>
      </header>
    `
  },

  getLeftPanelHTML() {
    const { form, personas, subtitlePresets, ttsVoices, isGenerating } = this.state
    return `
      <aside class="left-panel">

        <!-- STEP 1: 소스 입력 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">1</span>
            소스 URL 입력
          </div>

          <div class="platform-tabs">
            <div class="platform-tab ${form.platform === 'douyin' ? 'active' : ''}" data-platform="douyin" id="tab-douyin">
              🎵 도우인
            </div>
            <div class="platform-tab ${form.platform === 'xiaohongshu' ? 'active' : ''}" data-platform="xiaohongshu" id="tab-xhs">
              📕 샤오홍슈
            </div>
            <div class="platform-tab ${form.platform === 'other' ? 'active' : ''}" data-platform="other" id="tab-other">
              🔗 기타
            </div>
          </div>

          <div class="input-group">
            <input
              type="text"
              class="input-field"
              id="sourceUrl"
              placeholder="https://www.douyin.com/video/..."
              value="${this.escHtml(form.source_url)}"
            />
          </div>

          <div class="input-group">
            <label class="input-label">
              <i class="fas fa-hashtag" style="margin-right:4px;color:var(--accent-light)"></i>
              제품번호 <span style="font-size:0.65rem;color:#a78bfa;margin-left:4px">CTA 자동 삽입</span>
            </label>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <input
                type="text"
                class="input-field"
                id="productNumber"
                placeholder="예: A-23, 7번, 상품코드 입력 (선택)"
                value="${this.escHtml(form.product_number)}"
                style="flex:1"
              />
            </div>
            ${form.product_number ? `
              <div id="ctaPreview" style="margin-top:0.35rem;padding:0.35rem 0.6rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:6px;font-size:0.68rem;color:#a78bfa">
                <i class="fas fa-magic" style="margin-right:4px"></i>
                CTA 자동 생성: "...프로필 링크에서 <strong>${this.escHtml(form.product_number)}번</strong>으로 확인해주세요"
              </div>
            ` : `
              <div id="ctaPreview" style="margin-top:0.35rem;font-size:0.65rem;color:var(--text-muted)">
                미입력 시 기본 CTA: "프로필 링크 확인해보세요" 사용
              </div>
            `}
          </div>

          <div class="input-group">
            <label class="input-label">
              <i class="fas fa-comment-alt" style="margin-right:4px;color:var(--accent-light)"></i>
              댓글·상품정보 컨텍스트 (선택)
            </label>
            <textarea
              class="input-field textarea"
              id="contextText"
              placeholder="상품 설명, 댓글, 후기 등을 복붙해주세요.&#10;&#10;예: '이 보습 밤 써보니 피부가 진짜 달라짐. 아이한테 써도 된다고 함. 성분 순함.'&#10;또는 '엄마의 마음으로 써줘', '누나의 찐후기 스타일' 등 간단 가이드도 가능"
            >${this.escHtml(form.context_text)}</textarea>
          </div>
        </section>

        <!-- STEP 2: 페르소나 선택 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">2</span>
            페르소나 선택 <span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px;">누구의 이야기?</span>
          </div>

          <div class="persona-grid" id="personaGrid">
            ${personas.length === 0
              ? '<div style="color:var(--text-muted);font-size:0.78rem;grid-column:span 3">로딩 중...</div>'
              : personas.map(p => `
                <div class="persona-card ${form.persona_id === p.id ? 'selected' : ''}"
                  data-persona-id="${p.id}">
                  ${form.persona_id === p.id ? '<div class="selected-check"><i class="fas fa-check"></i></div>' : ''}
                  <span class="persona-icon">${p.icon}</span>
                  <div class="persona-name">${p.label}</div>
                  <div class="persona-tone">${p.tone?.split(' ')[0] || ''}</div>
                </div>
              `).join('')
            }
          </div>

          ${form.persona_id ? (() => {
            const p = personas.find(x => x.id === form.persona_id)
            return p ? `<div style="margin-top:0.75rem;padding:0.6rem 0.75rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;">
              <div style="font-size:0.75rem;font-weight:600;color:var(--accent-light);margin-bottom:0.2rem">${p.icon} ${p.label} — ${p.tone}</div>
              <div style="font-size:0.7rem;color:var(--text-secondary);line-height:1.4">${p.description}</div>
            </div>` : ''
          })() : ''}
        </section>

        <!-- STEP 3: 가치 키워드 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">3</span>
            강조 가치 키워드
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.6rem">
            대본에서 강조하고 싶은 가치를 선택하세요
          </div>
          <div class="keyword-tags" id="keywordTags">
            ${this.keywordOptions.map(kw => `
              <div class="keyword-tag ${form.value_keywords.includes(kw) ? 'active' : ''}"
                data-keyword="${this.escHtml(kw)}">
                ${kw}
              </div>
            `).join('')}
          </div>
        </section>

        <!-- STEP 4: TTS 성우 + 감정 선택 + 미리듣기 → STEP 4로 통합 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">4</span>
            Typecast 성우 &amp; 감정 선택
            <span style="font-size:0.62rem;color:#a855f7;background:rgba(168,85,247,0.1);padding:0.15rem 0.4rem;border-radius:4px;margin-left:6px">TYPECAST</span>
          </div>

          <!-- 성우 목록 (미리듣기 버튼 포함) -->
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.5rem">
            성우 선택
            <span style="font-size:0.65rem;color:#a78bfa;margin-left:6px">▶ 버튼으로 미리듣기 가능</span>
          </div>
          <div class="voice-grid" id="voiceList">
            ${ttsVoices.map(v => {
              const genderIcon = v.gender === 'male' ? '👨' : '👩'
              const styleColor = {
                'warm': '#f59e0b', 'trendy': '#a855f7',
                'casual': '#10b981', 'professional': '#3b82f6', 'cheerful': '#f97316'
              }[v.style] || '#6b7280'
              const isSelected = form.tts_voice_id === v.id
              return `
                <div class="voice-item ${isSelected ? 'selected' : ''}" data-voice-id="${v.id}"
                  style="position:relative">
                  <div class="voice-avatar" style="background:${styleColor}22;border:1px solid ${styleColor}44">
                    ${genderIcon}
                  </div>
                  <div class="voice-info" style="flex:1;min-width:0">
                    <div class="voice-name">${v.name}</div>
                    <div class="voice-desc" style="font-size:0.62rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.description || ''}</div>
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;flex-shrink:0">
                    <button
                      onclick="event.stopPropagation();App.previewVoice(${v.id},'${this.escHtml(v.voice_id)}','${this.escHtml(v.name)}')"
                      id="previewBtn_${v.id}"
                      title="미리듣기"
                      style="width:28px;height:28px;border-radius:50%;background:${styleColor}22;border:1px solid ${styleColor}66;color:${styleColor};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.75rem;transition:all 0.2s;flex-shrink:0">
                      <i class="fas fa-play" id="previewIcon_${v.id}"></i>
                    </button>
                    ${isSelected ? `<i class="fas fa-check-circle" style="color:var(--accent-light);font-size:0.8rem"></i>` : ''}
                  </div>
                </div>
              `
            }).join('')}
          </div>

          <!-- ── 속도 슬라이더: 성우 목록 바로 아래 (미리듣기에 즉시 반영) ── -->
          <div style="margin-top:0.75rem;background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.15);border-radius:10px;padding:0.65rem 0.85rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">
              <span style="font-size:0.72rem;color:var(--text-muted)">
                <i class="fas fa-tachometer-alt" style="margin-right:4px;color:#a78bfa"></i>
                말하기 속도 <span style="font-size:0.63rem;color:#6b7280">(미리듣기·TTS 생성에 바로 반영)</span>
              </span>
              <span id="speedLabel" style="font-size:0.8rem;font-weight:700;color:var(--accent-light)">${form.tts_speed.toFixed(2)}×</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-size:0.63rem;color:var(--text-muted)">🐢 0.5×</span>
              <input type="range" id="ttsSpeedSlider"
                min="0.5" max="2.0" step="0.05" value="${form.tts_speed}"
                style="flex:1;accent-color:#7c3aed;height:4px;cursor:pointer">
              <span style="font-size:0.63rem;color:var(--text-muted)">🐇 2.0×</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.62rem;color:var(--text-muted);margin-top:0.2rem">
              <span>느리게 (명확하게)</span>
              <span style="color:#a78bfa">현재: ${form.tts_speed.toFixed(2)}× — 미리듣기 버튼으로 바로 확인하세요</span>
              <span>빠르게 (짧게)</span>
            </div>
          </div>

          <!-- 미리듣기 상태 바 -->
          <div id="voicePreviewBar" style="display:none;margin-top:0.6rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:0.55rem 0.75rem">
            <div style="display:flex;align-items:center;gap:0.6rem">
              <span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:rgba(124,58,237,0.2);border-top-color:#a855f7" id="previewSpinner"></span>
              <span style="font-size:0.75rem;color:#a78bfa" id="previewStatusText">미리듣기 생성 중...</span>
              <button onclick="App.stopPreview()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;padding:0.1rem 0.3rem">
                <i class="fas fa-stop"></i> 중지
              </button>
            </div>
            <audio id="previewAudio" style="display:none" onended="App.onPreviewEnded()"></audio>
          </div>

          <!-- 감정 선택 (Typecast 7감정 + 스마트 자동) -->
          <div style="font-size:0.72rem;color:var(--text-muted);margin:0.85rem 0 0.5rem">감정 스타일</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem" id="emotionSelector">
            ${this.emotionOptions.map(e => `
              <div class="emotion-item ${form.tts_emotion === e.value ? 'selected' : ''}"
                data-emotion="${e.value}"
                title="${e.desc}"
                style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.55rem;
                  background:${form.tts_emotion === e.value ? 'rgba(124,58,237,0.15)' : 'var(--bg-secondary)'};
                  border:1px solid ${form.tts_emotion === e.value ? 'rgba(124,58,237,0.5)' : 'var(--border)'};
                  border-radius:6px;cursor:pointer;transition:all 0.15s">
                <span style="font-size:0.9rem">${e.label.split(' ')[0]}</span>
                <span style="font-size:0.7rem;color:${form.tts_emotion === e.value ? 'var(--accent-light)' : 'var(--text-secondary)'}">${e.label.split(' ').slice(1).join(' ')}</span>
              </div>
            `).join('')}
          </div>

        </section>

        <!-- 생성 버튼 -->
        <section class="section" style="border-bottom:none">
          <button class="btn-generate" id="btnGenerate" style="${isGenerating ? 'background:linear-gradient(135deg,#ef4444,#dc2626)' : ''}">
            ${isGenerating
              ? `<span class="spinner"></span> 생성 중... <span style="font-size:0.72rem;opacity:0.85;margin-left:4px">(클릭하여 중단)</span>`
              : `<i class="fas fa-magic"></i> AI 대본 생성하기`}
          </button>
          ${!form.persona_id
            ? `<div style="text-align:center;font-size:0.72rem;color:#f59e0b;margin-top:0.5rem">
                <i class="fas fa-exclamation-circle"></i> 페르소나를 먼저 선택해주세요
              </div>`
            : ''}
        </section>

      </aside>
    `
  },

  getRightPanelHTML() {
    const currentJob = this.state.currentJob
    const activeTab = this.state.activeTab
    const state = this.state
    return `
      <main class="right-panel">

        <!-- 탭 네비게이션 (단순화) -->
        <nav class="tab-nav">
          <button class="tab-btn ${activeTab === 'workspace' ? 'active' : ''}" data-tab="workspace">
            <i class="fas fa-magic"></i> 작업 공간
          </button>
        </nav>

        ${this.getWorkspaceTabHTML()}

      </main>
    `
  },

  getWorkspaceTabHTML() {
    const currentJob = this.state.currentJob
    const settings = this.state.settings || {}
    const state = this.state

    // 스테이지 계산
    const stage = currentJob?.stage || 'waiting'
    const stages = [
      { key: 'waiting',     icon: '⏳', label: '대기',    pct: 0   },
      { key: 'script_done', icon: '📝', label: '대본',    pct: 25  },
      { key: 'tts_done',    icon: '🔊', label: 'TTS',     pct: 55  },
      { key: 'rendering',   icon: '🎬', label: '렌더링',  pct: 80  },
      { key: 'complete',    icon: '✅', label: '완료',    pct: 100 }
    ]
    const stageIdx  = stages.findIndex(s => s.key === stage)
    const progress  = stages[stageIdx]?.pct ?? 0

    const hasScript  = !!currentJob?.script_content
    const hasTTS     = !!currentJob?.tts_audio_url
    const hasVideo   = !!currentJob?.output_video_url  // 이전 합성 결과
    const hasBgVideo = !!state.bgVideoFile             // 업로드된 원본 영상
    const charCount  = hasScript ? currentJob.script_content.length : 0
    const isRendering = state.isRendering || false

    return `
      <!-- ━━ 전체 진행 상황 카드 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem">
            <i class="fas fa-tasks" style="color:var(--accent-light)"></i>
            워크플로우 진행 상황
          </div>
          <div style="font-size:0.78rem;font-weight:700;color:${progress===100?'#10b981':'var(--accent-light)'}">
            ${progress}%
          </div>
        </div>

        <!-- 진행 바 -->
        <div style="height:6px;background:var(--bg-secondary);border-radius:99px;overflow:hidden;margin-bottom:1rem">
          <div style="height:100%;width:${progress}%;background:${progress===100?'#10b981':'linear-gradient(90deg,#7c3aed,#a855f7)'};border-radius:99px;transition:width 0.6s ease"></div>
        </div>

        <!-- 단계 스텝 -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.25rem">
          ${stages.map((s, i) => {
            const done   = i < stageIdx
            const active = i === stageIdx
            return `
              <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
                <div style="
                  width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;
                  background:${done?'#10b981':active?'rgba(124,58,237,0.25)':'var(--bg-secondary)'};
                  border:2px solid ${done?'#10b981':active?'#7c3aed':'var(--border)'};
                  transition:all 0.3s
                ">
                  ${done ? '<i class="fas fa-check" style="color:white;font-size:0.7rem"></i>' : s.icon}
                </div>
                <div style="font-size:0.62rem;color:${done?'#10b981':active?'var(--accent-light)':'var(--text-muted)'};font-weight:${active?700:400};text-align:center">${s.label}</div>
              </div>
            `
          }).join('')}
        </div>

        ${currentJob ? `
          <div style="margin-top:0.75rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
            <code style="font-size:0.68rem;color:var(--text-muted);background:var(--bg-secondary);padding:0.2rem 0.5rem;border-radius:4px">${currentJob.job_id}</code>
            ${hasScript?`<span style="font-size:0.65rem;padding:0.15rem 0.4rem;border-radius:10px;background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)">✓ 대본</span>`:''}
            ${hasTTS?`<span style="font-size:0.65rem;padding:0.15rem 0.4rem;border-radius:10px;background:rgba(124,58,237,0.15);color:#a78bfa;border:1px solid rgba(124,58,237,0.3)">✓ TTS</span>`:''}
            ${hasVideo?`<span style="font-size:0.65rem;padding:0.15rem 0.4rem;border-radius:10px;background:rgba(251,146,60,0.15);color:#fb923c;border:1px solid rgba(251,146,60,0.3)">✓ 영상</span>`:''}
          </div>
        ` : `<div style="margin-top:0.75rem;font-size:0.75rem;color:var(--text-muted);text-align:center">좌측에서 URL·페르소나를 입력하고 대본 생성을 시작하세요</div>`}
      </div>

      <!-- ━━ 대본 뷰어 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <div class="script-viewer">
        <div class="script-viewer-header">
          <div class="script-viewer-title">
            <i class="fas fa-file-alt" style="color:var(--accent-light)"></i>
            생성된 대본 (PAS+E 구조)
          </div>
          <div class="script-actions">
            ${hasScript ? `
              <button class="btn-secondary" id="btnEditScript"><i class="fas fa-edit"></i> 수정</button>
              <button class="btn-secondary" id="btnRegenScript"><i class="fas fa-redo"></i> 재생성</button>
              <button class="btn-secondary" id="btnCopyScript"><i class="fas fa-copy"></i> 복사</button>
            ` : ''}
          </div>
        </div>
        <div class="script-content ${state.editingScript ? 'editable' : ''}" id="scriptContent"
          ${state.editingScript ? 'contenteditable="true"' : ''}>
          ${hasScript
            ? this.escHtml(currentJob.script_content)
            : '<span class="script-placeholder">좌측에서 페르소나와 URL을 입력하고 AI 대본 생성하기를 클릭하세요.\n\n3초 후킹 → 공감 → 해결 경험 → 효과 → CTA 구조로 자동 생성됩니다.</span>'}
        </div>
        ${hasScript ? `
          <div class="script-char-count">
            <span style="color:${charCount > 130 ? '#f59e0b' : 'var(--text-muted)'}">
              ${charCount}자 / 권장 70~130자
            </span>
            ${charCount > 130 ? `<span style="color:#f59e0b;margin-left:0.5rem"><i class="fas fa-exclamation-triangle"></i> 조금 길 수 있어요</span>` : ''}
            ${state.editingScript ? `
              <button class="btn-accent" id="btnSaveScript" style="margin-left:0.75rem;font-size:0.72rem;padding:0.2rem 0.5rem">
                <i class="fas fa-save"></i> 저장
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- ━━ TTS 음성 생성 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <div class="tts-player">
        <div class="script-viewer-header" style="margin-bottom:0.85rem">
          <div class="script-viewer-title">
            <i class="fas fa-microphone" style="color:var(--accent-light)"></i>
            TTS 음성 생성
            <span style="font-size:0.62rem;color:#a855f7;background:rgba(168,85,247,0.1);padding:0.12rem 0.35rem;border-radius:4px;margin-left:4px">TYPECAST</span>
          </div>
          ${hasScript && !state.isGeneratingTTS ? `
            <button class="btn-accent" id="btnGenerateTTS" style="font-size:0.78rem;padding:0.4rem 0.9rem">
              ${hasTTS
                ? '<i class="fas fa-redo"></i> 재생성'
                : '<i class="fas fa-play-circle"></i> TTS 생성'}
            </button>
          ` : state.isGeneratingTTS ? `
            <button class="btn-accent" onclick="App.cancelTTS()" style="font-size:0.78rem;padding:0.4rem 0.9rem;background:linear-gradient(135deg,#ef4444,#dc2626)">
              <span class="spinner" style="width:12px;height:12px;border-width:2px"></span> 생성 중... <span style="font-size:0.68rem;opacity:0.85">(클릭 중단)</span>
            </button>
          ` : ''}
        </div>

        ${!settings.has_typecast && hasScript ? `
          <div class="api-alert" style="margin-bottom:0.75rem">
            <i class="fas fa-microphone-slash"></i>
            <div>
              <strong>Typecast API 키 필요</strong>
              <span style="font-size:0.72rem"> — 지금은 브라우저 TTS로 미리 들을 수 있어요.</span>
              <button onclick="App.browserTTS()" style="background:none;border:none;color:#fcd34d;cursor:pointer;font-size:0.78rem;padding:0;margin-left:0.5rem">
                <i class="fas fa-volume-up"></i> 듣기
              </button>
            </div>
          </div>
        ` : ''}

        ${hasScript && !hasTTS && !state.isGeneratingTTS ? `
          <!-- ── 선택된 성우 정보 + 미리듣기 ── -->
          ${(() => {
            const selVoice = this.state.ttsVoices.find(v => v.id === this.state.form.tts_voice_id)
            if (!selVoice) return ''
            const emotionLabel = this.emotionOptions.find(e => e.value === this.state.form.tts_emotion)?.label?.split(' ')[0] || '🧠 스마트'
            const speed = (this.state.form.tts_speed || 1.0).toFixed(2)
            const genderIcon = selVoice.gender === 'male' ? '🧔' : '👩'
            return `
              <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.75rem">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.55rem">
                  <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600">
                    <i class="fas fa-user-circle" style="margin-right:4px;color:#a78bfa"></i>선택된 성우
                  </div>
                  <button onclick="App.workspacePreview(${selVoice.id},'${selVoice.voice_id}','${selVoice.name}')"
                    style="display:inline-flex;align-items:center;gap:0.35rem;background:rgba(124,58,237,0.15);border:1px solid #7c3aed;color:#a78bfa;padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;font-size:0.72rem;font-weight:600"
                    id="workspacePreviewBtn">
                    <i class="fas fa-play" id="workspacePreviewIcon"></i>
                    목소리 미리듣기
                  </button>
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem">
                  <div style="font-size:1.5rem;line-height:1">${genderIcon}</div>
                  <div>
                    <div style="font-size:0.85rem;font-weight:700;color:var(--text-primary)">${selVoice.name}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted);margin-top:0.15rem">${selVoice.description || ''}</div>
                  </div>
                  <div style="margin-left:auto;text-align:right">
                    <div style="font-size:0.65rem;color:#a78bfa;background:rgba(124,58,237,0.1);padding:0.15rem 0.4rem;border-radius:4px;margin-bottom:0.25rem">${emotionLabel}</div>
                    <div style="font-size:0.65rem;color:#34d399;background:rgba(16,185,129,0.1);padding:0.15rem 0.4rem;border-radius:4px">${speed}× 속도</div>
                  </div>
                </div>
                <!-- 미리듣기 상태 표시줄 -->
                <div id="workspacePreviewBar" style="display:none;margin-top:0.55rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:6px;padding:0.4rem 0.6rem;display:none;align-items:center;gap:0.5rem">
                  <span class="spinner" style="width:12px;height:12px;border-width:2px;border-color:rgba(124,58,237,0.2);border-top-color:#a855f7" id="workspacePreviewSpinner"></span>
                  <span style="font-size:0.72rem;color:#a78bfa" id="workspacePreviewStatus">미리듣기 생성 중...</span>
                  <audio id="workspacePreviewAudio" style="display:none" onended="App.onWorkspacePreviewEnded()"></audio>
                </div>
              </div>
            `
          })()}
        ` : ''}

        ${hasTTS ? `
          <!-- 오디오 플레이어 -->
          <div class="audio-player" style="margin-bottom:0.75rem">
            <button class="play-btn" id="playTTSBtn" onclick="App.toggleAudio()">
              <i class="fas fa-play" id="playIcon"></i>
            </button>
            <div class="audio-waveform" id="audioWaveform">
              ${Array.from({length:20}, () => `<div class="wave-bar" style="height:${15+Math.random()*70}%"></div>`).join('')}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.2rem;min-width:52px">
              <span style="font-size:0.72rem;color:var(--text-muted)" id="audioTime">0:00</span>
              <span style="font-size:0.6rem;color:#a78bfa">🎙 TC</span>
            </div>
          </div>
          <audio id="ttsAudio" src="${currentJob.tts_audio_url}" style="display:none"
            ontimeupdate="App.updateAudioTime()" onended="App.onAudioEnded()"></audio>

          <!-- 속도 조절 슬라이더 (재생 속도) -->
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.75rem">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
              <span style="font-size:0.72rem;color:var(--text-muted)"><i class="fas fa-tachometer-alt" style="margin-right:4px"></i>재생 속도</span>
              <div style="display:flex;align-items:center;gap:0.4rem">
                <button onclick="App.setPlaybackSpeed(0.75)" style="background:${state.playbackSpeed===0.75?'rgba(124,58,237,0.25)':'var(--bg-secondary)'};border:1px solid ${state.playbackSpeed===0.75?'#7c3aed':'var(--border)'};color:${state.playbackSpeed===0.75?'#a78bfa':'var(--text-muted)'};padding:0.15rem 0.4rem;border-radius:4px;cursor:pointer;font-size:0.68rem">0.75×</button>
                <button onclick="App.setPlaybackSpeed(0.9)" style="background:${state.playbackSpeed===0.9?'rgba(124,58,237,0.25)':'var(--bg-secondary)'};border:1px solid ${state.playbackSpeed===0.9?'#7c3aed':'var(--border)'};color:${state.playbackSpeed===0.9?'#a78bfa':'var(--text-muted)'};padding:0.15rem 0.4rem;border-radius:4px;cursor:pointer;font-size:0.68rem">0.9×</button>
                <button onclick="App.setPlaybackSpeed(1.0)" style="background:${(state.playbackSpeed??1.0)===1.0?'rgba(124,58,237,0.25)':'var(--bg-secondary)'};border:1px solid ${(state.playbackSpeed??1.0)===1.0?'#7c3aed':'var(--border)'};color:${(state.playbackSpeed??1.0)===1.0?'#a78bfa':'var(--text-muted)'};padding:0.15rem 0.4rem;border-radius:4px;cursor:pointer;font-size:0.68rem">1.0×</button>
                <button onclick="App.setPlaybackSpeed(1.1)" style="background:${state.playbackSpeed===1.1?'rgba(124,58,237,0.25)':'var(--bg-secondary)'};border:1px solid ${state.playbackSpeed===1.1?'#7c3aed':'var(--border)'};color:${state.playbackSpeed===1.1?'#a78bfa':'var(--text-muted)'};padding:0.15rem 0.4rem;border-radius:4px;cursor:pointer;font-size:0.68rem">1.1×</button>
                <button onclick="App.setPlaybackSpeed(1.25)" style="background:${state.playbackSpeed===1.25?'rgba(124,58,237,0.25)':'var(--bg-secondary)'};border:1px solid ${state.playbackSpeed===1.25?'#7c3aed':'var(--border)'};color:${state.playbackSpeed===1.25?'#a78bfa':'var(--text-muted)'};padding:0.15rem 0.4rem;border-radius:4px;cursor:pointer;font-size:0.68rem">1.25×</button>
              </div>
            </div>
            <input type="range" id="playbackSpeedSlider"
              min="0.5" max="1.5" step="0.05" value="${state.playbackSpeed ?? 1.0}"
              style="width:100%;accent-color:#7c3aed;height:4px"
              oninput="App.setPlaybackSpeed(parseFloat(this.value))">
            <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-muted);margin-top:0.2rem">
              <span>0.5× (느리게)</span>
              <span id="playbackSpeedLabel" style="color:var(--accent-light);font-weight:700">${(state.playbackSpeed??1.0).toFixed(2)}×</span>
              <span>1.5× (빠르게)</span>
            </div>
          </div>

          <!-- TTS 메타 정보 -->
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem">
            ${currentJob.tts_emotion?`<span style="font-size:0.65rem;background:rgba(124,58,237,0.1);color:#a78bfa;padding:0.15rem 0.4rem;border-radius:10px;border:1px solid rgba(124,58,237,0.2)">감정: ${currentJob.tts_emotion}</span>`:''}
            ${currentJob.tts_tempo?`<span style="font-size:0.65rem;background:rgba(16,185,129,0.1);color:#34d399;padding:0.15rem 0.4rem;border-radius:10px;border:1px solid rgba(16,185,129,0.2)">생성속도: ${currentJob.tts_tempo}×</span>`:''}
            <span style="font-size:0.65rem;background:rgba(168,85,247,0.1);color:#c084fc;padding:0.15rem 0.4rem;border-radius:10px;border:1px solid rgba(168,85,247,0.2)">🎙 Typecast ssfm-v30</span>
          </div>

          <!-- TTS 다운로드 + 재생성 -->
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <a href="${currentJob.tts_audio_url}" download="tts_typecast.mp3" class="btn-secondary">
              <i class="fas fa-download"></i> TTS 다운로드
            </a>
            <button class="btn-secondary" id="btnRegenTTS">
              <i class="fas fa-redo"></i> TTS 재생성
            </button>
          </div>
        ` : hasScript ? `
          <div style="text-align:center;padding:1.25rem;color:var(--text-muted);font-size:0.82rem">
            <i class="fas fa-microphone" style="font-size:1.8rem;display:block;margin-bottom:0.5rem;opacity:0.3"></i>
            위의 TTS 생성 버튼을 클릭하면<br>성우 목소리로 변환됩니다
          </div>
        ` : `
          <div style="text-align:center;padding:1.25rem;color:var(--text-muted);font-size:0.82rem">
            <i class="fas fa-file-alt" style="font-size:1.8rem;display:block;margin-bottom:0.5rem;opacity:0.3"></i>
            먼저 대본을 생성해주세요
          </div>
        `}
      </div>

      <!-- ━━ 영상 합성 & 다운로드 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem">
        <div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <i class="fas fa-film" style="color:#fb923c"></i>
          영상 합성 &amp; 다운로드
          ${hasVideo ? `<span style="font-size:0.65rem;color:#10b981;background:rgba(16,185,129,0.1);padding:0.15rem 0.4rem;border-radius:6px;border:1px solid rgba(16,185,129,0.3)">✅ 완성</span>` : ''}
        </div>

        ${hasVideo ? `
          <!-- ✅ 완성된 영상 다운로드 -->
          <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:1rem;text-align:center;margin-bottom:0.75rem">
            <div style="font-size:2rem;margin-bottom:0.5rem">🎬</div>
            <div style="font-size:0.85rem;font-weight:700;color:#10b981;margin-bottom:0.3rem">자막 합성 영상 완성!</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem">${hasTTS ? 'TTS 음성 + 자막이 합성된 영상입니다' : '자막 합성 영상입니다 (TTS 없음)'}</div>
            <a href="${currentJob.output_video_url}" download="${currentJob._videoIsMP4 === false ? 'aistudio_output.webm' : 'aistudio_output.mp4'}"
              style="display:inline-flex;align-items:center;gap:0.4rem;background:#10b981;color:white;padding:0.55rem 1.2rem;border-radius:8px;text-decoration:none;font-size:0.82rem;font-weight:700">
              <i class="fas fa-download"></i> ${currentJob._videoIsMP4 === false ? 'WebM 다운로드' : 'MP4 다운로드 (인스타·틱톡 호환)'}
            </a>
          </div>

          <!-- 🔧 자막 설정 편집 후 재합성 (항상 표시) -->
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.75rem">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-primary);margin-bottom:0.65rem;display:flex;align-items:center;gap:0.4rem">
              <i class="fas fa-sliders-h" style="color:#a78bfa"></i>
              자막 설정 편집 &amp; 재합성
              <span style="font-size:0.62rem;color:var(--text-muted);margin-left:4px">폰트·크기·위치·색 변경 후 다시 합성</span>
            </div>

            <!-- 폰트 선택 (가로 스크롤) -->
            <div style="margin-bottom:0.55rem">
              <label style="font-size:0.65rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.3rem">폰트</label>
              <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
                ${this.fontOptions.map(f => `
                  <div onclick="App.setSubtitleFont('${f.value}')"
                    style="padding:0.3rem 0.55rem;border-radius:6px;cursor:pointer;border:1px solid ${state.subtitleFont===f.value?'#7c3aed':'var(--border)'};background:${state.subtitleFont===f.value?'rgba(124,58,237,0.15)':'var(--bg-card)'};white-space:nowrap;transition:all 0.15s">
                    <div style="font-family:${f.value};font-size:0.75rem;color:${state.subtitleFont===f.value?'#a78bfa':'var(--text-secondary)'}">
                      ${f.label}${f.handwriting?' ✍️':''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 크기 + 위치 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.55rem">
              <div>
                <label style="font-size:0.65rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.2rem">
                  글자 크기 <strong style="color:var(--text-primary);font-size:0.72rem" id="fontSizeValResynth">${state.subtitleFontSize||41}px</strong>
                </label>
                <input type="range" id="subtitleFontSizeResynth" min="20" max="72" step="1"
                  value="${state.subtitleFontSize||41}"
                  style="width:100%;accent-color:#7c3aed;cursor:pointer"
                  oninput="App.state.subtitleFontSize=parseInt(this.value);const el=document.getElementById('fontSizeValResynth');if(el)el.textContent=this.value+'px'">
              </div>
              <div>
                <label style="font-size:0.65rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.2rem">자막 위치</label>
                <select id="subtitlePositionResynth" style="width:100%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem;border-radius:5px;font-size:0.72rem"
                  onchange="App.state.subtitlePosition=this.value">
                  <option value="middle" ${(state.subtitlePosition||'middle')==='middle'?'selected':''}>중앙 (기본)</option>
                  <option value="top" ${state.subtitlePosition==='top'?'selected':''}>상단</option>
                  <option value="top-middle" ${state.subtitlePosition==='top-middle'?'selected':''}>상‑중 사이</option>
                  <option value="middle-bottom" ${state.subtitlePosition==='middle-bottom'?'selected':''}>중‑하 사이</option>
                  <option value="bottom" ${state.subtitlePosition==='bottom'?'selected':''}>하단</option>
                </select>
              </div>
            </div>

            <!-- 글자 색 -->
            <div style="margin-bottom:0.55rem">
              <label style="font-size:0.65rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.25rem">글자 색</label>
              <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap">
                ${['#FFFFFF','#FFFF00','#00FF99','#FF6B6B','#A78BFA','#FBBF24','#34D399','#F97316'].map(col=>`
                  <div onclick="App.state.subtitleFontColor='${col}';App.state.subtitleColor='${col}'"
                    style="width:22px;height:22px;background:${col};border-radius:4px;cursor:pointer;border:2px solid ${(state.subtitleFontColor||'#FFFFFF').toUpperCase()===col?'#7c3aed':'var(--border)'}"></div>
                `).join('')}
                <input type="color" value="${state.subtitleFontColor||'#ffffff'}"
                  onchange="App.state.subtitleFontColor=this.value;App.state.subtitleColor=this.value"
                  style="width:28px;height:22px;padding:1px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:transparent">
              </div>
            </div>

            <!-- 배경바 + 불투명도 -->
            <div style="margin-bottom:0.65rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;font-size:0.7rem;color:var(--text-secondary)">
                <input type="checkbox" id="subtitleBgBarResynth" ${state.subtitleBgBar!==false?'checked':''}
                  onchange="App.state.subtitleBgBar=this.checked"
                  style="accent-color:#7c3aed;width:13px;height:13px">
                배경 바
              </label>
              ${state.subtitleBgBar!==false ? `
              <div style="display:flex;align-items:center;gap:0.3rem;flex:1">
                ${[{l:'검정',c:'rgba(0,0,0,0.65)'},{l:'진검정',c:'rgba(0,0,0,0.85)'},{l:'보라',c:'rgba(124,58,237,0.7)'},{l:'흰색',c:'rgba(255,255,255,0.75)'}].map(bg=>`
                  <div onclick="App.state.subtitleBgColor='${bg.c}'"
                    title="${bg.l}"
                    style="width:24px;height:15px;background:${bg.c};border:1px solid rgba(255,255,255,0.15);border-radius:3px;cursor:pointer;outline:${(state.subtitleBgColor||'rgba(0,0,0,0.65)')===bg.c?'2px solid #7c3aed':'none'}"></div>
                `).join('')}
                <input type="range" min="0" max="1" step="0.05" value="${state.subtitleBgOpacity||0.65}"
                  style="flex:1;accent-color:#7c3aed;height:3px;min-width:50px"
                  oninput="App.state.subtitleBgOpacity=parseFloat(this.value)">
                <span style="font-size:0.62rem;color:#a78bfa;min-width:24px">${Math.round((state.subtitleBgOpacity||0.65)*100)}%</span>
              </div>` : ''}
            </div>

            <!-- 원본 영상 교체 / 업로드 -->
            <div style="margin-bottom:0.75rem;background:${state.bgVideoFile ? 'rgba(16,185,129,0.07)' : 'rgba(251,146,60,0.07)'};border:1px solid ${state.bgVideoFile ? 'rgba(16,185,129,0.25)' : 'rgba(251,146,60,0.3)'};border-radius:9px;padding:0.75rem">
              <div style="font-size:0.75rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem">
                <i class="fas fa-video" style="color:#fb923c"></i>
                원본 영상 업로드
                ${state.bgVideoFile
                  ? `<span style="font-size:0.62rem;color:#10b981;background:rgba(16,185,129,0.12);padding:0.12rem 0.4rem;border-radius:5px;border:1px solid rgba(16,185,129,0.3)">✅ 업로드됨</span>`
                  : `<span style="font-size:0.62rem;color:#fbbf24;background:rgba(251,191,36,0.12);padding:0.12rem 0.4rem;border-radius:5px;border:1px solid rgba(251,191,36,0.3)">⚠ 미업로드 (그라데이션 배경)</span>`
                }
              </div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:0.5rem;line-height:1.5">
                ${state.bgVideoFile
                  ? `<i class="fas fa-check-circle" style="color:#10b981"></i> <strong style="color:#10b981">${state.bgVideoFile.name}</strong> (${(state.bgVideoFile.size/1024/1024).toFixed(1)}MB) — 재합성 시 이 영상 위에 자막이 합성됩니다`
                  : `도우인/샤오홍슈 원본 영상을 업로드하면 해당 영상 위에 자막이 합성됩니다.<br><span style="color:#fbbf24">⚠ 9:16 세로 영상 권장</span>`
                }
              </div>
              <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
                <label for="bgVideoInput2" style="display:inline-flex;align-items:center;gap:0.3rem;background:${state.bgVideoFile ? 'rgba(251,146,60,0.85)' : 'var(--accent)'};color:white;padding:0.35rem 0.8rem;border-radius:7px;cursor:pointer;font-size:0.75rem;font-weight:600">
                  <i class="fas fa-upload"></i> ${state.bgVideoFile ? '영상 교체' : '📁 영상 업로드'}
                </label>
                <input type="file" id="bgVideoInput2" accept="video/*" style="display:none" onchange="App.handleBgVideoUpload(event)">
                ${state.bgVideoFile ? `<button onclick="App.clearBgVideo()" style="display:inline-flex;align-items:center;gap:0.25rem;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.6rem;border-radius:7px;cursor:pointer;font-size:0.72rem"><i class="fas fa-times"></i> 제거</button>` : ''}
              </div>
            </div>

            <!-- 재합성 버튼 -->
            <button id="btnResynth"
              style="width:100%;padding:0.65rem;background:linear-gradient(135deg,${isRendering ? '#ef4444,#dc2626' : '#fb923c,#f97316'});border:none;color:white;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:0.5rem">
              ${isRendering
                ? `<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> 합성 중... (클릭하여 중단)`
                : `<i class="fas fa-redo"></i> ${state.bgVideoFile ? '업로드된 영상 & 자막 재합성' + (hasTTS ? ' (TTS 포함)' : ' (TTS 없이)') : '자막 설정 적용 후 재합성' + (hasTTS ? ' (TTS 포함)' : ' (TTS 없이)')}`}
            </button>
          </div>
        ` : hasTTS ? `
          <!-- 합성 준비 완료 or 합성 중 -->
          ${isRendering ? `
            <div id="renderingProgress" style="background:rgba(251,146,60,0.05);border:1px solid rgba(251,146,60,0.2);border-radius:10px;padding:1rem">
              <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
                <span class="spinner" style="width:18px;height:18px;border-color:rgba(251,146,60,0.3);border-top-color:#fb923c"></span>
                <div style="flex:1">
                  <div style="font-size:0.82rem;font-weight:700;color:#fb923c">자막 합성 렌더링 중...</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)" id="renderStatusText">준비 중...</div>
                </div>
                <div style="font-size:0.85rem;font-weight:700;color:#fb923c" id="renderPct">0%</div>
              </div>
              <div style="height:6px;background:var(--bg-secondary);border-radius:99px;overflow:hidden;margin-bottom:0.65rem">
                <div id="renderProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#f97316,#fb923c);border-radius:99px;transition:width 0.4s ease"></div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="font-size:0.68rem;color:var(--text-muted)">브라우저에서 직접 렌더링 중 — 탭을 닫지 마세요</div>
                <button onclick="App.cancelRendering()" style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:0.3rem 0.9rem;border-radius:6px;cursor:pointer;font-size:0.72rem;font-weight:600">
                  <i class="fas fa-stop-circle"></i> 합성 중단
                </button>
              </div>
            </div>
          ` : `
            <div style="padding:0.5rem 0">

              <!-- ① 원본 영상 업로드 (선택) -->
              <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.85rem">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem">
                  <i class="fas fa-video" style="color:#fb923c"></i>
                  원본 영상 (선택사항)
                  ${state.bgVideoFile ? `<span style="font-size:0.65rem;color:#10b981;background:rgba(16,185,129,0.1);padding:0.15rem 0.4rem;border-radius:6px;border:1px solid rgba(16,185,129,0.3)">✅ ${state.bgVideoFile.name}</span>` : '<span style="font-size:0.65rem;color:var(--text-muted);background:var(--bg-card);padding:0.15rem 0.4rem;border-radius:6px;border:1px solid var(--border)">미선택시 그라데이션 배경 사용</span>'}
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.6rem;line-height:1.5">
                  도우인/샤오홍슈에서 다운받은 영상을 업로드하면 해당 영상 위에 자막이 합성됩니다.<br>
                  <span style="color:#fbbf24">⚠ 9:16 세로 영상 권장</span> — 가로 영상은 크롭됩니다
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                  <label for="bgVideoInput" style="display:inline-flex;align-items:center;gap:0.35rem;background:var(--accent);color:white;padding:0.4rem 0.9rem;border-radius:7px;cursor:pointer;font-size:0.78rem;font-weight:600">
                    <i class="fas fa-upload"></i> ${state.bgVideoFile ? '영상 교체' : '영상 업로드'}
                  </label>
                  <input type="file" id="bgVideoInput" accept="video/*" style="display:none"
                    onchange="App.handleBgVideoUpload(event)">
                  ${state.bgVideoFile ? `
                  <button onclick="App.clearBgVideo()" style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:0.4rem 0.7rem;border-radius:7px;cursor:pointer;font-size:0.75rem">
                    <i class="fas fa-times"></i> 제거
                  </button>
                  ` : ''}
                </div>
                ${state.bgVideoFile ? `
                <div style="margin-top:0.5rem;font-size:0.68rem;color:#10b981">
                  <i class="fas fa-check-circle"></i> ${state.bgVideoFile.name} (${(state.bgVideoFile.size/1024/1024).toFixed(1)}MB) — 이 영상 위에 자막이 합성됩니다
                </div>` : ''}
              </div>

              <!-- ② TTS 준비 완료 안내 -->
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.35rem">
                <i class="fas fa-check-circle" style="color:#a78bfa;margin-right:6px"></i>
                TTS 음성 준비 완료 — 자막 합성을 시작할 수 있어요
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.85rem">
                ${state.bgVideoFile ? '업로드된 영상 + 자막 + TTS 오디오가 합성됩니다' : '기본 그라데이션 배경 + 자막 + TTS 오디오가 합성됩니다'}
              </div>

              <!-- 자막 설정 (확장판) -->
              <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.85rem;text-align:left">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
                  <div style="font-size:0.78rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:0.4rem">
                    <i class="fas fa-closed-captioning" style="color:var(--accent-light)"></i>자막 · TTS 설정
                  </div>
                  <!-- 프리셋 저장 버튼 -->
                  <button onclick="App.openSavePresetModal()" style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;padding:0.25rem 0.65rem;border-radius:6px;cursor:pointer;font-size:0.7rem;font-weight:600">
                    <i class="fas fa-save"></i> 프리셋 저장
                  </button>
                </div>

                <!-- 📌 제작 프리셋 불러오기 -->
                ${this.state.productionPresets.length > 0 ? `
                <div style="margin-bottom:0.75rem">
                  <label style="font-size:0.7rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.35rem"><i class="fas fa-bookmark" style="margin-right:3px;color:#a78bfa"></i>저장된 프리셋 불러오기</label>
                  <div style="display:flex;gap:0.35rem;flex-wrap:wrap">
                    ${this.state.productionPresets.map(p => `
                      <button onclick="App.loadProductionPreset(${p.id})"
                        style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.3rem 0.6rem;border-radius:6px;cursor:pointer;font-size:0.7rem;font-weight:600;transition:all 0.15s;
                          background:${this.state.selectedProductionPresetId===p.id?'rgba(124,58,237,0.2)':'var(--bg-card)'};
                          border:1px solid ${this.state.selectedProductionPresetId===p.id?'#7c3aed':'var(--border)'};
                          color:${this.state.selectedProductionPresetId===p.id?'#a78bfa':'var(--text-secondary)'}">
                        ${p.name}
                      </button>
                    `).join('')}
                  </div>
                </div>
                ` : ''}

                <!-- 자막 폰트 선택 -->
                <div style="margin-bottom:0.65rem">
                  <label style="font-size:0.68rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.3rem">폰트 선택</label>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem" id="fontPickerGrid">
                    ${this.fontOptions.map(f => `
                      <div onclick="App.setSubtitleFont('${f.value}')"
                        style="padding:0.45rem 0.6rem;border-radius:7px;cursor:pointer;border:1px solid ${(state.subtitleFont||'NanumSquareRound')===f.value?'#7c3aed':'var(--border)'};background:${(state.subtitleFont||'NanumSquareRound')===f.value?'rgba(124,58,237,0.15)':'var(--bg-card)'};transition:all 0.15s">
                        <div style="font-size:0.62rem;color:${(state.subtitleFont||'NanumSquareRound')===f.value?'#a78bfa':'var(--text-muted)'};margin-bottom:0.2rem;display:flex;align-items:center;gap:0.25rem">
                          ${f.handwriting?'✍️ ':''}${f.category}
                          ${f.handwriting?'<span style="font-size:0.58rem;color:#f59e0b;background:rgba(245,158,11,0.1);padding:0.08rem 0.3rem;border-radius:3px;border:1px solid rgba(245,158,11,0.2)">손글씨</span>':''}
                        </div>
                        <div style="font-family:${f.value};font-size:0.78rem;color:${(state.subtitleFont||'NanumSquareRound')===f.value?'var(--text-primary)':'var(--text-secondary)'};">${f.label}</div>
                        <div style="font-family:${f.value};font-size:0.85rem;color:#a78bfa;margin-top:0.15rem;font-weight:bold">가나다 ABC 123</div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- 글자 크기 + 위치 -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.6rem">
                  <div>
                    <label style="font-size:0.68rem;color:var(--text-muted);font-weight:600">
                      글자 크기 <strong style="color:var(--text-primary);font-size:0.75rem" id="fontSizeValMain">${state.subtitleFontSize||41}px</strong>
                    </label>
                    <input type="range" id="subtitleFontSize" min="20" max="72" step="1"
                      value="${state.subtitleFontSize||41}"
                      style="width:100%;accent-color:#7c3aed;cursor:pointer;margin-top:0.35rem;display:block"
                      oninput="App.state.subtitleFontSize=parseInt(this.value);const el=document.getElementById('fontSizeValMain');if(el)el.textContent=this.value+'px'">
                  </div>
                  <div>
                    <label style="font-size:0.68rem;color:var(--text-muted);font-weight:600">자막 위치</label>
                    <select id="subtitlePosition" style="width:100%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem;border-radius:5px;font-size:0.72rem;margin-top:0.2rem"
                      onchange="App.state.subtitlePosition=this.value">
                      <option value="middle" ${(state.subtitlePosition||'middle')==='middle'?'selected':''}>중앙 (기본)</option>
                      <option value="top" ${(state.subtitlePosition||'middle')==='top'?'selected':''}>상단</option>
                      <option value="top-middle" ${state.subtitlePosition==='top-middle'?'selected':''}>상‑중 사이</option>
                      <option value="middle-bottom" ${state.subtitlePosition==='middle-bottom'?'selected':''}>중‑하 사이</option>
                      <option value="bottom" ${state.subtitlePosition==='bottom'?'selected':''}>하단</option>
                    </select>
                  </div>
                </div>

                <!-- 글자 색 + 커스텀 -->
                <div style="margin-bottom:0.6rem">
                  <label style="font-size:0.68rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.3rem">글자 색상</label>
                  <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
                    ${['#FFFFFF','#FFFF00','#00FF99','#FF6B6B','#A78BFA','#FBBF24','#34D399','#F97316'].map(c=>`
                      <div onclick="App.state.subtitleFontColor='${c}';App.state.subtitleColor='${c}';this.closest('.color-swatch-row').querySelectorAll('.cswatch').forEach(d=>d.style.outline='none');this.style.outline='2px solid #7c3aed'"
                        class="cswatch"
                        style="width:22px;height:22px;background:${c};border-radius:4px;cursor:pointer;border:2px solid var(--border);outline:${(state.subtitleFontColor||'#FFFFFF')===c||(state.subtitleColor||'#ffffff').toUpperCase()===c?'2px solid #7c3aed':'none'};flex-shrink:0"></div>
                    `).join('')}
                    <input type="color" value="${state.subtitleFontColor||'#ffffff'}" title="직접 색 선택"
                      onchange="App.state.subtitleFontColor=this.value;App.state.subtitleColor=this.value"
                      style="width:28px;height:22px;padding:1px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:transparent">
                  </div>
                  <div class="color-swatch-row" style="display:none"></div>
                </div>

                <!-- 배경 바 설정 -->
                <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:0.6rem;margin-bottom:0.6rem">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.45rem">
                    <label style="font-size:0.68rem;color:var(--text-muted);font-weight:600">반투명 배경 바</label>
                    <div style="display:flex;align-items:center;gap:0.35rem">
                      <input type="checkbox" id="subtitleBgBar" ${state.subtitleBgBar!==false?'checked':''}
                        onchange="App.state.subtitleBgBar=this.checked"
                        style="accent-color:#7c3aed;width:14px;height:14px">
                      <span style="font-size:0.68rem;color:var(--text-secondary)">배경 바 ON</span>
                    </div>
                  </div>
                  ${state.subtitleBgBar !== false ? `
                  <div>
                    <label style="font-size:0.65rem;color:var(--text-muted);display:block;margin-bottom:0.25rem">배경 색상 선택</label>
                    <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap">
                      ${[
                        { label:'검정', color:'rgba(0,0,0,0.65)' },
                        { label:'진검정', color:'rgba(0,0,0,0.85)' },
                        { label:'보라', color:'rgba(124,58,237,0.7)' },
                        { label:'남색', color:'rgba(30,64,175,0.7)' },
                        { label:'흰색', color:'rgba(255,255,255,0.75)' }
                      ].map(bg => `
                        <div onclick="App.state.subtitleBgColor='${bg.color}';this.parentNode.querySelectorAll('div').forEach(d=>d.style.outline='none');this.style.outline='2px solid #7c3aed'"
                          title="${bg.label}"
                          style="width:28px;height:18px;background:${bg.color};border:1px solid rgba(255,255,255,0.2);border-radius:3px;cursor:pointer;outline:${(state.subtitleBgColor||'rgba(0,0,0,0.65)')===bg.color?'2px solid #7c3aed':'none'}"></div>
                      `).join('')}
                      <div style="display:flex;align-items:center;gap:0.25rem;margin-left:auto">
                        <span style="font-size:0.62rem;color:var(--text-muted)">불투명도</span>
                        <input type="range" min="0" max="1" step="0.05" value="${state.subtitleBgOpacity||0.65}"
                          style="width:70px;accent-color:#7c3aed;height:3px"
                          oninput="App.state.subtitleBgOpacity=parseFloat(this.value);document.getElementById('bgOpacityLabel').textContent=Math.round(this.value*100)+'%'">
                        <span style="font-size:0.62rem;color:#a78bfa;min-width:28px" id="bgOpacityLabel">${Math.round((state.subtitleBgOpacity||0.65)*100)}%</span>
                      </div>
                    </div>
                  </div>
                  ` : ''}
                </div>

                <!-- 실시간 자막 미리보기 -->
                <div style="background:#111;border-radius:8px;padding:0.75rem;position:relative;overflow:hidden;min-height:52px;display:flex;align-items:${(state.subtitlePosition||'middle')==='top'?'flex-start':(state.subtitlePosition||'middle')==='middle'?'center':'flex-end'};justify-content:center">
                  <div style="padding:0.3rem 0.7rem;border-radius:5px;background:${state.subtitleBgBar!==false?(state.subtitleBgColor||'rgba(0,0,0,0.65)'):'transparent'};text-align:center;max-width:90%">
                    <span style="font-family:${state.subtitleFont||'NanumSquareRound'};font-size:${Math.round((state.subtitleFontSize||41)*0.55)}px;color:${state.subtitleFontColor||'#FFFFFF'};font-weight:bold;text-shadow:1px 1px 2px ${state.subtitleBgBar!==false?'transparent':'#000'};line-height:1.3">
                      자막 미리보기 텍스트 — ABC 가나다
                    </span>
                  </div>
                  <div style="position:absolute;top:4px;left:4px;font-size:0.55rem;color:rgba(255,255,255,0.3)">미리보기</div>
                </div>
              </div>

              <button id="btnSynthStart" class="btn-generate" style="font-size:0.85rem;padding:0.7rem 1.5rem;background:linear-gradient(135deg,${isRendering ? '#ef4444,#dc2626' : '#fb923c,#f97316'})">
                ${isRendering
                  ? `<span class="spinner" style="width:15px;height:15px;border-width:2px"></span>&nbsp; 합성 중... <span style="font-size:0.72rem;opacity:0.85;margin-left:4px">(클릭하여 중단)</span>`
                  : hasBgVideo
                    ? `<i class="fas fa-film"></i> 영상 &amp; 자막 합성하기 (TTS 포함)`
                    : `<i class="fas fa-film"></i> 영상 &amp; 자막 합성하기 (그라데이션 배경)`}
              </button>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:0.4rem">
                브라우저에서 직접 렌더링 · 약 20~40초 소요
              </div>
            </div>
          `}
        ` : `
          <!-- TTS 없음 — 영상만 업로드해 자막 재합성 가능 -->
          <div style="padding:0.5rem 0">
            <div style="background:rgba(251,146,60,0.06);border:1px solid rgba(251,146,60,0.18);border-radius:8px;padding:0.75rem;margin-bottom:0.85rem">
              <div style="font-size:0.75rem;font-weight:700;color:#fb923c;margin-bottom:0.3rem;display:flex;align-items:center;gap:0.4rem">
                <i class="fas fa-info-circle"></i> 다운로드 영상 재합성
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);line-height:1.6">
                이전에 생성한 영상이 마음에 들지 않으면,<br>
                영상 파일을 업로드하고 <strong style="color:var(--text-primary)">자막 설정을 바꿔</strong> 다시 합성할 수 있습니다.<br>
                TTS 없이도 업로드된 영상 위에 자막만 입힐 수 있어요.
              </div>
            </div>

            <!-- 영상 업로드 -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.85rem">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem">
                <i class="fas fa-video" style="color:#fb923c"></i>
                영상 업로드 (선택사항)
                ${state.bgVideoFile ? `<span style="font-size:0.65rem;color:#10b981;background:rgba(16,185,129,0.1);padding:0.15rem 0.4rem;border-radius:6px;border:1px solid rgba(16,185,129,0.3)">✅ ${state.bgVideoFile.name}</span>` : '<span style="font-size:0.65rem;color:var(--text-muted)">미선택 시 그라데이션 배경 사용</span>'}
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                <label for="bgVideoInputNoTTS" style="display:inline-flex;align-items:center;gap:0.35rem;background:var(--accent);color:white;padding:0.4rem 0.9rem;border-radius:7px;cursor:pointer;font-size:0.78rem;font-weight:600">
                  <i class="fas fa-upload"></i> ${state.bgVideoFile ? '영상 교체' : '영상 업로드'}
                </label>
                <input type="file" id="bgVideoInputNoTTS" accept="video/*" style="display:none" onchange="App.handleBgVideoUpload(event)">
                ${state.bgVideoFile ? `
                <button onclick="App.clearBgVideo()" style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:0.4rem 0.7rem;border-radius:7px;cursor:pointer;font-size:0.75rem">
                  <i class="fas fa-times"></i> 제거
                </button>
                ` : ''}
              </div>
              ${state.bgVideoFile ? `<div style="margin-top:0.5rem;font-size:0.68rem;color:#10b981"><i class="fas fa-check-circle"></i> ${state.bgVideoFile.name} (${(state.bgVideoFile.size/1024/1024).toFixed(1)}MB)</div>` : ''}
            </div>

            <!-- 자막 설정 (간략) -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.85rem">
              <div style="font-size:0.75rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem">
                <i class="fas fa-closed-captioning" style="color:var(--accent-light)"></i> 자막 설정
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                <div>
                  <label style="font-size:0.65rem;color:var(--text-muted);display:block;margin-bottom:0.2rem">
                    글자 크기 <strong style="color:var(--text-primary);font-size:0.72rem" id="fontSizeValNoTTS">${state.subtitleFontSize||41}px</strong>
                  </label>
                  <input type="range" id="subtitleFontSizeNoTTS" min="20" max="72" step="1"
                    value="${state.subtitleFontSize||41}"
                    style="width:100%;accent-color:#7c3aed;cursor:pointer"
                    oninput="App.state.subtitleFontSize=parseInt(this.value);const el=document.getElementById('fontSizeValNoTTS');if(el)el.textContent=this.value+'px'">
                </div>
                <div>
                  <label style="font-size:0.65rem;color:var(--text-muted);display:block;margin-bottom:0.2rem">자막 위치</label>
                  <select id="subtitlePositionNoTTS" style="width:100%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem;border-radius:5px;font-size:0.72rem"
                    onchange="App.state.subtitlePosition=this.value">
                    <option value="middle" ${(state.subtitlePosition||'middle')==='middle'?'selected':''}>중앙 (기본)</option>
                    <option value="top" ${(state.subtitlePosition||'middle')==='top'?'selected':''}>상단</option>
                    <option value="top-middle" ${state.subtitlePosition==='top-middle'?'selected':''}>상‑중 사이</option>
                    <option value="middle-bottom" ${state.subtitlePosition==='middle-bottom'?'selected':''}>중‑하 사이</option>
                    <option value="bottom" ${state.subtitlePosition==='bottom'?'selected':''}>하단</option>
                  </select>
                </div>
              </div>
            </div>

            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.5rem;text-align:center">
              <i class="fas fa-exclamation-triangle" style="color:#fbbf24;margin-right:4px"></i>
              TTS 없이 합성 시 영상에 오디오가 없습니다. TTS를 먼저 생성하는 것을 권장합니다.
            </div>

            <button id="btnSynthNoTTS" class="btn-generate" style="font-size:0.82rem;padding:0.65rem 1.2rem;background:linear-gradient(135deg,${isRendering ? '#ef4444,#dc2626' : '#fb923c,#f97316'})">
              ${isRendering
                ? `<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> 합성 중... <span style="font-size:0.72rem;opacity:0.85;margin-left:4px">(클릭하여 중단)</span>`
                : hasBgVideo
                  ? `<i class="fas fa-film"></i> 영상 &amp; 자막 합성하기 (TTS 없이)`
                  : `<i class="fas fa-film"></i> 자막만 합성 (그라데이션 배경)`}
            </button>
          </div>
        `}
      </div>

      <!-- YouTube/SNS 제목 & 설명글 (워크스페이스 하단 인라인) -->
      ${hasScript ? this._getYoutubeSectionHTML() : ''}

      <!-- 숨겨진 캔버스 (렌더링용) -->
      <canvas id="synthCanvas" style="display:none"></canvas>
    `
  },

  getHistoryTabHTML() {
    const { jobs, _jobsLoaded } = this.state

    // jobs가 아직 로드되지 않았으면 로딩 스피너 표시 + 자동 로드 트리거
    if (!_jobsLoaded) {
      // 렌더링 후 자동으로 jobs 로드 (setTimeout으로 렌더링 완료 후 실행)
      setTimeout(() => App.refreshJobs(), 0)
      return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;gap:1rem">
          <div class="spinner" style="width:28px;height:28px"></div>
          <div style="color:var(--text-muted);font-size:0.82rem">히스토리 불러오는 중...</div>
        </div>
      `
    }

    return `
      <div>
        ${jobs.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">아직 생성된 작업이 없습니다.<br>좌측에서 URL과 페르소나를 선택하고<br>대본을 생성해보세요!</div>
          </div>
        ` : `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <div style="font-size:0.82rem;color:var(--text-muted)">총 ${jobs.length}개의 작업</div>
            <button class="btn-secondary" onclick="App.refreshJobs()">
              <i class="fas fa-sync-alt"></i> 새로고침
            </button>
          </div>
          <div class="history-list">
            ${jobs.map(job => {
              const platformIcon = job.platform === 'douyin' ? '🎵' : job.platform === 'xiaohongshu' ? '📕' : '🔗'
              return `
                <div class="history-item" onclick="App.loadJobFromHistory('${job.job_id}')">
                  <div class="history-header">
                    <div class="history-persona">
                      <span>${job.persona_icon || '👤'}</span>
                      <span>${job.persona_label || '알 수 없음'}</span>
                      <span style="color:var(--text-muted)">${platformIcon}</span>
                    </div>
                    <div class="history-status status-${job.status}">${this.getStatusLabel(job.status)}</div>
                  </div>
                  <div class="history-url">${job.source_url}</div>
                  ${job.script_content ? `
                    <div class="history-script-preview">${this.escHtml(job.script_content)}</div>
                  ` : ''}
                  <div class="history-time">
                    <i class="fas fa-clock"></i>
                    ${this.formatDate(job.created_at)}
                  </div>
                </div>
              `
            }).join('')}
          </div>
        `}
      </div>
    `
  },

  getPreviewTabHTML() {
    const { currentJob, form, subtitlePresets } = this.state
    const preset = subtitlePresets.find(p => p.id === form.subtitle_preset_id) || subtitlePresets[0]
    const script = currentJob?.script_content || '여기에 대본 자막이\n표시됩니다'
    const firstLine = script.split('\n')[0] || script.substring(0, 20)

    return `
      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">

          <!-- 자막 미리보기 -->
          <div>
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1rem">
              <i class="fas fa-mobile-alt" style="color:var(--accent-light)"></i> 자막 미리보기 (9:16)
            </div>
            <div style="display:flex;justify-content:center">
              <div class="subtitle-preview">
                <div class="preview-video-placeholder">
                  <i class="fas fa-play-circle"></i>
                </div>
                ${preset ? `
                  <div class="preview-subtitle">
                    <span class="preview-subtitle-text" style="
                      background:${preset.bg_color};
                      color:${preset.font_color};
                      font-family:'${preset.font_family}',sans-serif;
                      -webkit-text-stroke: ${preset.stroke_width}px ${preset.stroke_color};
                    ">${this.escHtml(firstLine)}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- 자막 색상 정보 -->
            ${preset ? `
              <div style="margin-top:1rem;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:0.75rem">
                <div style="font-size:0.75rem;font-weight:600;margin-bottom:0.5rem">${preset.name}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;font-size:0.72rem;color:var(--text-muted)">
                  <div>폰트: <span style="color:var(--text-primary)">${preset.font_family}</span></div>
                  <div>크기: <span style="color:var(--text-primary)">${preset.font_size}px</span></div>
                  <div>레이아웃: <span style="color:var(--text-primary)">${preset.layout}</span></div>
                  <div>하이라이트: <span style="color:${preset.highlight_color}">${preset.highlight_color}</span></div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- 대본 전체 자막 시뮬레이션 -->
          <div>
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1rem">
              <i class="fas fa-list-alt" style="color:var(--accent-light)"></i> 대본 자막 라인
            </div>
            ${currentJob?.script_content ? `
              <div style="display:flex;flex-direction:column;gap:0.5rem">
                ${currentJob.script_content.split('\n').filter(l => l.trim()).map((line, i) => `
                  <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:6px">
                    <span style="width:20px;height:20px;background:var(--bg-secondary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:var(--text-muted);flex-shrink:0">${i+1}</span>
                    <span style="font-size:0.82rem;flex:1">${this.escHtml(line)}</span>
                    <span style="font-size:0.65rem;color:var(--text-muted)">${line.length}자</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-state-icon" style="font-size:1.8rem">✏️</div>
                <div class="empty-state-text">대본을 먼저 생성해주세요</div>
              </div>
            `}

            <!-- 타이밍 가이드 -->
            ${currentJob?.script_content ? `
              <div style="margin-top:1rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:0.75rem">
                <div style="font-size:0.75rem;font-weight:600;color:var(--accent-light);margin-bottom:0.5rem">
                  <i class="fas fa-clock"></i> 예상 영상 시간
                </div>
                <div style="font-size:0.72rem;color:var(--text-secondary)">
                  총 글자 수: <strong>${currentJob.script_content.length}자</strong><br>
                  TTS 속도 1.0x 기준: 약 <strong>${Math.round(currentJob.script_content.length / 5)}초</strong><br>
                  권장 분량: <span style="color:${currentJob.script_content.length >= 70 && currentJob.script_content.length <= 120 ? '#10b981' : '#f59e0b'}">
                    ${currentJob.script_content.length >= 70 && currentJob.script_content.length <= 120 ? '✅ 적정 (15~30초)' : '⚠️ 조정 권장'}
                  </span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `
  },

  // ── 이벤트 바인딩 ─────────────────────────────────────────────
  bindEvents() {
    // 플랫폼 탭
    document.querySelectorAll('.platform-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.state.form.platform = tab.dataset.platform
        this.rerender()
      })
    })

    // URL 입력
    const urlInput = document.getElementById('sourceUrl')
    if (urlInput) {
      urlInput.addEventListener('input', e => {
        this.state.form.source_url = e.target.value
        // 플랫폼 자동 감지
        const url = e.target.value
        if (url.includes('douyin') || url.includes('tiktok')) {
          this.state.form.platform = 'douyin'
        } else if (url.includes('xiaohongshu') || url.includes('xhslink') || url.includes('rednote')) {
          this.state.form.platform = 'xiaohongshu'
        }
      })
    }

    // 제품번호 입력
    const productInput = document.getElementById('productNumber')
    if (productInput) {
      productInput.addEventListener('input', e => {
        this.state.form.product_number = e.target.value
        // CTA 미리보기 실시간 업데이트 (rerender 없이)
        const ctaPreview = document.getElementById('ctaPreview')
        if (ctaPreview) {
          if (e.target.value) {
            ctaPreview.innerHTML = `<i class="fas fa-magic" style="margin-right:4px"></i>CTA 자동 생성: "...프로필 링크에서 <strong>${this.escHtml(e.target.value)}번</strong>으로 확인해주세요"`
            ctaPreview.style.display = 'block'
          } else {
            ctaPreview.innerHTML = `미입력 시 기본 CTA: "프로필 링크 확인해보세요" 사용`
            ctaPreview.style.color = 'var(--text-muted)'
          }
        }
      })
    }

    // 컨텍스트 텍스트
    const ctxInput = document.getElementById('contextText')
    if (ctxInput) {
      ctxInput.addEventListener('input', e => {
        this.state.form.context_text = e.target.value
      })
    }

    // 페르소나 선택
    document.querySelectorAll('.persona-card').forEach(card => {
      card.addEventListener('click', () => {
        this.state.form.persona_id = parseInt(card.dataset.personaId)
        // 페르소나에 맞는 보이스 자동 선택
        const persona = this.state.personas.find(p => p.id === this.state.form.persona_id)
        if (persona) {
          const matchVoice = this.state.ttsVoices.find(v =>
            v.persona_match && v.persona_match.includes(persona.name)
          )
          if (matchVoice) this.state.form.tts_voice_id = matchVoice.id
        }
        this.rerender()
      })
    })

    // 키워드 태그
    document.querySelectorAll('.keyword-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const kw = tag.dataset.keyword
        const idx = this.state.form.value_keywords.indexOf(kw)
        if (idx === -1) {
          this.state.form.value_keywords.push(kw)
        } else {
          this.state.form.value_keywords.splice(idx, 1)
        }
        tag.classList.toggle('active')
      })
    })

    // 자막 프리셋 선택
    document.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', () => {
        this.state.form.subtitle_preset_id = parseInt(item.dataset.presetId)
        document.querySelectorAll('.preset-item').forEach(i => i.classList.remove('selected'))
        item.classList.add('selected')
        item.querySelector('.preset-radio').style.background = 'var(--accent)'
      })
    })

    // TTS 보이스 선택
    document.querySelectorAll('.voice-item').forEach(item => {
      item.addEventListener('click', () => {
        this.state.form.tts_voice_id = parseInt(item.dataset.voiceId)
        document.querySelectorAll('.voice-item').forEach(i => i.classList.remove('selected'))
        item.classList.add('selected')
      })
    })

    // 생성 버튼 (생성 중이면 중단, 아니면 생성)
    const btnGen = document.getElementById('btnGenerate')
    if (btnGen) {
      btnGen.addEventListener('click', () => {
        if (this.state.isGenerating) this.cancelScript()
        else this.generateScript()
      })
    }

    // 대본 수정 버튼
    const btnEdit = document.getElementById('btnEditScript')
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        this.state.editingScript = !this.state.editingScript
        this.rerender()
        if (this.state.editingScript) {
          setTimeout(() => {
            const el = document.getElementById('scriptContent')
            if (el) { el.focus(); const range = document.createRange(); range.selectNodeContents(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(range) }
          }, 50)
        }
      })
    }

    // 대본 저장
    const btnSave = document.getElementById('btnSaveScript')
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveScript())
    }

    // 대본 재생성
    const btnRegen = document.getElementById('btnRegenScript')
    if (btnRegen) {
      btnRegen.addEventListener('click', () => this.regenerateScript())
    }

    // 대본 복사
    const btnCopy = document.getElementById('btnCopyScript')
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (this.state.currentJob?.script_content) {
          navigator.clipboard.writeText(this.state.currentJob.script_content)
          this.showToast('대본이 클립보드에 복사되었습니다!', 'success')
        }
      })
    }

    // TTS 생성 버튼
    const btnTTS = document.getElementById('btnGenerateTTS')
    if (btnTTS) {
      btnTTS.addEventListener('click', () => this.generateTTS())
    }

    // TTS 재생성 (workspace 버튼에서도)
    const btnRegenTTS = document.getElementById('btnRegenTTS')
    if (btnRegenTTS) {
      btnRegenTTS.addEventListener('click', () => this.generateTTS())
    }

    // TTS 생성 버튼 (workspace 상단)
    const btnGenerateTTS = document.getElementById('btnGenerateTTS')
    if (btnGenerateTTS) {
      btnGenerateTTS.addEventListener('click', () => this.generateTTS())
    }

    // 영상 합성 버튼들 (재합성 / 합성시작 / NoTTS)
    const btnResynth = document.getElementById('btnResynth')
    if (btnResynth) {
      btnResynth.addEventListener('click', () => {
        if (this.state.isRendering) this.cancelRendering()
        else this.startVideoSynthesis()
      })
    }
    const btnSynthStart = document.getElementById('btnSynthStart')
    if (btnSynthStart) {
      btnSynthStart.addEventListener('click', () => {
        if (this.state.isRendering) this.cancelRendering()
        else this.startVideoSynthesis()
      })
    }
    const btnSynthNoTTS = document.getElementById('btnSynthNoTTS')
    if (btnSynthNoTTS) {
      btnSynthNoTTS.addEventListener('click', () => {
        if (this.state.isRendering) this.cancelRendering()
        else this.startVideoSynthesisNoTTS()
      })
    }

    // 감정 선택
    document.querySelectorAll('.emotion-item').forEach(item => {
      item.addEventListener('click', () => {
        this.state.form.tts_emotion = item.dataset.emotion
        document.querySelectorAll('.emotion-item').forEach(i => {
          i.style.background = 'var(--bg-secondary)'
          i.style.borderColor = 'var(--border)'
          i.querySelector('span:last-child').style.color = 'var(--text-secondary)'
        })
        item.style.background = 'rgba(124,58,237,0.15)'
        item.style.borderColor = 'rgba(124,58,237,0.5)'
        item.querySelector('span:last-child').style.color = 'var(--accent-light)'
      })
    })

    // TTS 속도 슬라이더
    const speedSlider = document.getElementById('ttsSpeedSlider')
    if (speedSlider) {
      speedSlider.addEventListener('input', e => {
        this.state.form.tts_speed = parseFloat(e.target.value)
        const lbl = document.getElementById('speedLabel')
        if (lbl) lbl.textContent = this.state.form.tts_speed.toFixed(2) + '×'
      })
    }

    // 탭 버튼
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.activeTab = btn.dataset.tab
        this.rerender()
      })
    })
  },

  // ── 대본 생성 중단 ────────────────────────────────────────────
  cancelScript() {
    if (this.state._scriptAbortCtrl) {
      this.state._scriptAbortCtrl.abort()
      this.state._scriptAbortCtrl = null
    }
    this.state.isGenerating = false
    this.showToast('대본 생성이 중단되었습니다.', 'info')
    this.rerender()
  },

  // ── 대본 생성 ─────────────────────────────────────────────────
  async generateScript() {
    const { form } = this.state
    if (!form.source_url.trim()) {
      this.showToast('소스 URL을 입력해주세요.', 'error'); return
    }
    if (!form.persona_id) {
      this.showToast('페르소나를 선택해주세요.', 'error'); return
    }

    // AbortController 생성
    const abortCtrl = new AbortController()
    this.state._scriptAbortCtrl = abortCtrl
    this.state.isGenerating = true
    this.rerender()

    try {
      const res = await axios.post('/api/jobs', {
        source_url: form.source_url,
        platform: form.platform,
        context_text: form.context_text,
        persona_id: form.persona_id,
        subtitle_preset_id: form.subtitle_preset_id,
        tts_voice_id: form.tts_voice_id,
        value_keywords: form.value_keywords,
        product_number: form.product_number   // 제품번호 전달
      })

      if (res.data.ok) {
        this.state.currentJob = {
          job_id: res.data.data.job_id,
          script_content: res.data.data.script,
          status: 'script_ready',
          stage: 'script_done',
          source_url: form.source_url,
          tts_audio_url: null
        }
        // 히스토리 갱신
        const jobsRes = await axios.get('/api/jobs')
        this.state.jobs = jobsRes.data.data || []
        this.state._jobsLoaded = true

        this.showToast('대본이 생성되었습니다! ✨', 'success')
        this.state.activeTab = 'workspace'
        this.state.isGeneratingTitle = true  // 유튜브 제목 생성 중 표시
        this.rerender()

        // ── 백그라운드 유튜브 제목/설명 자동 생성 (논블로킹) ──────
        const jobIdForTitle = res.data.data.job_id
        const prodNum = form.product_number || ''
        setTimeout(async () => {
          try {
            const titleRes = await axios.post(`/api/jobs/${jobIdForTitle}/generate-title`, {
              product_number: prodNum
            })
            if (titleRes.data.ok) {
              if (this.state.currentJob?.job_id === jobIdForTitle) {
                const d = titleRes.data.data
                this.state.currentJob.youtube_titles      = d.titles || []
                this.state.currentJob.youtube_description = d.description || ''
                this.state.currentJob.youtube_hashtags    = d.hashtags || []
                if (!titleRes.data.demo) {
                  this.showToast('🎯 제목 & 설명글 자동 생성 완료!', 'success')
                }
              }
            }
          } catch(e) { /* 백그라운드 실패는 무시 */ } finally {
            this.state.isGeneratingTitle = false
            this.rerender()
          }
        }, 500)

      } else {
        this.showToast(res.data.error || '생성 실패', 'error')
      }
    } catch (e) {
      // 중단 요청이면 토스트 안 띄움 (cancelScript가 이미 처리)
      if (e.name !== 'AbortError' && !String(e.message).includes('abort')) {
        this.showToast('서버 오류: ' + (e.response?.data?.error || e.message), 'error')
      }
    } finally {
      this.state._scriptAbortCtrl = null
      this.state.isGenerating = false
      this.rerender()
    }
  },

  // ── 대본 재생성 ───────────────────────────────────────────────
  async regenerateScript() {
    if (!this.state.currentJob?.job_id) return
    this.showToast('다른 버전의 대본을 생성 중...', 'info')
    try {
      const res = await axios.post(`/api/jobs/${this.state.currentJob.job_id}/regenerate-script`)
      if (res.data.ok) {
        this.state.currentJob.script_content = res.data.data.script
        this.showToast(`버전 ${res.data.data.version} 대본 생성 완료!`, 'success')
        this.rerender()
        // 재생성 시에도 제목 백그라운드 재생성
        const jid = this.state.currentJob.job_id
        setTimeout(async () => {
          try {
            const tr = await axios.post(`/api/jobs/${jid}/generate-title`, {
              product_number: this.state.form.product_number || ''
            })
            if (tr.data.ok && this.state.currentJob?.job_id === jid) {
              const d = tr.data.data
              this.state.currentJob.youtube_titles      = d.titles || []
              this.state.currentJob.youtube_description = d.description || ''
              this.state.currentJob.youtube_hashtags    = d.hashtags || []
              this.rerender()
            }
          } catch(e) {}
        }, 300)
      }
    } catch (e) {
      this.showToast('재생성 실패: ' + e.message, 'error')
    }
  },

  // ── 대본 저장 ─────────────────────────────────────────────────
  async saveScript() {
    const el = document.getElementById('scriptContent')
    if (!el || !this.state.currentJob) return
    const newScript = el.innerText.trim()
    try {
      await axios.patch(`/api/jobs/${this.state.currentJob.job_id}/script`, {
        script_content: newScript
      })
      this.state.currentJob.script_content = newScript
      this.state.editingScript = false
      this.showToast('대본이 저장되었습니다.', 'success')
      this.rerender()
    } catch (e) {
      this.showToast('저장 실패', 'error')
    }
  },

  // ── TTS 생성 중단 ────────────────────────────────────────────
  cancelTTS() {
    if (this.state._ttsAbortCtrl) {
      this.state._ttsAbortCtrl.abort()
      this.state._ttsAbortCtrl = null
    }
    this.state.isGeneratingTTS = false
    this.showToast('TTS 생성이 중단되었습니다.', 'info')
    this.rerender()
  },

  // ── TTS 생성 (Typecast) ───────────────────────────────────────
  async generateTTS() {
    if (!this.state.currentJob?.job_id) {
      this.showToast('먼저 대본을 생성해주세요.', 'error'); return
    }
    if (!this.state.settings.has_typecast) {
      this.showToast('Typecast API 키가 필요합니다. Deploy 탭에서 설정하세요.', 'error'); return
    }

    const abortCtrl = new AbortController()
    this.state._ttsAbortCtrl = abortCtrl
    this.state.isGeneratingTTS = true
    this.rerender()

    const { form } = this.state
    const selectedVoice = this.state.ttsVoices.find(v => v.id === form.tts_voice_id)

    try {
      const res = await axios.post(`/api/jobs/${this.state.currentJob.job_id}/generate-tts`, {
        voice_id: selectedVoice?.voice_id || null,
        speed: form.tts_speed,
        emotion_type: form.tts_emotion,
        audio_format: 'mp3'
      })
      if (res.data.ok) {
        this.state.currentJob.tts_audio_url = res.data.data.audio_url
        this.state.currentJob.stage = 'tts_done'
        this.state.currentJob.status = 'tts_ready'
        this.state.currentJob.tts_emotion = res.data.data.emotion
        this.state.currentJob.tts_tempo = res.data.data.tempo
        const emotionLabel = this.emotionOptions.find(e => e.value === res.data.data.emotion)?.label || res.data.data.emotion
        this.showToast(`TTS 생성 완료! 🎙️ 감정: ${emotionLabel}`, 'success')
      } else {
        const errCode = res.data.error_code || ''
        if (errCode === 'QUOTA_INSUFFICIENT') {
          // 크레딧 부족 — 모달로 안내
          await this._showConfirmModal({
            emoji: '💳',
            title: 'Typecast API 크레딧이 부족합니다',
            body:  '<div style="font-size:0.82rem;line-height:1.7">' +
                   '결제는 완료되었지만 <strong style="color:#ef4444">API 전용 크레딧</strong>이 소진되었습니다.<br><br>' +
                   '⚠️ <strong style="color:#fbbf24">일반 구독과 API 크레딧은 별도</strong>입니다.<br>' +
                   'Typecast 웹사이트 이용권과 API 사용 크레딧은 분리되어 있어요.<br><br>' +
                   '✅ 해결 방법:<br>' +
                   '1. <a href="https://typecast.ai" target="_blank" style="color:#a78bfa;text-decoration:underline">typecast.ai</a> 로그인<br>' +
                   '2. 설정 → API → 크레딧 충전<br>' +
                   '3. 충전 후 다시 TTS 생성 시도<br><br>' +
                   '<span style="color:var(--text-muted);font-size:0.75rem">문의: Typecast 고객센터 또는 이메일 문의</span>' +
                   '</div>',
            cancelText: '닫기',
            okText: '💳 typecast.ai에서 크레딧 충전',
          }).then(ok => { if (ok) window.open('https://typecast.ai', '_blank') })
        } else if (errCode === 'INVALID_API_KEY') {
          this.showToast('Typecast API 키가 유효하지 않습니다. 키를 다시 확인해주세요.', 'error', 6000)
        } else {
          const hint = res.data.hint ? `\n힌트: ${res.data.hint}` : ''
          this.showToast((res.data.error || 'TTS 생성 실패') + hint, 'error', 5000)
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError' && !String(e.message).includes('abort')) {
        this.showToast('TTS 오류: ' + (e.response?.data?.error || e.message), 'error')
      }
    } finally {
      this.state._ttsAbortCtrl = null
      this.state.isGeneratingTTS = false
      this.rerender()
    }
  },

  // ── 성우 미리듣기 ─────────────────────────────────────────────
  async previewVoice(voiceId, voiceApiId, voiceName) {
    // 이미 재생 중이면 중지
    this.stopPreview()

    const bar       = document.getElementById('voicePreviewBar')
    const spinner   = document.getElementById('previewSpinner')
    const statusTxt = document.getElementById('previewStatusText')
    const icon      = document.getElementById(`previewIcon_${voiceId}`)

    if (bar) bar.style.display = 'block'
    if (statusTxt) statusTxt.textContent = `${voiceName} 목소리 생성 중...`
    if (icon) icon.className = 'fas fa-spinner fa-spin'

    this.state._previewVoiceId = voiceId

    // 샘플 텍스트: 현재 대본 앞 30자 or 기본 문구
    const sampleText = this.state.currentJob?.script_content
      ? this.state.currentJob.script_content.substring(0, 50).trim()
      : '안녕하세요! 저는 이 목소리로 쇼츠 대본을 읽어드릴 거예요. 잘 부탁드립니다!'

    try {
      const res = await axios.post('/api/tts-preview', {
        voice_id: voiceApiId,
        emotion_type: this.state.form.tts_emotion || 'smart',
        speed: this.state.form.tts_speed || 1.0,
        sample_text: sampleText
      })

      if (!res.data.ok) {
        throw new Error(res.data.error || '미리듣기 실패')
      }

      const audio = document.getElementById('previewAudio')
      if (!audio) return

      audio.src = res.data.data.audio_url
      audio.playbackRate = this.state.playbackSpeed || 1.0
      audio.load()

      if (spinner) spinner.style.display = 'none'
      if (statusTxt) {
        statusTxt.innerHTML = `
          <i class="fas fa-music" style="margin-right:4px;color:#a855f7"></i>
          <strong>${voiceName}</strong> 재생 중
          <span style="font-size:0.65rem;color:var(--text-muted);margin-left:6px">
            감정: ${this.emotionOptions.find(e => e.value === this.state.form.tts_emotion)?.label?.split(' ')[0] || '🧠'} · 속도: ${this.state.form.tts_speed.toFixed(2)}×
          </span>
        `
      }
      if (icon) icon.className = 'fas fa-stop'

      await audio.play()

    } catch (e) {
      if (bar) bar.style.display = 'none'
      if (icon) icon.className = 'fas fa-play'
      const msg = e.message || ''
      // worker 재시작 오류 → 사용자 친화적 메시지
      const displayMsg = (msg.includes('restarted') || msg.includes('try again'))
        ? '서버가 재시작되었습니다. 다시 시도해주세요.'
        : (msg || '미리듣기 실패')
      this.showToast('미리듣기 오류: ' + displayMsg, 'error')
    }
  },

  stopPreview() {
    // 패널(Step5) 미리듣기 정리
    const audio = document.getElementById('previewAudio')
    if (audio && !audio.paused) { audio.pause(); audio.src = '' }
    const bar = document.getElementById('voicePreviewBar')
    if (bar) bar.style.display = 'none'
    if (this.state._previewVoiceId) {
      const icon = document.getElementById(`previewIcon_${this.state._previewVoiceId}`)
      if (icon) icon.className = 'fas fa-play'
      this.state._previewVoiceId = null
    }
    const spinner = document.getElementById('previewSpinner')
    if (spinner) spinner.style.display = 'inline-block'

    // 워크스페이스 미리듣기 정리
    const wAudio = document.getElementById('workspacePreviewAudio')
    if (wAudio && !wAudio.paused) { wAudio.pause(); wAudio.src = '' }
    const wBar = document.getElementById('workspacePreviewBar')
    if (wBar) wBar.style.display = 'none'
    const wIcon = document.getElementById('workspacePreviewIcon')
    if (wIcon) wIcon.className = 'fas fa-play'
    this.state._workspacePreviewPlaying = false
  },

  onPreviewEnded() {
    const bar = document.getElementById('voicePreviewBar')
    const statusTxt = document.getElementById('previewStatusText')
    if (bar) bar.style.display = 'none'
    if (this.state._previewVoiceId) {
      const icon = document.getElementById(`previewIcon_${this.state._previewVoiceId}`)
      if (icon) icon.className = 'fas fa-play'
      this.state._previewVoiceId = null
    }
  },

  // 워크스페이스 미리듣기 종료 콜백
  onWorkspacePreviewEnded() {
    const bar = document.getElementById('workspacePreviewBar')
    if (bar) bar.style.display = 'none'
    const icon = document.getElementById('workspacePreviewIcon')
    if (icon) icon.className = 'fas fa-play'
    this.state._workspacePreviewPlaying = false
  },

  // 워크스페이스 전용 미리듣기 (TTS 생성 전 선택된 성우 확인용)
  async workspacePreview(voiceId, voiceApiId, voiceName) {
    // 이미 재생 중이면 중지
    const wAudio = document.getElementById('workspacePreviewAudio')
    if (this.state._workspacePreviewPlaying && wAudio) {
      wAudio.pause(); wAudio.src = ''
      this.state._workspacePreviewPlaying = false
      const icon = document.getElementById('workspacePreviewIcon')
      if (icon) icon.className = 'fas fa-play'
      const bar = document.getElementById('workspacePreviewBar')
      if (bar) bar.style.display = 'none'
      return
    }

    const bar    = document.getElementById('workspacePreviewBar')
    const status = document.getElementById('workspacePreviewStatus')
    const icon   = document.getElementById('workspacePreviewIcon')
    const btn    = document.getElementById('workspacePreviewBtn')

    if (bar)    { bar.style.display = 'flex' }
    if (status) status.textContent = `${voiceName} 목소리 생성 중...`
    if (icon)   icon.className = 'fas fa-spinner fa-spin'
    if (btn)    btn.disabled = true

    const sampleText = this.state.currentJob?.script_content
      ? this.state.currentJob.script_content.substring(0, 60).trim()
      : '안녕하세요! 저는 이 목소리로 쇼츠 대본을 읽어드릴 거예요. 잘 부탁드립니다!'

    try {
      const res = await axios.post('/api/tts-preview', {
        voice_id: voiceApiId,
        emotion_type: this.state.form.tts_emotion || 'smart',
        speed: this.state.form.tts_speed || 1.0,
        sample_text: sampleText
      })
      if (!res.data.ok) throw new Error(res.data.error || '미리듣기 실패')

      const audio = document.getElementById('workspacePreviewAudio')
      if (!audio) return
      audio.src = res.data.data.audio_url
      audio.playbackRate = this.state.playbackSpeed || 1.0
      audio.load()

      if (icon)   icon.className = 'fas fa-stop'
      if (status) status.innerHTML = `<i class="fas fa-music" style="margin-right:4px;color:#a855f7"></i><strong>${voiceName}</strong> 재생 중`
      if (btn)    btn.disabled = false
      this.state._workspacePreviewPlaying = true

      await audio.play()
    } catch (e) {
      if (bar)  bar.style.display = 'none'
      if (icon) icon.className = 'fas fa-play'
      if (btn)  btn.disabled = false
      this.state._workspacePreviewPlaying = false
      const msg = e.message || ''
      const displayMsg = (msg.includes('restarted') || msg.includes('try again'))
        ? '서버가 재시작되었습니다. 다시 시도해주세요.'
        : (msg || '미리듣기 실패')
      this.showToast('미리듣기 오류: ' + displayMsg, 'error')
    }
  },

  // ── 재생 속도 조절 ────────────────────────────────────────────
  setPlaybackSpeed(speed) {
    this.state.playbackSpeed = speed
    const audio = document.getElementById('ttsAudio')
    if (audio) audio.playbackRate = speed
    // 슬라이더 + 라벨만 업데이트 (rerender 없이)
    const slider = document.getElementById('playbackSpeedSlider')
    if (slider) slider.value = speed
    const lbl = document.getElementById('playbackSpeedLabel')
    if (lbl) lbl.textContent = speed.toFixed(2) + '×'
    // 버튼 하이라이트 갱신
    const btns = document.querySelectorAll('[onclick^="App.setPlaybackSpeed"]')
    btns.forEach(b => {
      const v = parseFloat(b.getAttribute('onclick').match(/[\d.]+/)[0])
      if (Math.abs(v - speed) < 0.001) {
        b.style.background = 'rgba(124,58,237,0.25)'
        b.style.borderColor = '#7c3aed'
        b.style.color = '#a78bfa'
      } else {
        b.style.background = 'var(--bg-secondary)'
        b.style.borderColor = 'var(--border)'
        b.style.color = 'var(--text-muted)'
      }
    })
  },

  // ── 원본 영상 업로드 핸들러 ────────────────────────────────────
  handleBgVideoUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) {
      this.showToast('영상 파일(mp4, mov 등)만 업로드 가능합니다.', 'error')
      return
    }
    if (file.size > 500 * 1024 * 1024) {
      this.showToast('파일 크기가 너무 큽니다 (최대 500MB).', 'error')
      return
    }
    this.state.bgVideoFile = file
    this.showToast(`✅ 영상 업로드됨: ${file.name}`, 'success')
    this.rerender()
  },

  clearBgVideo() {
    this.state.bgVideoFile = null
    // 모든 영상 input 초기화 (bgVideoInput, bgVideoInput2, bgVideoInputNoTTS)
    ;['bgVideoInput','bgVideoInput2','bgVideoInputNoTTS'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.value = ''
    })
    this.showToast('원본 영상이 제거되었습니다.', 'info')
    this.rerender()
  },

  // ── 영상 합성 (Canvas + MediaRecorder) ───────────────────────
  _renderCancelFlag: false,

  cancelRendering() {
    this._renderCancelFlag = true
    this.showToast('렌더링 취소 중...', 'info')
  },

  // ── 원본 영상 없이 TTS만으로 합성 시 확인 팝업 ─────────────────
  /**
   * 범용 확인 모달 (Promise<boolean>)
   * opts: { emoji, title, body(HTML), cancelText, okText, okDanger }
   */
  _showConfirmModal({ emoji='⚠️', title='', body='', cancelText='취소', okText='계속 진행', okDanger=false } = {}) {
    return new Promise((resolve) => {
      const existing = document.getElementById('_synthConfirmModal')
      if (existing) existing.remove()

      const modal = document.createElement('div')
      modal.id = '_synthConfirmModal'
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem'

      const okBg = okDanger
        ? 'background:linear-gradient(135deg,#dc2626,#ef4444);color:white;border:none;'
        : 'background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;'

      modal.innerHTML =
        '<div style="background:#1a1035;border:1px solid rgba(124,58,237,0.4);border-radius:16px;' +
        'padding:1.75rem 1.5rem;max-width:360px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.7)">' +
          '<div style="font-size:2.2rem;text-align:center;margin-bottom:0.65rem">' + emoji + '</div>' +
          '<div style="font-size:0.95rem;font-weight:700;color:#f8f8f8;text-align:center;margin-bottom:0.55rem">' + title + '</div>' +
          '<div style="font-size:0.78rem;color:#a0a0b8;text-align:center;line-height:1.65;margin-bottom:1.4rem">' + body + '</div>' +
          '<div style="display:flex;gap:0.6rem">' +
            '<button id="_synthCancel" style="flex:1;padding:0.7rem;background:rgba(239,68,68,0.12);' +
            'color:#ef4444;border:1px solid rgba(239,68,68,0.35);border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600">' +
              '✕ ' + cancelText +
            '</button>' +
            '<button id="_synthOk" style="flex:1;padding:0.7rem;' + okBg +
            'border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600">' +
              '✔ ' + okText +
            '</button>' +
          '</div>' +
        '</div>'

      document.body.appendChild(modal)
      document.getElementById('_synthCancel').onclick = () => { modal.remove(); resolve(false) }
      document.getElementById('_synthOk').onclick    = () => { modal.remove(); resolve(true)  }
      modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); resolve(false) } })
    })
  },

  // 하위 호환 래퍼
  _confirmNoVideoSynthesis() {
    return this._showConfirmModal({
      emoji: '🎬',
      title: '원본 영상이 없습니다',
      body:  '원본 영상 없이 합성하면<br>' +
             '<strong style="color:#fbbf24">TTS 음성만 있는 그라데이션 배경 영상</strong>이 생성됩니다.<br><br>' +
             '원본 영상(도우인/샤오홍슈 등)을 업로드하면<br>해당 영상 위에 자막이 합성됩니다.',
      cancelText: '취소 — 영상 업로드',
      okText: '그라데이션 배경으로 합성',
    })
  },


  async startVideoSynthesis() {
    if (!this.state.currentJob?.script_content) {
      this.showToast('대본이 없습니다.', 'error'); return
    }

    const hasTTS   = !!this.state.currentJob?.tts_audio_url
    const hasVideo = !!this.state.bgVideoFile

    // ── Case 1: TTS도 없고 영상도 없음 ───────────────────────────
    if (!hasTTS && !hasVideo) {
      const ok = await this._showConfirmModal({
        emoji: '❗',
        title: 'TTS와 원본 영상이 모두 없습니다',
        body:  '<strong style="color:#fbbf24">TTS 음성</strong>도 <strong style="color:#fbbf24">원본 영상</strong>도 없는 상태입니다.<br><br>' +
               '진행하면 <strong style="color:#a78bfa">무음 + 그라데이션 배경</strong>에 자막만 표시되는 영상이 생성됩니다.<br><br>' +
               '그래도 합성하시겠습니까?',
        cancelText: '취소',
        okText: '무음 자막 영상으로 합성',
        okDanger: true,
      })
      if (!ok) return
    }
    // ── Case 2: TTS 없음 (영상은 있거나 없거나) ──────────────────
    else if (!hasTTS) {
      const ok = await this._showConfirmModal({
        emoji: '🔇',
        title: 'TTS 음성이 없습니다',
        body:  'TTS 음성을 아직 생성하지 않은 상태입니다.<br><br>' +
               (hasVideo
                 ? '원본 영상의 <strong style="color:#fbbf24">오디오가 유지</strong>된 채 자막만 합성됩니다.'
                 : '진행하면 <strong style="color:#fbbf24">무음 + 그라데이션 배경</strong> 영상이 생성됩니다.') +
               '<br><br>TTS를 먼저 생성하는 것을 권장합니다.',
        cancelText: '취소 — TTS 먼저 생성',
        okText: hasVideo ? '원본 오디오로 합성' : '무음으로 합성',
      })
      if (!ok) return
    }
    // ── Case 3: 영상 없음 (TTS는 있음) ──────────────────────────
    else if (!hasVideo) {
      const ok = await this._confirmNoVideoSynthesis()
      if (!ok) return
    }

    this._renderCancelFlag = false
    this.state.isRendering = true
    this.rerender()

    // 진행 단계 서버에 알림
    try {
      await axios.patch(`/api/jobs/${this.state.currentJob.job_id}/stage`, {
        stage: 'rendering', status: 'rendering'
      })
    } catch(e) {}

    try {
      const videoResult = await this._renderSubtitleVideo()
      if (this._renderCancelFlag) {
        this.showToast('렌더링이 취소되었습니다.', 'info')
        return
      }
      // _renderSubtitleVideo는 { url, isH264 } 또는 문자열(URL) 반환
      const videoUrl = typeof videoResult === 'object' ? videoResult.url : videoResult
      const isH264   = typeof videoResult === 'object' ? videoResult.isH264 : true
      this.state.currentJob.output_video_url = videoUrl
      this.state.currentJob._videoIsMP4 = isH264
      this.state.currentJob.stage = 'complete'
      this.state.currentJob.status = 'complete'

      // 서버에 완료 보고
      try {
        await axios.post(`/api/jobs/${this.state.currentJob.job_id}/synthesis-complete`, {
          output_video_url: videoUrl
        })
      } catch(e) {}

      const isWebm = videoUrl.startsWith('blob:') ? false : videoUrl.includes('.webm')
      this.showToast('🎬 영상 합성 완료! 다운로드 버튼을 클릭하세요.', 'success')
    } catch(e) {
      if (this._renderCancelFlag) {
        this.showToast('렌더링이 취소되었습니다.', 'info')
      } else {
        this.showToast('렌더링 오류: ' + e.message, 'error')
        console.error(e)
      }
    } finally {
      this._renderCancelFlag = false
      this.state.isRendering = false
      this.rerender()
    }
  },

  // ── 내부: WebCodecs H.264 MP4 합성 (bgVideo play + rVFC 캡처) ──
  async _renderSubtitleVideo() {
    const job      = this.state.currentJob
    const script   = job.script_content || ''
    const audioSrc = job.tts_audio_url

    // ── 설정 읽기 ────────────────────────────────────────────────
    const fontSizeEl = document.getElementById('subtitleFontSize')
    const positionEl = document.getElementById('subtitlePosition')
    const bgBarEl    = document.getElementById('subtitleBgBar')
    const fontSize   = parseInt(fontSizeEl?.value || this.state.subtitleFontSize || '41')
    const position   = positionEl?.value || this.state.subtitlePosition || 'middle'
    const fontColor  = this.state.subtitleFontColor || this.state.subtitleColor || '#ffffff'
    const hasBgBar   = bgBarEl ? bgBarEl.checked : (this.state.subtitleBgBar !== false)
    const fontFamily = this.state.subtitleFont || 'NanumSquareRound'
    const bgColor    = hasBgBar ? (this.state.subtitleBgColor || 'rgba(0,0,0,0.65)') : 'transparent'
    this.state.subtitleFontSize = fontSize
    this.state.subtitlePosition = position
    this.state.subtitleBgBar    = hasBgBar

    const W = 720, H = 1280
    const canvas    = document.getElementById('synthCanvas')
    canvas.width    = W; canvas.height = H
    canvas.style.display = 'none'
    const ctx = canvas.getContext('2d')

    const hasBgVideo = !!this.state.bgVideoFile

    const setProgress = (pct, msg) => {
      const bar   = document.getElementById('renderProgressBar')
      const pctEl = document.getElementById('renderPct')
      const txt   = document.getElementById('renderStatusText')
      if (bar)   bar.style.width = pct + '%'
      if (pctEl) pctEl.textContent = Math.round(pct) + '%'
      if (txt)   txt.textContent = msg || ''
    }

    // ── 오디오 디코딩 ────────────────────────────────────────────
    setProgress(5, '오디오 로딩 중...')
    const audioResp     = await fetch(audioSrc)
    const audioArrayBuf = await audioResp.arrayBuffer()
    const tmpACtx       = new (window.AudioContext || window.webkitAudioContext)()
    const audioBuffer   = await tmpACtx.decodeAudioData(audioArrayBuf.slice(0))
    tmpACtx.close()
    const duration = audioBuffer.duration

    // ── 자막 세그먼트 생성 ────────────────────────────────────────
    setProgress(8, '자막 세그먼트 생성 중...')
    const speechRegions = this._detectSpeechRegions(audioBuffer)
    const segments = this._buildSubtitleSegmentsFromSpeech(script, duration, ctx, fontSize, W, speechRegions)

    // ── bgVideo 없으면 그라데이션 MediaRecorder 폴백 ──────────────
    if (!hasBgVideo) {
      return await this._renderWithMediaRecorder(
        canvas, ctx, W, H, null, false, audioSrc, duration,
        segments, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor, setProgress
      )
    }

    // ── mp4-muxer 로드 ────────────────────────────────────────────
    setProgress(10, 'MP4 인코더 준비 중...')
    if (!window.Mp4Muxer) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://unpkg.com/mp4-muxer@5.2.2/build/mp4-muxer.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
    }

    // WebCodecs 미지원 → MediaRecorder 폴백
    if (typeof VideoEncoder === 'undefined' || !window.Mp4Muxer) {
      const bg = await this._loadBgVideo(this.state.bgVideoFile)
      return await this._renderWithMediaRecorder(
        canvas, ctx, W, H, bg, true, audioSrc, duration,
        segments, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor, setProgress
      )
    }

    const FPS = 30
    const { Muxer, ArrayBufferTarget } = window.Mp4Muxer
    const target = new ArrayBufferTarget()
    const muxer  = new Muxer({
      target,
      video: { codec: 'avc', width: W, height: H },
      audio: { codec: 'aac', sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
      fastStart: 'in-memory'
    })

    // VideoEncoder
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => console.error('VideoEncoder:', e)
    })
    videoEncoder.configure({
      codec: 'avc1.42001f', width: W, height: H,
      framerate: FPS, bitrate: 6_000_000, latencyMode: 'realtime'
    })

    // AudioEncoder
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error:  (e) => console.error('AudioEncoder:', e)
    })
    audioEncoder.configure({
      codec: 'mp4a.40.2', sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels, bitrate: 128_000
    })

    // ── 오디오 인코딩 ────────────────────────────────────────────
    setProgress(15, '오디오 인코딩 중...')
    const CHUNK = 4096
    const sr    = audioBuffer.sampleRate
    const nCh   = audioBuffer.numberOfChannels
    const total = audioBuffer.length
    const chData = []
    for (let c = 0; c < nCh; c++) chData.push(audioBuffer.getChannelData(c))

    for (let off = 0; off < total; off += CHUNK) {
      if (this._renderCancelFlag) { videoEncoder.close(); audioEncoder.close(); muxer.finalize(); return null }
      const frames = Math.min(CHUNK, total - off)
      const ts     = Math.round(off / sr * 1_000_000)
      const buf    = new Float32Array(frames * nCh)
      for (let i = 0; i < frames; i++)
        for (let c = 0; c < nCh; c++) buf[i * nCh + c] = chData[c][off + i]
      const ad = new AudioData({ format: 'f32', sampleRate: sr, numberOfFrames: frames, numberOfChannels: nCh, timestamp: ts, data: buf })
      audioEncoder.encode(ad); ad.close()
    }
    await audioEncoder.flush(); audioEncoder.close()

    // ── bgVideo 로드 ─────────────────────────────────────────────
    setProgress(20, '영상 로딩 중...')
    const bgVideo = await this._loadBgVideo(this.state.bgVideoFile)
    bgVideo.loop  = false; bgVideo.muted = true
    bgVideo.currentTime = 0
    await new Promise(r => { bgVideo.onseeked = () => { bgVideo.onseeked = null; r() }; setTimeout(r, 800) })
    const vidDur = bgVideo.duration || duration

    // ── 비디오 프레임 인코딩 (play + rVFC) ───────────────────────
    setProgress(25, '비디오 합성 중...')
    const totalFrames = Math.ceil(duration * FPS)
    let encodedFrames = 0

    await new Promise((resolve, reject) => {
      const onFrame = () => {
        if (this._renderCancelFlag) { resolve(); return }
        if (encodedFrames >= totalFrames) { resolve(); return }

        // bgVideo 루프 처리
        if (bgVideo.currentTime >= vidDur - 0.05) {
          bgVideo.currentTime = 0
          bgVideo.play().catch(() => {})
        }

        // Canvas 렌더링
        const vw = bgVideo.videoWidth || W, vh = bgVideo.videoHeight || H
        const scale = Math.max(W / vw, H / vh)
        ctx.drawImage(bgVideo, (W - vw*scale)/2, (H - vh*scale)/2, vw*scale, vh*scale)

        // 자막 (encodedFrames 기준 시간으로 정확히 싱크)
        const t = encodedFrames / FPS
        const seg = segments.find(s => t >= s.start && t < s.end)
        if (seg) {
          const subLines = seg.text.split('\n').filter(Boolean)
          this._drawSubtitle(ctx, subLines, W, H, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor)
        }

        // 인코딩 (타임스탬프 단조증가 보장)
        const ts  = Math.round(encodedFrames / FPS * 1_000_000)
        const dur = Math.round(1_000_000 / FPS)
        const frame = new VideoFrame(canvas, { timestamp: ts, duration: dur })
        videoEncoder.encode(frame, { keyFrame: encodedFrames % (FPS * 2) === 0 })
        frame.close()
        encodedFrames++

        if (encodedFrames % 15 === 0) {
          const pct = 25 + (encodedFrames / totalFrames) * 65
          setProgress(pct, `비디오 합성 중... ${encodedFrames}/${totalFrames}`)
        }

        if (encodedFrames >= totalFrames) { resolve(); return }

        // 백프레셔: 큐가 크면 잠시 대기
        if (videoEncoder.encodeQueueSize > 15) {
          const waitAndContinue = () => {
            if (videoEncoder.encodeQueueSize <= 8) {
              if (typeof bgVideo.requestVideoFrameCallback === 'function')
                bgVideo.requestVideoFrameCallback(onFrame)
              else requestAnimationFrame(onFrame)
            } else setTimeout(waitAndContinue, 5)
          }
          waitAndContinue()
        } else {
          if (typeof bgVideo.requestVideoFrameCallback === 'function')
            bgVideo.requestVideoFrameCallback(onFrame)
          else requestAnimationFrame(onFrame)
        }
      }

      bgVideo.play().then(() => {
        if (typeof bgVideo.requestVideoFrameCallback === 'function')
          bgVideo.requestVideoFrameCallback(onFrame)
        else requestAnimationFrame(onFrame)
      }).catch(reject)
    })

    bgVideo.pause()

    if (this._renderCancelFlag) { videoEncoder.close(); muxer.finalize(); return null }

    setProgress(92, 'MP4 파일 생성 중...')
    await videoEncoder.flush()
    videoEncoder.close()
    muxer.finalize()

    const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' })
    setProgress(100, '✅ H.264 MP4 완성!')
    return { url: URL.createObjectURL(mp4Blob), isH264: true }
  },


  // ── WebCodecs 미지원 폴백: MediaRecorder 방식 ─────────────────
  async _renderWithMediaRecorder(
    canvas, ctx, W, H, bgVideo, hasBgVideo, audioSrc, duration,
    segments, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor, setProgress
  ) {
    setProgress(15, 'MediaRecorder 방식으로 렌더링...')

    const audio = new Audio(audioSrc)
    audio.crossOrigin = 'anonymous'
    await new Promise((res, rej) => { audio.onloadedmetadata = () => res(null); audio.onerror = rej; audio.load() })

    const stream   = canvas.captureStream(30)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const src      = audioCtx.createMediaElementSource(audio)
    const dest     = audioCtx.createMediaStreamDestination()
    src.connect(dest)
    src.connect(audioCtx.destination)
    stream.addTrack(dest.stream.getAudioTracks()[0])

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
    const chunks   = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.start(100)
    audio.currentTime = 0
    if (hasBgVideo) {
      bgVideo.currentTime = 0
      await new Promise(r => { bgVideo.onseeked = r; setTimeout(r, 500) })
      // ★ MediaRecorder 방식도 loop=false이므로 ended 시 재시작 처리
      bgVideo.onended = () => {
        bgVideo.currentTime = 0
        bgVideo.play().catch(() => {})
      }
    }
    audio.play()
    if (hasBgVideo) bgVideo.play().catch(() => {})
    setProgress(20, '영상 렌더링 시작...')

    let animFrame

    await new Promise((resolve) => {
      const drawFrame = () => {
        if (this._renderCancelFlag) {
          cancelAnimationFrame(animFrame)
          recorder.stop()
          audio.pause()
          try { audioCtx.close() } catch(e) {}
          resolve()
          return
        }
        // ★ audio.currentTime 기준으로 자막 싱크 (performance.now() 오프셋 제거)
        const elapsed = audio.currentTime
        setProgress(20 + Math.min(elapsed / duration * 70, 70), `렌더링 중... ${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s`)

        if (hasBgVideo) {
          const vw = bgVideo.videoWidth  || W
          const vh = bgVideo.videoHeight || H
          const scale = Math.max(W / vw, H / vh)
          const dw = vw * scale, dh = vh * scale
          ctx.drawImage(bgVideo, (W - dw) / 2, (H - dh) / 2, dw, dh)
        } else {
          const grad = ctx.createLinearGradient(0, 0, 0, H)
          grad.addColorStop(0, '#0d0820')
          grad.addColorStop(0.5, '#1a0a3a')
          grad.addColorStop(1, '#0a0515')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, W, H)
        }

        const seg = segments.find(s => elapsed >= s.start && elapsed < s.end)
        if (seg) {
          const lines = seg.text.split('\n').filter(Boolean)
          this._drawSubtitle(ctx, lines, W, H, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor)
        }

        // ★ audio.ended 또는 currentTime이 duration에 도달하면 종료
        if (!audio.ended && elapsed < duration + 0.1) {
          animFrame = requestAnimationFrame(drawFrame)
        } else {
          cancelAnimationFrame(animFrame)
          if (hasBgVideo) bgVideo.onended = null
          recorder.stop()
          audio.pause()
          try { audioCtx.close() } catch(e) {}
        }
      }
      requestAnimationFrame(drawFrame)

      recorder.onstop = () => resolve()
    })

    if (this._renderCancelFlag) return null

    setProgress(92, 'WebM 파일 처리 중...')
    const webmBlob = new Blob(chunks, { type: 'video/webm' })
    setProgress(100, '완료 (WebM — PC에서 MP4 변환 권장)')
    this.showToast('⚠️ 이 브라우저는 H.264 직접 인코딩 미지원.\n.webm으로 저장됩니다. PC Chrome에서 생성하면 MP4로 저장됩니다.', 'info', 7000)
    return { url: URL.createObjectURL(webmBlob), isH264: false }
  },


  // ── 배경 영상 로드 헬퍼 ────────────────────────────────────────
  _loadBgVideo(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const v   = document.createElement('video')
      v.src     = url
      v.muted   = true
      v.loop    = false  // ★ 루프는 코드로 제어 (loop=true면 currentTime 역행으로 timestamp 오류)
      v.playsInline = true
      v.onloadeddata = () => { resolve(v) }  // play()는 렌더 시작 시 직접 호출
      v.onerror  = reject
      v.load()
    })
  },


  // ── 자막 세그먼트 빌더 (폴백용 — VAD 없을 때) ───────────────────
  // 대본 → 의미 단위 분리 → 최대 너비 기준 줄바꿈 → 타임코드 할당
  // 한 줄당 최대 14자, 한 번에 1줄만 표시 (이탈 방지)
  _buildSubtitleSegments(script, duration, ctx, fontSize, canvasW, subtitleOffset = 0) {
    // 1) 대본을 의미 단위로 분리
    const raw = script.trim()
    let chunks = []

    // 줄바꿈 기준: \n, 마침표·!·?·~ 뒤 공백
    const rawLines = raw.split('\n').filter(l => l.trim())
    for (const line of rawLines) {
      // 문장부호 기준 추가 분리 (단, 분리 후 너무 짧으면 합침)
      const parts = line.split(/(?<=[.!?~。！？])\s*/)
      for (const p of parts) {
        const t = p.trim()
        if (t.length > 0) chunks.push(t)
      }
    }
    if (chunks.length === 0) chunks = [raw]

    // 2) 캔버스 폰트 설정 (줄바꿈 측정용)
    const SAFE_W = canvasW - 120   // 양옆 60px 안전 마진 (모바일 크롭 방지)
    const MAX_LINE_CHARS = 14      // ★ 한 줄 최대 14자 (이탈 방지)
    ctx.font = `bold ${fontSize}px 'Apple SD Gothic Neo','Noto Sans KR',sans-serif`

    // ★ 어절(띄어쓰기) 단위로 끊기 — 단어 중간 절대 자르지 않음
    // 규칙: 어절을 하나씩 추가하다가 14자 초과 또는 픽셀 너비 초과 시 이전 어절까지를 한 줄로 확정
    const wrapTextByWidth = (text) => {
      const words = text.split(' ')   // 어절 분리
      const lines = []
      let cur = ''

      for (const word of words) {
        if (!word) continue
        const candidate = cur ? cur + ' ' + word : word

        // 14자 초과 OR 픽셀 너비 초과 → 현재 줄 확정 후 새 줄 시작
        // ★ 글자 수는 공백 포함 길이로 계산 (어절 중간에 끊지 않음)
        if (cur && (candidate.length > MAX_LINE_CHARS || ctx.measureText(candidate).width > SAFE_W)) {
          lines.push(cur)
          cur = word
        } else {
          cur = candidate
        }
      }
      if (cur) lines.push(cur)

      // 어절 자체가 MAX_LINE_CHARS 초과인 경우(긴 단어) 글자 단위로 보조 분리
      const result = []
      for (const line of lines) {
        if (line.length <= MAX_LINE_CHARS && ctx.measureText(line).width <= SAFE_W) {
          result.push(line)
        } else {
          // 불가피한 경우만 글자 단위 분리 (합성어·외래어 등)
          let tmp = ''
          for (const ch of line) {
            const test = tmp + ch
            if ((test.replace(/\s/g, '').length > MAX_LINE_CHARS || ctx.measureText(test).width > SAFE_W) && tmp.length > 0) {
              result.push(tmp)
              tmp = ch
            } else {
              tmp = test
            }
          }
          if (tmp) result.push(tmp)
        }
      }
      return result.length > 0 ? result : [text]
    }

    // 3) 각 청크를 줄 단위로 분해 후 1줄씩 세그먼트로 묶기
    //    → 화면에 동시에 보이는 자막은 ★ 최대 1줄 (집중도·가독성 최우선)
    const MAX_LINES_PER_SEG = 1
    let allLineGroups = []
    for (const chunk of chunks) {
      const wrappedLines = wrapTextByWidth(chunk)
      // 1줄씩 그룹화
      for (let i = 0; i < wrappedLines.length; i += MAX_LINES_PER_SEG) {
        allLineGroups.push({
          lines: wrappedLines.slice(i, i + MAX_LINES_PER_SEG),
          charCount: wrappedLines.slice(i, i + MAX_LINES_PER_SEG).join('').replace(/\s/g, '').length
        })
      }
    }
    if (allLineGroups.length === 0) allLineGroups = [{ lines: [raw.substring(0, MAX_LINE_CHARS)], charCount: Math.min(raw.length, MAX_LINE_CHARS) }]

    // 4) 타임코드 할당 — 실제 TTS 발화속도 기반 싱크
    // 한국어 TTS 평균: 약 4.5글자/초 (speed 1.0 기준)
    // 문장부호(마침표·느낌표·물음표) 뒤 = 0.25초 포즈 추가
    // 줄바꿈(\n) 위치 = 0.15초 포즈 추가
    const ttsSpeed   = this.state.form?.tts_speed || 1.0
    const CPS_BASE   = 4.5                        // 글자/초 (speed 1.0)
    const CPS        = CPS_BASE * ttsSpeed         // 재생속도 반영
    const MIN_SEG_DUR = 0.7                        // 최소 노출시간 (초)
    const MAX_SEG_DUR = 3.5                        // 최대 노출시간 (초)
    const PAUSE_PUNCT = 0.22                       // 문장부호 후 포즈
    const PAUSE_NL    = 0.12                       // 줄바꿈 후 포즈

    // 각 세그먼트의 예상 발화시간 계산
    const rawDurs = allLineGroups.map(g => {
      const chars = g.charCount || 1
      const base  = chars / CPS
      // 텍스트 끝이 문장부호면 포즈 추가
      const txt   = g.lines.join('')
      const hasPunct = /[.!?~。！？,，]$/.test(txt.trim())
      const hasNL    = g._isNewline || false
      return Math.min(MAX_SEG_DUR, Math.max(MIN_SEG_DUR, base))
           + (hasPunct ? PAUSE_PUNCT : 0)
           + (hasNL    ? PAUSE_NL    : 0)
    })

    // 전체 예상시간이 실제 duration과 다르면 비율 보정
    const rawTotal  = rawDurs.reduce((s, d) => s + d, 0) || 1
    const usable    = Math.max(duration - subtitleOffset, duration * 0.85)
    const scale     = usable / rawTotal

    const segments = []
    let elapsed = subtitleOffset

    for (let i = 0; i < allLineGroups.length; i++) {
      const group  = allLineGroups[i]
      const segDur = rawDurs[i] * scale
      segments.push({
        lines: group.lines,
        start: elapsed,
        end:   elapsed + segDur,
        text:  group.lines.join(' ')
      })
      elapsed += segDur
    }

    // 마지막 세그먼트가 duration을 초과하지 않도록 클램프
    if (segments.length > 0) {
      const last = segments[segments.length - 1]
      if (last.end > duration) last.end = duration
    }

    return segments
  },

  // ── 자막 렌더링 ────────────────────────────────────────────────
  _drawSubtitle(ctx, lines, W, H, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor) {
    if (!lines || lines.length === 0) return

    // ★ 1줄만 표시 (이탈 방지 - 14자 이내 단줄 자막)
    const displayLines = lines.slice(0, 1)

    const lineH  = Math.round(fontSize * 1.4)  // 줄 간격 (여유롭게)
    const padX   = 28                           // 좌우 패딩
    const padY   = 10                           // 상하 패딩
    const totalH = displayLines.length * lineH + padY  // 전체 자막 블록 높이

    // ── 위치 결정 (안전 마진 포함) ──────────────────────────────────
    // 모바일/쇼츠: 하단 150px은 플랫폼 UI 영역, 상단 120px은 상태바+아이콘
    const SAFE_BOTTOM = 150
    const SAFE_TOP    = 120
    const SAFE_SIDE   = 40   // 양옆 최소 여백 (9:16에서 크롭 방지)

    const fontStr = fontFamily ? `'${fontFamily}','Apple SD Gothic Neo','Noto Sans KR',sans-serif` : `'Apple SD Gothic Neo','Noto Sans KR',sans-serif`
    ctx.font      = `bold ${fontSize}px ${fontStr}`
    ctx.textAlign = 'center'

    // 가장 넓은 줄의 픽셀 너비 측정
    let maxTw = 0
    for (const line of displayLines) {
      const tw = ctx.measureText(line).width
      if (tw > maxTw) maxTw = tw
    }
    // 배경 박스 너비: 텍스트 너비 + 패딩, 캔버스 너비 초과 방지
    const boxW = Math.min(maxTw + padX * 2, W - SAFE_SIDE * 2)

    // 첫 번째 줄 y 좌표 (텍스트 baseline 기준)
    let baseY
    if (position === 'top') {
      baseY = SAFE_TOP + fontSize
    } else if (position === 'top-middle') {
      // 상단과 중앙의 중간
      const topY    = SAFE_TOP + fontSize
      const middleY = Math.round(H / 2 - totalH / 2 + fontSize)
      baseY = Math.round((topY + middleY) / 2)
    } else if (position === 'middle') {
      baseY = Math.round(H / 2 - totalH / 2 + fontSize)
    } else if (position === 'middle-bottom') {
      // 중앙과 하단의 중간
      const middleY = Math.round(H / 2 - totalH / 2 + fontSize)
      const bottomY = H - SAFE_BOTTOM - (displayLines.length - 1) * lineH
      baseY = Math.round((middleY + bottomY) / 2)
    } else {
      // bottom: 가장 아래 줄이 SAFE_BOTTOM 위에 위치
      baseY = H - SAFE_BOTTOM - (displayLines.length - 1) * lineH
    }

    // ── 배경 박스 (줄 전체를 감싸는 단일 박스) ──────────────────────
    if (hasBgBar) {
      const boxH  = totalH
      const boxX  = W / 2 - boxW / 2
      const boxY  = baseY - fontSize - padY / 2
      ctx.fillStyle = bgColor || 'rgba(0,0,0,0.78)'
      if (ctx.roundRect) {
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxW, boxH, 8)
        ctx.fill()
      } else {
        ctx.fillRect(boxX, boxY, boxW, boxH)
      }
    }

    // ── 각 줄 텍스트 ────────────────────────────────────────────────
    for (let i = 0; i < displayLines.length; i++) {
      const line = displayLines[i]
      const y    = baseY + i * lineH

      // 외곽선 (배경 바 없을 때 가독성 확보)
      if (!hasBgBar) {
        ctx.strokeStyle = 'rgba(0,0,0,0.98)'
        ctx.lineWidth   = Math.max(4, fontSize * 0.1)
        ctx.lineJoin    = 'round'
        ctx.strokeText(line, W / 2, y)
      }

      // 텍스트
      ctx.fillStyle = fontColor
      ctx.fillText(line, W / 2, y)
    }
  },

  // ── 브라우저 TTS (API 없을 때 미리듣기) ─────────────────────
  browserTTS() {    if (!this.state.currentJob?.script_content) return
    const utter = new SpeechSynthesisUtterance(this.state.currentJob.script_content)
    utter.lang = 'ko-KR'
    utter.rate = 1.0
    speechSynthesis.cancel()
    speechSynthesis.speak(utter)
    this.showToast('브라우저 TTS로 재생 중...', 'info')
  },

  // ── 오디오 컨트롤 ─────────────────────────────────────────────
  toggleAudio() {
    const audio = document.getElementById('ttsAudio')
    const playIcon = document.getElementById('playIcon')
    if (!audio) return
    // 재생 속도 적용
    audio.playbackRate = this.state.playbackSpeed || 1.0
    if (audio.paused) {
      audio.play()
      if (playIcon) { playIcon.className = 'fas fa-pause' }
    } else {
      audio.pause()
      if (playIcon) { playIcon.className = 'fas fa-play' }
    }
  },

  updateAudioTime() {
    const audio = document.getElementById('ttsAudio')
    const timeEl = document.getElementById('audioTime')
    if (!audio || !timeEl) return
    const t = audio.currentTime
    timeEl.textContent = `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`
  },

  onAudioEnded() {
    const playIcon = document.getElementById('playIcon')
    if (playIcon) playIcon.className = 'fas fa-play'
  },

  // ── 히스토리에서 로드 ─────────────────────────────────────────
  async loadJobFromHistory(jobId) {
    try {
      const res = await axios.get(`/api/jobs/${jobId}`)
      if (res.data.ok) {
        this.state.currentJob = res.data.data
        this.state.activeTab = 'workspace'
        // 폼 복원
        if (res.data.data.persona_id) {
          this.state.form.persona_id = res.data.data.persona_id
        }
        this.rerender()
        this.showToast('작업을 불러왔습니다.', 'info')
      }
    } catch (e) {
      this.showToast('불러오기 실패', 'error')
    }
  },

  // ── 히스토리 새로고침 ─────────────────────────────────────────
  async refreshJobs() {
    try {
      const res = await axios.get('/api/jobs')
      this.state.jobs = res.data.data || []
      this.state._jobsLoaded = true
      this.rerender()
    } catch (e) {}
  },

  // ── 유틸리티 ─────────────────────────────────────────────────
  showToast(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer')
    if (!container) return
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    const icons = { success: '✅', error: '❌', info: 'ℹ️' }
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span style="white-space:pre-line">${msg}</span>`
    container.appendChild(toast)
    setTimeout(() => toast.remove(), duration)
  },

  escHtml(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  },

  // \n을 <br>로 변환 (인스타 캡션 줄바꿈 표시용)
  escHtmlWithBr(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>')
  },

  getStatusLabel(status) {
    const labels = {
      pending: '대기 중',
      script_ready: '대본 완료',
      tts_ready: 'TTS 완료',
      rendering: '렌더링 중',
      complete: '✅ 완성',
      error: '오류'
    }
    return labels[status] || status
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return dateStr }
  },

  // ── 폰트 선택 ─────────────────────────────────────────────────
  setSubtitleFont(fontValue) {
    this.state.subtitleFont = fontValue
    // 폰트 피커 그리드만 재렌더 (전체 rerender 방지)
    const grid = document.getElementById('fontPickerGrid')
    if (grid) {
      this.fontOptions.forEach(f => {
        // 각 폰트 카드 스타일 업데이트
      })
    }
    this.rerender()
  },

  // ── 제작 프리셋 불러오기 ──────────────────────────────────────
  async loadProductionPreset(presetId) {
    try {
      const res = await axios.get(`/api/production-presets/${presetId}`)
      if (!res.data.ok) throw new Error(res.data.error)
      const p = res.data.data
      this.applyProductionPreset(p, true)
      this.showToast(`✅ "${p.name}" 프리셋 적용됨`, 'success')
    } catch (e) {
      this.showToast('프리셋 불러오기 실패: ' + e.message, 'error')
    }
  },

  applyProductionPreset(p, showRerender = true) {
    if (!p) return
    this.state.selectedProductionPresetId = p.id

    // 자막 설정 적용
    if (p.subtitle_font)       this.state.subtitleFont       = p.subtitle_font
    if (p.subtitle_font_size)  this.state.subtitleFontSize   = p.subtitle_font_size
    // subtitle_position: 프리셋에 'bottom'이 저장되어 있어도 'middle'로 교정
    const rawPos = p.subtitle_position || this.state.subtitlePosition || 'middle'
    this.state.subtitlePosition = rawPos === 'bottom' ? 'middle' : rawPos
    if (p.subtitle_font_color) {
      this.state.subtitleFontColor = p.subtitle_font_color
      this.state.subtitleColor     = p.subtitle_font_color
    }
    if (p.subtitle_bg_color)   this.state.subtitleBgColor   = p.subtitle_bg_color
    if (p.subtitle_bg_opacity !== undefined) this.state.subtitleBgOpacity = p.subtitle_bg_opacity
    this.state.subtitleBgBar = p.subtitle_has_bg_bar !== 0

    // TTS 설정 적용
    if (p.tts_emotion) this.state.form.tts_emotion = p.tts_emotion
    if (p.tts_speed)   this.state.form.tts_speed   = p.tts_speed

    // 성우 설정 적용 (voice_id로 ttsVoices 목록에서 찾기)
    if (p.tts_voice_id) {
      const matchedVoice = this.state.ttsVoices.find(v => v.voice_id === p.tts_voice_id)
      if (matchedVoice) {
        this.state.form.tts_voice_id = matchedVoice.id
      }
    }

    if (showRerender) this.rerender()
  },

  // ── 제작 프리셋 저장 모달 ──────────────────────────────────────
  openSavePresetModal() {
    // 현재 설정을 읽어 모달 표시
    const state = this.state
    const modal = document.createElement('div')
    modal.id = 'savePresetModal'
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem'

    // 선택된 성우 정보
    const selVoice = this.state.ttsVoices.find(v => v.id === state.form.tts_voice_id)
    const voiceId  = selVoice?.voice_id || ''
    const voiceName = selVoice?.name || ''

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.5rem;max-width:420px;width:100%;max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <div style="font-size:1rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem">
            <i class="fas fa-bookmark" style="color:#a78bfa"></i> 제작 프리셋 저장
          </div>
          <button onclick="document.getElementById('savePresetModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;padding:0.2rem 0.4rem;border-radius:4px">✕</button>
        </div>

        <div style="margin-bottom:0.85rem">
          <label style="font-size:0.72rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.3rem">프리셋 이름 <span style="color:#ef4444">*</span></label>
          <input id="presetNameInput" type="text" placeholder="예: 엄마 기본셋, 트렌디 누나..."
            style="width:100%;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.55rem 0.75rem;border-radius:7px;font-size:0.82rem;box-sizing:border-box">
        </div>
        <div style="margin-bottom:1rem">
          <label style="font-size:0.72rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.3rem">메모 (선택)</label>
          <input id="presetDescInput" type="text" placeholder="이 프리셋에 대한 메모..."
            style="width:100%;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.45rem 0.75rem;border-radius:7px;font-size:0.78rem;box-sizing:border-box">
        </div>

        <!-- 현재 설정 요약 -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.75rem;margin-bottom:1rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.8">
          <div style="font-size:0.68rem;color:var(--text-muted);font-weight:600;margin-bottom:0.4rem">📋 저장될 설정</div>
          <div>🔤 폰트: <strong style="color:var(--text-primary)">${state.subtitleFont || 'NanumSquareRound'}</strong></div>
          <div>📏 크기/위치: <strong style="color:var(--text-primary)">${state.subtitleFontSize || 42}px · ${state.subtitlePosition || 'middle'}</strong></div>
          <div>🎨 글자/배경: <span style="background:${state.subtitleFontColor||'#fff'};color:${state.subtitleFontColor==='#FFFFFF'||state.subtitleFontColor==='#ffffff'?'#333':'#fff'};padding:1px 6px;border-radius:3px;font-size:0.65rem">${state.subtitleFontColor||'#FFFFFF'}</span>
            · ${state.subtitleBgBar!==false?'배경바 ON':'배경바 OFF'}</div>
          <div>🎙 성우: <strong style="color:var(--text-primary)">${voiceName || '기본'}</strong></div>
          <div>😊 감정/속도: <strong style="color:var(--text-primary)">${state.form.tts_emotion || 'smart'} · ${(state.form.tts_speed||1.0).toFixed(2)}×</strong></div>
        </div>

        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <input type="checkbox" id="presetIsDefault" style="accent-color:#7c3aed;width:14px;height:14px">
          <label for="presetIsDefault" style="font-size:0.72rem;color:var(--text-secondary);cursor:pointer">기본 프리셋으로 설정 (앱 시작 시 자동 적용)</label>
        </div>

        <div style="display:flex;gap:0.5rem">
          <button onclick="document.getElementById('savePresetModal').remove()"
            style="flex:1;padding:0.6rem;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-secondary);border-radius:7px;cursor:pointer;font-size:0.82rem">
            취소
          </button>
          <button onclick="App.saveProductionPreset()"
            style="flex:2;padding:0.6rem;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;color:white;border-radius:7px;cursor:pointer;font-size:0.82rem;font-weight:700">
            <i class="fas fa-save"></i> 저장
          </button>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    setTimeout(() => document.getElementById('presetNameInput')?.focus(), 100)
  },

  async saveProductionPreset() {
    const nameEl = document.getElementById('presetNameInput')
    const descEl = document.getElementById('presetDescInput')
    const isDefaultEl = document.getElementById('presetIsDefault')
    const name = nameEl?.value?.trim()
    if (!name) { nameEl?.focus(); this.showToast('프리셋 이름을 입력해주세요.', 'error'); return }

    const state = this.state
    const selVoice = this.state.ttsVoices.find(v => v.id === state.form.tts_voice_id)

    try {
      const res = await axios.post('/api/production-presets', {
        name,
        description: descEl?.value?.trim() || '',
        subtitle_font:        state.subtitleFont || 'NanumSquareRound',
        subtitle_font_size:   state.subtitleFontSize || 42,
        subtitle_position:    state.subtitlePosition || 'middle',
        subtitle_font_color:  state.subtitleFontColor || '#FFFFFF',
        subtitle_bg_color:    state.subtitleBgColor || 'rgba(0,0,0,0.65)',
        subtitle_bg_opacity:  state.subtitleBgOpacity ?? 0.65,
        subtitle_has_bg_bar:  state.subtitleBgBar !== false ? 1 : 0,
        subtitle_stroke_color: state.subtitleStrokeColor || '#000000',
        subtitle_stroke_width: state.subtitleStrokeWidth || 2,
        tts_voice_id:  selVoice?.voice_id || '',
        tts_voice_name: selVoice?.name || '',
        tts_emotion:   state.form.tts_emotion || 'smart',
        tts_speed:     state.form.tts_speed || 1.0,
        is_default:    isDefaultEl?.checked ? 1 : 0
      })
      if (!res.data.ok) throw new Error(res.data.error)

      // 목록 갱신
      const listRes = await axios.get('/api/production-presets')
      this.state.productionPresets = listRes.data.data || []
      this.state.selectedProductionPresetId = res.data.data.id

      document.getElementById('savePresetModal')?.remove()
      this.showToast(`✅ "${name}" 프리셋 저장됨!`, 'success')
      this.rerender()
    } catch (e) {
      this.showToast('저장 실패: ' + (e.response?.data?.error || e.message), 'error')
    }
  },

  // ── 제작 프리셋 삭제 ──────────────────────────────────────────
  async deleteProductionPreset(presetId, presetName) {
    if (!confirm(`"${presetName}" 프리셋을 삭제할까요?`)) return
    try {
      await axios.delete(`/api/production-presets/${presetId}`)
      const listRes = await axios.get('/api/production-presets')
      this.state.productionPresets = listRes.data.data || []
      if (this.state.selectedProductionPresetId === presetId) {
        this.state.selectedProductionPresetId = null
      }
      this.showToast('프리셋이 삭제되었습니다.', 'info')
      this.rerender()
    } catch (e) {
      this.showToast('삭제 실패: ' + e.message, 'error')
    }
  },

  // ── TTS 없이 영상합성 (자막만) ────────────────────────────────
  async startVideoSynthesisNoTTS() {
    if (!this.state.currentJob?.script_content) {
      this.showToast('대본이 없습니다.', 'error'); return
    }

    const hasBgVideo = !!this.state.bgVideoFile

    // bgVideoFile이 있어도 TTS가 없다는 안내 (영상+자막만 합성)
    if (hasBgVideo) {
      const ok = await this._showConfirmModal({
        emoji: '🔇',
        title: 'TTS 음성 없이 합성합니다',
        body:  '업로드된 영상 위에 <strong style="color:#fbbf24">자막만 합성</strong>됩니다.<br><br>' +
               '영상 원본 오디오는 <strong style="color:#10b981">유지</strong>되며,<br>' +
               'TTS 음성은 포함되지 않습니다.<br><br>' +
               'TTS를 먼저 생성하면 성우 목소리도 함께 넣을 수 있어요.',
        cancelText: '취소 — TTS 먼저 생성',
        okText: '영상 & 자막 합성 (오디오 유지)',
      })
      if (!ok) return
    }
    // bgVideoFile이 없으면 그라데이션 배경 사용 — 커스텀 확인 모달
    else {
      const ok = await this._showConfirmModal({
        emoji: '🎬',
        title: 'TTS 음성과 원본 영상이 없습니다',
        body:  'TTS 음성도 원본 영상도 없는 상태입니다.<br><br>' +
               '진행하면 <strong style="color:#fbbf24">무음 + 그라데이션 배경</strong>에 자막만 표시되는 영상이 생성됩니다.<br><br>' +
               'TTS 생성 또는 영상 업로드를 먼저 하는 것을 권장합니다.',
        cancelText: '취소',
        okText: '그라데이션 배경으로 합성',
      })
      if (!ok) return
    }

    // 오디오 없이 영상합성 — silent audio 생성
    this.state.isRendering = true
    this.rerender()

    try {
      const videoUrl = await this._renderSubtitleVideoNoAudio()
      this.state.currentJob.output_video_url = videoUrl
      this.state.currentJob._videoIsMP4 = true
      this.state.currentJob.stage = 'complete'
      this.state.currentJob.status = 'complete'
      this.showToast('🎬 자막 합성 완료! 다운로드 버튼을 클릭하세요.', 'success')
    } catch(e) {
      this.showToast('렌더링 오류: ' + e.message, 'error')
      console.error(e)
    } finally {
      this.state.isRendering = false
      this.rerender()
    }
  },

  // ── 내부: 오디오 없이 자막만 Canvas 합성 (WebCodecs 우선) ────
  // ── 내부: 오디오 없이 자막만 합성 (bgVideo 있으면 FFmpeg.wasm) ──
  async _renderSubtitleVideoNoAudio() {
    const job    = this.state.currentJob
    const script = job.script_content || ''

    const fontSizeEl = document.getElementById('subtitleFontSizeNoTTS') || document.getElementById('subtitleFontSize')
    const positionEl = document.getElementById('subtitlePositionNoTTS') || document.getElementById('subtitlePosition')
    const bgBarEl    = document.getElementById('subtitleBgBar')
    const fontSize   = parseInt(fontSizeEl?.value || this.state.subtitleFontSize || '41')
    const position   = positionEl?.value || this.state.subtitlePosition || 'middle'
    const fontColor  = this.state.subtitleFontColor || '#ffffff'
    const hasBgBar   = bgBarEl ? bgBarEl.checked : (this.state.subtitleBgBar !== false)
    const fontFamily = this.state.subtitleFont || 'NanumSquareRound'
    const bgColor    = hasBgBar ? (this.state.subtitleBgColor || 'rgba(0,0,0,0.65)') : 'transparent'

    const W = 720, H = 1280
    const canvas = document.getElementById('synthCanvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    const hasBgVideo = !!this.state.bgVideoFile
    const estimatedDuration = Math.max(15, Math.round(script.length / 5))
    const segments = this._buildSubtitleSegments(script, estimatedDuration, ctx, fontSize, W)

    const setProgress = (pct, msg) => {
      const bar   = document.getElementById('renderProgressBar')
      const pctEl = document.getElementById('renderPct')
      const txt   = document.getElementById('renderStatusText')
      if (bar)   bar.style.width = pct + '%'
      if (pctEl) pctEl.textContent = Math.round(pct) + '%'
      if (txt)   txt.textContent = msg || ''
    }

    // bgVideo 있으면 captureStream 방식 - 원본 비디오 그대로 + 자막 오버레이
    if (hasBgVideo) {
      setProgress(10, '영상 로딩 중...')
      const bgVideo = await this._loadBgVideo(this.state.bgVideoFile)
      bgVideo.loop  = false
      bgVideo.muted = true
      bgVideo.currentTime = 0
      await new Promise(r => { bgVideo.onseeked = () => { bgVideo.onseeked = null; r() }; setTimeout(r, 800) })

      const noAudioCanvas = document.getElementById('synthCanvas')
      noAudioCanvas.width = W; noAudioCanvas.height = H
      const noAudioCtx = noAudioCanvas.getContext('2d')

      const noAudioStream = noAudioCanvas.captureStream(30)
      const noAudioMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm'
      const noAudioRec = new MediaRecorder(noAudioStream, { mimeType: noAudioMime, videoBitsPerSecond: 8_000_000 })
      const noAudioChunks = []
      noAudioRec.ondataavailable = e => { if (e.data.size > 0) noAudioChunks.push(e.data) }

      bgVideo.onended = () => { bgVideo.currentTime = 0; bgVideo.play().catch(() => {}) }

      setProgress(20, '자막 합성 시작...')
      noAudioRec.start(100)
      bgVideo.play().catch(() => {})

      const totalDuration = bgVideo.duration || estimatedDuration

      await new Promise(resolve => {
        let animNA
        const startNA = performance.now()
        const drawNA = () => {
          if (this._renderCancelFlag) { cancelAnimationFrame(animNA); noAudioRec.stop(); resolve(); return }
          const elapsed = (performance.now() - startNA) / 1000
          setProgress(20 + Math.min(elapsed / totalDuration * 70, 70), `합성 중... ${elapsed.toFixed(1)}s / ${totalDuration.toFixed(1)}s`)

          const vw = bgVideo.videoWidth || W
          const vh = bgVideo.videoHeight || H
          const scale = Math.max(W / vw, H / vh)
          noAudioCtx.drawImage(bgVideo, (W - vw*scale)/2, (H - vh*scale)/2, vw*scale, vh*scale)

          const seg = segments.find(s => elapsed >= s.start && elapsed < s.end)
          if (seg) {
            const lines = (seg.text || seg.lines?.join('\n') || '').split('\n').filter(Boolean)
            this._drawSubtitle(noAudioCtx, lines, W, H, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor)
          }

          if (elapsed < totalDuration) {
            animNA = requestAnimationFrame(drawNA)
          } else {
            bgVideo.onended = null; bgVideo.pause()
            noAudioRec.stop()
          }
        }
        requestAnimationFrame(drawNA)
        noAudioRec.onstop = () => resolve()
      })

      const noAudioBlob = new Blob(noAudioChunks, { type: 'video/webm' })
      setProgress(100, '✅ 완성!')
      return URL.createObjectURL(noAudioBlob)
    }

    // bgVideo 없으면 기존 그라데이션 + Canvas 방식
    if (!window.Mp4Muxer) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://unpkg.com/mp4-muxer@5.2.2/build/mp4-muxer.js'
          s.onload = resolve; s.onerror = reject
          document.head.appendChild(s)
        })
      } catch(e) {}
    }

    const supportsWebCodecs = typeof VideoEncoder !== 'undefined' && !!window.Mp4Muxer
    if (supportsWebCodecs) {
      setProgress(5, 'H.264 인코더 초기화 중...')
      const FPS = 30
      const { Muxer, ArrayBufferTarget } = window.Mp4Muxer
      const target = new ArrayBufferTarget()
      const muxer  = new Muxer({ target, video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' })

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error:  (e) => console.error('VideoEncoder error:', e),
      })
      videoEncoder.configure({ codec: 'avc1.42001f', width: W, height: H, framerate: FPS, bitrate: 8_000_000, latencyMode: 'realtime' })

      setProgress(10, '비디오 프레임 렌더링 중...')
      const totalFrames = Math.ceil(estimatedDuration * FPS)

      let encodedFramesNA = 0
      await new Promise((resolve) => {
        const encodeFrame = async () => {
          if (this._renderCancelFlag) { videoEncoder.close(); muxer.finalize(); resolve(); return }
          if (encodedFramesNA >= totalFrames) { resolve(); return }
          while (videoEncoder.encodeQueueSize > 10) await new Promise(r => setTimeout(r, 5))

          const t = encodedFramesNA / FPS
          const grad = ctx.createLinearGradient(0, 0, 0, H)
          grad.addColorStop(0, '#0d0820'); grad.addColorStop(0.5, '#160c30'); grad.addColorStop(1, '#0d0820')
          ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
          for (let i = 0; i < 36; i++) {
            const x = (W / 36) * i + W / 72
            const h = 18 + Math.sin(t * 2.5 + i * 0.55) * 14
            ctx.fillStyle = `rgba(124,58,237,${0.12 + Math.sin(t + i) * 0.08})`
            ctx.fillRect(x - 3, H / 2 - h / 2, 6, h)
          }

          const seg = segments.find(s => t >= s.start && t < s.end)
          if (seg) {
            const lines = seg.text ? seg.text.split('\n').filter(Boolean) : (seg.lines || [])
            this._drawSubtitle(ctx, lines, W, H, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor)
          }

          const timestamp = Math.round(encodedFramesNA / FPS * 1_000_000)
          const frame = new VideoFrame(canvas, { timestamp, duration: Math.round(1_000_000 / FPS) })
          videoEncoder.encode(frame, { keyFrame: encodedFramesNA % (FPS * 2) === 0 })
          frame.close()
          encodedFramesNA++

          if (encodedFramesNA % 15 === 0)
            setProgress(10 + (encodedFramesNA / totalFrames) * 82, `프레임 렌더링... ${encodedFramesNA}/${totalFrames}`)
          if (encodedFramesNA % 30 === 0) await new Promise(r => setTimeout(r, 0))
          encodeFrame()
        }
        encodeFrame()
      })

      setProgress(94, 'MP4 파일 생성 중...')
      await videoEncoder.flush()
      videoEncoder.close()
      muxer.finalize()

      const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' })
      setProgress(100, '✅ H.264 MP4 완성!')
      return URL.createObjectURL(mp4Blob)
    }

    // MediaRecorder 폴백
    setProgress(5, 'MediaRecorder 방식으로 렌더링...')
    const stream   = canvas.captureStream(30)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    const chunks   = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.start(100)
    const startTime = performance.now()
    let animFrameNA

    await new Promise(resolve => {
      const drawFrameNA = () => {
        const elapsed = (performance.now() - startTime) / 1000
        setProgress(Math.min(elapsed / estimatedDuration * 90, 90), `렌더링 중... ${elapsed.toFixed(1)}s`)
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, '#0d0820'); grad.addColorStop(0.5, '#160c30'); grad.addColorStop(1, '#0d0820')
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

        const seg = segments.find(s => elapsed >= s.start && elapsed < s.end)
        if (seg) {
          const lines = seg.text ? seg.text.split('\n').filter(Boolean) : (seg.lines || [])
          this._drawSubtitle(ctx, lines, W, H, fontSize, fontColor, hasBgBar, position, fontFamily, bgColor)
        }

        if (elapsed < estimatedDuration) {
          animFrameNA = requestAnimationFrame(drawFrameNA)
        } else {
          recorder.stop()
        }
      }
      requestAnimationFrame(drawFrameNA)
      recorder.onstop = () => resolve()
    })

    const webmBlob = new Blob(chunks, { type: 'video/webm' })
    setProgress(100, '완료 (WebM)')
    return URL.createObjectURL(webmBlob)
  },

  // ── YouTube/SNS 섹션 HTML (워크스페이스 인라인용) ────────────
  _getYoutubeSectionHTML() {
    const { currentJob, form } = this.state
    const titles   = currentJob?.youtube_titles || []
    const desc     = currentJob?.youtube_description || ''
    const hashtags = currentJob?.youtube_hashtags || []
    const isGen    = this.state.isGeneratingTitle || false

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem">
          <div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem">
            <i class="fab fa-youtube" style="color:#ff0000"></i>
            YouTube · SNS 제목 &amp; 설명글
          </div>
          <div style="display:flex;align-items:center;gap:0.4rem">
            <input type="text" id="ytProductNumberInline" value="${this.escHtml(form.product_number)}"
              placeholder="제품번호 (선택)"
              style="width:100px;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.25rem 0.5rem;border-radius:5px;font-size:0.7rem"
              oninput="App.state.form.product_number=this.value">
            <button onclick="App.generateYoutubeTitle()" ${isGen?'disabled':''}
              style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.3rem 0.75rem;background:linear-gradient(135deg,#ff0000,#cc0000);border:none;color:white;border-radius:6px;cursor:pointer;font-size:0.72rem;font-weight:700;white-space:nowrap">
              ${isGen ? `<span class="spinner" style="width:11px;height:11px;border-color:rgba(255,255,255,0.3);border-top-color:white"></span>`
                      : `<i class="fas fa-magic"></i>`}
              ${isGen ? '생성 중...' : '제목 생성'}
            </button>
          </div>
        </div>

        ${isGen ? `
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.75rem;background:rgba(255,0,0,0.05);border:1px solid rgba(255,0,0,0.1);border-radius:8px;margin-bottom:0.5rem">
            <span class="spinner" style="width:14px;height:14px;border-color:rgba(255,0,0,0.2);border-top-color:#ff6666;flex-shrink:0"></span>
            <span style="font-size:0.75rem;color:#ff9999">YouTube 제목 & 설명글 자동 생성 중...</span>
          </div>
        ` : ''}
        ${titles.length > 0 ? `
          <!-- 제목 후보 5개 -->
          <div style="margin-bottom:0.75rem">
            <div style="font-size:0.68rem;color:var(--text-muted);font-weight:600;margin-bottom:0.35rem;display:flex;align-items:center;justify-content:space-between">
              <span><i class="fas fa-heading" style="margin-right:3px;color:#ff6666"></i>후킹 제목 후보</span>
              <button onclick="App.copyAllTitles()" style="background:none;border:none;color:#ff6666;cursor:pointer;font-size:0.65rem;padding:0"><i class="fas fa-copy"></i> 전체복사</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.3rem">
              ${titles.map((t, i) => `
                <div style="display:flex;align-items:center;gap:0.4rem;padding:0.45rem 0.65rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:7px">
                  <span style="width:16px;height:16px;background:rgba(255,0,0,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.58rem;color:#ff6666;flex-shrink:0;font-weight:700">${i+1}</span>
                  <span style="flex:1;font-size:0.75rem;color:var(--text-primary)">${this.escHtml(t)}</span>
                  <button onclick="App.copyText('${this.escHtml(t).replace(/'/g,"\\'")}','제목')"
                    style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0.1rem 0.25rem;font-size:0.68rem;flex-shrink:0"><i class="fas fa-copy"></i></button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 설명글 -->
          ${desc ? `
          <div style="margin-bottom:0.65rem">
            <div style="font-size:0.68rem;color:var(--text-muted);font-weight:600;margin-bottom:0.3rem;display:flex;align-items:center;justify-content:space-between">
              <span><i class="fas fa-instagram" style="margin-right:3px;color:#e1306c"></i>인스타그램 캡션 <span style="color:#10b981;font-size:0.62rem">(YouTube·인스타·틱톡 공용 · 편집 가능)</span></span>
              <button onclick="App.copyText(document.getElementById('descContentInline').innerText,'설명글')"
                style="background:none;border:none;color:#a78bfa;cursor:pointer;font-size:0.65rem;padding:0"><i class="fas fa-copy"></i> 복사</button>
            </div>
            <div id="descContentInline" contenteditable="true"
              style="background:var(--bg-secondary);border:1px solid rgba(225,48,108,0.25);border-radius:7px;padding:0.75rem;font-size:0.78rem;color:var(--text-primary);line-height:1.9;min-height:120px;outline:none;max-height:400px;overflow-y:auto;word-break:break-word;font-family:inherit"
              oninput="App.state.currentJob.youtube_description=this.innerText">${this.escHtmlWithBr(desc)}</div>
          </div>` : ''}

          <!-- 해시태그 -->
          ${hashtags.length > 0 ? `
          <div>
            <div style="font-size:0.68rem;color:var(--text-muted);font-weight:600;margin-bottom:0.3rem;display:flex;align-items:center;justify-content:space-between">
              <span><i class="fas fa-hashtag" style="margin-right:3px;color:#60a5fa"></i>해시태그</span>
              <button onclick="App.copyText('${this.escHtml(hashtags.join(' '))}','해시태그')"
                style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:0.65rem;padding:0"><i class="fas fa-copy"></i> 복사</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.25rem">
              ${hashtags.map(h=>`<span onclick="App.copyText('${this.escHtml(h)}','해시태그')" style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);color:#93c5fd;padding:0.15rem 0.5rem;border-radius:99px;font-size:0.68rem;cursor:pointer">${this.escHtml(h)}</span>`).join('')}
            </div>
          </div>` : ''}
        ` : `
          <div style="text-align:center;padding:0.75rem;color:var(--text-muted);font-size:0.78rem;opacity:0.7">
            <i class="fab fa-youtube" style="font-size:1.5rem;display:block;margin-bottom:0.35rem;opacity:0.3"></i>
            위 버튼을 클릭해 제목 5개 + SNS 설명글을 자동 생성하세요
          </div>
        `}
      </div>
    `
  },

  // ── YouTube/SNS 탭 HTML (레거시 — 워크스페이스 인라인으로 대체) ─
  // ── YouTube/SNS 탭 HTML ────────────────────────────────────────
  getYoutubeTabHTML() {
    return `<div>${this._getYoutubeSectionHTML()}</div>`
  },


  // ── YouTube 제목 생성 ──────────────────────────────────────────
  async generateYoutubeTitle() {
    if (!this.state.currentJob?.job_id) {
      this.showToast('먼저 대본을 생성해주세요.', 'error'); return
    }
    this.state.isGeneratingTitle = true
    this.rerender()

    try {
      const res = await axios.post(`/api/jobs/${this.state.currentJob.job_id}/generate-title`, {
        product_number: this.state.form.product_number || ''
      })
      if (res.data.ok) {
        const d = res.data.data
        this.state.currentJob.youtube_titles      = d.titles || []
        this.state.currentJob.youtube_description = d.description || ''
        this.state.currentJob.youtube_hashtags    = d.hashtags || []
        if (res.data.demo) {
          this.showToast('📝 샘플 제목이 생성되었습니다. (OpenAI 키 없음)', 'info')
        } else {
          this.showToast('🎯 제목 &amp; 설명글 생성 완료!', 'success')
        }
      } else {
        this.showToast(res.data.error || '생성 실패', 'error')
      }
    } catch (e) {
      this.showToast('생성 오류: ' + (e.response?.data?.error || e.message), 'error')
    } finally {
      this.state.isGeneratingTitle = false
      this.rerender()
    }
  },

  selectTitle(idx) {
    const titles = this.state.currentJob?.youtube_titles || []
    if (!titles[idx]) return
    // 선택된 제목 하이라이트
    document.querySelectorAll('[id^="titleItem_"]').forEach((el, i) => {
      if (i === idx) {
        el.style.background = 'rgba(255,0,0,0.08)'
        el.style.borderColor = 'rgba(255,0,0,0.3)'
      } else {
        el.style.background = 'var(--bg-secondary)'
        el.style.borderColor = 'var(--border)'
      }
    })
    navigator.clipboard.writeText(titles[idx]).then(() => {
      this.showToast(`✅ 제목 복사됨: "${titles[idx].substring(0,20)}..."`, 'success')
    })
  },

  copyAllTitles() {
    const titles = this.state.currentJob?.youtube_titles || []
    if (!titles.length) return
    const text = titles.map((t, i) => `${i+1}. ${t}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('✅ 제목 5개 모두 복사됨!', 'success')
    })
  },

  copyText(text, label) {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(`✅ ${label || '텍스트'} 복사됨!`, 'success')
    })
  }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => App.init())
\n  // ── TTS 오디오 에너지 분석 → 실제 음성 구간 감지 (VAD) ────────
  // MERGE_GAP을 크게(500ms) 써서 문장/구절 단위 버스트를 반환
  _detectSpeechRegions(audioBuffer, mergeGap = 0.50) {
    const sampleRate   = audioBuffer.sampleRate
    const channelData  = audioBuffer.getChannelData(0)
    const totalSamples = channelData.length
    const frameSamples = Math.round(sampleRate * 0.02)   // 20ms 프레임

    // 1) RMS 에너지 계산
    const frames = []
    for (let i = 0; i < totalSamples; i += frameSamples) {
      let sum = 0
      const end = Math.min(i + frameSamples, totalSamples)
      for (let j = i; j < end; j++) sum += channelData[j] ** 2
      frames.push(Math.sqrt(sum / (end - i)))
    }

    // 2) 동적 임계값 (중앙값의 15%, 최소 0.003)
    const sorted    = [...frames].sort((a, b) => a - b)
    const median    = sorted[Math.floor(sorted.length * 0.5)] || 0.001
    const threshold = Math.max(median * 0.15, 0.003)

    // 3) 음성 구간 추출 (짧은 무음은 mergeGap 기준으로 합침)
    const MIN_SPEECH = 0.10
    const regions    = []
    let inSpeech = false, speechStart = 0

    for (let i = 0; i < frames.length; i++) {
      const t = i * 0.02
      if (!inSpeech && frames[i] > threshold) {
        inSpeech = true; speechStart = t
      } else if (inSpeech && frames[i] <= threshold) {
        let gapEnd = i
        while (gapEnd < frames.length && frames[gapEnd] <= threshold) gapEnd++
        const gapDur = (gapEnd - i) * 0.02
        if (gapDur < mergeGap && gapEnd < frames.length) {
          i = gapEnd - 1   // 짧은 무음 → 합치기
        } else {
          const dur = t - speechStart
          if (dur >= MIN_SPEECH) regions.push({ start: speechStart, end: t })
          inSpeech = false
        }
      }
    }
    if (inSpeech) {
      const dur = frames.length * 0.02 - speechStart
      if (dur >= MIN_SPEECH) regions.push({ start: speechStart, end: frames.length * 0.02 })
    }
    return regions
  },

  // ── 자막 줄 ↔ VAD 버스트 1:1 매핑 ──────────────────────────────
  // 전략:
  //   1) 대본을 문장(청크) 단위로 분해 → 각 청크를 wrapText로 자막 줄 목록으로 변환
  //   2) VAD(mergeGap=500ms)로 문장 단위 버스트 감지
  //   3) 청크 수 ↔ 버스트 수 1:1 정렬
  //      - 청크 1개 = 버스트 1개 → 버스트 시간 그대로 사용
  //      - 버스트 1개에 여러 자막 줄이 있으면 글자수 비율로 세분
  _buildSubtitleSegmentsFromSpeech(script, duration, ctx, fontSize, canvasW, speechRegions) {
    // VAD 구간이 없으면 CPS 폴백
    const totalSpeechDur = speechRegions.reduce((s, r) => s + (r.end - r.start), 0)
    if (speechRegions.length === 0 || totalSpeechDur < 0.5) {
      return this._buildSubtitleSegments(script, duration, ctx, fontSize, canvasW, 0)
    }

    // ── 1) 대본 → 청크 분해 ───────────────────────────────────────
    const SAFE_W    = canvasW - 120
    const MAX_CHARS = 14
    ctx.font = `bold ${fontSize}px 'Apple SD Gothic Neo','Noto Sans KR',sans-serif`

    // 줄바꿈 단위로 1차 분리 → 문장부호 기준 2차 분리
    const rawLines = script.trim().split('\n').filter(l => l.trim())
    const chunks   = []
    for (const line of rawLines) {
      // 마침표·느낌표·물음표 뒤 공백 기준 분리
      const parts = line.split(/(?<=[.!?~。！？,，、])\s*/)
      for (const p of parts) {
        if (p.trim()) chunks.push(p.trim())
      }
    }
    if (chunks.length === 0) chunks.push(script.trim())

    // 각 청크를 자막 줄로 래핑 (MAX_CHARS / pixel 기준)
    const wrapText = (text) => {
      const words  = text.split(' ')
      const result = []
      let cur      = ''
      for (const word of words) {
        if (!word) continue
        const cand = cur ? cur + ' ' + word : word
        if (cur && (cand.length > MAX_CHARS || ctx.measureText(cand).width > SAFE_W)) {
          result.push(cur); cur = word
        } else cur = cand
      }
      if (cur) result.push(cur)
      // 여전히 너무 긴 줄은 글자 단위 강제 분리
      const final = []
      for (const line of result) {
        if (line.length <= MAX_CHARS && ctx.measureText(line).width <= SAFE_W) {
          final.push(line)
        } else {
          let tmp = ''
          for (const ch of line) {
            const test = tmp + ch
            if ((test.replace(/\s/g,'').length > MAX_CHARS || ctx.measureText(test).width > SAFE_W) && tmp) {
              final.push(tmp); tmp = ch
            } else tmp = test
          }
          if (tmp) final.push(tmp)
        }
      }
      return final.length > 0 ? final : [text.substring(0, MAX_CHARS)]
    }

    // 청크 → { lines[], totalChars } 목록
    const chunkData = chunks.map(chunk => {
      const lines      = wrapText(chunk)
      const totalChars = lines.reduce((s, l) => s + l.replace(/\s/g, '').length, 0) || 1
      return { lines, totalChars }
    })

    // ── 2) VAD 버스트 수 조정 ────────────────────────────────────
    // 청크 수와 버스트 수가 다르면 비율로 묶어서 청크 수에 맞게 조정
    const nChunks  = chunkData.length
    const nBursts  = speechRegions.length
    const segments = []

    // 버스트를 청크 수만큼 그룹핑
    const burstGroups = []
    for (let ci = 0; ci < nChunks; ci++) {
      const b0 = Math.floor(ci * nBursts / nChunks)
      const b1 = Math.floor((ci + 1) * nBursts / nChunks)
      const group = speechRegions.slice(b0, Math.max(b0 + 1, b1))
      burstGroups.push(group)
    }

    // ── 3) 각 청크에 버스트 그룹 타임을 할당 ────────────────────
    for (let ci = 0; ci < nChunks; ci++) {
      const { lines, totalChars } = chunkData[ci]
      const group = burstGroups[ci]
      if (!group || group.length === 0) continue

      const segStart = group[0].start
      // segEnd: 이 그룹의 마지막 버스트 끝 ~ 다음 그룹 시작 중간
      let segEnd
      if (ci < nChunks - 1) {
        const nextGroup = burstGroups[ci + 1]
        const nextStart = nextGroup && nextGroup[0] ? nextGroup[0].start : duration
        const thisEnd   = group[group.length - 1].end
        // 현재 발화 끝과 다음 발화 시작의 중간점 (또는 현재 발화 끝에서 최대 0.3s)
        segEnd = Math.min(thisEnd + (nextStart - thisEnd) * 0.5, nextStart - 0.02)
      } else {
        segEnd = Math.min(group[group.length - 1].end + 0.3, duration)
      }
      const burstDur = Math.max(segEnd - segStart, 0.1)

      // 자막 줄이 1줄이면 버스트 전체 사용
      if (lines.length === 1) {
        segments.push({ text: lines[0], lines: [lines[0]], start: segStart, end: segEnd })
      } else {
        // 여러 줄이면 글자수 비율로 버스트 시간 세분
        let t = segStart
        for (let li = 0; li < lines.length; li++) {
          const chars   = lines[li].replace(/\s/g, '').length || 1
          const lineDur = (chars / totalChars) * burstDur
          const lineEnd = li === lines.length - 1 ? segEnd : t + lineDur
          segments.push({ text: lines[li], lines: [lines[li]], start: t, end: lineEnd })
          t += lineDur
        }
      }
    }

    // 마지막 세그먼트 클램프
    if (segments.length > 0) {
      segments[segments.length - 1].end = Math.min(segments[segments.length - 1].end, duration)
    }
    return segments
  },
