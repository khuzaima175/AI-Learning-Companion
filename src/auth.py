"""
src/auth.py — Fast JWT verification with memory cache for protected routes
"""
import os
import time
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

security = HTTPBearer()

_sb_auth_client: Client | None = None
# In-memory token cache: { token_str: (user_dict, timestamp_expires) }
_token_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL_SECONDS = 90.0  # Cache verified tokens for 90 seconds to avoid remote round-trips


def _get_auth_client() -> Client:
    global _sb_auth_client
    if _sb_auth_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_ANON_KEY")
        if not url or not key:
            raise HTTPException(status_code=500, detail="Missing Supabase Auth configuration")
        _sb_auth_client = create_client(url, key)
    return _sb_auth_client


def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Extracts and verifies the JWT token from the Authorization header.
    Utilizes an in-memory TTL cache to avoid redundant remote network calls to Supabase on every request.
    """
    token = credentials.credentials
    now = time.time()

    # Fast-path: Check in-memory cache
    if token in _token_cache:
        cached_user, expires_at = _token_cache[token]
        if now < expires_at:
            return cached_user
        else:
            del _token_cache[token]

    try:
        sb = _get_auth_client()

        # Ask Supabase to verify this token
        user_response = sb.auth.get_user(token)
        user = user_response.user

        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_dict = {"id": user.id, "email": user.email, "token": token}
        
        # Cache for 90 seconds
        _token_cache[token] = (user_dict, now + _CACHE_TTL_SECONDS)

        # Periodically prune stale cache entries (keep under 500 items)
        if len(_token_cache) > 500:
            for k in list(_token_cache.keys()):
                if _token_cache[k][1] < now:
                    del _token_cache[k]

        return user_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication required: {str(e)}")
