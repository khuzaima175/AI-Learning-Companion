"""
migrate_to_supabase.py – One-off data migration script
Copies all data from the local SQLite database into Supabase.

Usage:
    1. Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env
    2. Run:  python migrate_to_supabase.py
"""

import json
import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ── Locate local SQLite DB ──────────────────────────────────────────────────
_APPDATA_DB = (
    Path(os.getenv("APPDATA", Path.home())) / "AILearningCompanion" / "learning.db"
)
_LOCAL_DB = Path("learning.db")  # fallback: repo root

def find_sqlite_db() -> Path:
    if _APPDATA_DB.exists():
        return _APPDATA_DB
    if _LOCAL_DB.exists():
        return _LOCAL_DB
    raise FileNotFoundError(
        "Could not find learning.db. "
        f"Tried: {_APPDATA_DB} and {_LOCAL_DB}"
    )


# ── Supabase client ─────────────────────────────────────────────────────────
def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


# ── Migration ────────────────────────────────────────────────────────────────
def migrate():
    db_path = find_sqlite_db()
    print(f"📂 Reading from: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    sb = get_supabase()
    print("✅ Connected to Supabase")

    # ── 1. Courses ──────────────────────────────────────────────────────────
    cur.execute("SELECT id, name FROM courses ORDER BY id")
    courses = cur.fetchall()
    course_id_map: dict[int, int] = {}  # old SQLite id → new Supabase id

    print(f"\n📚 Migrating {len(courses)} course(s)...")
    for c in courses:
        result = (
            sb.table("courses")
            .upsert({"name": c["name"]}, on_conflict="name")
            .execute()
        )
        new_id = result.data[0]["id"]
        course_id_map[c["id"]] = new_id
        print(f"  Course: [{c['id']} → {new_id}] {c['name']}")

    # ── 2. Videos ───────────────────────────────────────────────────────────
    cur.execute(
        "SELECT id, course_id, title, video_id, summary, key_concepts, "
        "bullet_points, user_notes, transcript, created_date FROM videos ORDER BY id"
    )
    videos = cur.fetchall()
    video_id_map: dict[int, int] = {}  # old SQLite id → new Supabase id

    print(f"\n🎬 Migrating {len(videos)} video(s)...")
    for v in videos:
        new_course_id = course_id_map.get(v["course_id"])
        payload = {
            "course_id":    new_course_id,
            "title":        v["title"],
            "video_id":     v["video_id"],
            "summary":      v["summary"],
            "key_concepts": v["key_concepts"],
            "bullet_points": v["bullet_points"],
            "user_notes":   v["user_notes"] or "",
            "transcript":   v["transcript"],
        }
        result = (
            sb.table("videos")
            .upsert(payload, on_conflict="video_id")
            .execute()
        )
        new_id = result.data[0]["id"]
        video_id_map[v["id"]] = new_id
        print(f"  Video: [{v['id']} → {new_id}] {v['title']}")

    # ── 3. Quiz Questions ────────────────────────────────────────────────────
    cur.execute(
        "SELECT id, video_id, question, options, answer, srs_level, "
        "next_review_date, difficulty, times_answered, times_correct, "
        "created_date FROM quiz_questions ORDER BY id"
    )
    questions = cur.fetchall()

    print(f"\n❓ Migrating {len(questions)} quiz question(s)...")
    for q in questions:
        new_video_id = video_id_map.get(q["video_id"])
        if new_video_id is None:
            print(f"  ⚠️  Skipping question {q['id']} — video not found")
            continue
        payload = {
            "video_id":         new_video_id,
            "question":         q["question"],
            "options":          q["options"],
            "answer":           q["answer"],
            "srs_level":        q["srs_level"] or 0,
            "next_review_date": q["next_review_date"],
            "difficulty":       q["difficulty"] or "medium",
            "times_answered":   q["times_answered"] or 0,
            "times_correct":    q["times_correct"] or 0,
        }
        sb.table("quiz_questions").insert(payload).execute()

    print(f"  ✅ {len(questions)} questions migrated")

    # ── 4. Quiz Sessions ─────────────────────────────────────────────────────
    cur.execute(
        "SELECT session_date, questions_answered, questions_correct, "
        "session_type FROM quiz_sessions ORDER BY id"
    )
    sessions = cur.fetchall()

    print(f"\n📊 Migrating {len(sessions)} quiz session(s)...")
    for s in sessions:
        sb.table("quiz_sessions").insert({
            "session_date":       s["session_date"],
            "questions_answered": s["questions_answered"] or 0,
            "questions_correct":  s["questions_correct"] or 0,
            "session_type":       s["session_type"] or "review",
        }).execute()
    print(f"  ✅ {len(sessions)} sessions migrated")

    conn.close()
    print("\n🎉 Migration complete! All local data is now in Supabase.")


if __name__ == "__main__":
    migrate()
