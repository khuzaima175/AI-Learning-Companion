"""
AI Learning Companion – FastAPI server
Run with:  uvicorn app:app --reload
Open:      http://localhost:8000
"""

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from src import config
from src.auth import verify_token
from src.api_processor import ApiProcessor
from src.database import DatabaseManager

# ── App & shared singletons ────────────────────────────────────────────────
app = FastAPI(title="AI Learning Companion", version="2.0.0")

_db: DatabaseManager | None = None
_api: ApiProcessor | None = None


def get_db() -> DatabaseManager:
    global _db
    if _db is None:
        _db = DatabaseManager()
    return _db


def get_api() -> ApiProcessor:
    global _api
    if _api is None:
        _api = ApiProcessor()
    return _api


# ── Static files ───────────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ── Startup: pre-warm DB singleton so first real request is fast ──
@app.on_event("startup")
async def _warmup():
    import asyncio
    import threading
    def _init():
        try:
            get_db()  # creates and caches the Supabase client
        except Exception:
            pass  # don't crash startup if env vars are missing
    threading.Thread(target=_init, daemon=True).start()


@app.get("/")
async def index():
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.get("/api/ping")
async def ping():
    """Lightweight keep-alive endpoint — no DB hit."""
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════
# Models
# ══════════════════════════════════════════════════════════════════════════

class AddVideoRequest(BaseModel):
    url: str
    title: str
    course: str
    manual_transcript: str = ""


class GenerateQuizRequest(BaseModel):
    video_id: int
    num_questions: int = 5
    difficulties: list[str] = ["easy", "medium", "hard"]


class SRSUpdateRequest(BaseModel):
    question_id: int
    performance: str  # "hard" | "good" | "easy"


class UpdateNotesRequest(BaseModel):
    video_id: int
    notes: str


class AskQuestionRequest(BaseModel):
    video_id: int
    question: str


class ApiKeyRequest(BaseModel):
    api_key: str


class QuizAnswerRequest(BaseModel):
    session_id: int
    question_id: int
    is_correct: bool
    performance: str


# ══════════════════════════════════════════════════════════════════════════
# Config / API key
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/config")
async def get_config():
    key = config.get_api_key()
    return {
        "has_api_key": bool(key),
        "masked_key": f"****{key[-4:]}" if key and len(key) >= 4 else "set",
    }


@app.get("/api/supabase-config")
async def get_supabase_config():
    return {
        "supabase_url": os.environ.get("SUPABASE_URL", ""),
        "supabase_anon": os.environ.get("SUPABASE_ANON_KEY", "")
    }


@app.post("/api/config/api-key")
async def save_api_key(req: ApiKeyRequest):
    if not req.api_key.strip():
        raise HTTPException(400, "API key cannot be empty")
    config.save_api_key(req.api_key.strip())
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════
# Courses & Videos
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/courses")
async def list_courses(user: dict = Depends(verify_token)):
    db = get_db()
    result = db.get_all_courses_full(user_id=user["id"])   # 3 queries instead of 1+2N+V
    response = JSONResponse(content=result)
    # 15s client cache — avoids re-fetching on every page switch
    response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=30"
    return response


@app.get("/api/videos/{video_id}")
async def get_video(video_id: int, user: dict = Depends(verify_token)):
    db = get_db()
    row = db.get_video_details(video_id, user_id=user["id"])
    if not row:
        raise HTTPException(404, "Video not found")
    title, summary, key_concepts_raw, bullet_points_raw, user_notes = row
    try:
        key_concepts = json.loads(key_concepts_raw) if key_concepts_raw else []
    except Exception:
        key_concepts = []
    try:
        bullet_points = json.loads(bullet_points_raw) if bullet_points_raw else []
    except Exception:
        bullet_points = []
    q_count = db.get_video_stats(video_id, user_id=user["id"])
    return {
        "id": video_id, "title": title, "summary": summary,
        "key_concepts": key_concepts, "bullet_points": bullet_points,
        "user_notes": user_notes or "", "question_count": q_count,
    }


@app.post("/api/add-video")
async def add_video(req: AddVideoRequest, user: dict = Depends(verify_token)):
    db = get_db()
    api = get_api()

    # 1. Get transcript
    if req.manual_transcript.strip():
        transcript, vid_id = api.get_manual_transcript(req.manual_transcript.strip(), "manual")
    else:
        transcript, vid_id = api.get_youtube_transcript(req.url)
        if transcript is None:
            raise HTTPException(400, f"Could not fetch transcript: {vid_id}")

    # 2. Generate AI content
    data, err = api.generate_summary_and_concepts(transcript, req.title)
    if err or not data:
        raise HTTPException(500, f"AI processing failed: {err}")

    # 3. Save to DB
    course_id = db.get_or_create_course(req.course, user_id=user["id"])
    video_db_id = db.add_video_data({
        "course_id": course_id,
        "title": req.title,
        "video_id": vid_id if not req.manual_transcript.strip() else f"manual_{req.title[:20]}",
        "summary": data.get("summary", ""),
        "key_concepts": data.get("key_concepts", []),
        "bullet_points": data.get("bullet_points", []),
        "transcript": transcript,
    }, user_id=user["id"])

    # 4. Auto-generate quiz questions
    q_data, _ = api.generate_quiz_questions_with_difficulty(transcript, req.title, num_questions=20)
    if q_data and "quiz_questions" in q_data:
        db.add_quiz_questions(video_db_id, q_data["quiz_questions"], user_id=user["id"])

    return {"ok": True, "video_id": video_db_id, "title": req.title}


@app.post("/api/notes")
async def update_notes(req: UpdateNotesRequest, user: dict = Depends(verify_token)):
    get_db().update_user_notes(req.video_id, req.notes, user_id=user["id"])
    return {"ok": True}


@app.post("/api/ask")
async def ask_question(req: AskQuestionRequest, user: dict = Depends(verify_token)):
    db = get_db()
    api = get_api()
    row = db.get_video_info_for_quiz(req.video_id, user_id=user["id"])
    if not row:
        raise HTTPException(404, "Video not found")
    title, transcript = row
    answer, err = api.ask_video_question(req.question, transcript or "", title)
    if err:
        raise HTTPException(500, err)
    return {"answer": answer}


# ══════════════════════════════════════════════════════════════════════════
# Quiz
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/quiz/questions")
async def get_quiz_questions(
    scope: str = "all",
    scope_id: int = 0,
    limit: int = 10,
    user: dict = Depends(verify_token)
):
    db = get_db()
    if scope == "video":
        rows = db.get_questions_by_video(scope_id, user_id=user["id"], limit=limit)
    elif scope == "course":
        rows = db.get_questions_by_course(scope_id, user_id=user["id"], limit=limit)
    else:
        rows = db.get_all_questions(user_id=user["id"], limit=limit)

    questions = []
    for qid, question, options_raw, answer in rows:
        try:
            options = json.loads(options_raw) if options_raw else []
        except Exception:
            options = []
        questions.append({"id": qid, "question": question, "options": options, "answer": answer})
    return questions


@app.post("/api/quiz/generate")
async def generate_quiz(req: GenerateQuizRequest, user: dict = Depends(verify_token)):
    db = get_db()
    api = get_api()
    row = db.get_video_info_for_quiz(req.video_id, user_id=user["id"])
    if not row:
        raise HTTPException(404, "Video not found")
    title, transcript = row
    data, err = api.generate_quiz_questions_with_difficulty(
        transcript or "", title, req.num_questions, req.difficulties
    )
    if err or not data:
        raise HTTPException(500, f"Could not generate quiz: {err}")
    questions = data.get("quiz_questions", [])
    if not questions:
        raise HTTPException(500, "AI returned no questions. Try again or check your API key.")
    inserted = db.add_quiz_questions(req.video_id, questions, user_id=user["id"])
    return {"ok": True, "count": inserted, "generated": len(questions)}


@app.post("/api/quiz/start-session")
async def start_quiz_session(user: dict = Depends(verify_token)):
    sid = get_db().create_quiz_session(user_id=user["id"])
    return {"session_id": sid}


@app.post("/api/quiz/answer")
async def submit_answer(req: QuizAnswerRequest, user: dict = Depends(verify_token)):
    db = get_db()
    db.update_srs_level(req.question_id, req.performance, user_id=user["id"])
    db.update_quiz_session(req.session_id, req.is_correct, user_id=user["id"])
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════
# Daily Review (SRS)
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/review/due")
async def get_due_questions(limit: int = 0, user: dict = Depends(verify_token)):
    db = get_db()
    count = db.get_due_review_count(user_id=user["id"])
    rows = db.get_due_questions(user_id=user["id"], limit=limit)
    questions = []
    for qid, question, options_raw, answer in rows:
        try:
            options = json.loads(options_raw) if options_raw else []
        except Exception:
            options = []
        questions.append({"id": qid, "question": question, "options": options, "answer": answer})
    return {"due_count": count, "questions": questions}


@app.post("/api/review/answer")
async def submit_review_answer(req: QuizAnswerRequest, user: dict = Depends(verify_token)):
    db = get_db()
    db.update_srs_level(req.question_id, req.performance, user_id=user["id"])
    db.update_quiz_session(req.session_id, req.is_correct, user_id=user["id"])
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════
# Stats
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/stats")
async def get_stats(user: dict = Depends(verify_token)):
    db = get_db()
    quiz_stats = db.get_quiz_stats(user_id=user["id"])
    db_info = db.get_database_info(user_id=user["id"])
    sessions = db.get_recent_sessions(user_id=user["id"], limit=10)
    session_data = [
        {"date": str(s[0]), "answered": s[1], "correct": s[2]}
        for s in sessions
    ]
    return {**quiz_stats, **db_info, "recent_sessions": session_data}


# ══════════════════════════════════════════════════════════════════════════
# Manage / Delete
# ══════════════════════════════════════════════════════════════════════════

@app.delete("/api/videos/{video_id}")
async def delete_video(video_id: int, user: dict = Depends(verify_token)):
    ok, msg = get_db().delete_video(video_id, user_id=user["id"])
    if not ok:
        raise HTTPException(500, msg)
    return {"ok": True, "message": msg}


@app.delete("/api/courses/{course_id}")
async def delete_course(course_id: int, user: dict = Depends(verify_token)):
    ok, msg = get_db().delete_course(course_id, user_id=user["id"])
    if not ok:
        raise HTTPException(500, msg)
    return {"ok": True, "message": msg}
