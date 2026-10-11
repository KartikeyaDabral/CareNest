import re
from datetime import datetime

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
# 10-digit Indian mobile number (optionally starting with 6, 7, 8, or 9)
MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")
PINCODE_REGEX = re.compile(r"^\d{6}$")

def validate_email(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email.strip()))

def validate_mobile(mobile: str) -> bool:
    if not mobile or not isinstance(mobile, str):
        return False
    clean_mobile = mobile.strip().replace(" ", "").replace("-", "")
    if clean_mobile.startswith("+91"):
        clean_mobile = clean_mobile[3:]
    return bool(MOBILE_REGEX.match(clean_mobile))

def validate_password_strength(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A-Z)."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter (a-z)."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number (0-9)."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character (!@#$%^&* etc.)."
    return True, "Password meets security requirements."

def validate_pincode(pincode: str) -> bool:
    if not pincode:
        return False
    return bool(PINCODE_REGEX.match(str(pincode).strip()))

def validate_date(date_str: str) -> bool:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if dt > datetime.now():
            return False
        return True
    except (ValueError, TypeError):
        return False

def allowed_file(filename: str, allowed_extensions: set) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions
