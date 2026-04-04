"""
src/auth.py — JWT verification for every protected route
"""
import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client

security = HTTPBearer()

def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Extracts and verifies the JWT token from the Authorization header.
    Returns the user dict if valid, raises 401 if not.
    """
    token = credentials.credentials

    try:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_ANON_KEY")
        
        if not url or not key:
             raise HTTPException(status_code=500, detail="Missing Supabase Auth configuration")
             
        sb = create_client(url, key)

        # Ask Supabase to verify this token and return user info
        user_response = sb.auth.get_user(token)
        user = user_response.user

        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        return {"id": user.id, "email": user.email, "token": token}

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication required: {str(e)}")
