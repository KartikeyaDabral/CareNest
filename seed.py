import os
import sqlite3
import psycopg2
import bcrypt
from dotenv import load_dotenv

load_dotenv()

def seed_database():
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/carenest_db")
    password = "Password@123"
    pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    print("[*] Seeding demo user into CareNest database...")
    print("    Email:    demo@carenest.in")
    print("    Password: Password@123")
    print("    Mobile:   9876543210")

    # Sample user directories & dummy prescription file
    base_dir = os.path.dirname(__file__)
    upload_base = os.path.join(base_dir, "uploads")
    os.makedirs(upload_base, exist_ok=True)

    if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
        try:
            conn = psycopg2.connect(db_url)
            with conn.cursor() as cur:
                # Check if exists
                cur.execute("SELECT user_id FROM user_login WHERE email = %s", ("demo@carenest.in",))
                row = cur.fetchone()
                if row:
                    user_id = row[0]
                    print(f"[*] Demo user already exists with ID: {user_id}. Updating details.")
                    cur.execute("UPDATE user_login SET password_hash = %s, failed_attempts = 0, locked_until = NULL WHERE user_id = %s", (pwd_hash, user_id))
                else:
                    cur.execute("""
                        INSERT INTO user_login (email, mobile, password_hash, is_registered, created_at, updated_at)
                        VALUES (%s, %s, %s, TRUE, NOW(), NOW())
                        RETURNING user_id;
                    """, ("demo@carenest.in", "9876543210", pwd_hash))
                    user_id = cur.fetchone()[0]

                # Seed user_registration
                cur.execute("SELECT registration_id FROM user_registration WHERE user_id = %s", (user_id,))
                reg_row = cur.fetchone()
                if not reg_row:
                    cur.execute("""
                        INSERT INTO user_registration (
                            user_id, first_name, last_name, date_of_birth, gender, blood_group,
                            mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
                            allergies, chronic_conditions, current_medications,
                            emergency_contact_name, emergency_contact_phone, created_at, updated_at
                        ) VALUES (
                            %s, 'Ananya', 'Sharma', '1994-06-15', 'Female', 'B+',
                            '9876543210', '9876543299', 'Flat 402, Green Meadows, 5th Main Road',
                            'Near Indiranagar Metro', 'Bengaluru', 'Karnataka', '560038',
                            'Penicillin, Seasonal Pollen', 'Mild Asthma', 'Montair LC 10mg, Budecort 200 Inhaler',
                            'Rohan Sharma', '9876543211', NOW(), NOW()
                        );
                    """, (user_id,))

                # Seed demo prescription document
                user_doc_dir = os.path.join(upload_base, str(user_id))
                os.makedirs(user_doc_dir, exist_ok=True)
                demo_file_name = "demo_rx_dr_mehta.pdf"
                demo_path = os.path.join(user_doc_dir, demo_file_name)
                with open(demo_path, "wb") as f:
                    f.write(b"%PDF-1.4\n%CareNest Demo Prescription Document - Dr. Rajesh Mehta, MD (Cardiology)\nRx:\n1. Tab Atorvastatin 20mg - 1 OD\n2. Tab Telmisartan 40mg - 1 OD morning\n%%EOF")

                cur.execute("SELECT document_id FROM document_track WHERE user_id = %s AND original_file_name = %s", (user_id, "Prescription_Dr_Mehta.pdf"))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO document_track (
                            user_id, document_type, original_file_name, stored_file_name,
                            file_path, file_size_kb, mime_type, status, uploaded_at, updated_at, is_deleted
                        ) VALUES (
                            %s, 'Prescription', 'Prescription_Dr_Mehta.pdf', %s,
                            %s, 145, 'application/pdf', 'Verified', NOW(), NOW(), FALSE
                        );
                    """, (user_id, demo_file_name, demo_path))

            conn.commit()
            conn.close()
            print("[+] PostgreSQL seed completed successfully!")
            return
        except Exception as e:
            print(f"[!] PostgreSQL seed notice: {e}. Seeding local SQLite database...")

    # SQLite fallback
    sqlite_path = os.path.join(base_dir, "carenest.sqlite3")
    conn = sqlite3.connect(sqlite_path)
    with conn:
        cur = conn.cursor()
        cur.execute("SELECT user_id FROM user_login WHERE email = ?", ("demo@carenest.in",))
        row = cur.fetchone()
        if row:
            user_id = row[0]
            cur.execute("UPDATE user_login SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE user_id = ?", (pwd_hash, user_id))
        else:
            cur.execute("""
                INSERT INTO user_login (email, mobile, password_hash, is_registered)
                VALUES (?, ?, ?, 1)
            """, ("demo@carenest.in", "9876543210", pwd_hash))
            user_id = cur.lastrowid

        cur.execute("SELECT registration_id FROM user_registration WHERE user_id = ?", (user_id,))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO user_registration (
                    user_id, first_name, last_name, date_of_birth, gender, blood_group,
                    mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
                    allergies, chronic_conditions, current_medications,
                    emergency_contact_name, emergency_contact_phone
                ) VALUES (
                    ?, 'Ananya', 'Sharma', '1994-06-15', 'Female', 'B+',
                    '9876543210', '9876543299', 'Flat 402, Green Meadows, 5th Main Road',
                    'Near Indiranagar Metro', 'Bengaluru', 'Karnataka', '560038',
                    'Penicillin, Seasonal Pollen', 'Mild Asthma', 'Montair LC 10mg, Budecort 200 Inhaler',
                    'Rohan Sharma', '9876543211'
                )
            """, (user_id,))

        user_doc_dir = os.path.join(upload_base, str(user_id))
        os.makedirs(user_doc_dir, exist_ok=True)
        demo_file_name = "demo_rx_dr_mehta.pdf"
        demo_path = os.path.join(user_doc_dir, demo_file_name)
        with open(demo_path, "wb") as f:
            f.write(b"%PDF-1.4\n%CareNest Demo Prescription Document - Dr. Rajesh Mehta, MD (Cardiology)\nRx:\n1. Tab Atorvastatin 20mg - 1 OD\n2. Tab Telmisartan 40mg - 1 OD morning\n%%EOF")

        cur.execute("SELECT document_id FROM document_track WHERE user_id = ? AND original_file_name = ?", (user_id, "Prescription_Dr_Mehta.pdf"))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO document_track (
                    user_id, document_type, original_file_name, stored_file_name,
                    file_path, file_size_kb, mime_type, status, is_deleted
                ) VALUES (
                    ?, 'Prescription', 'Prescription_Dr_Mehta.pdf', ?,
                    ?, 145, 'application/pdf', 'Verified', 0
                )
            """, (user_id, demo_file_name, demo_path))

    conn.close()
    print("[+] Seed completed successfully in local database!")

if __name__ == "__main__":
    seed_database()
