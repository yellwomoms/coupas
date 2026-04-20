import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  OPENAI_API_KEY: string
  ELEVENLABS_API_KEY: string
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
      value_keywords = []
    } = body

    if (!source_url) {
      return c.json({ ok: false, error: '소스 URL이 필요합니다.' }, 400)
    }
    if (!persona_id) {
      return c.json({ ok: false, error: '페르소나를 선택해주세요.' }, 400)
    }

    // 고유 job_id 생성
    const job_id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // DB에 작업 저장
    await c.env.DB.prepare(`
      INSERT INTO jobs (job_id, source_url, platform, context_text, persona_id, subtitle_preset_id, tts_voice_id, value_keywords, status, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'waiting')
    `).bind(
      job_id,
      source_url,
      platform,
      context_text,
      persona_id,
      subtitle_preset_id || 1,
      tts_voice_id || 1,
      JSON.stringify(value_keywords)
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
        source_url
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
      script_content = generateSampleScript(persona as any, value_keywords)
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
    let new_script = ''

    if (c.env.OPENAI_API_KEY && persona) {
      new_script = await generateScript(
        c.env.OPENAI_API_KEY,
        persona,
        job.context_text || '',
        value_keywords,
        job.source_url,
        true // regenerate flag
      )
    } else {
      new_script = generateSampleScript(persona, value_keywords)
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
// TTS 생성
// ─────────────────────────────────────────
apiRoutes.post('/jobs/:job_id/generate-tts', async (c) => {
  try {
    const job_id = c.req.param('job_id')
    const { voice_id, speed = 1.0 } = await c.req.json()

    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE job_id = ?'
    ).bind(job_id).first() as any

    if (!job || !job.script_content) {
      return c.json({ ok: false, error: '대본이 없습니다. 먼저 대본을 생성해주세요.' }, 400)
    }

    // ElevenLabs TTS API 호출
    const apiKey = c.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return c.json({
        ok: false,
        error: 'ElevenLabs API 키가 설정되지 않았습니다.',
        demo: true
      }, 400)
    }

    const ttsVoice = await c.env.DB.prepare(
      'SELECT * FROM tts_voices WHERE id = ?'
    ).bind(job.tts_voice_id).first() as any

    const actualVoiceId = voice_id || ttsVoice?.voice_id || 'pNInz6obpgDQGcFmaJgB'

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: job.script_content,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
            speed: speed
          }
        })
      }
    )

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text()
      return c.json({ ok: false, error: `TTS 생성 실패: ${errText}` }, 500)
    }

    // 오디오 데이터를 base64로 변환
    const audioBuffer = await ttsResponse.arrayBuffer()
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    )
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    await c.env.DB.prepare(`
      UPDATE jobs SET tts_audio_url = ?, status = 'tts_ready', stage = 'tts_done', updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(audioDataUrl, job_id).run()

    return c.json({ ok: true, data: { audio_url: audioDataUrl, job_id } })
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
      has_elevenlabs: !!c.env.ELEVENLABS_API_KEY,
      has_n8n: !!c.env.N8N_WEBHOOK_URL
    }
  })
})

// ─────────────────────────────────────────
// 헬퍼: OpenAI 대본 생성
// ─────────────────────────────────────────
async function generateScript(
  apiKey: string,
  persona: any,
  contextText: string,
  valueKeywords: string[],
  sourceUrl: string,
  isRegenerate = false
): Promise<string> {
  const keywordsStr = valueKeywords.length > 0
    ? `강조 가치 키워드: ${valueKeywords.join(', ')}`
    : ''

  const regenerateNote = isRegenerate
    ? '이전과 다른 새로운 버전의 대본을 작성해주세요. 다른 각도와 표현을 사용하세요.'
    : ''

  const systemPrompt = `당신은 한국 숏폼 마케팅 전문 카피라이터입니다.
도우인/샤오홍슈 영상의 상품 정보나 댓글을 바탕으로, 페르소나의 실제 경험담처럼 들리는 한국어 쇼츠 대본을 작성합니다.

핵심 원칙:
1. "광고"가 아닌 "추천"과 "경험담"처럼 작성
2. PAS+E 구조 필수 적용: [문제(P)] → [공감/감정 고조(A)] → [해결/경험(S)] → [효과(E)] → [CTA]
3. 첫 3초 후킹: 시청자가 멈추게 하는 강렬한 첫 문장
4. 15~30초 분량 = 약 70~120자 (TTS 속도 고려)
5. 페르소나의 말투와 감성을 완벽히 구현
6. 자연스러운 구어체, 실제로 말하는 것처럼

${persona.prompt_template}

${keywordsStr}
${regenerateNote}`

  const userPrompt = `다음 정보를 바탕으로 쇼츠 대본을 작성해주세요:

소스 URL: ${sourceUrl}
추가 정보/댓글: ${contextText || '(없음)'}

대본만 작성하고, 설명이나 구조 표시 없이 순수한 대본 텍스트만 출력하세요.
자막으로 표시될 것이므로 줄바꿈을 적절히 사용하고, 각 문장은 간결하게 작성하세요.`

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
      max_tokens: 500,
      temperature: isRegenerate ? 0.9 : 0.75
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API 오류: ${response.status}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content?.trim() || '대본 생성 실패'
}

// ─────────────────────────────────────────
// 헬퍼: 샘플 대본 (API 키 없을 때)
// ─────────────────────────────────────────
function generateSampleScript(persona: any, valueKeywords: string[]): string {
  const samples: Record<string, string> = {
    mom: `밤마다 아이가 긁어서 속상하셨죠?\n좋다는 거 다 써봤는데 소용없고\n엄마 마음이 얼마나 찢어지던지요.\n\n이거 쓰고 나서부터 달라졌어요.\n애가 안 긁어요, 진짜로.\n\n성분이 순해서 믿음도 가고\n지금은 피부가 꿀광이에요 우리 아이.\n\n프로필 링크 확인해보세요 🔗`,
    sister: `맨날 서서 일하다 퇴근하면 다리가 통나무잖아요.\n이거저거 다 써봤는데 다 거기서 거기.\n\n근데 이거 퇴근하고 딱 10분만 해도\n진짜 극락이에요, 과장 아니에요.\n\n삶의 질이 올라간 게 느껴져요 진짜로.\n이제 이거 없으면 못 살 것 같아요.\n\n링크 타서 확인해봐요 👇`,
    solo: `자취방에 뭘 들여놓기가 너무 부담스럽잖아요.\n공간도 없고 돈도 없는데.\n\n근데 이건 접으면 진짜 한 뼘이에요.\n가격도 부담 없고 기능은 완벽해요.\n\n자취 퀄리티가 갑자기 올라간 느낌이에요.\n진짜 잘 산 것 같아요.\n\n한번 써보세요, 후회 없어요 ✅`,
    expert: `성인 3명 중 1명이 이 문제로 고생하는데\n많은 분들이 잘못된 방법을 쓰고 계세요.\n\n이 제품은 임상 검증된 성분을 사용해서\n다른 제품들과 확실히 다르더라고요.\n\n실제로 사용 후 수치가 개선된 걸 확인했어요.\n전문가 입장에서 자신 있게 추천합니다.\n\n자세한 정보는 프로필 링크에서 확인하세요 📊`,
    dad: `주말에 애 혼자 봤다가 완전 초토화됐는데요.\n어떻게 해줘야 하는지 진짜 막막하잖아요.\n\n이거 하나로 아이가 집중해주니까\n저도 드디어 숨 쉬었어요 솔직히.\n\n주말이 이제 두렵지 않아요 진짜로.\n가족 모두가 행복해졌어요.\n\n육아하는 아빠들 꼭 써보세요 👍`
  }

  const personaName = persona?.name || 'mom'
  return samples[personaName] || samples['mom']
}
