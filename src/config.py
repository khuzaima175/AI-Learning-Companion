import json
import os
from pathlib import Path

import google.genai as genai

CONFIG_DIR = Path(os.getenv("APPDATA", Path.home())) / "AILearningCompanion"
CONFIG_FILE = CONFIG_DIR / "config.json"

MODEL_ID = "gemini-2.5-flash"


def get_config_dir() -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_DIR


def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(data: dict):
    get_config_dir()
    existing = load_config()
    existing.update(data)
    with open(CONFIG_FILE, "w") as f:
        json.dump(existing, f, indent=2)


def get_api_key() -> str | None:
    return load_config().get("api_key")


def save_api_key(api_key: str):
    save_config({"api_key": api_key})


def get_client() -> genai.Client | None:
    key = get_api_key()
    if not key:
        return None
    return genai.Client(api_key=key)


def get_model_id() -> str:
    return MODEL_ID
