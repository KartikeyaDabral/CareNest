import os
import sqlite3
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def init_database():
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/carenest_db")
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    print(f"[*] Initializing CareNest database...")
    if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
        try:
            conn = psycopg2.connect(db_url)
            with conn.cursor() as cur:
                cur.execute(schema_sql)
            conn.commit()
            conn.close()
            print("[+] PostgreSQL database initialized successfully with schema.sql!")
            return
        except Exception as e:
            print(f"[!] Warning: PostgreSQL connection failed ({e}).")
            print("[*] Creating local carenest.sqlite3 fallback database...")

    # SQLite fallback
    sqlite_path = os.path.join(os.path.dirname(__file__), "carenest.sqlite3")
    conn = sqlite3.connect(sqlite_path)
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
    print("[+] Local SQLite database initialized successfully!")

if __name__ == "__main__":
    init_database()
