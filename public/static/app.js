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
    activeTab: 'workspace',       // workspace | history | preview
    editingScript: false,
    currentAudio: null,
    playbackSpeed: 1.0,           // 오디오 재생 속도
    subtitleColor: '#ffffff',     // 자막 글자색
    subtitleBgBar: true           // 자막 배경 바
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

        <!-- STEP 5: TTS 성우 + 감정 선택 + 미리듣기 -->
        <section class="section">
          <div class="section-title">
            <span class="step-badge">5</span>
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

          <!-- TTS 속도 슬라이더 -->
          <div style="margin-top:0.85rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">
              <span style="font-size:0.72rem;color:var(--text-muted)">TTS 생성 속도</span>
              <span id="speedLabel" style="font-size:0.75rem;font-weight:700;color:var(--accent-light)">${form.tts_speed.toFixed(2)}×</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-size:0.65rem;color:var(--text-muted)">0.5×</span>
              <input type="range" id="ttsSpeedSlider"
                min="0.5" max="2.0" step="0.05" value="${form.tts_speed}"
                style="flex:1;accent-color:#7c3aed;height:4px">
              <span style="font-size:0.65rem;color:var(--text-muted)">2.0×</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.63rem;color:var(--text-muted);margin-top:0.25rem">
              <span>느리게 (명확)</span>
              <span style="color:var(--accent-light)">${form.tts_speed.toFixed(2)}×</span>
              <span>빠르게 (짧게)</span>
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

    const hasScript = !!currentJob?.script_content
    const hasTTS    = !!currentJob?.tts_audio_url
    const hasVideo  = !!currentJob?.output_video_url
    const charCount = hasScript ? currentJob.script_content.length : 0
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
            <button class="btn-accent" disabled style="font-size:0.78rem;padding:0.4rem 0.9rem;opacity:0.7">
              <span class="spinner" style="width:12px;height:12px;border-width:2px"></span> 생성 중...
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
          <!-- 완성된 영상 다운로드 -->
          <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:1rem;text-align:center;margin-bottom:0.75rem">
            <div style="font-size:2rem;margin-bottom:0.5rem">🎬</div>
            <div style="font-size:0.85rem;font-weight:700;color:#10b981;margin-bottom:0.3rem">자막 합성 영상 완성!</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem">TTS 음성 + 자막이 합성된 MP4 영상입니다</div>
            <a href="${currentJob.output_video_url}" download="aistudio_output.mp4" 
              style="display:inline-flex;align-items:center;gap:0.4rem;background:#10b981;color:white;padding:0.55rem 1.2rem;border-radius:8px;text-decoration:none;font-size:0.82rem;font-weight:700">
              <i class="fas fa-download"></i> MP4 다운로드
            </a>
          </div>
          <button onclick="App.startVideoSynthesis()" class="btn-secondary" style="width:100%;justify-content:center">
            <i class="fas fa-redo"></i> 다시 합성
          </button>
        ` : hasTTS ? `
          <!-- 합성 준비 완료 or 합성 중 -->
          ${isRendering ? `
            <div id="renderingProgress" style="background:rgba(251,146,60,0.05);border:1px solid rgba(251,146,60,0.2);border-radius:10px;padding:1rem">
              <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
                <span class="spinner" style="width:18px;height:18px;border-color:rgba(251,146,60,0.3);border-top-color:#fb923c"></span>
                <div>
                  <div style="font-size:0.82rem;font-weight:700;color:#fb923c">자막 합성 렌더링 중...</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)" id="renderStatusText">준비 중...</div>
                </div>
                <div style="margin-left:auto;font-size:0.85rem;font-weight:700;color:#fb923c" id="renderPct">0%</div>
              </div>
              <div style="height:6px;background:var(--bg-secondary);border-radius:99px;overflow:hidden">
                <div id="renderProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#f97316,#fb923c);border-radius:99px;transition:width 0.4s ease"></div>
              </div>
              <div style="margin-top:0.6rem;font-size:0.68rem;color:var(--text-muted);text-align:center">브라우저에서 직접 렌더링 중 — 탭을 닫지 마세요</div>
            </div>
          ` : `
            <div style="text-align:center;padding:1rem">
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem">
                <i class="fas fa-check-circle" style="color:#a78bfa;margin-right:6px"></i>
                TTS 음성 준비 완료 — 자막 합성을 시작할 수 있어요
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:1rem">
                대본 텍스트 → 자막 오버레이 + TTS 오디오가 합성된 영상이 생성됩니다
              </div>

              <!-- 자막 설정 -->
              <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.75rem;margin-bottom:0.85rem;text-align:left">
                <div style="font-size:0.75rem;font-weight:600;color:var(--text-primary);margin-bottom:0.6rem">
                  <i class="fas fa-closed-captioning" style="color:var(--accent-light);margin-right:5px"></i>자막 설정
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
                  <div>
                    <label style="font-size:0.68rem;color:var(--text-muted)">글자 크기</label>
                    <select id="subtitleFontSize" style="width:100%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem;border-radius:4px;font-size:0.72rem;margin-top:0.2rem">
                      <option value="28">작게 (28px)</option>
                      <option value="36" selected>보통 (36px)</option>
                      <option value="44">크게 (44px)</option>
                      <option value="52">매우 크게 (52px)</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size:0.68rem;color:var(--text-muted)">자막 위치</label>
                    <select id="subtitlePosition" style="width:100%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem;border-radius:4px;font-size:0.72rem;margin-top:0.2rem">
                      <option value="bottom" selected>하단 (권장)</option>
                      <option value="middle">중앙</option>
                      <option value="top">상단</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size:0.68rem;color:var(--text-muted)">글자 색상</label>
                    <div style="display:flex;gap:0.3rem;margin-top:0.3rem">
                      ${['#ffffff','#ffff00','#00ff99','#ff6b6b','#a78bfa'].map(c=>`
                        <div onclick="App.state.subtitleColor='${c}';this.parentNode.querySelectorAll('div').forEach(d=>d.style.outline='none');this.style.outline='2px solid #7c3aed'"
                          style="width:20px;height:20px;background:${c};border-radius:3px;cursor:pointer;border:1px solid var(--border);outline:${(state.subtitleColor??'#ffffff')===c?'2px solid #7c3aed':'none'}"></div>
                      `).join('')}
                    </div>
                  </div>
                  <div>
                    <label style="font-size:0.68rem;color:var(--text-muted)">배경 바</label>
                    <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.3rem">
                      <input type="checkbox" id="subtitleBgBar" ${state.subtitleBgBar!==false?'checked':''} style="accent-color:#7c3aed">
                      <span style="font-size:0.7rem;color:var(--text-secondary)">반투명 배경 바</span>
                    </div>
                  </div>
                </div>
              </div>

              <button onclick="App.startVideoSynthesis()" class="btn-generate" style="font-size:0.85rem;padding:0.7rem 1.5rem">
                <i class="fas fa-film"></i> 자막+TTS 영상 합성 시작
              </button>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:0.4rem">
                브라우저에서 직접 렌더링 · 약 20~40초 소요
              </div>
            </div>
          `}
        ` : `
          <!-- TTS 없음 -->
          <div style="text-align:center;padding:1.25rem;color:var(--text-muted);font-size:0.82rem">
            <div style="font-size:2rem;margin-bottom:0.5rem;opacity:0.3">🎬</div>
            <div>TTS 음성을 먼저 생성해주세요</div>
            <div style="font-size:0.72rem;margin-top:0.3rem">대본 생성 → TTS 생성 → 영상 합성 순서로 진행합니다</div>
          </div>
        `}
      </div>

      <!-- 숨겨진 캔버스 (렌더링용) -->
      <canvas id="synthCanvas" style="display:none"></canvas>
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
      this.showToast('미리듣기 오류: ' + (e.response?.data?.error || e.message), 'error')
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
      this.showToast('미리듣기 오류: ' + (e.response?.data?.error || e.message), 'error')
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

  // ── 영상 합성 (Canvas + MediaRecorder) ───────────────────────
  async startVideoSynthesis() {
    if (!this.state.currentJob?.tts_audio_url) {
      this.showToast('TTS 음성을 먼저 생성해주세요.', 'error'); return
    }
    if (!this.state.currentJob?.script_content) {
      this.showToast('대본이 없습니다.', 'error'); return
    }

    this.state.isRendering = true
    this.rerender()

    // 진행 단계 서버에 알림
    try {
      await axios.patch(`/api/jobs/${this.state.currentJob.job_id}/stage`, {
        stage: 'rendering', status: 'rendering'
      })
    } catch(e) {}

    try {
      const videoUrl = await this._renderSubtitleVideo()
      this.state.currentJob.output_video_url = videoUrl
      this.state.currentJob._videoIsMP4 = true  // mp4 변환 완료 플래그
      this.state.currentJob.stage = 'complete'
      this.state.currentJob.status = 'complete'

      // 서버에 완료 보고
      try {
        await axios.post(`/api/jobs/${this.state.currentJob.job_id}/synthesis-complete`, {
          output_video_url: videoUrl
        })
      } catch(e) {}

      this.showToast('🎬 영상 합성 완료! 다운로드 버튼을 클릭하세요.', 'success')
    } catch(e) {
      this.showToast('렌더링 오류: ' + e.message, 'error')
      console.error(e)
    } finally {
      this.state.isRendering = false
      this.rerender()
    }
  },

  // ── 내부: Canvas+MediaRecorder로 자막+TTS 합성 → mp4 출력 ──────
  async _renderSubtitleVideo() {
    const job     = this.state.currentJob
    const script  = job.script_content || ''
    const audioSrc = job.tts_audio_url

    // 설정 읽기
    const fontSize    = parseInt(document.getElementById('subtitleFontSize')?.value || '36')
    const position    = document.getElementById('subtitlePosition')?.value || 'bottom'
    const fontColor   = this.state.subtitleColor || '#ffffff'
    const bgCheck = document.getElementById('subtitleBgBar')
    const hasBgBar = bgCheck ? bgCheck.checked : true

    // 캔버스 설정 (9:16 세로 비율, 720×1280)
    const W = 720, H = 1280
    const canvas = document.getElementById('synthCanvas')
    canvas.width  = W
    canvas.height = H
    canvas.style.display = 'none'
    const ctx = canvas.getContext('2d')

    // 오디오 로드
    const audio = new Audio(audioSrc)
    audio.crossOrigin = 'anonymous'
    audio.playbackRate = this.state.playbackSpeed || 1.0
    await new Promise((res, rej) => {
      audio.onloadedmetadata = res
      audio.onerror = rej
      audio.load()
    })
    const duration = audio.duration || 20

    // 대본을 줄 단위로 쪼개고 타이밍 계산
    const lines = script.split('\n').map(l=>l.trim()).filter(l=>l.length > 0)
    const timePerLine = duration / Math.max(lines.length, 1)

    // MediaRecorder 설정 (webm으로 녹화 후 ffmpeg으로 mp4 변환)
    const stream = canvas.captureStream(30)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source   = audioCtx.createMediaElementSource(audio)
    const dest     = audioCtx.createMediaStreamDestination()
    source.connect(dest)
    source.connect(audioCtx.destination)
    stream.addTrack(dest.stream.getAudioTracks()[0])

    // 브라우저 지원 webm mimeType 선택
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 })
    const chunks   = []
    recorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data) }

    // 진행 업데이트 헬퍼
    const setProgress = (pct, msg) => {
      const bar = document.getElementById('renderProgressBar')
      const pctEl = document.getElementById('renderPct')
      const txt = document.getElementById('renderStatusText')
      if (bar) bar.style.width = pct + '%'
      if (pctEl) pctEl.textContent = Math.round(pct) + '%'
      if (txt) txt.textContent = msg || ''
    }

    // 렌더링 시작
    recorder.start(100)
    audio.currentTime = 0
    audio.play()
    setProgress(5, '음성 재생 시작...')

    let animFrame
    const startTime = performance.now()

    const drawFrame = () => {
      const elapsed = (performance.now() - startTime) / 1000
      const pct = Math.min(elapsed / duration * 100 * 0.6, 60)  // 0~60%는 녹화 단계
      setProgress(pct, `녹화 중... (${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s)`)

      // 배경 (그라데이션)
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#0f0a1e')
      grad.addColorStop(1, '#1a0a2e')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // 브랜드 워터마크
      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = 'rgba(167,139,250,0.3)'
      ctx.textAlign = 'center'
      ctx.fillText('AI Studio', W/2, 40)

      // 파형 시각화 (데코레이션)
      const barCount = 40
      for (let i = 0; i < barCount; i++) {
        const x = (W / barCount) * i + W / barCount / 2
        const h = 20 + Math.sin(elapsed * 3 + i * 0.5) * 15 + Math.random() * 10
        ctx.fillStyle = `rgba(124,58,237,${0.15 + Math.sin(elapsed + i) * 0.1})`
        ctx.fillRect(x - 4, H/2 - h/2, 8, h)
      }

      // 현재 자막 라인 결정
      const lineIdx = Math.min(Math.floor(elapsed / timePerLine), lines.length - 1)
      const currentLine = lines[Math.max(0, lineIdx)] || ''

      if (currentLine) {
        ctx.font = `bold ${fontSize}px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`
        ctx.textAlign = 'center'
        const textWidth = ctx.measureText(currentLine).width

        // 자막 Y 위치
        const yPos = position === 'top' ? 120
          : position === 'middle' ? H/2
          : H - 120

        // 배경 바
        if (hasBgBar) {
          ctx.fillStyle = 'rgba(0,0,0,0.65)'
          const pad = 20
          const barH = fontSize + 28
          ctx.roundRect
            ? ctx.roundRect(W/2 - textWidth/2 - pad, yPos - fontSize - 4, textWidth + pad*2, barH, 8)
            : ctx.fillRect(W/2 - textWidth/2 - pad, yPos - fontSize - 4, textWidth + pad*2, barH)
          ctx.fill()
        }

        // 테두리 (stroke)
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'
        ctx.lineWidth = 3
        ctx.strokeText(currentLine, W/2, yPos)

        // 자막 텍스트
        ctx.fillStyle = fontColor
        ctx.fillText(currentLine, W/2, yPos)
      }

      // 타임 표시
      ctx.font = '18px monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.textAlign = 'right'
      ctx.fillText(`${elapsed.toFixed(1)}s`, W - 20, H - 20)

      if (elapsed < duration + 0.3) {
        animFrame = requestAnimationFrame(drawFrame)
      }
    }

    animFrame = requestAnimationFrame(drawFrame)

    // 오디오 끝날 때까지 대기
    await new Promise(res => {
      audio.onended = res
      setTimeout(res, (duration + 1) * 1000)
    })

    cancelAnimationFrame(animFrame)
    setProgress(65, 'webm 녹화 완료, mp4 변환 중...')
    recorder.stop()

    await new Promise(res => { recorder.onstop = res })
    audio.pause()
    audioCtx.close()

    // ── webm Blob 생성 ──────────────────────────────────────────
    const webmBlob = new Blob(chunks, { type: mimeType })

    // ── FFmpeg.wasm으로 mp4 변환 ────────────────────────────────
    try {
      setProgress(70, 'MP4 변환 준비 중...')

      // FFmpeg 로드 확인
      const { FFmpeg } = window.FFmpegWASM || {}
      const { fetchFile } = window.FFmpegUtil || {}

      if (!FFmpeg || !fetchFile) {
        // FFmpeg 로드 실패 시 webm 그대로 다운로드 (fallback)
        console.warn('FFmpeg.wasm 로드 실패 → webm fallback')
        setProgress(100, '완료! (webm 형식)')
        return URL.createObjectURL(webmBlob)
      }

      const ffmpeg = new FFmpeg()

      // 진행 콜백
      ffmpeg.on('progress', ({ progress }) => {
        const pct = 70 + progress * 28
        setProgress(pct, `MP4 변환 중... ${Math.round(progress * 100)}%`)
      })
      ffmpeg.on('log', ({ message }) => {
        console.log('[ffmpeg]', message)
      })

      // FFmpeg Core wasm 로드 (CDN)
      setProgress(72, 'FFmpeg 코어 로드 중...')
      await ffmpeg.load({
        coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      })

      setProgress(78, '영상 데이터 전달 중...')
      // webm 파일을 ffmpeg 가상 파일시스템에 쓰기
      const webmData = await fetchFile(webmBlob)
      await ffmpeg.writeFile('input.webm', webmData)

      setProgress(82, 'MP4 인코딩 중... (잠시 기다려 주세요)')
      // webm → mp4 변환 (재인코딩 없이 컨테이너 변환 → 빠름)
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'copy',      // 비디오 스트림 복사 (재인코딩 없음 → 빠름)
        '-c:a', 'aac',       // 오디오 AAC 인코딩 (mp4 호환)
        '-movflags', '+faststart',  // 웹 스트리밍 최적화
        'output.mp4'
      ])

      setProgress(96, '파일 생성 중...')
      const mp4Data = await ffmpeg.readFile('output.mp4')
      const mp4Blob = new Blob([mp4Data.buffer], { type: 'video/mp4' })

      // 정리
      await ffmpeg.deleteFile('input.webm')
      await ffmpeg.deleteFile('output.mp4')

      setProgress(100, '완료! MP4 다운로드 준비됨')
      return URL.createObjectURL(mp4Blob)

    } catch (ffmpegErr) {
      // FFmpeg 변환 실패 시 webm fallback
      console.error('FFmpeg 변환 실패:', ffmpegErr)
      setProgress(100, '완료! (webm 형식 — mp4 변환 실패)')
      this.showToast('MP4 변환 중 오류가 발생해 webm으로 저장합니다.', 'error')
      return URL.createObjectURL(webmBlob)
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
  }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => App.init())
