"""
Daily Review page – Spaced Repetition System (SRS) review of due questions.

Difficulty is now rated AUTOMATICALLY:
  - < 10 s to answer  → easy   (level +2, longer interval)
  - 10–15 s           → good   (level +1, normal interval)
  - > 15 s            → hard   (level reset, short interval)
  - Wrong answer      → hard   (always, regardless of time)
  - "Show Answer" used → hard  (always – you needed the hint)
"""

import json
import random
import re
import time

import streamlit as st

from src.database import DatabaseManager


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _sanitize(text: str) -> str:
    return re.sub(r"^[A-Da-d][\)\.]\s*|^[1-4][\)\.]\s*", "", text).strip()


def _auto_rate(elapsed: float, is_correct: bool, hint_used: bool) -> str:
    """Return 'easy' | 'good' | 'hard' based on time, correctness & hint."""
    if hint_used or not is_correct:
        return "hard"
    if elapsed < 10:
        return "easy"
    if elapsed <= 15:
        return "good"
    return "hard"


def _rating_badge(rating: str) -> str:
    return {
        "easy": "😎 **Easy** — Great recall! Next review in a long while.",
        "good": "🙂 **Good** — Solid! You'll see this again soon.",
        "hard": "😓 **Hard** — Keep at it. Reviewing again shortly.",
    }.get(rating, "")


# ------------------------------------------------------------------ #
# Entry point
# ------------------------------------------------------------------ #

def render(db: DatabaseManager):
    st.header("🧠 Daily Spaced Repetition Review")
    st.markdown(
        "Strengthen your memory by reviewing questions that are due today. "
        "Your difficulty rating is **set automatically** based on how quickly you answer."
    )

    user_id = st.session_state.get("user_id")

    due_count = db.get_due_review_count(user_id)

    if due_count == 0:
        st.success("🎉 All done! No items due for review today. Great work!")
        return

    st.info(f"📋 **{due_count} question(s)** due for review today.")

    # ---- Start / reset ----
    if "srs_active" not in st.session_state or not st.session_state.srs_active:
        if st.button("▶️ Start Review Session", type="primary", use_container_width=True):
            questions = db.get_due_questions(user_id)
            if not questions:
                st.warning("No due questions available right now.")
                return
            prepared = []
            for qid, question, options_json, answer in questions:
                opts = [_sanitize(o) for o in json.loads(options_json)]
                random.shuffle(opts)
                prepared.append(
                    {"id": qid, "question": question, "options": opts, "answer": _sanitize(answer)}
                )
            st.session_state.srs_active = True
            st.session_state.srs_questions = prepared
            st.session_state.srs_index = 0
            st.session_state.srs_answered = False
            st.session_state.srs_timer_idx = -1   # force timer init on first question
            st.rerun()
        return

    questions = st.session_state.srs_questions
    idx = st.session_state.srs_index
    total = len(questions)

    if idx >= total:
        _quiz_results()
        return

    _question_view(db, questions, idx, total, user_id)


# ------------------------------------------------------------------ #
# Per-question view
# ------------------------------------------------------------------ #

def _question_view(db: DatabaseManager, questions: list, idx: int, total: int, user_id: str):
    q = questions[idx]

    # ---- Start timer once per question (survives reruns) ----
    if st.session_state.get("srs_timer_idx") != idx:
        st.session_state.srs_question_start_time = time.time()
        st.session_state.srs_timer_idx = idx
        st.session_state.srs_hint_used = False

    score = sum(1 for s in st.session_state.get("srs_scores", []) if s)
    st.progress(idx / total, text=f"Question {idx + 1} of {total}  |  Correct so far: {score}/{idx}")

    st.markdown(f"### {q['question']}")

    # ================================================================
    # PRE-ANSWER STATE
    # ================================================================
    if not st.session_state.srs_answered:

        # Answer options
        for opt in q["options"]:
            if st.button(opt, key=f"srs_opt_{idx}_{opt}", use_container_width=True):
                elapsed = time.time() - st.session_state.srs_question_start_time
                is_correct = opt == q["answer"]
                rating = _auto_rate(elapsed, is_correct, st.session_state.srs_hint_used)

                # Persist result
                st.session_state.srs_last_elapsed = elapsed
                st.session_state.srs_correct = is_correct
                st.session_state.srs_last_answer = opt
                st.session_state.srs_last_rating = rating
                st.session_state.srs_answered = True

                # Commit SRS update immediately
                db.update_srs_level(q["id"], rating, user_id)

                # Track running scores
                scores = st.session_state.get("srs_scores", [])
                scores.append(is_correct)
                st.session_state.srs_scores = scores

                st.rerun()

        # ---- Show Answer / Hint button ----
        st.divider()
        if not st.session_state.srs_hint_used:
            if st.button("💡 Show Answer  *(counts as Hard)*", key=f"hint_{idx}", use_container_width=True):
                st.session_state.srs_hint_used = True
                st.rerun()
        else:
            # Hint revealed – show the answer and let user confirm they've seen it
            st.info(f"✅ **Correct Answer:** {q['answer']}")
            if st.button("✔️ Got it — Next Question ➡️", key=f"hint_next_{idx}", type="primary", use_container_width=True):
                # Record as hard (unanswered, hint used)
                rating = "hard"
                db.update_srs_level(q["id"], rating, user_id)
                scores = st.session_state.get("srs_scores", [])
                scores.append(False)
                st.session_state.srs_scores = scores
                _advance()

    # ================================================================
    # POST-ANSWER STATE
    # ================================================================
    else:
        elapsed = st.session_state.srs_last_elapsed
        rating = st.session_state.srs_last_rating

        # Show options (highlight correct / wrong)
        for opt in q["options"]:
            if opt == q["answer"]:
                st.success(f"✅ {opt}")
            elif opt == st.session_state.srs_last_answer and not st.session_state.srs_correct:
                st.error(f"❌ {opt}")
            else:
                st.button(opt, disabled=True, key=f"srs_dis_{idx}_{opt}", use_container_width=True)

        # Result message
        if st.session_state.srs_correct:
            st.success("**Correct!** Well done.")
        else:
            st.error(f"**Incorrect.** Correct answer: **{q['answer']}**")

        # Auto-rating info
        st.markdown(
            f"> ⏱️ You answered in **{elapsed:.1f}s** &nbsp;→&nbsp; {_rating_badge(rating)}"
        )

        if st.button("Next Question ➡️", type="primary", key=f"next_{idx}", use_container_width=True):
            _advance()


# ------------------------------------------------------------------ #
# Advance to next question
# ------------------------------------------------------------------ #

def _advance():
    st.session_state.srs_index += 1
    st.session_state.srs_answered = False
    st.rerun()


# ------------------------------------------------------------------ #
# Results screen
# ------------------------------------------------------------------ #

def _quiz_results():
    scores = st.session_state.get("srs_scores", [])
    total = len(scores)
    correct = sum(scores)
    pct = (correct / total * 100) if total else 0

    st.markdown("## ✅ Review Session Complete!")
    col1, col2, col3 = st.columns(3)
    col1.metric("Reviewed", total)
    col2.metric("Correct", correct)
    col3.metric("Accuracy", f"{pct:.1f}%")

    if pct >= 80:
        st.success("🏆 Outstanding! Your memory is sharp.")
    elif pct >= 60:
        st.info("👍 Good effort! Keep reviewing daily.")
    else:
        st.warning("📚 Keep practicing – spaced repetition works over time!")

    if st.button("🔄 Start New Session", type="primary"):
        for key in ("srs_active", "srs_questions", "srs_index", "srs_answered",
                    "srs_timer_idx", "srs_scores", "srs_hint_used",
                    "srs_question_start_time", "srs_last_elapsed", "srs_last_rating"):
            st.session_state.pop(key, None)
        st.rerun()
