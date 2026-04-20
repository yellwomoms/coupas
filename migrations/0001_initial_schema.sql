-- AI Studio: 페르소나 기반 쇼츠 자동생성 시스템 DB 스키마

-- 페르소나 프리셋 테이블
CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  tone TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  speech_style TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 자막 스타일 프리셋 테이블
CREATE TABLE IF NOT EXISTS subtitle_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  font_family TEXT NOT NULL,
  font_size INTEGER DEFAULT 36,
  font_color TEXT DEFAULT '#FFFFFF',
  bg_color TEXT DEFAULT 'rgba(0,0,0,0.6)',
  layout TEXT DEFAULT 'bottom_bar',
  highlight_color TEXT DEFAULT '#FFD700',
  stroke_color TEXT DEFAULT '#000000',
  stroke_width INTEGER DEFAULT 2,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TTS 보이스 프리셋 테이블
CREATE TABLE IF NOT EXISTS tts_voices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  provider TEXT DEFAULT 'elevenlabs',
  gender TEXT DEFAULT 'female',
  style TEXT DEFAULT 'warm',
  description TEXT,
  persona_match TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 작업(Job) 테이블
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT UNIQUE NOT NULL,
  source_url TEXT NOT NULL,
  platform TEXT DEFAULT 'douyin',
  context_text TEXT,
  persona_id INTEGER,
  subtitle_preset_id INTEGER,
  tts_voice_id INTEGER,
  value_keywords TEXT,
  status TEXT DEFAULT 'pending',
  stage TEXT DEFAULT 'waiting',
  script_content TEXT,
  tts_audio_url TEXT,
  output_video_url TEXT,
  video_duration INTEGER,
  error_message TEXT,
  n8n_webhook_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id),
  FOREIGN KEY (subtitle_preset_id) REFERENCES subtitle_presets(id),
  FOREIGN KEY (tts_voice_id) REFERENCES tts_voices(id)
);

-- 대본 히스토리 테이블
CREATE TABLE IF NOT EXISTS script_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  script_content TEXT NOT NULL,
  persona_id INTEGER,
  is_selected INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_script_history_job_id ON script_history(job_id);
