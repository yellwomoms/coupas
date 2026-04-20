-- production_presets: 자주 사용하는 제작 설정을 프리셋으로 저장
-- 자막(폰트·크기·위치·색·배경) + 성우 + 감정 + TTS 속도를 하나로 묶어 재사용

CREATE TABLE IF NOT EXISTS production_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                         -- 프리셋 이름 (예: "엄마 기본셋")
  description TEXT DEFAULT '',                -- 설명 메모

  -- ── 자막 설정 ──────────────────────────────────────────────────
  subtitle_font TEXT DEFAULT 'NanumSquareRound',  -- 폰트 패밀리
  subtitle_font_size INTEGER DEFAULT 36,           -- 글자 크기 (px)
  subtitle_position TEXT DEFAULT 'bottom',         -- 위치: bottom | middle | top
  subtitle_font_color TEXT DEFAULT '#FFFFFF',      -- 글자 색
  subtitle_bg_color TEXT DEFAULT 'rgba(0,0,0,0.65)',  -- 배경 색 (rgba)
  subtitle_bg_opacity REAL DEFAULT 0.65,           -- 배경 불투명도 0~1
  subtitle_has_bg_bar INTEGER DEFAULT 1,           -- 반투명 배경 바 ON/OFF (1/0)
  subtitle_stroke_color TEXT DEFAULT '#000000',    -- 외곽선 색
  subtitle_stroke_width INTEGER DEFAULT 2,         -- 외곽선 두께

  -- ── TTS / 성우 설정 ────────────────────────────────────────────
  tts_voice_id TEXT DEFAULT '',                    -- Typecast voice_id (tc_xxx...)
  tts_voice_name TEXT DEFAULT '',                  -- 성우 이름 (표시용)
  tts_emotion TEXT DEFAULT 'smart',                -- 감정: smart|normal|happy|toneup|sad|whisper|tonedown|angry
  tts_speed REAL DEFAULT 1.0,                      -- TTS 속도 (0.5~2.0)

  is_default INTEGER DEFAULT 0,                    -- 기본 프리셋 여부
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_production_presets_is_default ON production_presets(is_default);

-- subtitle_presets 테이블에 폰트 추가 컬럼 (이미 있으면 무시)
-- 손글씨 폰트 지원을 위해 font_family 범위 확장 (기존 컬럼 사용 가능, 별도 ALTER 불필요)
