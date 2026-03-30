"""
DatabaseManager - local SQLite storage for AI Learning Companion.
Replaces the Google Colab / Google Drive version from main.py.
Database is stored at APPDATA/AILearningCompanion/learning.db
"""

import json
import os
import shutil
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path


def _get_db_dir() -> Path:
    base = Path(os.getenv("APPDATA", Path.home())) / "AILearningCompanion"
    base.mkdir(parents=True, exist_ok=True)
    return base


class DatabaseManager:
    def __init__(self, db_file: str = "learning.db"):
        self.app_dir = _get_db_dir()
        self.db_path = str(self.app_dir / db_file)
        self.conn = self._get_connection()
        self.setup_database()

    # ------------------------------------------------------------------
    # Connection helpers
    # ------------------------------------------------------------------

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def setup_database(self):
        cursor = self.conn.cursor()

        cursor.execute(
            "CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)"
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY,
                course_id INTEGER,
                title TEXT,
                video_id TEXT UNIQUE,
                summary TEXT,
                key_concepts TEXT,
                bullet_points TEXT,
                user_notes TEXT,
                transcript TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses (id)
            )"""
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY,
                video_id INTEGER,
                question TEXT,
                options TEXT,
                answer TEXT,
                srs_level INTEGER DEFAULT 0,
                next_review_date DATE,
                difficulty TEXT DEFAULT 'medium',
                times_answered INTEGER DEFAULT 0,
                times_correct INTEGER DEFAULT 0,
                created_date DATE DEFAULT CURRENT_DATE,
                FOREIGN KEY (video_id) REFERENCES videos (id)
            )"""
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS quiz_sessions (
                id INTEGER PRIMARY KEY,
                session_date DATE DEFAULT CURRENT_DATE,
                questions_answered INTEGER DEFAULT 0,
                questions_correct INTEGER DEFAULT 0,
                session_type TEXT DEFAULT 'review',
                created_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        self._migrate_database()
        self.conn.commit()
        self._create_backup()

    def _migrate_database(self):
        cursor = self.conn.cursor()

        cursor.execute("PRAGMA table_info(videos)")
        video_columns = [col[1] for col in cursor.fetchall()]
        for col_name, col_def in [
            ("transcript", "TEXT"),
            ("created_date", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ]:
            if col_name not in video_columns:
                try:
                    cursor.execute(f"ALTER TABLE videos ADD COLUMN {col_name} {col_def}")
                except Exception:
                    pass

        cursor.execute("PRAGMA table_info(quiz_questions)")
        quiz_columns = [col[1] for col in cursor.fetchall()]
        for col_name, col_def in [
            ("difficulty", "TEXT DEFAULT 'medium'"),
            ("times_answered", "INTEGER DEFAULT 0"),
            ("times_correct", "INTEGER DEFAULT 0"),
            ("created_date", "DATE DEFAULT CURRENT_DATE"),
        ]:
            if col_name not in quiz_columns:
                try:
                    cursor.execute(
                        f"ALTER TABLE quiz_questions ADD COLUMN {col_name} {col_def}"
                    )
                except Exception:
                    pass

    def _create_backup(self):
        try:
            backup_dir = self.app_dir / "backups"
            backup_dir.mkdir(exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = backup_dir / f"learning_backup_{ts}.db"
            shutil.copy2(self.db_path, str(backup_path))

            # Keep only 5 most recent backups
            backups = sorted(backup_dir.glob("learning_backup_*.db"), reverse=True)
            for old in backups[5:]:
                try:
                    old.unlink()
                except Exception:
                    pass
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Query execution
    # ------------------------------------------------------------------

    def execute_query(self, query: str, params=(), fetch=None):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                cursor = self.conn.cursor()
                cursor.execute(query, params)

                if fetch == "one":
                    result = cursor.fetchone()
                elif fetch == "all":
                    result = cursor.fetchall()
                else:
                    result = None

                self.conn.commit()

                if any(kw in query.upper() for kw in ("INSERT", "UPDATE", "DELETE")):
                    self.conn.execute("PRAGMA wal_checkpoint(FULL)")

                return result

            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                try:
                    self.conn.close()
                    self.conn = self._get_connection()
                except Exception:
                    pass
                raise
        return None

    def close(self):
        try:
            if self.conn:
                self.conn.execute("PRAGMA wal_checkpoint(FULL)")
                self.conn.close()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Course / Video CRUD
    # ------------------------------------------------------------------

    def get_or_create_course(self, name: str) -> int:
        clean = name.strip()
        row = self.execute_query(
            "SELECT id FROM courses WHERE name = ?", (clean,), fetch="one"
        )
        if row:
            return row[0]
        self.execute_query("INSERT INTO courses (name) VALUES (?)", (clean,))
        return self.execute_query("SELECT last_insert_rowid()", fetch="one")[0]

    def add_video_data(self, data: dict) -> int:
        existing = self.execute_query(
            "SELECT id FROM videos WHERE video_id = ?", (data["video_id"],), fetch="one"
        )
        if existing:
            self.execute_query(
                """UPDATE videos SET course_id=?, title=?, summary=?, key_concepts=?,
                   bullet_points=?, user_notes=?, transcript=? WHERE video_id=?""",
                (
                    data["course_id"],
                    data["title"],
                    data["summary"],
                    json.dumps(data["key_concepts"]),
                    json.dumps(data["bullet_points"]),
                    "",
                    data["transcript"],
                    data["video_id"],
                ),
            )
            return existing[0]
        self.execute_query(
            """INSERT INTO videos
               (course_id, title, video_id, summary, key_concepts, bullet_points, user_notes, transcript)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["course_id"],
                data["title"],
                data["video_id"],
                data["summary"],
                json.dumps(data["key_concepts"]),
                json.dumps(data["bullet_points"]),
                "",
                data["transcript"],
            ),
        )
        return self.execute_query("SELECT last_insert_rowid()", fetch="one")[0]

    def get_video_info_for_quiz(self, video_db_id: int):
        return self.execute_query(
            "SELECT title, transcript FROM videos WHERE id = ?",
            (video_db_id,),
            fetch="one",
        )

    def get_video_details(self, video_id: int):
        return self.execute_query(
            "SELECT title, summary, key_concepts, bullet_points, user_notes FROM videos WHERE id = ?",
            (video_id,),
            fetch="one",
        )

    def update_user_notes(self, video_id: int, notes: str):
        self.execute_query("UPDATE videos SET user_notes = ? WHERE id = ?", (notes, video_id))

    def get_all_courses(self):
        return self.execute_query("SELECT id, name FROM courses ORDER BY name", fetch="all") or []

    def get_videos_for_course(self, course_id: int):
        return (
            self.execute_query(
                "SELECT id, title FROM videos WHERE course_id = ? ORDER BY title",
                (course_id,),
                fetch="all",
            )
            or []
        )

    def delete_video(self, video_id: int):
        try:
            self.execute_query("DELETE FROM quiz_questions WHERE video_id = ?", (video_id,))
            self.execute_query("DELETE FROM videos WHERE id = ?", (video_id,))
            return True, "Video and all associated data deleted successfully."
        except Exception as e:
            return False, f"Error deleting video: {e}"

    def delete_course(self, course_id: int):
        try:
            videos = self.execute_query(
                "SELECT id FROM videos WHERE course_id = ?", (course_id,), fetch="all"
            ) or []
            for (vid,) in videos:
                self.execute_query("DELETE FROM quiz_questions WHERE video_id = ?", (vid,))
            self.execute_query("DELETE FROM videos WHERE course_id = ?", (course_id,))
            self.execute_query("DELETE FROM courses WHERE id = ?", (course_id,))
            return True, "Course and all associated data deleted successfully."
        except Exception as e:
            return False, f"Error deleting course: {e}"

    def get_course_stats(self, course_id: int):
        try:
            v = self.execute_query(
                "SELECT COUNT(*) FROM videos WHERE course_id = ?", (course_id,), fetch="one"
            )[0]
            q = self.execute_query(
                """SELECT COUNT(*) FROM quiz_questions qq
                   JOIN videos v ON qq.video_id = v.id
                   WHERE v.course_id = ?""",
                (course_id,),
                fetch="one",
            )[0]
            return v, q
        except Exception:
            return 0, 0

    def get_video_stats(self, video_id: int) -> int:
        try:
            return self.execute_query(
                "SELECT COUNT(*) FROM quiz_questions WHERE video_id = ?",
                (video_id,),
                fetch="one",
            )[0]
        except Exception:
            return 0

    # ------------------------------------------------------------------
    # Quiz CRUD
    # ------------------------------------------------------------------

    def add_quiz_questions(self, video_db_id: int, questions: list):
        self.execute_query("DELETE FROM quiz_questions WHERE video_id = ?", (video_db_id,))
        today = datetime.now().date()
        for q in questions:
            difficulty = q.get("difficulty", "medium")
            self.execute_query(
                """INSERT INTO quiz_questions
                   (video_id, question, options, answer, next_review_date, difficulty)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (video_db_id, q["question"], json.dumps(q["options"]), q["answer"], today, difficulty),
            )

    def get_due_review_count(self) -> int:
        today = datetime.now().date()
        return (
            self.execute_query(
                "SELECT COUNT(*) FROM quiz_questions WHERE next_review_date <= ?",
                (today,),
                fetch="one",
            )[0]
            or 0
        )

    def get_due_questions(self, limit=None):
        today = datetime.now().date()
        query = "SELECT id, question, options, answer FROM quiz_questions WHERE next_review_date <= ? ORDER BY RANDOM()"
        params = (today,)
        if limit:
            query += " LIMIT ?"
            params = (today, limit)
        return self.execute_query(query, params, fetch="all") or []

    def get_questions_by_video(self, video_id: int, limit=None):
        query = "SELECT id, question, options, answer FROM quiz_questions WHERE video_id = ? ORDER BY RANDOM()"
        params = (video_id,)
        if limit:
            query += " LIMIT ?"
            params = (video_id, limit)
        return self.execute_query(query, params, fetch="all") or []

    def get_questions_by_course(self, course_id: int, limit=None):
        query = """SELECT qq.id, qq.question, qq.options, qq.answer
                   FROM quiz_questions qq JOIN videos v ON qq.video_id = v.id
                   WHERE v.course_id = ? ORDER BY RANDOM()"""
        params = (course_id,)
        if limit:
            query += " LIMIT ?"
            params = (course_id, limit)
        return self.execute_query(query, params, fetch="all") or []

    def get_all_questions(self, limit=None):
        query = "SELECT id, question, options, answer FROM quiz_questions ORDER BY RANDOM()"
        params = ()
        if limit:
            query += " LIMIT ?"
            params = (limit,)
        return self.execute_query(query, params, fetch="all") or []

    def update_srs_level(self, question_id: int, performance: str):
        row = self.execute_query(
            "SELECT srs_level, times_answered, times_correct FROM quiz_questions WHERE id = ?",
            (question_id,),
            fetch="one",
        )
        if not row:
            return
        level, times_answered, times_correct = row
        times_answered += 1
        if performance in ("good", "easy"):
            times_correct += 1
        if performance == "hard":
            level = 0
        elif performance == "good":
            level = min(level + 1, 6)
        elif performance == "easy":
            level = min(level + 2, 6)
        interval_days = [1, 3, 7, 14, 30, 90, 180][level]
        next_review = datetime.now().date() + timedelta(days=interval_days)
        self.execute_query(
            """UPDATE quiz_questions
               SET srs_level=?, next_review_date=?, times_answered=?, times_correct=?
               WHERE id=?""",
            (level, next_review, times_answered, times_correct, question_id),
        )

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_quiz_stats(self) -> dict:
        total = self.execute_query("SELECT COUNT(*) FROM quiz_questions", fetch="one")[0]
        due = self.get_due_review_count()
        acc_row = self.execute_query(
            """SELECT AVG(CASE WHEN times_answered > 0
               THEN CAST(times_correct AS FLOAT) / times_answered ELSE 0 END)
               FROM quiz_questions WHERE times_answered > 0""",
            fetch="one",
        )
        accuracy = (acc_row[0] * 100) if acc_row and acc_row[0] else 0.0
        return {
            "total_questions": total,
            "due_questions": due,
            "accuracy": round(accuracy, 1),
        }

    def create_quiz_session(self) -> int:
        self.execute_query(
            "INSERT INTO quiz_sessions (session_date, questions_answered, questions_correct) VALUES (?, ?, ?)",
            (datetime.now().date(), 0, 0),
        )
        return self.execute_query("SELECT last_insert_rowid()", fetch="one")[0]

    def update_quiz_session(self, session_id: int, correct: bool):
        self.execute_query(
            """UPDATE quiz_sessions
               SET questions_answered = questions_answered + 1,
                   questions_correct = questions_correct + ?
               WHERE id = ?""",
            (1 if correct else 0, session_id),
        )

    def get_recent_sessions(self, limit: int = 10):
        return (
            self.execute_query(
                """SELECT session_date, questions_answered, questions_correct
                   FROM quiz_sessions ORDER BY id DESC LIMIT ?""",
                (limit,),
                fetch="all",
            )
            or []
        )

    def get_database_info(self) -> dict:
        return {
            "path": self.db_path,
            "size_kb": round(os.path.getsize(self.db_path) / 1024, 1)
            if os.path.exists(self.db_path)
            else 0,
            "courses": (
                self.execute_query("SELECT COUNT(*) FROM courses", fetch="one") or (0,)
            )[0],
            "videos": (
                self.execute_query("SELECT COUNT(*) FROM videos", fetch="one") or (0,)
            )[0],
            "questions": (
                self.execute_query("SELECT COUNT(*) FROM quiz_questions", fetch="one") or (0,)
            )[0],
        }
