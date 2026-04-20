# AI Studio - 페르소나 기반 쇼츠 자동생성 시스템

## 📌 프로젝트 개요
도우인(Douyin)/샤오홍슈 영상 URL과 상품 정보를 입력하면, 페르소나(엄마/누나/자취생/전문가/육아대디) 시점의 감성적인 한국어 쇼츠 대본을 자동 생성하고, TTS 음성과 자막을 제공하는 **AI 마케팅 쇼츠 공장**입니다.

## 🌐 URLs
- **로컬 개발**: http://localhost:3000
- **API 베이스**: http://localhost:3000/api

## ✅ 구현된 기능

### 1. 스마트 입력 섹션
- 도우인/샤오홍슈/기타 플랫폼 자동 인식 탭
- URL 입력 시 플랫폼 자동 감지
- 댓글·상품정보 컨텍스트 박스 (자유 텍스트 붙여넣기)

### 2. 페르소나 시스템 (PAS+E 구조)
- **엄마** 👩‍👧: 따뜻한 공감형, 육아 밀착형 경험담
- **누나/언니** 👩‍💼: 트렌디 자기관리형, MZ 감성
- **자취생** 🏠: 실용 가성비형, 공간 효율 중심
- **전문가** 🔬: 신뢰 정보형, 데이터/성분 기반
- **육아대디** 👨‍👦: 유쾌 공감형, 솔직한 아빠 시점
- 페르소나 선택 시 자동으로 맞는 TTS 보이스 추천

### 3. 가치 키워드 선택기
- 피부 개선, 시간 절약, 삶의 질 상승, 가성비 최강 등 12개 키워드
- 다중 선택 → 대본 생성 프롬프트에 자동 주입

### 4. 자막 스타일 프리셋 (5종)
- 기본 하단 바 (NanumSquareRound)
- 배민 감성체 (BMJUA)
- 강조형 굵은 자막 (NanumSquareExtraBold)
- 여기어때 잘난체 (GmarketSansBold)
- 나눔 명조 감성 (NanumMyeongjo)

### 5. TTS 성우 선택 (5종)
- ElevenLabs API 연동 (multilingual v2)
- 따뜻한 엄마, 트렌디 누나, 친근한 자취생, 전문가, 유쾌한 아빠
- 페르소나별 자동 매칭
- 브라우저 내장 TTS (API 키 없을 때 미리듣기)

### 6. AI 대본 생성 엔진 (PAS+E)
- OpenAI GPT-4o-mini 활용
- 구조: [3초 후킹] → [문제P] → [공감A] → [해결S] → [효과E] → [CTA]
- API 키 없을 때 샘플 대본 자동 제공
- 대본 재생성 (다른 버전), 직접 편집, 복사 기능
- 글자 수 가이드 (70~120자 권장)

### 7. 워크플로우 진행 상황 뷰어
- 대기 → 대본 → TTS → 렌더링 → 완료 단계 표시
- n8n 연결 상태 표시

### 8. 자막 미리보기 탭
- 9:16 세로형 미리보기
- 선택한 프리셋으로 실시간 자막 스타일 확인
- 대본 라인별 자막 목록 + 글자 수
- 예상 영상 시간 계산

### 9. 작업 히스토리
- Cloudflare D1 DB에 모든 작업 저장
- 히스토리 탭에서 이전 작업 불러오기

## 🔌 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/personas` | 페르소나 목록 |
| GET | `/api/subtitle-presets` | 자막 프리셋 목록 |
| GET | `/api/tts-voices` | TTS 보이스 목록 |
| POST | `/api/jobs` | 새 작업 생성 (대본 생성) |
| GET | `/api/jobs` | 작업 히스토리 목록 |
| GET | `/api/jobs/:id` | 특정 작업 조회 |
| POST | `/api/jobs/:id/regenerate-script` | 대본 재생성 |
| POST | `/api/jobs/:id/generate-tts` | TTS 생성 |
| PATCH | `/api/jobs/:id/script` | 대본 수정 |
| GET | `/api/settings` | API 키 설정 상태 |

## 🗄️ 데이터 아키텍처

### Cloudflare D1 테이블
- `personas` - 페르소나 프롬프트 템플릿
- `subtitle_presets` - 자막 스타일 프리셋
- `tts_voices` - TTS 보이스 목록
- `jobs` - 작업 히스토리 및 상태
- `script_history` - 대본 버전 히스토리

### 환경 변수 (Cloudflare Secrets)
- `OPENAI_API_KEY` - 대본 생성용 GPT-4o-mini
- `ELEVENLABS_API_KEY` - TTS 생성
- `N8N_WEBHOOK_URL` - n8n 자동화 파이프라인 연동

## 🚀 기술 스택
- **Backend**: Hono + TypeScript + Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JS + Tailwind CSS + FontAwesome
- **AI**: OpenAI GPT-4o-mini (대본) + ElevenLabs (TTS)
- **Automation**: n8n 웹훅 연동 준비 완료

## 📋 미구현 / 로드맵
- [ ] 실제 도우인/샤오홍슈 영상 다운로드 (yt-dlp n8n 연동)
- [ ] 자막 제거 (OpenCV + LaMa 인페인팅)
- [ ] FFmpeg 영상 합성 (음성+자막+원본 영상)
- [ ] BGM Mood Sync (감정선에 맞는 배경음악)
- [ ] Visual Sync Subtitle (키워드 강조 색상 변경)
- [ ] 완성 영상 다운로드 링크 제공
- [ ] Kokoro-82M 로컬 TTS 엔진 연동

## 🔧 개발 환경 실행
```bash
# 의존성 설치
npm install

# 빌드
npm run build

# D1 마이그레이션 (최초 1회)
npm run db:migrate:local
npm run db:seed

# PM2로 서비스 시작
pm2 start ecosystem.config.cjs

# 브라우저에서 접속
# http://localhost:3000
```

## 💡 사용 방법
1. 도우인/샤오홍슈 영상 URL 입력
2. 댓글·상품정보 텍스트 붙여넣기 (선택)
3. 페르소나 선택 (엄마/누나/자취생/전문가/육아대디)
4. 강조 키워드 선택 (다중 가능)
5. 자막 스타일 프리셋 선택
6. TTS 성우 선택
7. **AI 대본 생성하기** 클릭
8. 생성된 대본 확인/수정/재생성
9. TTS 생성으로 음성 미리듣기
10. 자막 미리보기 탭에서 최종 확인

**Last Updated**: 2026-04-20  
**Status**: ✅ MVP 완성 (대본+TTS+프리셋 시스템)
