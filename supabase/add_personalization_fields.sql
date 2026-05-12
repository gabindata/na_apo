-- users 테이블에 개인화 정보 컬럼 추가
-- Supabase SQL Editor 또는 psql에서 실행하세요.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_year smallint,
  ADD COLUMN IF NOT EXISTS gender     text CHECK (gender IN ('male', 'female', 'none'));
