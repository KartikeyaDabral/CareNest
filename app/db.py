import os
import sqlite3
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from flask import current_app, g

_db_pool = None
_use_sqlite = False

def _sqlite_database_path(app):
    db_url = app.config.get("DATABASE_URL", "")
    if db_url.startswith("sqlite:///"):
        path = db_url[len("sqlite:///"):]
        if path.startswith("/"):
            return path
        return os.path.join(app.config["BASE_DIR"], path)
    return os.path.join(app.config["BASE_DIR"], "carenest.sqlite3")

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
        app.logger.info("Using local SQLite database.")

    # Setup SQLite database as fallback
    db_path = _sqlite_database_path(app)
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
            db_path = _sqlite_database_path(current_app)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
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
            # A request may finish after read-only queries or an early return
            # with an open PostgreSQL transaction. Reset the connection before
            # another request borrows it from the pool.
            try:
                db.rollback()
            except Exception:
                _db_pool.putconn(db, close=True)
            else:
                _db_pool.putconn(db)

def query_db(query, args=(), one=False, commit=False):
    db = get_db()
    is_sqlite = getattr(g, "is_sqlite", False)

    # Application queries use psycopg2's %s style. Translate it for SQLite.
    formatted_query = query.replace("%s", "?") if is_sqlite else query
    cursor = db.cursor()
    try:
        cursor.execute(formatted_query, args)

        # Read RETURNING rows before committing. SQLite rejects a commit while
        # a RETURNING statement still has unread rows.
        rows = cursor.fetchall() if cursor.description else []
        result = [dict(row) for row in rows]
        if commit:
            db.commit()
            if is_sqlite:
                # lastrowid is available for inserts without RETURNING; use
                # the returned value when the query explicitly requested it.
                if result:
                    return next(iter(result[0].values()))
                return cursor.lastrowid
            if result and "RETURNING" in query.upper():
                return next(iter(result[0].values()))
            return None

        return (result[0] if result else None) if one else result
    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
