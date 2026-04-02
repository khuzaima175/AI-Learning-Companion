"""
DatabaseManager – Supabase (PostgreSQL) backend for AI Learning Companion.
Replaces the local SQLite version.

Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from environment variables
(set in .env locally, or in the Vercel dashboard for production).
"""

import json
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


def _get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set as environment variables."
        )
    return create_client(url, key)


class DatabaseManager:
    def __init__(self):
        self.sb: Client = _get_supabase_client()

    # ------------------------------------------------------------------
    # Course / Video CRUD
    # ------------------------------------------------------------------

    def get_or_create_course(self, name: str) -> int:
        clean = name.strip()
        result = self.sb.table("courses").select("id").eq("name", clean).execute()
        if result.data:
            return result.data[0]["id"]
        insert_result = self.sb.table("courses").insert({"name": clean}).execute()
        return insert_result.data[0]["id"]

    def add_video_data(self, data: dict) -> int:
        existing = (
            self.sb.table("videos")
            .select("id")
            .eq("video_id", data["video_id"])
            .execute()
        )
        payload = {
            "course_id":     data["course_id"],
            "title":         data["title"],
            "video_id":      data["video_id"],
            "summary":       data.get("summary", ""),
            "key_concepts":  json.dumps(data.get("key_concepts", [])),
            "bullet_points": json.dumps(data.get("bullet_points", [])),
            "user_notes":    "",
            "transcript":    data.get("transcript", ""),
        }
        if existing.data:
            vid_id = existing.data[0]["id"]
            self.sb.table("videos").update(payload).eq("id", vid_id).execute()
            return vid_id
        result = self.sb.table("videos").insert(payload).execute()
        return result.data[0]["id"]

    def get_video_info_for_quiz(self, video_db_id: int):
        result = (
            self.sb.table("videos")
            .select("title, transcript")
            .eq("id", video_db_id)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        return row["title"], row["transcript"]

    def get_video_details(self, video_id: int):
        result = (
            self.sb.table("videos")
            .select("title, summary, key_concepts, bullet_points, user_notes")
            .eq("id", video_id)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        return (
            row["title"],
            row["summary"],
            row["key_concepts"],
            row["bullet_points"],
            row["user_notes"],
        )

    def update_user_notes(self, video_id: int, notes: str):
        self.sb.table("videos").update({"user_notes": notes}).eq("id", video_id).execute()

    def get_all_courses(self):
        result = self.sb.table("courses").select("id, name").order("name").execute()
        return [(row["id"], row["name"]) for row in result.data]

    def get_videos_for_course(self, course_id: int):
        result = (
            self.sb.table("videos")
            .select("id, title")
            .eq("course_id", course_id)
            .order("title")
            .execute()
        )
        return [(row["id"], row["title"]) for row in result.data]

    def delete_video(self, video_id: int):
        try:
            self.sb.table("quiz_questions").delete().eq("video_id", video_id).execute()
            self.sb.table("videos").delete().eq("id", video_id).execute()
            return True, "Video and all associated data deleted successfully."
        except Exception as e:
            return False, f"Error deleting video: {e}"

    def delete_course(self, course_id: int):
        try:
            # Get all video IDs for this course
            videos = (
                self.sb.table("videos")
                .select("id")
                .eq("course_id", course_id)
                .execute()
            )
            for v in videos.data:
                self.sb.table("quiz_questions").delete().eq("video_id", v["id"]).execute()
            self.sb.table("videos").delete().eq("course_id", course_id).execute()
            self.sb.table("courses").delete().eq("id", course_id).execute()
            return True, "Course and all associated data deleted successfully."
        except Exception as e:
            return False, f"Error deleting course: {e}"

    def get_course_stats(self, course_id: int):
        try:
            v_result = (
                self.sb.table("videos")
                .select("id", count="exact")
                .eq("course_id", course_id)
                .execute()
            )
            v_count = v_result.count or 0

            video_ids = [row["id"] for row in v_result.data]
            if not video_ids:
                return v_count, 0

            q_result = (
                self.sb.table("quiz_questions")
                .select("id", count="exact")
                .in_("video_id", video_ids)
                .execute()
            )
            q_count = q_result.count or 0
            return v_count, q_count
        except Exception:
            return 0, 0

    def get_video_stats(self, video_id: int) -> int:
        try:
            result = (
                self.sb.table("quiz_questions")
                .select("id", count="exact")
                .eq("video_id", video_id)
                .execute()
            )
            return result.count or 0
        except Exception:
            return 0

    # ------------------------------------------------------------------
    # Quiz CRUD
    # ------------------------------------------------------------------

    def add_quiz_questions(self, video_db_id: int, questions: list) -> int:
        """Append new questions without deleting existing ones.
        Skips duplicates by comparing lowercased question text.
        Returns the number of questions actually inserted.
        """
        existing_result = (
            self.sb.table("quiz_questions")
            .select("question")
            .eq("video_id", video_db_id)
            .execute()
        )
        existing_texts = {row["question"].strip().lower() for row in existing_result.data}

        today = datetime.now().date().isoformat()
        inserted = 0
        rows_to_insert = []

        for q in questions:
            q_text = q.get("question", "").strip()
            if not q_text or q_text.lower() in existing_texts:
                continue
            difficulty = q.get("difficulty", "medium").lower()
            if difficulty not in ("easy", "medium", "hard"):
                difficulty = "medium"
            rows_to_insert.append({
                "video_id":         video_db_id,
                "question":         q_text,
                "options":          json.dumps(q.get("options", [])),
                "answer":           q.get("answer", ""),
                "next_review_date": today,
                "difficulty":       difficulty,
            })
            existing_texts.add(q_text.lower())
            inserted += 1

        if rows_to_insert:
            self.sb.table("quiz_questions").insert(rows_to_insert).execute()

        return inserted

    def get_due_review_count(self) -> int:
        today = datetime.now().date().isoformat()
        result = (
            self.sb.table("quiz_questions")
            .select("id", count="exact")
            .lte("next_review_date", today)
            .execute()
        )
        return result.count or 0

    def get_due_questions(self, limit=None):
        today = datetime.now().date().isoformat()
        query = (
            self.sb.table("quiz_questions")
            .select("id, question, options, answer")
            .lte("next_review_date", today)
        )
        if limit:
            query = query.limit(limit)
        result = query.execute()
        return [(r["id"], r["question"], r["options"], r["answer"]) for r in result.data]

    def get_questions_by_video(self, video_id: int, limit=None):
        query = (
            self.sb.table("quiz_questions")
            .select("id, question, options, answer")
            .eq("video_id", video_id)
        )
        if limit:
            query = query.limit(limit)
        result = query.execute()
        return [(r["id"], r["question"], r["options"], r["answer"]) for r in result.data]

    def get_questions_by_course(self, course_id: int, limit=None):
        # Get video IDs for this course first
        v_result = (
            self.sb.table("videos")
            .select("id")
            .eq("course_id", course_id)
            .execute()
        )
        video_ids = [v["id"] for v in v_result.data]
        if not video_ids:
            return []
        query = (
            self.sb.table("quiz_questions")
            .select("id, question, options, answer")
            .in_("video_id", video_ids)
        )
        if limit:
            query = query.limit(limit)
        result = query.execute()
        return [(r["id"], r["question"], r["options"], r["answer"]) for r in result.data]

    def get_all_questions(self, limit=None):
        query = self.sb.table("quiz_questions").select("id, question, options, answer")
        if limit:
            query = query.limit(limit)
        result = query.execute()
        return [(r["id"], r["question"], r["options"], r["answer"]) for r in result.data]

    def update_srs_level(self, question_id: int, performance: str):
        result = (
            self.sb.table("quiz_questions")
            .select("srs_level, times_answered, times_correct")
            .eq("id", question_id)
            .execute()
        )
        if not result.data:
            return
        row = result.data[0]
        level = row["srs_level"] or 0
        times_answered = (row["times_answered"] or 0) + 1
        times_correct = row["times_correct"] or 0

        if performance in ("good", "easy"):
            times_correct += 1
        if performance == "hard":
            level = 0
        elif performance == "good":
            level = min(level + 1, 6)
        elif performance == "easy":
            level = min(level + 2, 6)

        interval_days = [1, 3, 7, 14, 30, 90, 180][level]
        next_review = (datetime.now().date() + timedelta(days=interval_days)).isoformat()

        self.sb.table("quiz_questions").update({
            "srs_level":        level,
            "next_review_date": next_review,
            "times_answered":   times_answered,
            "times_correct":    times_correct,
        }).eq("id", question_id).execute()

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_quiz_stats(self) -> dict:
        total_result = (
            self.sb.table("quiz_questions").select("id", count="exact").execute()
        )
        total = total_result.count or 0
        due = self.get_due_review_count()

        acc_result = (
            self.sb.table("quiz_questions")
            .select("times_answered, times_correct")
            .gt("times_answered", 0)
            .execute()
        )
        rows = acc_result.data
        if rows:
            accuracy = (
                sum(r["times_correct"] / r["times_answered"] for r in rows) / len(rows)
            ) * 100
        else:
            accuracy = 0.0

        return {
            "total_questions": total,
            "due_questions":   due,
            "accuracy":        round(accuracy, 1),
        }

    def create_quiz_session(self) -> int:
        result = self.sb.table("quiz_sessions").insert({
            "session_date":       datetime.now().date().isoformat(),
            "questions_answered": 0,
            "questions_correct":  0,
        }).execute()
        return result.data[0]["id"]

    def update_quiz_session(self, session_id: int, correct: bool):
        result = (
            self.sb.table("quiz_sessions")
            .select("questions_answered, questions_correct")
            .eq("id", session_id)
            .execute()
        )
        if not result.data:
            return
        row = result.data[0]
        self.sb.table("quiz_sessions").update({
            "questions_answered": (row["questions_answered"] or 0) + 1,
            "questions_correct":  (row["questions_correct"] or 0) + (1 if correct else 0),
        }).eq("id", session_id).execute()

    def get_recent_sessions(self, limit: int = 10):
        result = (
            self.sb.table("quiz_sessions")
            .select("session_date, questions_answered, questions_correct")
            .order("id", desc=True)
            .limit(limit)
            .execute()
        )
        return [
            (r["session_date"], r["questions_answered"], r["questions_correct"])
            for r in result.data
        ]

    def get_database_info(self) -> dict:
        courses = (
            self.sb.table("courses").select("id", count="exact").execute().count or 0
        )
        videos = (
            self.sb.table("videos").select("id", count="exact").execute().count or 0
        )
        questions = (
            self.sb.table("quiz_questions").select("id", count="exact").execute().count or 0
        )
        return {
            "path":      "Supabase (cloud)",
            "size_kb":   0,
            "courses":   courses,
            "videos":    videos,
            "questions": questions,
        }
