"""
src/email_service.py — Resend-powered email notification service.

Sends daily study reminders with escalating urgency throughout the day.
Each email is a rich HTML template styled to match the app's dark aesthetic.
"""

import os
import resend
from dotenv import load_dotenv

load_dotenv()


def _get_resend_client():
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        raise EnvironmentError("RESEND_API_KEY must be set as an environment variable.")
    resend.api_key = api_key


def _app_url() -> str:
    return os.environ.get("APP_URL", "https://ai-learning-companion.vercel.app")


def _sender() -> str:
    return os.environ.get("NOTIFY_FROM_EMAIL", "AI Learning Companion <onboarding@resend.dev>")


# ── HTML Template ──────────────────────────────────────────────────────────────

def _build_email_html(
    emoji: str,
    headline: str,
    subtext: str,
    due_count: int,
    cta_label: str,
    cta_url: str,
    urgency_color: str = "#6c63ff",
    footer_note: str = "",
) -> str:
    """Renders a single consistent dark-theme HTML email."""
    card_plural = "card" if due_count == 1 else "cards"
    due_badge = f"{due_count} {card_plural} due"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{headline}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background: #0d0d1a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #e2e8f0;
      padding: 40px 20px;
    }}
    .wrapper {{
      max-width: 580px;
      margin: 0 auto;
    }}
    .card {{
      background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 20px;
      border: 1px solid rgba(108, 99, 255, 0.2);
      overflow: hidden;
    }}
    .header {{
      background: linear-gradient(135deg, {urgency_color}22 0%, {urgency_color}08 100%);
      border-bottom: 1px solid {urgency_color}30;
      padding: 36px 40px 28px;
      text-align: center;
    }}
    .emoji {{
      font-size: 52px;
      display: block;
      margin-bottom: 16px;
      line-height: 1;
    }}
    .app-name {{
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: {urgency_color};
      margin-bottom: 12px;
    }}
    .headline {{
      font-size: 26px;
      font-weight: 800;
      color: #f1f5f9;
      line-height: 1.3;
    }}
    .body {{
      padding: 32px 40px;
    }}
    .subtext {{
      font-size: 15px;
      color: #94a3b8;
      line-height: 1.7;
      margin-bottom: 28px;
    }}
    .due-badge {{
      display: inline-block;
      background: {urgency_color}20;
      border: 1px solid {urgency_color}50;
      color: {urgency_color};
      font-size: 13px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 999px;
      letter-spacing: 0.5px;
      margin-bottom: 28px;
    }}
    .cta-btn {{
      display: block;
      background: linear-gradient(135deg, {urgency_color} 0%, {urgency_color}cc 100%);
      color: #fff !important;
      text-decoration: none;
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      padding: 16px 32px;
      border-radius: 12px;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 24px {urgency_color}40;
      transition: all 0.2s;
    }}
    .divider {{
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 28px 0;
    }}
    .footer {{
      text-align: center;
      font-size: 12px;
      color: #475569;
      padding: 0 40px 28px;
      line-height: 1.6;
    }}
    .footer a {{
      color: {urgency_color};
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <span class="emoji">{emoji}</span>
        <div class="app-name">AI Learning Companion</div>
        <div class="headline">{headline}</div>
      </div>
      <div class="body">
        <p class="subtext">{subtext}</p>
        <div class="due-badge">📋 {due_badge} today</div>
        <a href="{cta_url}" class="cta-btn">{cta_label}</a>
        <div class="divider"></div>
      </div>
      <div class="footer">
        {"<p>" + footer_note + "</p>" if footer_note else ""}
        <p>You're receiving this because you enabled daily study reminders.<br/>
        <a href="{cta_url}">Open AI Learning Companion</a></p>
      </div>
    </div>
  </div>
</body>
</html>"""


# ── Individual email senders ───────────────────────────────────────────────────

def send_morning_email(to_email: str, due_count: int) -> bool:
    """10:00 AM — Energetic morning kickoff."""
    _get_resend_client()
    html = _build_email_html(
        emoji="🌅",
        headline="Good morning! Your reviews are waiting.",
        subtext=(
            f"Rise and shine! You have <strong style='color:#f1f5f9'>{due_count} flashcard{'s' if due_count != 1 else ''}</strong> "
            f"scheduled for review today. Starting your day with a quick study session boosts "
            f"long-term retention by up to 50% — let's make it count!"
        ),
        due_count=due_count,
        cta_label="🚀 Start Morning Review",
        cta_url=_app_url(),
        urgency_color="#6c63ff",
    )
    try:
        resend.Emails.send({
            "from": _sender(),
            "to": [to_email],
            "subject": f"🌅 Good morning! {due_count} card{'s' if due_count != 1 else ''} ready for review",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Morning email failed: {e}")
        return False


def send_midday_email(to_email: str, due_count: int) -> bool:
    """12:00 PM — Friendly midday check-in."""
    _get_resend_client()
    html = _build_email_html(
        emoji="☀️",
        headline="Still time to crush your reviews!",
        subtext=(
            f"Hey! It's midday and you still have <strong style='color:#f1f5f9'>{due_count} card{'s' if due_count != 1 else ''}</strong> "
            f"waiting. Take a 10-minute break from whatever you're doing and knock these out — "
            f"your future self will thank you!"
        ),
        due_count=due_count,
        cta_label="📚 Review Now (10 min)",
        cta_url=_app_url(),
        urgency_color="#3b82f6",
    )
    try:
        resend.Emails.send({
            "from": _sender(),
            "to": [to_email],
            "subject": f"☀️ Midday reminder — {due_count} card{'s' if due_count != 1 else ''} still due",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Midday email failed: {e}")
        return False


def send_afternoon_email(to_email: str, due_count: int) -> bool:
    """3:00 PM — Post-lunch nudge."""
    _get_resend_client()
    html = _build_email_html(
        emoji="📖",
        headline="Perfect time for a study break!",
        subtext=(
            f"The afternoon slump is real — beat it by doing something productive! "
            f"You have <strong style='color:#f1f5f9'>{due_count} card{'s' if due_count != 1 else ''}</strong> queued. "
            f"Studies show a short review session in the afternoon dramatically improves memory consolidation overnight."
        ),
        due_count=due_count,
        cta_label="🎯 Let's Review",
        cta_url=_app_url(),
        urgency_color="#0ea5e9",
        footer_note="Tip: Reviewing in multiple shorter sessions is more effective than one long session.",
    )
    try:
        resend.Emails.send({
            "from": _sender(),
            "to": [to_email],
            "subject": f"📖 Afternoon check-in — {due_count} card{'s' if due_count != 1 else ''} awaiting",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Afternoon email failed: {e}")
        return False


def send_evening_email(to_email: str, due_count: int) -> bool:
    """6:00 PM — Urgency starts building."""
    _get_resend_client()
    html = _build_email_html(
        emoji="🌆",
        headline="Don't let evening slip by!",
        subtext=(
            f"The day is winding down and you still have <strong style='color:#f1f5f9'>{due_count} card{'s' if due_count != 1 else ''}</strong> due. "
            f"Evening is actually a great time to review — your brain is tired from the day but still "
            f"capable of forming strong memories. Don't break your streak!"
        ),
        due_count=due_count,
        cta_label="⚡ Quick Review Session",
        cta_url=_app_url(),
        urgency_color="#f59e0b",
    )
    try:
        resend.Emails.send({
            "from": _sender(),
            "to": [to_email],
            "subject": f"🌆 Evening reminder — {due_count} card{'s' if due_count != 1 else ''} still pending",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Evening email failed: {e}")
        return False


def send_night_email(to_email: str, due_count: int) -> bool:
    """9:00 PM — High urgency."""
    _get_resend_client()
    html = _build_email_html(
        emoji="🌙",
        headline="Time is running out today!",
        subtext=(
            f"It's 9 PM and <strong style='color:#f1f5f9'>{due_count} card{'s' if due_count != 1 else ''}</strong> still haven't been reviewed. "
            f"Missing a day resets your SRS streak and pushes these cards back even further. "
            f"Just 5-7 minutes is all it takes — you can do this!"
        ),
        due_count=due_count,
        cta_label="🔥 Complete Reviews Now",
        cta_url=_app_url(),
        urgency_color="#ef4444",
        footer_note="Missing reviews pushes your SRS intervals back and reduces long-term retention.",
    )
    try:
        resend.Emails.send({
            "from": _sender(),
            "to": [to_email],
            "subject": f"🌙 Only 3 hours left! {due_count} card{'s' if due_count != 1 else ''} still due today",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Night email failed: {e}")
        return False


def send_final_email(to_email: str, due_count: int) -> bool:
    """11:30 PM — FINAL CALL, 30 minutes before midnight."""
    _get_resend_client()
    html = _build_email_html(
        emoji="🚨",
        headline="FINAL CALL — 30 minutes left!",
        subtext=(
            f"This is your last chance! Midnight resets the day and <strong style='color:#f1f5f9'>{due_count} card{'s' if due_count != 1 else ''}</strong> "
            f"will be marked as missed. It takes less time to review them than it does to read this email — "
            f"open the app RIGHT NOW and finish strong!"
        ),
        due_count=due_count,
        cta_label="🚨 Complete Before Midnight!",
        cta_url=_app_url(),
        urgency_color="#dc2626",
        footer_note="⚠️ After midnight, these cards will be overdue and affect your SRS schedule.",
    )
    try:
        resend.Emails.send({
            "from": _sender(),
            "to": [to_email],
            "subject": f"🚨 FINAL CALL — 30 min left! {due_count} card{'s' if due_count != 1 else ''} still due!",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Final email failed: {e}")
        return False
