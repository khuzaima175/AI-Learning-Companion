"""
api/index.py – Vercel Serverless Function entry point.

Wraps the existing FastAPI app with Mangum so Vercel can invoke it
as an AWS-Lambda-compatible handler.
"""

import sys
import os

# Make sure the project root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mangum import Mangum
from app import app  # the existing FastAPI application

# Vercel calls `handler` by convention
handler = Mangum(app, lifespan="off")
