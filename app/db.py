import os
import sqlite3
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from flask import current_app, g

_db_pool = None
_use_sqlite = False

def init_pool(app):
    global _db_pool, _use_sqlite
    db_url = app.config.get("DATABASE_URL", "")
    
    if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
        try:
            _db_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=20,
                dsn=db_url,
                cursor_factory=RealDictCursor
            )
            app.logger.info("Connected successfully to PostgreSQL connection pool.")
            _use_sqlite = False
            return
        except Exception as e:
            app.logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to local SQLite database.")
            _use_sqlite = True
    else:
        _use_sqlite = True

    # Setup SQLite database as fallback
    db_path = os.path.join(app.config["BASE_DIR"], "carenest.sqlite3")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # Run table creation for sqlite
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_login (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                mobile TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_registered INTEGER DEFAULT 0,
                failed_attempts INTEGER DEFAULT 0,
                locked_until TEXT NULL,
                reset_token_hash TEXT NULL,
                reset_token_expiry TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login_at TEXT NULL
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_registration (
                registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL REFERENCES user_login(user_id) ON DELETE CASCADE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                gender TEXT NOT NULL,
                blood_group TEXT,
                mobile TEXT NOT NULL,
                alternate_mobile TEXT,
                address_line1 TEXT NOT NULL,
                address_line2 TEXT,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                pincode TEXT NOT NULL,
                allergies TEXT,
                chronic_conditions TEXT,
                current_medications TEXT,
                emergency_contact_name TEXT NOT NULL,
                emergency_contact_phone TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS document_track (
                document_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES user_login(user_id) ON DELETE CASCADE,
                document_type TEXT NOT NULL,
                original_file_name TEXT NOT NULL,
                stored_file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size_kb INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_deleted INTEGER DEFAULT 0
            );
        """)
    conn.close()

def get_db():
    if "db" not in g:
        if _use_sqlite or _db_pool is None:
            db_path = os.path.join(current_app.config["BASE_DIR"], "carenest.sqlite3")
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            g.db = conn
            g.is_sqlite = True
        else:
            g.db = _db_pool.getconn()
            g.is_sqlite = False
    return g.db

def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        if getattr(g, "is_sqlite", False):
            db.close()
        elif _db_pool:
            _db_pool.putconn(db)

def query_db(query, args=(), one=False, commit=False):
    db = get_db()
    is_sqlite = getattr(g, "is_sqlite", False)
    
    # In SQLite, replace %s placeholders with ?
    if is_sqlite:
        formatted_query = query.replace("%s", "?")
        cursor = db.cursor()
        cursor.execute(formatted_query, args)
        if commit:
            db.commit()
            last_id = cursor.lastrowid
            cursor.close()
            return last_id
        rv = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        return (rv[0] if rv else None) if one else rv
    else:
        cursor = db.cursor()
        cursor.execute(query, args)
        if commit:
            db.commit()
            last_id = None
            if "RETURNING" in query.upper():
                row = cursor.fetchone()
                if row:
                    last_id = list(row.values())[0]
            cursor.close()
            return last_id
        rv = cursor.fetchall()
        cursor.close()
        return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]
