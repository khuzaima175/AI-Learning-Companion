-- ============================================================
-- AI Learning Companion – Supabase Schema (Multi-Tenant)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Courses
CREATE TABLE IF NOT EXISTS courses (
    id        BIGSERIAL PRIMARY KEY,
    user_id   UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_course_per_user UNIQUE (user_id, name)
);

-- 2. Videos
CREATE TABLE IF NOT EXISTS videos (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id    BIGINT REFERENCES courses (id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    video_id     TEXT,
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
    user_id          UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    video_id         BIGINT REFERENCES videos (id) ON DELETE CASCADE,
    question         TEXT NOT NULL,
    options          TEXT NOT NULL,  -- stored as JSON string
    answer           TEXT NOT NULL,
    srs_level        INTEGER DEFAULT 0,
    next_review_date DATE DEFAULT CURRENT_DATE,
    difficulty       TEXT DEFAULT 'medium',
    times_answered   INTEGER DEFAULT 0,
    times_correct    INTEGER DEFAULT 0,
    created_date     DATE DEFAULT CURRENT_DATE
);

-- 4. Quiz Sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    session_date        DATE DEFAULT CURRENT_DATE,
    questions_answered  INTEGER DEFAULT 0,
    questions_correct   INTEGER DEFAULT 0,
    session_type        TEXT DEFAULT 'review',
    created_timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- High-Performance Composite Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_courses_user           ON courses (user_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_course     ON videos (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_user_due          ON quiz_questions (user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_quiz_user_video        ON quiz_questions (user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date     ON quiz_sessions (user_id, session_date);

-- ============================================================
-- Atomic Session Increment RPC (Fast & Concurrency-Safe)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_session(s_id BIGINT, add_correct INT)
RETURNS VOID AS $$
BEGIN
    UPDATE quiz_sessions
    SET questions_answered = questions_answered + 1,
        questions_correct  = questions_correct + add_correct
    WHERE id = s_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Row Level Security (RLS)
-- Backend uses Supabase Service Key, bypassing RLS.
-- ============================================================
ALTER TABLE courses        DISABLE ROW LEVEL SECURITY;
ALTER TABLE videos         DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions  DISABLE ROW LEVEL SECURITY;
