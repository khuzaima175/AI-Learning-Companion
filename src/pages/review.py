"""
Daily Review page – Spaced Repetition System (SRS) review of due questions.
"""

import json
import random
import re

import streamlit as st

from src.database import DatabaseManager


def _sanitize(text: str) -> str:
    return re.sub(r"^[A-Da-d][\)\.]\s*|^[1-4][\)\.]\s*", "", text).strip()


def render(db: DatabaseManager):
    st.header("🧠 Daily Spaced Repetition Review")
    st.markdown(
        "Strengthen your memory by reviewing questions that are due today. "
        "Answer, then rate how well you knew it."
    )

    due_count = db.get_due_review_count()

    if due_count == 0:
        st.success("🎉 All done! No items due for review today. Great work!")
        return

    st.info(f"📋 **{due_count} question(s)** due for review today.")

    # ---- Start / reset ----
    if "srs_active" not in st.session_state or not st.session_state.srs_active:
        if st.button("▶️ Start Review Session", type="primary", use_container_width=True):
            questions = db.get_due_questions()
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
            st.rerun()
        return

    questions = st.session_state.srs_questions
    idx = st.session_state.srs_index
    total = len(questions)

    if idx >= total:
        st.success("✅ Review session complete! Excellent job!")
        if st.button("🔄 Start New Session", type="primary"):
            for key in ("srs_active", "srs_questions", "srs_index", "srs_answered"):
                st.session_state.pop(key, None)
            st.rerun()
        return

    q = questions[idx]
    st.progress((idx) / total, text=f"Question {idx + 1} of {total}")
    st.markdown(f"### {q['question']}")

    if not st.session_state.srs_answered:
        for opt in q["options"]:
            if st.button(opt, key=f"srs_opt_{idx}_{opt}", use_container_width=True):
                is_correct = opt == q["answer"]
                st.session_state.srs_correct = is_correct
                st.session_state.srs_last_answer = opt
                st.session_state.srs_answered = True
                st.rerun()
    else:
        # Show answer result
        for opt in q["options"]:
            if opt == q["answer"]:
                st.success(f"✅ {opt}")
            elif opt == st.session_state.srs_last_answer and not st.session_state.srs_correct:
                st.error(f"❌ {opt}")
            else:
                st.button(opt, disabled=True, key=f"srs_dis_{idx}_{opt}", use_container_width=True)

        if st.session_state.srs_correct:
            st.success("**Correct!** How well did you know it?")
        else:
            st.error(f"**Incorrect.** Correct answer: **{q['answer']}**  —  How hard was this?")

        st.markdown("**Rate your confidence:**")
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("😓 Hard", use_container_width=True, key=f"hard_{idx}"):
                db.update_srs_level(q["id"], "hard")
                _advance(db)
        with c2:
            if st.button("🙂 Good", use_container_width=True, key=f"good_{idx}", type="primary"):
                db.update_srs_level(q["id"], "good")
                _advance(db)
        with c3:
            if st.button("😎 Easy", use_container_width=True, key=f"easy_{idx}"):
                db.update_srs_level(q["id"], "easy")
                _advance(db)


def _advance(db: DatabaseManager):
    st.session_state.srs_index += 1
    st.session_state.srs_answered = False
    st.rerun()
