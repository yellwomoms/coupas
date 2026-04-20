import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  OPENAI_API_KEY: string
  TYPECAST_API_KEY: string
  N8N_WEBHOOK_URL: string
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

// ─────────────────────────────────────────
// 🚀 초기화 통합 API (페이지 로드 최적화)
// personas + subtitle-presets + tts-voices + settings + production-presets + jobs
// D1 batch()로 단일 왕복에 모든 데이터 조회 → 로딩 시간 대폭 단축
// ─────────────────────────────────────────
apiRoutes.get('/init', async (c) => {
  try {
    // jobs를 제외하고 핵심 설정 데이터만 batch로 빠르게 조회
    // (jobs는 히스토리 탭 클릭 시 별도 lazy load)
    const [personasR, presetsR, voicesR, prodPresetsR] = await c.env.DB.batch([
      c.env.DB.prepare('SELECT * FROM personas ORDER BY id'),
      c.env.DB.prepare('SELECT * FROM subtitle_presets ORDER BY id'),
      c.env.DB.prepare('SELECT * FROM tts_voices ORDER BY id'),
      c.env.DB.prepare('SELECT * FROM production_presets ORDER BY is_default DESC, id ASC'),
    ])
    return c.json({
      ok: true,
      data: {
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
    })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

apiRoutes.get('/personas', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM personas ORDER BY id'
    ).all()
    return c.json({ ok: true, data: results })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 자막 프리셋 목록 조회
// ─────────────────────────────────────────
apiRoutes.get('/subtitle-presets', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM subtitle_presets ORDER BY id'
    ).all()
    return c.json({ ok: true, data: results })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// TTS 보이스 목록 조회
// ─────────────────────────────────────────
apiRoutes.get('/tts-voices', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM tts_voices ORDER BY id'
    ).all()
    return c.json({ ok: true, data: results })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// Typecast 보이스 목록 API (동적 조회)
// ─────────────────────────────────────────
apiRoutes.get('/typecast-voices', async (c) => {
  const apiKey = c.env.TYPECAST_API_KEY
  if (!apiKey) {
    // API 키 없을 때 기본 한국어 보이스 목록 반환
    return c.json({
      ok: true,
      demo: true,
      data: TYPECAST_PRESET_VOICES
    })
  }

  try {
    const res = await fetch('https://api.typecast.ai/v2/voices?lang=kor', {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!res.ok) {
      return c.json({ ok: true, demo: true, data: TYPECAST_PRESET_VOICES })
    }

    const rawData = await res.json() as any
    // Typecast v2 API는 배열을 직접 반환
    const voiceList = Array.isArray(rawData) ? rawData : (rawData.voices || rawData.result || [])
    
    // ssfm-v30 지원하는 목소리만 필터링 + UI용 포맷으로 변환
    const formatted = voiceList
      .filter((v: any) => {
        const models = v.models || []
        return models.some((m: any) => m.version === 'ssfm-v30')
      })
      .map((v: any) => {
        const v30model = (v.models || []).find((m: any) => m.version === 'ssfm-v30')
        const emotions = v30model?.emotions || ['normal', 'happy', 'sad']
        return {
          voice_id: v.voice_id,
          name: v.voice_name || v.name || v.voice_id,
          gender: v.gender || 'female',
          age: v.age || 'young_adult',
          persona: v.gender === 'male' ? 'dad' : 'mom',
          description: `${v.gender === 'female' ? '여성' : '남성'} ${v.age === 'middle_age' ? '중년' : '20-30대'}`,
          emotions,
          tags: v.use_cases || [],
          recommended_for: []
        }
      })
    
    return c.json({ ok: true, data: formatted.length > 0 ? formatted : TYPECAST_PRESET_VOICES })
  } catch (e: any) {
    return c.json({ ok: true, demo: true, data: TYPECAST_PRESET_VOICES })
  }
})

// ─────────────────────────────────────────
// 새 작업 생성 (대본 생성 + n8n 트리거)
// ─────────────────────────────────────────
apiRoutes.post('/jobs', async (c) => {
  try {
    const body = await c.req.json()
    const {
      source_url,
      platform = 'douyin',
      context_text = '',
      persona_id,
      subtitle_preset_id,
      tts_voice_id,
      value_keywords = [],
      product_number = ''   // ✅ 제품번호 (CTA용)
    } = body

    if (!source_url) {
      return c.json({ ok: false, error: '소스 URL이 필요합니다.' }, 400)
    }
    if (!persona_id) {
      return c.json({ ok: false, error: '페르소나를 선택해주세요.' }, 400)
    }

    // 고유 job_id 생성
    const job_id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // DB에 작업 저장 (product_number 포함)
    await c.env.DB.prepare(`
      INSERT INTO jobs (job_id, source_url, platform, context_text, persona_id, subtitle_preset_id, tts_voice_id, value_keywords, product_number, status, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'waiting')
    `).bind(
      job_id,
      source_url,
      platform,
      context_text,
      persona_id,
      subtitle_preset_id || 1,
      tts_voice_id || 1,
      JSON.stringify(value_keywords),
      product_number
    ).run()

    // n8n 웹훅 트리거 (설정된 경우)
    const n8nUrl = c.env.N8N_WEBHOOK_URL
    if (n8nUrl) {
      try {
        await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id, source_url, platform, persona_id })
        })
      } catch (webhookErr) {
        console.error('n8n webhook failed:', webhookErr)
      }
    }

    // 페르소나 정보 조회
    const persona = await c.env.DB.prepare(
      'SELECT * FROM personas WHERE id = ?'
    ).bind(persona_id).first()

    // 대본 생성 (OpenAI API)
    let script_content = ''
    if (c.env.OPENAI_API_KEY && persona) {
      script_content = await generateScript(
        c.env.OPENAI_API_KEY,
        persona as any,
        context_text,
        value_keywords,
        source_url,
        false,
        product_number  // ✅ 제품번호 전달
      )
      // 대본 저장
      await c.env.DB.prepare(`
        UPDATE jobs SET script_content = ?, status = 'script_ready', stage = 'script_done', updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(script_content, job_id).run()

      await c.env.DB.prepare(`
        INSERT INTO script_history (job_id, version, script_content, persona_id, is_selected)
        VALUES (?, 1, ?, ?, 1)
      `).bind(job_id, script_content, persona_id).run()
    } else {
      // API 키 없을 경우 샘플 대본 생성
      script_content = generateSampleScript(persona as any, value_keywords, product_number)
      await c.env.DB.prepare(`
        UPDATE jobs SET script_content = ?, status = 'script_ready', stage = 'script_done', updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(script_content, job_id).run()
    }

    return c.json({
      ok: true,
      data: { job_id, status: 'script_ready', script: script_content }
    })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 작업 상태 조회
// ─────────────────────────────────────────
apiRoutes.get('/jobs/:job_id', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE job_id = ?'
    ).bind(job_id).first()

    if (!job) {
      return c.json({ ok: false, error: '작업을 찾을 수 없습니다.' }, 404)
    }
    return c.json({ ok: true, data: job })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 작업 목록 조회 (히스토리)
// ─────────────────────────────────────────
apiRoutes.get('/jobs', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT j.*, p.label as persona_label, p.icon as persona_icon, p.name as persona_name
      FROM jobs j
      LEFT JOIN personas p ON j.persona_id = p.id
      ORDER BY j.created_at DESC
      LIMIT 50
    `).all()
    return c.json({ ok: true, data: results })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 대본 재생성 (다른 버전)
// ─────────────────────────────────────────
apiRoutes.post('/jobs/:job_id/regenerate-script', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE job_id = ?'
    ).bind(job_id).first() as any

    if (!job) return c.json({ ok: false, error: '작업 없음' }, 404)

    const persona = await c.env.DB.prepare(
      'SELECT * FROM personas WHERE id = ?'
    ).bind(job.persona_id).first() as any

    const value_keywords = JSON.parse(job.value_keywords || '[]')
    const product_number = job.product_number || ''  // ✅ DB에서 제품번호 읽기
    let new_script = ''

    if (c.env.OPENAI_API_KEY && persona) {
      new_script = await generateScript(
        c.env.OPENAI_API_KEY,
        persona,
        job.context_text || '',
        value_keywords,
        job.source_url,
        true, // regenerate flag
        product_number  // ✅ 제품번호 전달
      )
    } else {
      new_script = generateSampleScript(persona, value_keywords, product_number)
    }

    // 버전 카운트
    const versionResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM script_history WHERE job_id = ?'
    ).bind(job_id).first() as any
    const version = (versionResult?.cnt || 0) + 1

    await c.env.DB.prepare(`
      INSERT INTO script_history (job_id, version, script_content, persona_id, is_selected)
      VALUES (?, ?, ?, ?, 1)
    `).bind(job_id, version, new_script, job.persona_id).run()

    await c.env.DB.prepare(`
      UPDATE jobs SET script_content = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?
    `).bind(new_script, job_id).run()

    return c.json({ ok: true, data: { script: new_script, version } })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 성우 미리듣기 TTS (짧은 샘플 텍스트)
// ─────────────────────────────────────────
apiRoutes.post('/tts-preview', async (c) => {
  try {
    const { voice_id, emotion_type = 'smart', speed = 1.0, sample_text } = await c.req.json()

    const apiKey = c.env.TYPECAST_API_KEY
    if (!apiKey) {
      return c.json({ ok: false, error: 'Typecast API 키가 없습니다.' }, 400)
    }
    if (!voice_id) {
      return c.json({ ok: false, error: 'voice_id가 필요합니다.' }, 400)
    }

    // 샘플 텍스트 (미입력 시 기본값)
    const rawText = (sample_text || '안녕하세요! 저는 이 목소리로 쇼츠 대본을 읽어드릴 거예요. 잘 부탁드립니다!').trim()
    const audioTempo = Math.max(0.5, Math.min(2.0, speed))

    // ── 첫 글자 잘림 방지 ──────────────────────────────────────────
    // previous_text를 충분히 긴 문장으로 + 본문 앞 패딩 추가
    const emotionContextMap: Record<string, string> = {
      'smart':    '네, 안녕하세요. 오늘도 좋은 하루 보내고 계신가요?',
      'normal':   '네, 안녕하세요. 오늘도 좋은 하루 보내고 계신가요?',
      'happy':    '와, 정말 기쁜 소식이에요! 여러분 너무 설레지 않나요? 저는 너무 좋아요!',
      'toneup':   '와! 이거 진짜 대박이에요! 여러분 꼭 보셔야 해요! 놓치면 후회해요!',
      'sad':      '사실 저도 많이 힘들었어요. 그 마음 너무 공감이 가더라고요. 속상하셨겠어요.',
      'whisper':  '잠깐, 이거 정말 중요한 얘기예요. 아무한테도 말하지 마세요.',
      'tonedown': '오늘은 중요한 내용을 말씀드리려 합니다. 잘 들어주시기 바랍니다.',
      'angry':    '이건 정말 놓치면 안 돼요! 꼭 보세요! 진짜 중요합니다!'
    }
    const prevText = emotionContextMap[emotion_type] || emotionContextMap['smart']
    // 본문 앞 패딩 추가
    const paddedText = '음. ' + rawText

    // Typecast v1 ssfm-v30: 항상 smart 모드 사용 (preset은 previous_text 불가)
    const payload: any = {
      voice_id,
      text: paddedText,
      model: 'ssfm-v30',
      language: 'kor',
      prompt: {
        emotion_type: 'smart',
        previous_text: prevText   // 감정 맥락 + 첫 음절 클리핑 방지
      },
      output: {
        volume: 100,
        audio_pitch: 0,
        audio_tempo: audioTempo,
        audio_format: 'mp3'
      }
    }

    const res = await fetch('https://api.typecast.ai/v1/text-to-speech', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `Typecast 오류 (${res.status})`
      try { const j = JSON.parse(errText); errMsg = j.message || j.error || errMsg } catch {}
      return c.json({ ok: false, error: errMsg }, 500)
    }

    // base64 변환 (청크 분할)
    const buf  = await res.arrayBuffer()
    const u8   = new Uint8Array(buf)
    let binary = ''
    const CHUNK = 8192
    for (let i = 0; i < u8.length; i += CHUNK) {
      binary += String.fromCharCode(...u8.subarray(i, i + CHUNK))
    }
    const audioDataUrl = `data:audio/mpeg;base64,${btoa(binary)}`

    return c.json({ ok: true, data: { audio_url: audioDataUrl, voice_id, emotion: emotion_type } })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// TTS 생성 (Typecast)
// ─────────────────────────────────────────
apiRoutes.post('/jobs/:job_id/generate-tts', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const {
      voice_id,
      speed = 1.0,
      emotion_type = 'smart',  // Typecast 감정: smart | normal | happy | sad | angry | whisper | toneup | tonedown
      audio_pitch = 0,
      audio_format = 'mp3'
    } = await c.req.json()

    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE job_id = ?'
    ).bind(job_id).first() as any

    if (!job || !job.script_content) {
      return c.json({ ok: false, error: '대본이 없습니다. 먼저 대본을 생성해주세요.' }, 400)
    }

    // Typecast API 키 확인
    const apiKey = c.env.TYPECAST_API_KEY
    if (!apiKey) {
      return c.json({
        ok: false,
        error: 'Typecast API 키가 설정되지 않았습니다.',
        hint: 'npx wrangler pages secret put TYPECAST_API_KEY --project-name aistudio',
        demo: true
      }, 400)
    }

    // DB에서 TTS 보이스 정보 조회
    const ttsVoice = await c.env.DB.prepare(
      'SELECT * FROM tts_voices WHERE id = ?'
    ).bind(job.tts_voice_id).first() as any

    // voice_id 결정: 요청값 > DB 저장값 > 실제 Typecast 기본 보이스
    // 주의: 'tc_jh001_kor' 같은 프리셋 ID는 실제 Typecast API에서 무효 → 실제 ID 사용
    const DEFAULT_VOICE_ID = 'tc_68f9c6a72f0f04a417bb136f'  // Moonjung (문정)
    // 프런트에서 숫자(DB id)로 넘어오면 해당 보이스의 Typecast ID로 변환
    let actualVoiceId: string
    if (voice_id && typeof voice_id === 'number') {
      // 숫자 id → DB에서 Typecast voice_id 조회
      const voiceById = await c.env.DB.prepare(
        'SELECT voice_id FROM tts_voices WHERE id = ?'
      ).bind(voice_id).first() as any
      actualVoiceId = voiceById?.voice_id || ttsVoice?.voice_id || DEFAULT_VOICE_ID
    } else if (voice_id && typeof voice_id === 'string' && voice_id.startsWith('tc_')) {
      // 이미 Typecast ID 형식
      actualVoiceId = voice_id
    } else {
      // DB에 저장된 보이스 사용
      actualVoiceId = ttsVoice?.voice_id || DEFAULT_VOICE_ID
    }

    // 페르소나에 맞는 감정 자동 추론
    const inferredEmotion = emotion_type === 'auto' || emotion_type === 'smart'
      ? inferEmotionFromScript(job.script_content, ttsVoice?.persona_name)
      : emotion_type   // 'normal' | 'happy' | 'sad' | 'angry' | 'whisper' | 'toneup' | 'tonedown'

    // ── Typecast v1 ssfm-v30 API 규칙 ─────────────────────────────
    // emotion_type은 'smart' | 'preset' | 'embedding' 만 지원
    //   - smart: previous_text, next_text로 맥락 제공 → 항상 이 모드 사용
    //   - preset: previous_text 불가, emotion 별도 구조 필요 → 사용 안 함
    //   - embedding: emotion_vector 필요 → 사용 안 함
    // 감정 반영: previous_text에 감정 맥락 문장을 넣어 smart 모드에서 자연스럽게 적용

    // audio_tempo: 0.5~2.0 범위 (Typecast 지원 범위)
    const audioTempo = Math.max(0.5, Math.min(2.0, speed))

    const rawText = job.script_content.trim()

    // ── 첫 글자 잘림 방지 ──────────────────────────────────────────
    // Typecast ssfm-v30: previous_text가 짧으면 한국어 첫 음절이 묵음 처리됨
    // 해결책: ① previous_text를 충분히 긴 문장으로 ② 본문 앞에 무음 패딩 추가
    const emotionContextMap: Record<string, string> = {
      'smart':    '네, 안녕하세요. 오늘도 좋은 하루 보내고 계신가요?',
      'normal':   '네, 안녕하세요. 오늘도 좋은 하루 보내고 계신가요?',
      'happy':    '와, 정말 기쁜 소식이에요! 여러분 너무 설레지 않나요? 저는 너무 좋아요!',
      'toneup':   '와! 이거 진짜 대박이에요! 여러분 꼭 보셔야 해요! 놓치면 후회해요!',
      'sad':      '사실 저도 많이 힘들었어요. 그 마음 너무 공감이 가더라고요. 속상하셨겠어요.',
      'whisper':  '잠깐, 이거 정말 중요한 얘기예요. 아무한테도 말하지 마세요.',
      'tonedown': '오늘은 중요한 내용을 말씀드리려 합니다. 잘 들어주시기 바랍니다.',
      'angry':    '이건 정말 놓치면 안 돼요! 꼭 보세요! 진짜 중요합니다!'
    }
    const prevText = emotionContextMap[emotion_type] || emotionContextMap['smart']
    // 본문 앞에 무음 패딩 추가 (첫 음절 클리핑 방지)
    const paddedText = '음. ' + rawText

    // ── Typecast TTS API 페이로드 (항상 smart 모드) ────────────────
    const ttsPayload: any = {
      voice_id: actualVoiceId,
      text: paddedText,
      model: 'ssfm-v30',
      language: 'kor',
      prompt: {
        emotion_type: 'smart',     // 항상 smart 사용 (preset/embedding은 구조 달라 오류)
        previous_text: prevText,   // 감정 맥락 + 첫 글자 클리핑 방지
      },
      output: {
        volume: 100,
        audio_pitch: audio_pitch,
        audio_tempo: audioTempo,
        audio_format: audio_format
      }
    }

    // next_text: 마지막 문장 → 자연스러운 마무리
    if (rawText.length > 20) {
      const sentences = rawText.split(/[.!?\n]/).filter((s: string) => s.trim())
      if (sentences.length > 1) {
        ttsPayload.prompt.next_text = sentences[sentences.length - 1].trim()
      }
    }

    const ttsResponse = await fetch(
      'https://api.typecast.ai/v1/text-to-speech',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ttsPayload)
      }
    )

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text()
      let errMsg = `Typecast TTS 오류 (${ttsResponse.status})`
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson.message || errJson.error || errMsg
      } catch {}
      return c.json({ ok: false, error: errMsg, detail: errText }, 500)
    }

    // ── base64 변환 (스택 오버플로우 방지 — 청크 분할 방식) ──
    const audioBuffer = await ttsResponse.arrayBuffer()
    const uint8 = new Uint8Array(audioBuffer)
    let binary = ''
    const CHUNK = 8192
    for (let i = 0; i < uint8.length; i += CHUNK) {
      binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK))
    }
    const base64Audio = btoa(binary)
    const mimeType = audio_format === 'wav' ? 'audio/wav' : 'audio/mpeg'
    const audioDataUrl = `data:${mimeType};base64,${base64Audio}`

    await c.env.DB.prepare(`
      UPDATE jobs SET tts_audio_url = ?, status = 'tts_ready', stage = 'tts_done', updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(audioDataUrl, job_id).run()

    return c.json({
      ok: true,
      data: {
        audio_url: audioDataUrl,
        job_id,
        voice_id: actualVoiceId,
        emotion: inferredEmotion,
        tempo: audioTempo,
        format: audio_format,
        provider: 'typecast'
      }
    })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 작업 진행 상황 실시간 조회 (폴링용)
// ─────────────────────────────────────────
apiRoutes.get('/jobs/:job_id/status', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const job = await c.env.DB.prepare(
      'SELECT job_id, status, stage, tts_audio_url, output_video_url, script_content, error_message, updated_at FROM jobs WHERE job_id = ?'
    ).bind(job_id).first() as any

    if (!job) return c.json({ ok: false, error: '작업 없음' }, 404)

    // 단계별 진행률 계산
    const stageProgress: Record<string, number> = {
      waiting: 0,
      script_done: 25,
      tts_done: 55,
      rendering: 75,
      complete: 100
    }
    const progress = stageProgress[job.stage] ?? 0

    return c.json({
      ok: true,
      data: {
        job_id: job.job_id,
        status: job.status,
        stage: job.stage,
        progress,
        has_script: !!job.script_content,
        has_tts: !!job.tts_audio_url,
        has_video: !!job.output_video_url,
        output_video_url: job.output_video_url || null,
        error_message: job.error_message || null,
        updated_at: job.updated_at
      }
    })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 클라이언트사이드 합성 완료 보고
// (브라우저에서 Canvas+MediaRecorder로 합성 후 결과 URL 저장)
// ─────────────────────────────────────────
apiRoutes.post('/jobs/:job_id/synthesis-complete', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const { output_video_url, video_duration } = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE jobs SET
        output_video_url = ?,
        video_duration = ?,
        status = 'complete',
        stage = 'complete',
        updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(output_video_url || null, video_duration || null, job_id).run()

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 합성 진행 단계 업데이트 (렌더링 시작 알림용)
// ─────────────────────────────────────────
apiRoutes.patch('/jobs/:job_id/stage', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const { stage, status } = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE jobs SET stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?
    `).bind(stage, status || stage, job_id).run()

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 대본 직접 업데이트
// ─────────────────────────────────────────
apiRoutes.patch('/jobs/:job_id/script', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const { script_content } = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE jobs SET script_content = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?
    `).bind(script_content, job_id).run()

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 설정 조회 (API 키 설정 여부 확인)
// ─────────────────────────────────────────
apiRoutes.get('/settings', async (c) => {
  return c.json({
    ok: true,
    data: {
      has_openai: !!c.env.OPENAI_API_KEY,
      has_typecast: !!c.env.TYPECAST_API_KEY,
      has_n8n: !!c.env.N8N_WEBHOOK_URL,
      tts_provider: 'typecast'
    }
  })
})

// ─────────────────────────────────────────
// 제작 프리셋 목록 조회
// ─────────────────────────────────────────
apiRoutes.get('/production-presets', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM production_presets ORDER BY is_default DESC, id ASC'
    ).all()
    return c.json({ ok: true, data: results })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 제작 프리셋 단건 조회
// ─────────────────────────────────────────
apiRoutes.get('/production-presets/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const preset = await c.env.DB.prepare(
      'SELECT * FROM production_presets WHERE id = ?'
    ).bind(id).first()
    if (!preset) return c.json({ ok: false, error: '프리셋을 찾을 수 없습니다.' }, 404)
    return c.json({ ok: true, data: preset })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 제작 프리셋 저장 (신규)
// ─────────────────────────────────────────
apiRoutes.post('/production-presets', async (c) => {
  try {
    const body = await c.req.json()
    const {
      name,
      description = '',
      subtitle_font = 'NanumSquareRound',
      subtitle_font_size = 36,
      subtitle_position = 'bottom',
      subtitle_font_color = '#FFFFFF',
      subtitle_bg_color = 'rgba(0,0,0,0.65)',
      subtitle_bg_opacity = 0.65,
      subtitle_has_bg_bar = 1,
      subtitle_stroke_color = '#000000',
      subtitle_stroke_width = 2,
      tts_voice_id = '',
      tts_voice_name = '',
      tts_emotion = 'smart',
      tts_speed = 1.0,
      is_default = 0
    } = body

    if (!name || !name.trim()) {
      return c.json({ ok: false, error: '프리셋 이름을 입력해주세요.' }, 400)
    }

    // 기본 프리셋으로 설정 시 기존 기본값 해제
    if (is_default) {
      await c.env.DB.prepare(
        'UPDATE production_presets SET is_default = 0'
      ).run()
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO production_presets (
        name, description,
        subtitle_font, subtitle_font_size, subtitle_position,
        subtitle_font_color, subtitle_bg_color, subtitle_bg_opacity,
        subtitle_has_bg_bar, subtitle_stroke_color, subtitle_stroke_width,
        tts_voice_id, tts_voice_name, tts_emotion, tts_speed, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      name.trim(), description,
      subtitle_font, subtitle_font_size, subtitle_position,
      subtitle_font_color, subtitle_bg_color, subtitle_bg_opacity,
      subtitle_has_bg_bar ? 1 : 0, subtitle_stroke_color, subtitle_stroke_width,
      tts_voice_id, tts_voice_name, tts_emotion, tts_speed, is_default ? 1 : 0
    ).run()

    const newPreset = await c.env.DB.prepare(
      'SELECT * FROM production_presets WHERE id = ?'
    ).bind(result.meta.last_row_id).first()

    return c.json({ ok: true, data: newPreset })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 제작 프리셋 수정
// ─────────────────────────────────────────
apiRoutes.patch('/production-presets/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await c.env.DB.prepare(
      'SELECT * FROM production_presets WHERE id = ?'
    ).bind(id).first() as any
    if (!existing) return c.json({ ok: false, error: '프리셋을 찾을 수 없습니다.' }, 404)

    const merged = { ...existing, ...body }

    // 기본 프리셋으로 설정 시 기존 기본값 해제
    if (merged.is_default) {
      await c.env.DB.prepare(
        'UPDATE production_presets SET is_default = 0 WHERE id != ?'
      ).bind(id).run()
    }

    await c.env.DB.prepare(`
      UPDATE production_presets SET
        name = ?, description = ?,
        subtitle_font = ?, subtitle_font_size = ?, subtitle_position = ?,
        subtitle_font_color = ?, subtitle_bg_color = ?, subtitle_bg_opacity = ?,
        subtitle_has_bg_bar = ?, subtitle_stroke_color = ?, subtitle_stroke_width = ?,
        tts_voice_id = ?, tts_voice_name = ?, tts_emotion = ?, tts_speed = ?,
        is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      merged.name, merged.description,
      merged.subtitle_font, merged.subtitle_font_size, merged.subtitle_position,
      merged.subtitle_font_color, merged.subtitle_bg_color, merged.subtitle_bg_opacity,
      merged.subtitle_has_bg_bar ? 1 : 0, merged.subtitle_stroke_color, merged.subtitle_stroke_width,
      merged.tts_voice_id, merged.tts_voice_name, merged.tts_emotion, merged.tts_speed,
      merged.is_default ? 1 : 0, id
    ).run()

    const updated = await c.env.DB.prepare(
      'SELECT * FROM production_presets WHERE id = ?'
    ).bind(id).first()

    return c.json({ ok: true, data: updated })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 제작 프리셋 삭제
// ─────────────────────────────────────────
apiRoutes.delete('/production-presets/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const existing = await c.env.DB.prepare(
      'SELECT * FROM production_presets WHERE id = ?'
    ).bind(id).first() as any
    if (!existing) return c.json({ ok: false, error: '프리셋을 찾을 수 없습니다.' }, 404)

    await c.env.DB.prepare('DELETE FROM production_presets WHERE id = ?').bind(id).run()
    return c.json({ ok: true, message: '삭제되었습니다.' })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 유튜브/SNS 제목 & 설명글 자동 생성
// (대본 + 컨텍스트 기반 후킹 제목 3개 + SNS 설명글)
// ─────────────────────────────────────────
apiRoutes.post('/jobs/:job_id/generate-title', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const { product_number = '' } = await c.req.json().catch(() => ({}))

    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE job_id = ?'
    ).bind(job_id).first() as any

    if (!job || !job.script_content) {
      return c.json({ ok: false, error: '대본이 없습니다.' }, 400)
    }

    const apiKey = c.env.OPENAI_API_KEY
    const pNum = (product_number || job.product_number || '').trim()

    // ── 컨텍스트 텍스트에서 #해시태그 추출 ───────────────────────
    const contextText: string = job.context_text || ''
    const contextTags: string[] = []
    const tagRegex = /#[\uAC00-\uD7A3\w]+/g
    let tagMatch
    while ((tagMatch = tagRegex.exec(contextText)) !== null) {
      contextTags.push(tagMatch[0])
    }
    const contextTagStr = contextTags.length > 0
      ? `컨텍스트 태그 (반드시 포함): ${contextTags.join(' ')}`
      : '컨텍스트 태그 없음'

    // ── 인스타 감성 설명글 예시 (few-shot) ─────────────────────────
    const instaExamples = `
[예시1 - 공감·일상형]
진짜 이거 쓰기 전이랑 후가 완전 달라요 🥹💕
그냥 별 생각 없이 써봤는데... 어느 순간부터 이게 없으면 불편한 거 있잖아요 ㅋㅋ

처음엔 반신반의했는데 주변에서 다들 어디서 샀냐고 물어볼 때 그 뿌듯함이란 😆!!
"나 이미 알고 있었어" 이 느낌 아시죠? ㅎㅎ

저처럼 이런 거 찾고 있었던 분들한테 진짜 강추예요 🙌
한 번 써보면 왜 난리났는지 바로 알게 될 거예요..!
궁금하신 분들 프로필 링크에서 301번으로 확인해보세요 🔗

[예시2 - 후기·스토리형]
솔직히 처음엔 그냥 지나치려 했어요 🤔...
근데 주변에서 너무 좋다고 해서 한번 써봤는데
아 이거 진짜 왜 이제 알았지 싶더라고요 ㅠㅠ

생각보다 훨씬 편하고, 쓰면 쓸수록 더 애착 가는 스타일이에요 ✨
이런 게 있었구나~ 싶은 그 설렘!! 저만 이런 건 아니죠? 😅

같은 고민 있으신 분들 한번쯤 써보세요 🙌
프로필 링크에서 523번으로 바로 확인하실 수 있어요!

[예시3 - 감성·공유형]
요즘 이런 거 찾는 사람 나뿐인 줄 알았는데 아니었어요 😅ㅋㅋ
딱 내가 원하던 게 이거였구나 싶었달까요... 🤍

작은 거 하나가 하루를 이렇게 바꿔놓을 줄은 몰랐어요 ✨
써보면 알아요, 말로 설명하기 어려운 그 느낌!

좋은 거 발견하면 나만 알기 아까워서요 😊💕
같은 고민이셨던 분들, 프로필 링크에서 확인해보세요 🔗
`.trim()

    // ── 제목 레퍼런스 ─────────────────────────────────────────────
    const titleExamples = `
내가 뺏어먹는 와이프 최애음식ㅋㅋ / 희한한데 유용한 상비템 / 계란초밥의 진실?
신기해서 사본 SNS 아이디어템 / 자취생 눈돌아가는 일본 발명품
드디어 찾아냈다ㄷㄷ / 일본 자취생이 몰래 쓰는ㄷㄷ / 1년째 매일 쓰는 이유 있어
이자카야 절대 안갑니다 / 주변 다 물어본 그 물건 / 반신반의했다가 완전 팬됨ㅋㅋ
설명서대로 쓰지마세요 / 사고나서 후회? 안 사고 후회? / 써보면 왜 난리났는지 알아
`.trim()

    // ── 컨텍스트 태그 처리 ────────────────────────────────────────
    const mustTagLine = contextTags.length > 0
      ? `\n\n⚠️ 아래 태그는 반드시 그대로 description에 포함할 것 (추가 삭제 불가):\n${contextTags.join(' ')}`
      : ''

    const prompt = `당신은 인스타그램 감성을 완벽하게 이해한 대한민국 라이프스타일 콘텐츠 크리에이터입니다.
아래 [대본]을 읽고, 그 대본의 스토리·감정·공감 포인트를 그대로 살려서 인스타그램 캡션을 작성하세요.
독자가 읽으면서 "아 이 사람 진짜 써봤구나", "나도 이런 거 찾고 있었는데" 하는 느낌이 들게 써야 합니다.

=== 대본 ===
${job.script_content}

=== 컨텍스트 정보 ===
- 플랫폼: ${job.platform || 'douyin'}
- URL: ${job.source_url || ''}${mustTagLine}

=== 인스타그램 감성 캡션 예시 (이 톤·분위기를 반드시 따를 것) ===
${instaExamples}

=== 제목 레퍼런스 패턴 ===
${titleExamples}

━━━━━━━━━━━━━━━━━━━━━━━━
[제목 5개 규칙]
1. 대본의 핵심 감정·상황을 한 방에 담은 후킹 제목
2. 10~20자 이내, 한국인이 공감하고 검색하는 자연스러운 말투
3. 말끝에 ㅋㅋ / ㄷㄷ / ? / !! 중 상황에 맞게 하나 추가 가능
4. 공감형 / 호기심형 / 후기형 / 반전형 / 일상형 각각 다르게

[SNS 캡션 규칙 — 가장 중요]
1. 대본의 스토리와 감정을 인스타 일상 포스트처럼 풀어쓸 것
2. 길이: 대본보다 짧으면 절대 안 됨. 대본과 비슷하거나 더 길게
3. 말투: 친한 친구한테 카톡 보내듯 솔직하고 따뜻하게. 사무적 표현 금지
4. 이모지 사용 규칙 (★ 핵심):
   - 감정이 올라오는 문장마다 어울리는 이모지 1~2개 자연스럽게 삽입
   - 특히 공감·놀람·기쁨·따뜻함을 표현할 때 꼭 이모지 사용 (🥹 😆 🙌 💕 ✨ 😅 🤍 💛 🫶 🥰 😊 😭 등)
   - 문장 끝이나 중간에 ...! / !! / ~~ / ㅋㅋ / ㅠㅠ 같은 감탄·말줄임 표현 자유롭게 사용
   - 매 문장 강제 삽입은 금지 (흐름에 맞을 때만)
5. 구조: 도입(공감/상황 + 이모지) → 경험/스토리 → 감상/추천 → CTA → 해시태그
6. 어미: ~요 / ~어요 / ~더라고요 / ~잖아요 / ~거 있잖아요 / ~달까요 등 자연스럽게
7. 절대 금지: "추천드려요", "이런 분께", "핵심 혜택", 체크리스트 불릿(•), 광고·홍보 말투
8. 사람 사는 세상 감성: 좋은 걸 발견했을 때 친구에게 공유하듯, 진심 어린 따뜻함이 묻어나야 함
9. CTA 규칙: ${pNum
      ? `반드시 본문 마지막에 "프로필 링크에서 ${pNum}번으로 확인해보세요" 형식으로 자연스럽게 포함 (번호 생략 절대 금지)`
      : '자연스러운 "프로필 링크 확인해보세요" 변형 말투로 마무리'}
10. 해시태그: ${contextTags.length > 0
      ? `반드시 ${contextTags.join(' ')} 전부 포함. 추가로 제품·주제 관련 인기 태그 합쳐서 총 5~10개`
      : '제품·주제·감성 관련 인스타·유튜브 인기 태그 5~10개 (조회수 높고 제품 관련성 높은 태그 선정)'}
11. 해시태그는 캡션 마지막에 한 줄로 띄어쓰기로 구분
12. JSON 형식 외 어떤 텍스트도 출력하지 마세요
13. description 필드의 줄바꿈은 반드시 \\n으로 표현

[줄바꿈 규칙 — 인스타 가독성 핵심]
- 1~2문장마다 반드시 \\n 줄바꿈 삽입 (3문장 이상 연속 금지)
- 감정 전환·장면 전환 구간에는 \\n\\n 빈줄 삽입으로 단락 분리
- 해시태그 앞에는 반드시 \\n\\n 빈줄 삽입
- 예시 형식:
  "오늘 우연히 써봤는데 진짜 대박이에요 😲!!\\n이게 이렇게 편할 줄 몰랐거든요 🥹\\n\\n처음엔 별거 아닌 줄 알았는데...\\n써보니까 왜 이게 난리났는지 바로 알겠더라고요 ㅋㅋ\\n\\n같은 고민이셨던 분들 한번만 써보세요 💕🙌\\n\\n#태그1 #태그2 #태그3"

=== 출력 형식 (JSON만) ===
{
  "titles": ["제목1","제목2","제목3","제목4","제목5"],
  "description": "인스타 감성 캡션 전체 (\\n으로 줄바꿈)",
  "hashtags": ["#태그1","#태그2","#태그3","#태그4","#태그5"]
}`

    // OpenAI 없으면 샘플 반환
    if (!apiKey) {
      const sampleTags = contextTags.length > 0
        ? [...contextTags, '#생활꿀템', '#일상템', '#쇼핑쇼츠', '#추천템', '#꿀팁'].slice(0, 8)
        : ['#생활꿀템', '#아이디어상품', '#쇼핑쇼츠', '#일상템', '#추천템', '#꿀팁', '#리뷰']
      const sampleTagStr = sampleTags.join(' ')
      const sampleDesc = `진짜 이거 쓰기 전이랑 후가 완전 달라요 🥹\n이런 게 있는 줄도 몰랐는데... 써보고 나서 왜 이제 알았지 싶더라고요 ㅠㅠ\n처음엔 반신반의했는데 어느 순간부터 이게 없으면 불편한 거 있잖아요 ㅋㅋ\n주변에서 다들 어디서 샀냐고 물어볼 때 그 뿌듯함이란... 😆\n같은 고민 있으셨던 분들 한번만 써보세요\n써보면 왜 난리났는지 바로 알게 될 거예요 💕\n\n${sampleTagStr}`
      return c.json({
        ok: true,
        demo: true,
        data: {
          titles: [
            '쓰고나서 왜 이제 알았지 싶은 거ㅠㅠ',
            '주변에서 다 물어보는 그거 맞아요ㅋㅋ',
            '반신반의했다가 완전 팬됨ㄷㄷ',
            '이거 없었으면 어떻게 살았을까',
            '써보면 알아요, 말로 설명이 안 됨'
          ],
          description: sampleDesc,
          hashtags: sampleTags
        }
      })
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 1.1,
        messages: [
          {
            role: 'system',
            content: '당신은 인스타그램 일상 감성 포스팅을 잘 쓰는 한국 크리에이터입니다. 좋은 걸 발견했을 때 친구에게 공유하듯, 진심 어린 따뜻함과 공감이 자연스럽게 묻어나는 글을 씁니다. 이모지와 느낌표·말줄임 등 감정 표현을 풍부하게 사용하되 억지스럽지 않게, 사람 사는 세상의 따뜻한 온기가 느껴지게 씁니다. 절대 사무적이거나 광고 말투를 사용하지 않습니다.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    })

    if (!res.ok) {
      const t = await res.text()
      return c.json({ ok: false, error: 'OpenAI 오류: ' + t.substring(0, 200) }, 500)
    }

    const resJson = await res.json() as any
    const raw = resJson.choices?.[0]?.message?.content || '{}'
    let parsed: any = {}
    try { parsed = JSON.parse(raw) } catch {}

    // DB에 생성된 제목/설명 저장
    const firstTitle = (parsed.titles || [])[0] || ''
    await c.env.DB.prepare(`
      UPDATE jobs SET youtube_title = ?, youtube_description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(firstTitle, parsed.description || '', job_id).run().catch(() => {})

    return c.json({ ok: true, data: parsed })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ─────────────────────────────────────────
// 헬퍼: 감정 자동 추론 (대본 분석)
// ─────────────────────────────────────────
function inferEmotionFromScript(script: string, personaName?: string): string {
  // 페르소나별 기본 감정
  const personaEmotions: Record<string, string> = {
    mom: 'happy',      // 엄마: 따뜻하고 공감적
    sister: 'toneup',  // 누나: 생동감, 업비트
    solo: 'normal',    // 자취생: 담백하고 실용적
    expert: 'normal',  // 전문가: 차분하고 신뢰감
    dad: 'happy'       // 육아대디: 유쾌하고 솔직
  }

  // CTA 포함 시 toneup
  if (script.includes('링크') || script.includes('확인') || script.includes('써보')) {
    return 'toneup'
  }

  // 공감/문제 표현 감지
  if (script.includes('속상') || script.includes('힘들') || script.includes('막막')) {
    return 'sad'
  }

  // 효과/결과 표현 감지
  if (script.includes('극락') || script.includes('행복') || script.includes('달라졌')) {
    return 'happy'
  }

  // 강조 표현 감지
  if (script.includes('진짜') || script.includes('완전') || script.includes('최고')) {
    return 'toneup'
  }

  return personaName ? (personaEmotions[personaName] || 'smart') : 'smart'
}

// ─────────────────────────────────────────
// Typecast 한국어 프리셋 보이스 목록
// (API 키 없을 때 또는 폴백용)
// ─────────────────────────────────────────
const TYPECAST_PRESET_VOICES = [
  {
    voice_id: 'tc_68f9c6a72f0f04a417bb136f',  // Moonjung - 실제 Typecast ID
    name: '문정 (Moonjung)',
    gender: 'female',
    age: '30s',
    persona: 'mom',
    description: '따뜻하고 신뢰감 있는 30대 여성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['엄마', '따뜻함', '공감'],
    recommended_for: ['엄마 페르소나', '공감형 CTA', '육아 콘텐츠']
  },
  {
    voice_id: 'tc_662a15c1e31aab9a774b3b31',  // Kristen - 실제 Typecast ID
    name: '크리스틴 (Kristen)',
    gender: 'female',
    age: '20s',
    persona: 'sister',
    description: '밝고 친근한 20대 여성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['누나', '트렌디', '자기관리'],
    recommended_for: ['누나/언니 페르소나', '뷰티/패션', '자기계발']
  },
  {
    voice_id: 'tc_68537c9420b646f2176890ba',  // Seojin - 실제 Typecast ID
    name: '서진 (Seojin)',
    gender: 'female',
    age: '20s',
    persona: 'solo',
    description: '세련되고 트렌디한 20대 여성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['자취생', '실용', '가성비'],
    recommended_for: ['자취생 페르소나', '가전/생활용품', '가성비 콘텐츠']
  },
  {
    voice_id: 'tc_68785db8ba9cd7503f27d921',  // Gowoon - 실제 Typecast ID
    name: '고운 (Gowoon)',
    gender: 'female',
    age: '20s',
    persona: 'expert',
    description: '차분하고 전문적인 20대 여성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['전문가', '신뢰', '정보'],
    recommended_for: ['전문가 페르소나', '건강/의료', '기술 제품']
  },
  {
    voice_id: 'tc_68d4b115f0486108a7eefb37',  // Kangil - 실제 Typecast ID
    name: '강일 (Kangil)',
    gender: 'male',
    age: '20s',
    persona: 'dad',
    description: '신뢰감 있는 20대 남성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['육아대디', '유쾌', '솔직'],
    recommended_for: ['육아 페르소나', '패밀리 제품', '놀이/교육']
  }
]

// ─────────────────────────────────────────
// 헬퍼: OpenAI 대본 생성 (감성 스토리텔링 완전판)
// ─────────────────────────────────────────
async function generateScript(
  apiKey: string,
  persona: any,
  contextText: string,
  valueKeywords: string[],
  sourceUrl: string,
  isRegenerate = false,
  productNumber = ''
): Promise<string> {
  const keywordsStr = valueKeywords.length > 0
    ? `\n✅ 대본에서 반드시 녹여낼 핵심 가치: ${valueKeywords.join(', ')}` : ''

  const productCTA = productNumber
    ? `\n✅ CTA 필수 규칙: 반드시 "이 제품 궁금하면 프로필 링크에서 ${productNumber}번으로 확인해주세요" 로 마무리`
    : `\n✅ CTA 규칙: 페르소나 말투에 맞는 자연스러운 "프로필 링크 확인해보세요" 변형 사용`

  const regenerateNote = isRegenerate
    ? `\n⚠️ 재생성 요청: 이전과 완전히 다른 상황·추억·감정 포인트를 사용하세요. 다른 장면, 다른 일상 속 순간으로 접근하세요.` : ''

  const storyFrame = PERSONA_STORY_FRAMES[persona.name] || PERSONA_STORY_FRAMES['mom']

  const systemPrompt = `당신은 대한민국 최고의 숏폼 감성 스토리텔러입니다.
틱톡·릴스·쇼츠에서 엄지를 멈추게 하는, 실제 사람의 진짜 경험담처럼 들리는 대본을 씁니다.
광고가 아닌, 친한 친구가 카카오톡으로 보내준 추천 메시지 같아야 합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 핵심 대본 원칙 5가지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【원칙 1】 첫 3초가 전부다 — 엄지를 멈춰라
시청자는 0.5초 안에 스크롤을 넘깁니다.
첫 문장에서 "이거 나 얘기잖아"라는 반응을 끌어내야 합니다.

✅ 강력한 오프닝 패턴 (하나만 골라 사용):
• 고백형: "솔직히 말하면 저 이거 쓰기 전까지는..." (취약성 노출)
• 질문형: "혹시 저만 이런 거 아니죠?" (공감 유도)
• 장면형: "새벽 2시에 혼자 울면서 검색했어요" (생생한 장면)
• 반전형: "세 달이나 참다가 이걸 썼는데..." (시간의 무게)
• 후회형: "진작에 알았으면 그 시간을 안 버렸을 텐데" (공감+후킹)

【원칙 2】 제품 자랑 말고 — 그 날의 이야기를 해라
❌ 금지 패턴:
- "이 제품은 ~성분이 들어있어서 효과가 좋습니다"
- "많은 분들이 사용하시는"
- "임상 테스트 결과"
- "지금 바로 구매하세요"

✅ 대신 이렇게:
- 제품을 처음 쓴 날의 날씨, 시간, 감정 상태
- 효과를 느낀 순간의 구체적 장면 ("그날 아침 거울 보다가 멈췄어요")
- 가족/친구의 반응 ("남편이 먼저 알아챘어요")
- 이전과 이후의 삶 비교 ("그 전에는 / 지금은")

【원칙 3】 생활 속 불편을 정확히 찌르고, 해소해라
시청자가 매일 겪지만 말 못했던 불편을 콕 집어 표현해야 합니다.
"맞아, 나도 그거 너무 불편했는데!" 라는 반응을 끌어내세요.

불편은 구체적일수록 강합니다:
- "매일 아침 허리 굽혀 청소기 돌리면서" (vs. "청소가 힘들어서")
- "손마디가 빨개지도록 박박 닦아도" (vs. "열심히 청소해도")
- "자기 전에 3번씩 확인하러 일어나서" (vs. "자꾸 신경 쓰여서")

【원칙 4】 감정의 여정을 그려라 (PAS+E 감성 서사)
━━━━━━━━━━━━━━━━━━
[후킹 3초] → 시청자 멈추게 하는 첫 장면/고백 (1~2문장)
[공감 고조] → 그 불편이 쌓이고 쌓인 감정, 지쳐있던 일상 (1~2문장)  
[발견 순간] → 이 제품을 만난 계기 + 첫 경험의 생생한 묘사 (1~2문장)
[삶의 변화] → "그날 이후로..." 달라진 일상의 구체적 장면 1개 (1~2문장)
[CTA] → 제품번호 포함 자연스러운 마무리 (1문장)
━━━━━━━━━━━━━━━━━━

【원칙 5】 추억과 후기를 스토리에 녹여라
가장 공감되는 대본은 "실제 경험한 사람만 알 수 있는" 디테일이 있습니다.
- 쓴 날의 날씨, 계절 ("그날 비가 왔는데...")
- 함께한 사람의 반응 ("아이가 처음으로 안 울었어요")
- 사소한 행동의 변화 ("이제 아침마다 기대하면서 일어나요")
- 비교 포인트 ("전에 쓰던 비싼 것보다 이게 더 잘 되더라고요")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 이 대본의 화자 (페르소나)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
후킹 스타일: ${storyFrame.hookStyle}
공감 포인트: ${storyFrame.painPoint}
감정 흐름: ${storyFrame.emotionArc}
추억 장면 아이디어: ${storyFrame.memoryHook}
CTA 톤: ${storyFrame.ctaStyle}

페르소나 말투·배경:
${persona.prompt_template}
${keywordsStr}
${productCTA}
${regenerateNote}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📏 출력 형식 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 총 길이: 70~130자 (TTS 15~30초 분량)
- 줄바꿈: 자연스러운 호흡 포인트마다 (TTS 포즈 역할)
- 이모지: 마지막 CTA 문장에만 최대 1~2개
- 구어체: 완전한 구어체 (글쓰기 ❌, 말하기 ✅)
- 순수 텍스트만 출력 (태그·설명·번호 없음)`

  const userPrompt = `아래 정보로 감성 쇼츠 대본을 작성해주세요.

소스 URL: ${sourceUrl}
제품/상품 정보·댓글·컨텍스트: ${contextText || '(제공 없음 — URL 도메인과 카테고리를 유추해서 해당 제품군에 맞는 생생한 실제 경험담 스토리 창작)'}

⚠️ 주의:
- 절대 광고처럼 쓰지 말 것
- 실제로 겪었던 사람만 알 수 있는 디테일 1개 반드시 포함
- 첫 문장에서 시청자의 공감을 즉시 끌어낼 것
- CTA 규칙 반드시 적용`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 700,
      temperature: isRegenerate ? 0.95 : 0.85
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API 오류: ${response.status}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content?.trim() || '대본 생성 실패'
}

// ─────────────────────────────────────────
// 헬퍼: 샘플 대본 (API 키 없을 때) - 감성 스토리 버전
// ─────────────────────────────────────────
function generateSampleScript(persona: any, valueKeywords: string[], productNumber = ''): string {
  const ctaSuffix = productNumber
    ? `이 제품 궁금하면 프로필 링크에서 ${productNumber}번으로 확인해주세요 🔗`
    : `프로필 링크 확인해보세요 🔗`

  const samples: Record<string, string> = {
    mom: `밤마다 아이 긁는 소리에 잠 못 잔 적 있으세요?
저 세 달을 그렇게 보냈거든요, 진짜로.

좋다는 건 다 발라봤는데
아이는 새벽마다 울고, 저도 같이 울었어요.

그러다 이걸 쓴 첫날 밤—
애가 긁지 않고 새근새근 자더라고요.
그 고요함이 얼마나 감사했는지 몰라요.

${ctaSuffix}`,

    sister: `퇴근하고 거울 봤다가 진짜 충격받은 날 있잖아요.
나 이렇게 살아도 되나 싶었던 그 날.

피부도 다리도 그냥 다 포기 상태였는데
친구한테 이거 써보라고 꼭 쥐여줬어요.

일주일 후에 남자친구가 먼저 알아챘어요.
"야 너 요즘 왜 이렇게 좋아 보여?"
그 한마디에 눈물 날 뻔했어요.

${ctaSuffix}`,

    solo: `자취방에서 혼자 밥 먹다가 문득 서글펐던 적 있죠?
이것저것 사고 싶은데 공간도 돈도 없고.

그냥 체념하고 살다가 이걸 발견한 거예요.
가격 보고 "설마" 했는데 써보고 "진짜?" 했어요.

지금은 자취방이 조금 더 살 만해진 느낌이에요.
혼자 사는 게 나쁘지 않다는 생각, 처음 했어요.

${ctaSuffix}`,

    expert: `솔직히 저도 처음엔 반신반의했어요.
이런 제품들이 다 거기서 거기라고 생각했거든요.

그런데 성분 보고 생각이 바뀌었어요.
3개월 쓰면서 수치로 확인했을 때—
이건 다르다, 확신이 생겼습니다.

전문가 입장에서 책임감 있게 말할 수 있어요.
지금까지 추천한 것 중 가장 후회 없는 선택이에요.

${ctaSuffix}`,

    dad: `주말에 애 혼자 봤다가 완전 멘탈 박살 난 적 있죠?
저 진짜 울 뻔했어요, 세 살짜리한테 지고 있으니까.

그날 밤에 이거 발견해서 다음 날 써봤는데—
아이가 처음으로 저한테 와서 안기더라고요.
그 순간 진짜 아빠가 된 것 같았어요.

아내도 그날 처음으로 "오빠 최고"라고 했어요.

${ctaSuffix}`
  }

  const personaName = persona?.name || 'mom'
  return samples[personaName] || samples['mom']
}

// ─────────────────────────────────────────
// 페르소나별 스토리 프레임 (감성 스토리텔링 가이드)
// ─────────────────────────────────────────
const PERSONA_STORY_FRAMES: Record<string, {
  hookStyle: string
  painPoint: string
  emotionArc: string
  memoryHook: string
  ctaStyle: string
}> = {
  mom: {
    hookStyle: '아이를 위해 노심초사했던 새벽, 모성 본능을 건드리는 고백형 오프닝',
    painPoint: '아이 피부/수면/식사/발달 걱정, 좋다는 건 다 써봤는데 안 됐던 지침',
    emotionArc: '걱정 → 지침 → 기대 반신반의 → 효과 첫 순간의 안도와 감동',
    memoryHook: '아이가 처음으로 긁지 않고 잠든 밤 / 아이가 웃으며 먹기 시작한 아침',
    ctaStyle: '따뜻하고 공감하는 엄마 친구 말투로 자연스럽게 추천'
  },
  sister: {
    hookStyle: '퇴근 후 거울 보고 현타 온 순간, MZ식 솔직 고백·자기비하 유머',
    painPoint: '피부/몸매/스트레스/루틴 관리 포기 직전, 살기 바빠서 자기관리 못했던 죄책감',
    emotionArc: '포기 → 뜻밖의 발견 → 반신반의 → 주변 반응에 놀람 → 자신감 회복',
    memoryHook: '남자친구·동료가 먼저 알아챈 순간 / 오랜만에 거울 보고 만족한 아침',
    ctaStyle: '친한 언니가 카카오톡으로 추천해주는 캐주얼하고 확신 있는 말투'
  },
  solo: {
    hookStyle: '자취방 혼자의 쓸쓸한 순간, 가성비 절박함 또는 공간 한계 공감형 오프닝',
    painPoint: '돈도 공간도 없는 자취 생활의 현실적 불편, 비싼 게 답이 아니란 걸 느낀 순간',
    emotionArc: '체념 → 우연한 발견 → "이 가격에?" 반신반의 → 생활의 작은 행복 발견',
    memoryHook: '혼자 자취방에서 처음으로 만족하며 쉰 저녁 / 친구 집에 자랑한 순간',
    ctaStyle: '같이 자취하는 친구에게 꿀팁 알려주듯 실용적이고 솔직한 말투'
  },
  expert: {
    hookStyle: '전문가도 처음엔 반신반의했다는 의외성 고백, 데이터나 경험 기반 신뢰 오프닝',
    painPoint: '비슷비슷한 제품들 사이에서 제대로 된 것 찾기 어려웠던 전문가적 답답함',
    emotionArc: '회의적 → 검증 시작 → 수치/변화로 확신 → 책임감 있는 공개 결심',
    memoryHook: '3개월 후 수치가 달라진 날 / 제자/환자에게 처음 추천하게 된 계기',
    ctaStyle: '전문가가 책임감을 갖고 정중하게 추천하는 신뢰감 있는 말투'
  },
  dad: {
    hookStyle: '육아 현장의 솔직 망신·좌충우돌, 아빠 입장의 유쾌한 무기력 고백',
    painPoint: '아이 앞에서 무능하게 느껴졌던 순간, 아내에게 인정받고 싶은 마음',
    emotionArc: '멘탈 붕괴 → 절박한 해결책 찾기 → 효과 발견 → 가족의 인정과 감동',
    memoryHook: '아이가 처음으로 아빠 품에 안긴 날 / 아내가 처음으로 "오빠 최고"라고 한 순간',
    ctaStyle: '유쾌하고 솔직한 30대 아빠가 동네 아빠들에게 귀띔해주는 친근한 말투'
  }
}
