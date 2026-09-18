import os
from pathlib import Path

from dotenv import load_dotenv
import google.genai as genai

load_dotenv()

# Model fallback chain — tried in order; falls back on quota / rate-limit errors
MODEL_CHAIN = [
    "gemini-3.6-flash",  # primary   (released 2026-07-21)
    "gemini-3.5-flash",  # fallback 1 (released 2026-07-21, one rung below 3.6)
    "gemini-2.5-flash",  # fallback 2
    "gemini-2.0-flash",  # fallback 3 (last resort)
]


def get_api_key() -> str | None:
    """Read Gemini API key from environment variable only (Vercel-compatible)."""
    return os.environ.get("GEMINI_API_KEY")


def save_api_key(api_key: str):
    """No-op in production — key is set as an env var in Vercel dashboard."""
    pass


_client: genai.Client | None = None
_cached_key: str | None = None


def get_client() -> genai.Client | None:
    """Returns cached Gemini Client singleton to reuse connection pools and SSL contexts."""
    global _client, _cached_key
    key = get_api_key()
    if not key:
        return None
    if _client is None or _cached_key != key:
        _client = genai.Client(api_key=key)
        _cached_key = key
    return _client


def get_model_chain() -> list[str]:
    """Returns the ordered list of models to try (primary → fallbacks)."""
    return MODEL_CHAIN


def get_model_id() -> str:
    """Returns the primary model (backward-compat shim)."""
    return MODEL_CHAIN[0]
