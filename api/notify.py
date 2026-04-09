"""
api/notify.py — Single unified cron handler for all 6 daily email notifications.

Vercel hits this endpoint 6x/day with ?type=<name>. Each cron in vercel.json
points to a different ?type, so one file handles everything cleanly.

Schedule (PKT → UTC):
  morning   → 10:00 AM PKT = 05:00 UTC
  midday    → 12:00 PM PKT = 07:00 UTC
  afternoon →  3:00 PM PKT = 10:00 UTC
  evening   →  6:00 PM PKT = 13:00 UTC
  night     →  9:00 PM PKT = 16:00 UTC
  final     → 11:30 PM PKT = 18:30 UTC
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
load_dotenv()

from src.database import DatabaseManager
from src.email_service import (
    send_morning_email,
    send_midday_email,
    send_afternoon_email,
    send_evening_email,
    send_night_email,
    send_final_email,
)

# Map ?type= param to the correct sender function
EMAIL_HANDLERS = {
    "morning":   send_morning_email,
    "midday":    send_midday_email,
    "afternoon": send_afternoon_email,
    "evening":   send_evening_email,
    "night":     send_night_email,
    "final":     send_final_email,
}


def handler(request: Request):
    # ── Auth: verify cron secret ──────────────────────────────────────────────
    secret = os.environ.get("CRON_SECRET", "")
    auth_header = request.headers.get("authorization", "")
    if secret and auth_header != f"Bearer {secret}":
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    # ── Resolve notification type ─────────────────────────────────────────────
    email_type = request.query_params.get("type", "").lower()
    if email_type not in EMAIL_HANDLERS:
        return JSONResponse(
            {"error": f"Unknown type '{email_type}'. Valid: {list(EMAIL_HANDLERS.keys())}"},
            status_code=400,
        )

    # ── Resolve recipient ─────────────────────────────────────────────────────
    notify_email = os.environ.get("NOTIFY_EMAIL", "")
    notify_user_id = os.environ.get("NOTIFY_USER_ID", "")
    if not notify_email or not notify_user_id:
        return JSONResponse(
            {"error": "NOTIFY_EMAIL and NOTIFY_USER_ID must be set"},
            status_code=500,
        )

    # ── Check due card count ──────────────────────────────────────────────────
    try:
        db = DatabaseManager()
        due_count = db.get_due_review_count(user_id=notify_user_id)
    except Exception as e:
        return JSONResponse({"error": f"DB error: {e}"}, status_code=500)

    # Morning always fires; all others are skipped if already reviewed
    if due_count == 0:
        reason = "Great job — all cards reviewed!" if email_type != "morning" else "No cards due today"
        return JSONResponse({"ok": True, "sent": False, "reason": reason})

    # ── Send email ────────────────────────────────────────────────────────────
    try:
        send_fn = EMAIL_HANDLERS[email_type]
        sent = send_fn(to_email=notify_email, due_count=due_count)
        return JSONResponse({
            "ok": True,
            "sent": sent,
            "type": email_type,
            "due_count": due_count,
            "to": notify_email,
        })
    except Exception as e:
        return JSONResponse({"error": f"Email send failed: {e}"}, status_code=500)
