"""
AI Learning Companion – Streamlit desktop app entry point.
Run with:  streamlit run app.py
"""

import streamlit as st

from src import config
from src.api_processor import ApiProcessor
from src.database import DatabaseManager

# ── Page config ────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AI Learning Companion",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS (subtle polish on top of the Streamlit theme) ──────────────
st.markdown(
    """
<style>
    /* sidebar header */
    section[data-testid="stSidebar"] h1 {font-size: 1.3rem;}
    /* metric labels */
    [data-testid="stMetricLabel"] {font-size: 0.85rem;}
    /* wider chat input */
    [data-testid="stChatInput"] textarea {font-size: 0.95rem;}
    /* button group spacing */
    .stButton>button {border-radius: 8px;}
</style>
""",
    unsafe_allow_html=True,
)

# ── Sidebar ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("🎓 AI Learning Companion")
    st.markdown("Your personal AI-powered study tool.")
    st.divider()

    # Navigation
    page = st.radio(
        "Navigate",
        options=[
            "📚 Add New Video",
            "📖 Browse Content",
            "🧠 Practice Quiz",
            "🔁 Daily Review",
            "📈 Statistics",
            "🗂️ Manage Content",
        ],
        label_visibility="collapsed",
    )

    st.divider()

    # ── API Key setup ──────────────────────────────────────────────────────
    st.subheader("🔑 Gemini API Key")
    current_key = config.get_api_key() or ""
    masked = f"{'*' * (len(current_key) - 4)}{current_key[-4:]}" if len(current_key) > 4 else ""

    with st.expander("Configure API Key", expanded=not bool(current_key)):
        new_key = st.text_input(
            "Gemini API Key",
            type="password",
            placeholder="AIzaSy…",
            value="",
            help="Get your key at https://aistudio.google.com/",
        )
        if st.button("💾 Save Key", use_container_width=True):
            if new_key.strip():
                config.save_api_key(new_key.strip())
                st.success("✅ API key saved!")
                st.rerun()
            else:
                st.error("Please enter a valid key.")

    if current_key:
        st.caption(f"Key on file: `{masked}`")
    else:
        st.warning("⚠️ No API key set. AI features won't work.")

    st.divider()
    st.caption("Data stored locally in `%APPDATA%\\AILearningCompanion`")

# ── Shared instances (cached so they persist across reruns) ─────────────────
@st.cache_resource
def get_db() -> DatabaseManager:
    return DatabaseManager()


@st.cache_resource
def get_api() -> ApiProcessor:
    return ApiProcessor()


db = get_db()
api = get_api()

# ── Page routing ─────────────────────────────────────────────────────────────
from src.pages import add_video, browse, quiz, review, stats, manage  # noqa: E402

if page == "📚 Add New Video":
    add_video.render(db, api)
elif page == "📖 Browse Content":
    browse.render(db, api)
elif page == "🧠 Practice Quiz":
    quiz.render(db)
elif page == "🔁 Daily Review":
    due = db.get_due_review_count()
    if due > 0:
        st.sidebar.info(f"🔔 {due} item(s) due today!")
    review.render(db)
elif page == "📈 Statistics":
    stats.render(db)
elif page == "🗂️ Manage Content":
    manage.render(db)
