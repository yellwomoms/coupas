/* ================================================================
   AI Studio - 페르소나 쇼츠 자동생성 프론트엔드
   ================================================================ */

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
      // Typecast 전용 옵션
      tts_emotion: 'smart',   // smart | normal | happy | sad | angry | whisper | toneup | tonedown
      tts_speed: 1.0          // 0.9 ~ 1.1
    },

    // 현재 작업 결과
    currentJob: null,
    isGenerating: false,
    isGeneratingTTS: false,
    activeTab: 'workspace', // workspace | history
    editingScript: false,
    currentAudio: null
  },

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
    this.renderApp()
    await this.loadInitialData()
    this.bindEvents()
  },

  async loadInitialData() {
    try {
      const [personasRes, presetsRes, voicesRes, settingsRes, jobsRes] = await Promise.all([
        axios.get('/api/personas'),
        axios.get('/api/subtitle-presets'),
        axios.get('/api/tts-voices'),
        axios.get('/api/settings'),
        axios.get('/api/jobs')
      ])
      this.state.personas = personasRes.data.data || []
      this.state.subtitlePresets = presetsRes.data.data || []
      this.state.ttsVoices = voicesRes.data.data || []
      this.state.settings = settingsRes.data.data || {}
      this.state.jobs = jobsRes.data.data || []

      // 기본값 세팅
      if (this.state.subtitlePresets.length > 0) {
        const def = this.state.subtitlePresets.find(p => p.is_default) || this.state.subtitlePresets[0]
        this.state.form.subtitle_preset_id = def.id
      }
      if (this.state.ttsVoices.length > 0) {
        const def = this.state.ttsVoices.find(v => v.is_default) || this.state.ttsVoices[0]
        this.state.form.tts_voice_id = def.id
      }

      this.rerender()
    } catch (e) {
      console.error('초기 데이터 로딩 실패:', e)
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

        <!-- STEP 4: 자막 스타일 프리셋 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">4</span>
            자막 스타일 프리셋
          </div>
          <div class="preset-list" id="subtitlePresetList">
            ${subtitlePresets.map(p => `
              <div class="preset-item ${form.subtitle_preset_id === p.id ? 'selected' : ''}"
                data-preset-id="${p.id}">
                <div class="preset-radio"></div>
                <div class="preset-info">
                  <div class="preset-name">${p.name}</div>
                  <div class="preset-font-preview" style="font-family:'${p.font_family}',sans-serif">
                    ${p.font_family} · ${p.layout === 'bottom_bar' ? '하단 바' : p.layout === 'bottom_center' ? '하단 중앙' : '중앙'}
                  </div>
                </div>
                <div style="width:40px;height:22px;background:${p.bg_color};border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <span style="font-size:8px;color:${p.font_color};font-weight:700">자막</span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- STEP 5: TTS 성우 + 감정 선택 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">5</span>
            Typecast 성우 &amp; 감정 선택
            <span style="font-size:0.62rem;color:#a855f7;background:rgba(168,85,247,0.1);padding:0.15rem 0.4rem;border-radius:4px;margin-left:6px">TYPECAST</span>
          </div>

          <!-- 성우 목록 -->
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.5rem">성우 선택</div>
          <div class="voice-grid" id="voiceList">
            ${ttsVoices.map(v => {
              const genderIcon = v.gender === 'male' ? '👨' : '👩'
              const styleColor = {
                'warm': '#f59e0b', 'trendy': '#a855f7',
                'casual': '#10b981', 'professional': '#3b82f6', 'cheerful': '#f97316'
              }[v.style] || '#6b7280'
              return `
                <div class="voice-item ${form.tts_voice_id === v.id ? 'selected' : ''}"
                  data-voice-id="${v.id}">
                  <div class="voice-avatar" style="background:${styleColor}22;border:1px solid ${styleColor}44">
                    ${genderIcon}
                  </div>
                  <div class="voice-info">
                    <div class="voice-name">${v.name}</div>
                    <div class="voice-desc">${v.description || ''}</div>
                  </div>
                  ${form.tts_voice_id === v.id
                    ? `<i class="fas fa-check-circle" style="color:var(--accent-light);font-size:0.85rem"></i>`
                    : ''}
                </div>
              `
            }).join('')}
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

          <!-- TTS 속도 슬라이더 -->
          <div style="margin-top:0.85rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">
              <span style="font-size:0.72rem;color:var(--text-muted)">TTS 속도 (싱크 조절)</span>
              <span id="speedLabel" style="font-size:0.75rem;font-weight:700;color:var(--accent-light)">${form.tts_speed.toFixed(1)}×</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-size:0.65rem;color:var(--text-muted)">0.9×</span>
              <input type="range" id="ttsSpeedSlider"
                min="0.9" max="1.1" step="0.05" value="${form.tts_speed}"
                style="flex:1;accent-color:#7c3aed;height:4px">
              <span style="font-size:0.65rem;color:var(--text-muted)">1.1×</span>
            </div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:0.3rem;text-align:center">
              15초 → ${Math.round(15 / form.tts_speed)}초 영상 기준
            </div>
          </div>
        </section>

        <!-- 생성 버튼 -->
        <section class="section" style="border-bottom:none">
          <button class="btn-generate" id="btnGenerate" ${isGenerating ? 'disabled' : ''}>
            ${isGenerating
              ? `<span class="spinner"></span> 대본 생성 중...`
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

        <!-- 탭 네비게이션 -->
        <nav class="tab-nav">
          <button class="tab-btn ${activeTab === 'workspace' ? 'active' : ''}" data-tab="workspace">
            <i class="fas fa-magic"></i> 작업 공간
          </button>
          <button class="tab-btn ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
            <i class="fas fa-history"></i> 히스토리
            ${state.jobs.length > 0 ? `<span style="background:var(--accent);color:white;padding:0 5px;border-radius:10px;font-size:0.65rem">${state.jobs.length}</span>` : ''}
          </button>
          <button class="tab-btn ${activeTab === 'preview' ? 'active' : ''}" data-tab="preview">
            <i class="fas fa-film"></i> 자막 미리보기
          </button>
        </nav>

        ${activeTab === 'workspace' ? this.getWorkspaceTabHTML() : ''}
        ${activeTab === 'history' ? this.getHistoryTabHTML() : ''}
        ${activeTab === 'preview' ? this.getPreviewTabHTML() : ''}

      </main>
    `
  },

  getWorkspaceTabHTML() {
    const currentJob = this.state.currentJob
    const settings = this.state.settings || {}
    const isGeneratingTTS = this.state.isGeneratingTTS
    const state = this.state

    // 스테이지 계산
    const stage = currentJob?.stage || 'waiting'
    const stages = [
      { key: 'waiting', icon: '⏳', label: '대기' },
      { key: 'script_done', icon: '📝', label: '대본' },
      { key: 'tts_done', icon: '🔊', label: 'TTS' },
      { key: 'rendering', icon: '🎬', label: '렌더링' },
      { key: 'complete', icon: '✅', label: '완료' }
    ]
    const stageIdx = stages.findIndex(s => s.key === stage)

    const hasScript = currentJob?.script_content
    const hasTTS = currentJob?.tts_audio_url
    const charCount = hasScript ? currentJob.script_content.length : 0

    return `
      <!-- n8n 상태 -->
      ${state.settings.has_n8n ? `
        <div class="n8n-status">
          <div class="n8n-dot ${currentJob ? 'processing' : 'connected'}"></div>
          <div style="flex:1">
            <div style="font-size:0.78rem;font-weight:600">n8n 워크플로우</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">
              ${currentJob ? `처리 중: ${currentJob.job_id}` : '연결됨 - 대기 중'}
            </div>
          </div>
          <a href="#" style="font-size:0.72rem;color:var(--accent-light)">대시보드 열기 →</a>
        </div>
      ` : `
        <div class="api-alert" style="margin-bottom:1rem">
          <i class="fas fa-info-circle"></i>
          <div>
            <strong>데모 모드</strong><br>
            API 키 없이도 샘플 대본 생성이 가능합니다.
            실제 AI 대본 생성은 OpenAI API 키가 필요합니다.
          </div>
        </div>
      `}

      <!-- 스테이지 뷰어 -->
      <div class="stage-viewer">
        <div class="stage-title">
          <i class="fas fa-tasks" style="color:var(--accent-light)"></i>
          워크플로우 진행 상황
        </div>
        <div class="stage-steps">
          ${stages.map((s, i) => {
            let cls = ''
            if (i < stageIdx) cls = 'done'
            else if (i === stageIdx) cls = 'active'
            return `
              <div class="stage-step ${cls}">
                <div class="step-circle">
                  ${i < stageIdx ? '<i class="fas fa-check" style="font-size:0.7rem"></i>' : s.icon}
                </div>
                <div class="step-label">${s.label}</div>
              </div>
            `
          }).join('')}
        </div>
      </div>

      <!-- 대본 뷰어 -->
      <div class="script-viewer">
        <div class="script-viewer-header">
          <div class="script-viewer-title">
            <i class="fas fa-file-alt" style="color:var(--accent-light)"></i>
            생성된 대본 (PAS+E 구조)
          </div>
          <div class="script-actions">
            ${hasScript ? `
              <button class="btn-secondary" id="btnEditScript">
                <i class="fas fa-edit"></i> 수정
              </button>
              <button class="btn-secondary" id="btnRegenScript">
                <i class="fas fa-redo"></i> 재생성
              </button>
              <button class="btn-secondary" id="btnCopyScript">
                <i class="fas fa-copy"></i> 복사
              </button>
            ` : ''}
          </div>
        </div>

        <div class="script-content ${state.editingScript ? 'editable' : ''}"
          id="scriptContent"
          ${state.editingScript ? 'contenteditable="true"' : ''}
        >
          ${hasScript
            ? this.escHtml(currentJob.script_content)
            : '<span class="script-placeholder">좌측에서 페르소나와 URL을 입력하고 AI 대본 생성하기를 클릭하세요.\n\n3초 후킹 → 공감 → 해결 경험 → 효과 → CTA 구조로 자동 생성됩니다.</span>'}
        </div>
        ${hasScript ? `
          <div class="script-char-count">
            <span style="color:${charCount > 120 ? '#f59e0b' : 'var(--text-muted)'}">
              ${charCount}자 / 권장 70~120자
            </span>
            ${charCount > 120 ? `<span style="color:#f59e0b;margin-left:0.5rem"><i class="fas fa-exclamation-triangle"></i> 너무 길 수 있어요</span>` : ''}
            ${state.editingScript ? `
              <button class="btn-accent" id="btnSaveScript" style="margin-left:0.75rem;font-size:0.72rem;padding:0.2rem 0.5rem">
                <i class="fas fa-save"></i> 저장
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- TTS 생성 섹션 -->
      <div class="tts-player">
        <div class="script-viewer-header" style="margin-bottom:1rem">
          <div class="script-viewer-title">
            <i class="fas fa-microphone" style="color:var(--accent-light)"></i>
            TTS 음성 생성
          </div>
          ${hasScript && !hasTTS ? `
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
              <span style="font-size:0.68rem;color:#a78bfa;background:rgba(167,139,250,0.1);padding:0.2rem 0.45rem;border-radius:4px;border:1px solid rgba(167,139,250,0.2)">
                ${this.emotionOptions.find(e => e.value === state.form.tts_emotion)?.label || state.form.tts_emotion}
              </span>
              <span style="font-size:0.68rem;color:#34d399;background:rgba(52,211,153,0.1);padding:0.2rem 0.45rem;border-radius:4px;border:1px solid rgba(52,211,153,0.2)">
                ${state.form.tts_speed.toFixed(2)}×
              </span>
              <button class="btn-accent" id="btnGenerateTTS" ${state.isGeneratingTTS ? 'disabled' : ''}>
                ${state.isGeneratingTTS
                  ? '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> 생성 중...'
                  : '<i class="fas fa-play-circle"></i> Typecast TTS 생성'}
              </button>
            </div>
          ` : ''}
        </div>

        ${!settings.has_typecast && hasScript ? `
          <div class="api-alert">
            <i class="fas fa-microphone-slash"></i>
            <div>
              <strong>Typecast API 키가 필요합니다.</strong><br>
              <code style="font-size:0.68rem;color:#fcd34d">npx wrangler pages secret put TYPECAST_API_KEY</code><br>
              <span style="font-size:0.72rem">지금은 브라우저 내장 TTS로 미리 들어보세요.</span>
              <br><button onclick="App.browserTTS()" style="background:none;border:none;color:#fcd34d;cursor:pointer;font-size:0.78rem;padding:0;margin-top:0.3rem">
                <i class="fas fa-volume-up"></i> 브라우저 TTS로 듣기
              </button>
            </div>
          </div>
        ` : ''}

        ${hasTTS ? `
          <div class="audio-player">
            <button class="play-btn" id="playTTSBtn" onclick="App.toggleAudio()">
              <i class="fas fa-play" id="playIcon"></i>
            </button>
            <div class="audio-waveform" id="audioWaveform">
              ${Array.from({length: 16}, (_, i) => `<div class="wave-bar" style="height:${20 + Math.random()*60}%"></div>`).join('')}
            </div>
            <span style="font-size:0.72rem;color:var(--text-muted)" id="audioTime">0:00</span>
          </div>
          <audio id="ttsAudio" src="${currentJob.tts_audio_url}" style="display:none"
            ontimeupdate="App.updateAudioTime()" onended="App.onAudioEnded()"></audio>
          <!-- Typecast 메타 정보 -->
          ${currentJob.tts_emotion || currentJob.tts_tempo ? `
            <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap">
              ${currentJob.tts_emotion ? `<span style="font-size:0.68rem;background:rgba(124,58,237,0.1);color:#a78bfa;padding:0.2rem 0.5rem;border-radius:10px;border:1px solid rgba(124,58,237,0.2)">
                감정: ${currentJob.tts_emotion}
              </span>` : ''}
              ${currentJob.tts_tempo ? `<span style="font-size:0.68rem;background:rgba(16,185,129,0.1);color:#34d399;padding:0.2rem 0.5rem;border-radius:10px;border:1px solid rgba(16,185,129,0.2)">
                속도: ${currentJob.tts_tempo}×
              </span>` : ''}
              <span style="font-size:0.68rem;background:rgba(168,85,247,0.1);color:#c084fc;padding:0.2rem 0.5rem;border-radius:10px;border:1px solid rgba(168,85,247,0.2)">
                🎙 Typecast
              </span>
            </div>
          ` : ''}
          <div style="margin-top:0.75rem;display:flex;gap:0.5rem">
            <a href="${currentJob.tts_audio_url}" download="tts_typecast.mp3" class="btn-secondary">
              <i class="fas fa-download"></i> 다운로드
            </a>
            <button class="btn-secondary" id="btnRegenTTS">
              <i class="fas fa-redo"></i> 재생성
            </button>
          </div>
        ` : `
          <div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.82rem">
            ${hasScript
              ? '<i class="fas fa-microphone" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;opacity:0.3"></i>TTS 생성 버튼을 클릭하면<br>성우 목소리로 변환됩니다'
              : '<i class="fas fa-file-alt" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;opacity:0.3"></i>먼저 대본을 생성해주세요'}
          </div>
        `}
      </div>

      <!-- n8n 워크플로우 안내 -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">
          <i class="fas fa-sitemap" style="color:var(--accent-light)"></i>
          n8n 자동화 파이프라인
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          ${[
            { icon: '🔗', label: 'URL 수신', desc: 'Webhook 트리거', done: !!currentJob },
            { icon: '📥', label: '영상 다운로드', desc: 'yt-dlp / API 추출', done: false },
            { icon: '✂️', label: '자막 제거', desc: 'OpenCV + LaMa 인페인팅', done: false },
            { icon: '🎙️', label: '음성·자막 합성', desc: 'FFmpeg 렌더링', done: false },
            { icon: '📤', label: '완성 알림', desc: '다운로드 링크 제공', done: false }
          ].map(step => `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;background:var(--bg-secondary);border-radius:6px;border:1px solid ${step.done ? 'rgba(16,185,129,0.3)' : 'var(--border)'}">
              <span style="font-size:1rem">${step.icon}</span>
              <div style="flex:1">
                <div style="font-size:0.78rem;font-weight:600;color:${step.done ? '#10b981' : 'var(--text-primary)'}">${step.label}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${step.desc}</div>
              </div>
              ${step.done ? '<i class="fas fa-check-circle" style="color:#10b981;font-size:0.85rem"></i>' : ''}
            </div>
          `).join('')}
        </div>
        ${currentJob ? `
          <div style="margin-top:0.75rem;padding:0.6rem 0.75rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:6px;font-size:0.72rem;color:var(--accent-light)">
            <i class="fas fa-info-circle"></i> Job ID: <code>${currentJob.job_id}</code>
          </div>
        ` : ''}
      </div>
    `
  },

  getHistoryTabHTML() {
    const { jobs, personas } = this.state
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

    // 생성 버튼
    const btnGen = document.getElementById('btnGenerate')
    if (btnGen) {
      btnGen.addEventListener('click', () => this.generateScript())
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

    // TTS 재생성
    const btnRegenTTS = document.getElementById('btnRegenTTS')
    if (btnRegenTTS) {
      btnRegenTTS.addEventListener('click', () => this.generateTTS())
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

  // ── 대본 생성 ─────────────────────────────────────────────────
  async generateScript() {
    const { form } = this.state
    if (!form.source_url.trim()) {
      this.showToast('소스 URL을 입력해주세요.', 'error'); return
    }
    if (!form.persona_id) {
      this.showToast('페르소나를 선택해주세요.', 'error'); return
    }

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
        value_keywords: form.value_keywords
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

        this.showToast('대본이 생성되었습니다! ✨', 'success')
        this.state.activeTab = 'workspace'
      } else {
        this.showToast(res.data.error || '생성 실패', 'error')
      }
    } catch (e) {
      this.showToast('서버 오류: ' + (e.response?.data?.error || e.message), 'error')
    } finally {
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

  // ── TTS 생성 (Typecast) ───────────────────────────────────────
  async generateTTS() {
    if (!this.state.currentJob?.job_id) {
      this.showToast('먼저 대본을 생성해주세요.', 'error'); return
    }
    if (!this.state.settings.has_typecast) {
      this.showToast('Typecast API 키가 필요합니다. Deploy 탭에서 설정하세요.', 'error'); return
    }

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
        const hint = res.data.hint ? `\n힌트: ${res.data.hint}` : ''
        this.showToast((res.data.error || 'TTS 생성 실패') + hint, 'error')
      }
    } catch (e) {
      this.showToast('TTS 오류: ' + (e.response?.data?.error || e.message), 'error')
    } finally {
      this.state.isGeneratingTTS = false
      this.rerender()
    }
  },

  // ── 브라우저 TTS (API 없을 때 미리듣기) ─────────────────────
  browserTTS() {
    if (!this.state.currentJob?.script_content) return
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
      this.rerender()
    } catch (e) {}
  },

  // ── 유틸리티 ─────────────────────────────────────────────────
  showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer')
    if (!container) return
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    const icons = { success: '✅', error: '❌', info: 'ℹ️' }
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`
    container.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  },

  escHtml(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  },

  getStatusLabel(status) {
    const labels = {
      pending: '대기 중',
      script_ready: '대본 완료',
      tts_ready: 'TTS 완료',
      complete: '완성',
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
  }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => App.init())
