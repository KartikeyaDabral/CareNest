import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "carenest-default-dev-secret-key-391823")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "carenest-jwt-secret-key-928172")
    JWT_TOKEN_LOCATION = ["cookies", "headers"]
    JWT_COOKIE_SECURE = False  # Set to True in HTTPS production
    JWT_COOKIE_CSRF_PROTECT = False  # Set to True if CSRF double submit cookies are configured
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_ACCESS_COOKIE_NAME = "carenest_token"

    # SQLite is the zero-configuration local default. Set DATABASE_URL to a
    # PostgreSQL URL when a PostgreSQL server is intentionally configured.
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///carenest.sqlite3")
    
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv("UPLOAD_FOLDER", "uploads"))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 5 * 1024 * 1024))  # 5 MB
    ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
    ALLOWED_MIMETYPES = {"application/pdf", "image/jpeg", "image/png"}
