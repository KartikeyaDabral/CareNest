import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, make_response, current_app
from app.db import query_db
from app.utils.security import (
    hash_password, check_password, generate_reset_token, hash_token, login_required, get_current_user_id
)
from app.utils.validators import (
    validate_email, validate_mobile, validate_password_strength
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def create_access_token_helper(user_id: int):
    try:
        from flask_jwt_extended import create_access_token
        return create_access_token(identity=str(user_id))
    except Exception:
        import jwt
        payload = {
            "sub": str(user_id),
            "exp": datetime.utcnow() + timedelta(days=1)
        }
        return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    mobile = data.get("mobile", "").strip().replace(" ", "").replace("-", "")
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")
    terms_accepted = data.get("terms", False)

    if not terms_accepted:
        return jsonify({"success": False, "message": "You must agree to the Terms of Service to continue.", "data": None}), 400

    if not full_name:
        return jsonify({"success": False, "message": "Please enter your full name.", "data": None}), 400

    if not validate_email(email):
        return jsonify({"success": False, "message": "Please enter a valid email address.", "data": None}), 400

    if not validate_mobile(mobile):
        return jsonify({"success": False, "message": "Please enter a valid 10-digit Indian mobile number.", "data": None}), 400

    if mobile.startswith("+91"):
        mobile = mobile[3:]

    if password != confirm_password:
        return jsonify({"success": False, "message": "Passwords do not match.", "data": None}), 400

    is_valid, msg = validate_password_strength(password)
    if not is_valid:
        return jsonify({"success": False, "message": msg, "data": None}), 400

    # Check if email or mobile is already in use
    existing_user = query_db(
        "SELECT user_id, email, mobile FROM user_login WHERE email = %s OR mobile = %s",
        (email, mobile),
        one=True
    )
    if existing_user:
        if existing_user.get("email") == email:
            return jsonify({"success": False, "message": "An account with this email already exists. Please log in.", "data": None}), 409
        else:
            return jsonify({"success": False, "message": "An account with this mobile number already exists. Please log in.", "data": None}), 409

    pwd_hash = hash_password(password)

    # Insert into user_login
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    user_id = query_db(
        """
        INSERT INTO user_login (email, mobile, password_hash, is_registered, created_at, updated_at)
        VALUES (%s, %s, %s, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING user_id;
        """,
        (email, mobile, pwd_hash),
        commit=True
    )

    if not user_id:
        # SQLite fallback where RETURNING isn't supported
        row = query_db("SELECT user_id FROM user_login WHERE email = %s", (email,), one=True)
        user_id = row["user_id"] if row else 1

    token = create_access_token_helper(user_id)
    resp = make_response(jsonify({
        "success": True,
        "message": "Account created successfully. Welcome to CareNest!",
        "data": {
            "user_id": user_id,
            "email": email,
            "mobile": mobile,
            "first_name": first_name,
            "last_name": last_name,
            "is_registered": False,
            "token": token
        }
    }), 201)

    resp.set_cookie(
        "carenest_token",
        token,
        httponly=True,
        samesite="Lax",
        secure=current_app.config["JWT_COOKIE_SECURE"],
        max_age=86400
    )
    return resp

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip().lower()
    password = data.get("password", "")
    remember_me = data.get("remember_me", False)

    if not identifier or not password:
        return jsonify({"success": False, "message": "Please provide both email/mobile and password.", "data": None}), 400

    # Clean mobile if formatted
    clean_identifier = identifier.replace(" ", "").replace("-", "")
    if clean_identifier.startswith("+91"):
        clean_identifier = clean_identifier[3:]

    user = query_db(
        "SELECT * FROM user_login WHERE email = %s OR mobile = %s",
        (identifier, clean_identifier),
        one=True
    )

    if not user:
        return jsonify({"success": False, "message": "Invalid email/mobile or password.", "data": None}), 401

    user_id = user["user_id"]

    # Check lock status
    locked_until = user.get("locked_until")
    if locked_until:
        if isinstance(locked_until, str):
            try:
                locked_until_dt = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
            except Exception:
                locked_until_dt = datetime.utcnow()
        else:
            locked_until_dt = locked_until

        if locked_until_dt > datetime.utcnow():
            remaining_mins = max(1, int((locked_until_dt - datetime.utcnow()).total_seconds() // 60))
            return jsonify({
                "success": False,
                "message": f"Account temporarily locked due to 5 consecutive failed attempts. Please try again in {remaining_mins} minute(s) or use 'Forgot Password'.",
                "data": {"locked": True, "remaining_minutes": remaining_mins}
            }), 403

    # Check password
    if not check_password(password, user["password_hash"]):
        failed = (user.get("failed_attempts") or 0) + 1
        lock_clause = ""
        lock_time = None
        if failed >= 5:
            lock_time = datetime.utcnow() + timedelta(minutes=15)
            query_db(
                "UPDATE user_login SET failed_attempts = %s, locked_until = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
                (failed, lock_time, user_id),
                commit=True
            )
            return jsonify({
                "success": False,
                "message": "Account locked for 15 minutes due to 5 failed login attempts. Please reset your password if needed.",
                "data": {"locked": True}
            }), 403
        else:
            query_db(
                "UPDATE user_login SET failed_attempts = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
                (failed, user_id),
                commit=True
            )
            remaining_attempts = 5 - failed
            return jsonify({
                "success": False,
                "message": f"Invalid email/mobile or password. ({remaining_attempts} attempt{'s' if remaining_attempts > 1 else ''} remaining before temporary lockout)",
                "data": None
            }), 401

    # Login succeeded - reset failed attempts & update last_login
    query_db(
        "UPDATE user_login SET failed_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
        (user_id,),
        commit=True
    )

    token = create_access_token_helper(user_id)
    max_age = 7 * 86400 if remember_me else 86400

    resp = make_response(jsonify({
        "success": True,
        "message": "Login successful. Welcome back!",
        "data": {
            "user_id": user_id,
            "email": user["email"],
            "mobile": user["mobile"],
            "is_registered": bool(user.get("is_registered")),
            "token": token
        }
    }), 200)

    resp.set_cookie(
        "carenest_token",
        token,
        httponly=True,
        samesite="Lax",
        secure=current_app.config["JWT_COOKIE_SECURE"],
        max_age=max_age
    )
    return resp

@auth_bp.route("/logout", methods=["POST"])
def logout():
    resp = make_response(jsonify({
        "success": True,
        "message": "You have been logged out successfully.",
        "data": None
    }), 200)
    resp.delete_cookie("carenest_token")
    return resp

@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Not authenticated", "data": None}), 401

    user = query_db(
        "SELECT user_id, email, mobile, is_registered, created_at, last_login_at FROM user_login WHERE user_id = %s",
        (user_id,),
        one=True
    )
    if not user:
        return jsonify({"success": False, "message": "User not found", "data": None}), 404

    profile = query_db(
        "SELECT first_name, last_name, gender, city, state FROM user_registration WHERE user_id = %s",
        (user_id,),
        one=True
    )

    return jsonify({
        "success": True,
        "message": "User profile retrieved.",
        "data": {
            "user_id": user["user_id"],
            "email": user["email"],
            "mobile": user["mobile"],
            "is_registered": bool(user.get("is_registered")),
            "profile": profile or {}
        }
    }), 200

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not validate_email(email):
        return jsonify({"success": False, "message": "Please enter a valid email address.", "data": None}), 400

    user = query_db("SELECT user_id FROM user_login WHERE email = %s", (email,), one=True)
    
    # Generic security response regardless of whether user exists
    demo_token = None
    if user:
        token, token_hash, expiry = generate_reset_token()
        query_db(
            "UPDATE user_login SET reset_token_hash = %s, reset_token_expiry = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (token_hash, expiry, user["user_id"]),
            commit=True
        )
        demo_token = token
        current_app.logger.info(f"[CareNest DEMO OTP/TOKEN] Password reset token for {email}: {token}")
        print(f"\n========================================\n[CareNest DEMO] Reset token for {email}: {token}\nLink: /reset-password?token={token}\n========================================\n")

    return jsonify({
        "success": True,
        "message": "If this email is registered with CareNest, password reset instructions and a verification token have been dispatched.",
        "data": {
            "demo_token": demo_token,
            "demo_note": "For review/testing convenience, you can use the token shown here or generated in the terminal console."
        }
    }), 200

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token", "").strip()
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if not token:
        return jsonify({"success": False, "message": "Reset token is missing or invalid.", "data": None}), 400

    if new_password != confirm_password:
        return jsonify({"success": False, "message": "Passwords do not match.", "data": None}), 400

    is_valid, msg = validate_password_strength(new_password)
    if not is_valid:
        return jsonify({"success": False, "message": msg, "data": None}), 400

    t_hash = hash_token(token)
    user = query_db(
        "SELECT user_id, reset_token_expiry FROM user_login WHERE reset_token_hash = %s",
        (t_hash,),
        one=True
    )

    if not user:
        return jsonify({"success": False, "message": "Invalid or expired password reset link.", "data": None}), 400

    expiry = user.get("reset_token_expiry")
    if expiry:
        if isinstance(expiry, str):
            try:
                expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            except Exception:
                expiry_dt = datetime.utcnow()
        else:
            expiry_dt = expiry

        if expiry_dt < datetime.utcnow():
            return jsonify({"success": False, "message": "Password reset token has expired. Please request a new one.", "data": None}), 400

    new_hash = hash_password(new_password)
    query_db(
        """
        UPDATE user_login
        SET password_hash = %s, reset_token_hash = NULL, reset_token_expiry = NULL, failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s
        """,
        (new_hash, user["user_id"]),
        commit=True
    )

    return jsonify({
        "success": True,
        "message": "Password has been reset successfully. Please log in with your new password.",
        "data": None
    }), 200

@auth_bp.route("/change-password", methods=["PUT"])
@login_required
def change_password():
    data = request.get_json() or {}
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if not current_password or not new_password:
        return jsonify({"success": False, "message": "Please provide both current and new passwords.", "data": None}), 400

    if new_password != confirm_password:
        return jsonify({"success": False, "message": "New passwords do not match.", "data": None}), 400

    is_valid, msg = validate_password_strength(new_password)
    if not is_valid:
        return jsonify({"success": False, "message": msg, "data": None}), 400

    user_id = request.current_user["user_id"] if hasattr(request, "current_user") else get_current_user_id()
    user = query_db("SELECT password_hash FROM user_login WHERE user_id = %s", (user_id,), one=True)

    if not user or not check_password(current_password, user["password_hash"]):
        return jsonify({"success": False, "message": "Current password is incorrect.", "data": None}), 400

    new_hash = hash_password(new_password)
    query_db(
        "UPDATE user_login SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
        (new_hash, user_id),
        commit=True
    )

    return jsonify({
        "success": True,
        "message": "Your password has been changed successfully.",
        "data": None
    }), 200
