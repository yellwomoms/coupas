import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  OPENAI_API_KEY: string
  TYPECAST_API_KEY: string
  N8N_WEBHOOK_URL: string
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

// ─────────────────────────────────────────
// 페르소나 목록 조회
// ─────────────────────────────────────────
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

    const data = await res.json() as any
    return c.json({ ok: true, data: data.voices || data.result || TYPECAST_PRESET_VOICES })
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

    // voice_id 결정: 요청값 > DB 저장값 > 기본 한국어 보이스
    const actualVoiceId = voice_id || ttsVoice?.voice_id || 'tc_jh001_kor'

    // 페르소나에 맞는 감정 자동 추론
    const resolvedEmotion = emotion_type === 'auto'
      ? inferEmotionFromScript(job.script_content, ttsVoice?.persona_name)
      : emotion_type

    // audio_tempo: 0.9~1.1 범위로 제한 (쇼츠 싱크)
    const audioTempo = Math.max(0.9, Math.min(1.1, speed))

    // ── Typecast TTS API 호출 ──────────────────────────────────
    const ttsPayload: any = {
      voice_id: actualVoiceId,
      text: job.script_content,
      model: 'ssfm-v30',  // 최신 모델 (37개 언어, 7감정)
      language: 'kor',     // 한국어
      prompt: {
        emotion_type: resolvedEmotion
      },
      output: {
        volume: 100,
        audio_pitch: audio_pitch,
        audio_tempo: audioTempo,
        audio_format: audio_format  // 'mp3' or 'wav'
      }
    }

    // smart 감정일 때 전후 맥락 추가 (더 자연스러운 감정 추론)
    if (resolvedEmotion === 'smart' && job.script_content.length > 20) {
      const sentences = job.script_content.split('\n').filter((s: string) => s.trim())
      if (sentences.length > 1) {
        ttsPayload.prompt.previous_text = sentences[0]
        if (sentences.length > 2) {
          ttsPayload.prompt.next_text = sentences[sentences.length - 1]
        }
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

    // Typecast는 audio/wav 또는 audio/mpeg 바이너리 반환
    const audioBuffer = await ttsResponse.arrayBuffer()
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    )
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
        emotion: resolvedEmotion,
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
    voice_id: 'tc_jh001_kor',
    name: '지현',
    gender: 'female',
    age: '30s',
    persona: 'mom',
    description: '따뜻하고 신뢰감 있는 30대 여성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['엄마', '따뜻함', '공감'],
    recommended_for: ['엄마 페르소나', '공감형 CTA', '육아 콘텐츠']
  },
  {
    voice_id: 'tc_ys002_kor',
    name: '유선',
    gender: 'female',
    age: '20s',
    persona: 'sister',
    description: '트렌디하고 생동감 넘치는 20대 여성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['누나', '트렌디', '자기관리'],
    recommended_for: ['누나/언니 페르소나', '뷰티/패션', '자기계발']
  },
  {
    voice_id: 'tc_ms003_kor',
    name: '민수',
    gender: 'male',
    age: '20s',
    persona: 'solo',
    description: '자연스럽고 친근한 20대 남성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['자취생', '실용', '가성비'],
    recommended_for: ['자취생 페르소나', '가전/생활용품', '가성비 콘텐츠']
  },
  {
    voice_id: 'tc_jw004_kor',
    name: '준원',
    gender: 'male',
    age: '40s',
    persona: 'expert',
    description: '신뢰감 있고 전문적인 40대 남성',
    emotions: ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'],
    tags: ['전문가', '신뢰', '정보'],
    recommended_for: ['전문가 페르소나', '건강/의료', '기술 제품']
  },
  {
    voice_id: 'tc_sh005_kor',
    name: '성호',
    gender: 'male',
    age: '30s',
    persona: 'dad',
    description: '유쾌하고 솔직한 30대 아빠',
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
