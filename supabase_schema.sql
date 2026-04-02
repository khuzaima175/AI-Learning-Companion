-- ============================================================
-- AI Learning Companion – Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Courses
CREATE TABLE IF NOT EXISTS courses (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- 2. Videos
CREATE TABLE IF NOT EXISTS videos (
    id           BIGSERIAL PRIMARY KEY,
    course_id    BIGINT REFERENCES courses (id) ON DELETE CASCADE,
    title        TEXT,
    video_id     TEXT UNIQUE,
    summary      TEXT,
    key_concepts TEXT,   -- stored as JSON string
    bullet_points TEXT,  -- stored as JSON string
    user_notes   TEXT,
    transcript   TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id               BIGSERIAL PRIMARY KEY,
    video_id         BIGINT REFERENCES videos (id) ON DELETE CASCADE,
    question         TEXT,
    options          TEXT,  -- stored as JSON string
    answer           TEXT,
    srs_level        INTEGER DEFAULT 0,
    next_review_date DATE,
    difficulty       TEXT DEFAULT 'medium',
    times_answered   INTEGER DEFAULT 0,
    times_correct    INTEGER DEFAULT 0,
    created_date     DATE DEFAULT CURRENT_DATE
);

-- 4. Quiz Sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id                  BIGSERIAL PRIMARY KEY,
    session_date        DATE DEFAULT CURRENT_DATE,
    questions_answered  INTEGER DEFAULT 0,
    questions_correct   INTEGER DEFAULT 0,
    session_type        TEXT DEFAULT 'review',
    created_timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Optional: Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_videos_course_id       ON videos (course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_video_id ON quiz_questions (video_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_review   ON quiz_questions (next_review_date);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_date      ON quiz_sessions (session_date);

-- ============================================================
-- Row Level Security (RLS) – disable for service-role-key usage
-- The backend uses service role key so RLS doesn't block it.
-- ============================================================
ALTER TABLE courses        DISABLE ROW LEVEL SECURITY;
ALTER TABLE videos         DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions  DISABLE ROW LEVEL SECURITY;
