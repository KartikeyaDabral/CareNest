import hashlib
import os
import secrets
from datetime import datetime, timedelta
from functools import wraps
import bcrypt
from flask import request, jsonify, g, current_app
from app.db import query_db

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def check_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def generate_reset_token():
    # 6-character alpha-numeric OTP or random hex token
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expiry = datetime.utcnow() + timedelta(minutes=15)
    return token, token_hash, expiry

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def get_current_user_id():
    # First check from flask_jwt_extended if active, or check cookie / Authorization header
    token = request.cookies.get("carenest_token")
    if not token and "Authorization" in request.headers:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        return None
        
    try:
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        return int(decoded.get("sub"))
    except Exception:
        # Fallback manual JWT decode if flask_jwt_extended is not in environment
        try:
            import jwt
            decoded = jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
            return int(decoded.get("sub"))
        except Exception:
            return None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                "success": False,
                "message": "Authentication required. Please log in to proceed.",
                "data": None
            }), 401
        
        # Verify user still exists in database
        user = query_db("SELECT user_id, email, mobile, is_registered FROM user_login WHERE user_id = %s", (user_id,), one=True)
        if not user:
            return jsonify({
                "success": False,
                "message": "User not found or account deactivated.",
                "data": None
            }), 401
            
        g.current_user = user
        return f(*args, **kwargs)
    return decorated_function
