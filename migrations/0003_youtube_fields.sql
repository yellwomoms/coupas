-- jobs 테이블에 유튜브/SNS 제목·설명 컬럼 추가
ALTER TABLE jobs ADD COLUMN youtube_title TEXT DEFAULT '';
ALTER TABLE jobs ADD COLUMN youtube_description TEXT DEFAULT '';
