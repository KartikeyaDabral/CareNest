# CareNest — Online Pharmacy & Healthcare Platform

CareNest is a full-stack e-pharmacy and healthcare management web application inspired by **Truemeds.in**. It delivers a clean, trustworthy healthcare experience with genuine medicines, doctor-approved generic substitute comparisons (saving up to 72%), encrypted prescription uploads, and patient health profile management.

---

## 1. Tech Stack Overview

- **Front End:** Plain HTML5, custom CSS3 (CSS variables, Flexbox/Grid, zero external framework slop), Vanilla JavaScript (ES6+), and Native Fetch API.
- **Back End:** Python Flask (REST API + Jinja2 template rendering).
- **Database:** PostgreSQL with `psycopg2` connection pooling and fallback SQLite support.
- **Authentication & Security:** 
  - Password hashing with `bcrypt`.
  - HTTP-only JWT cookies (`Flask-JWT-Extended` / `jsonwebtoken`).
  - Account lockout protection: 15-minute temporary lockout after 5 consecutive failed attempts.
  - Single-use 15-minute expiration password reset tokens (SHA-256 hashed).
  - Parameterized SQL queries to eliminate SQL injection risks.
- **File Uploads:**
  - Secure uploads with `werkzeug.utils.secure_filename`.
  - User-isolated storage (`/uploads/<user_id>/<unique_file_name>`).
  - Validation for allowed MIME types (`application/pdf`, `image/jpeg`, `image/png`) and 5 MB size limit on both client and server.
  - Comprehensive audit trail in the `document_track` table with soft delete support.

---

## 2. Database Schema (PostgreSQL, 3 Tables)

```
┌─────────────────────────────────┐
│           user_login            │
├─────────────────────────────────┤
│ user_id (PK, SERIAL)            │
│ email (UNIQUE)                  │
│ mobile (UNIQUE)                 │
│ password_hash                   │
│ is_registered (BOOLEAN)         │
│ failed_attempts (INT)           │
│ locked_until (TIMESTAMP)        │
│ reset_token_hash (TEXT)         │
│ reset_token_expiry (TIMESTAMP)  │
│ created_at, updated_at          │
└───────────────┬─────────────────┘
                │ 1:1 (ON DELETE CASCADE)
                ▼
┌─────────────────────────────────┐
│        user_registration        │
├─────────────────────────────────┤
│ registration_id (PK, SERIAL)    │
│ user_id (FK, UNIQUE)            │
│ first_name, last_name           │
│ date_of_birth, gender, blood    │
│ mobile, alternate_mobile        │
│ address_line1, address_line2    │
│ city, state, pincode            │
│ allergies, chronic_conditions   │
│ current_medications             │
│ emergency_contact_name & phone  │
└─────────────────────────────────┘
                │ 1:N (ON DELETE CASCADE)
                ▼
┌─────────────────────────────────┐
│         document_track          │
├─────────────────────────────────┤
│ document_id (PK, SERIAL)        │
│ user_id (FK)                    │
│ document_type (VARCHAR)         │
│ original_file_name              │
│ stored_file_name, file_path     │
│ file_size_kb, mime_type         │
│ status ('Pending'/'Verified')   │
│ uploaded_at, updated_at         │
│ is_deleted (BOOLEAN)            │
└─────────────────────────────────┘
```

---

## 3. Quick Start & Setup Commands (Flask + PostgreSQL)

Follow these exact steps to run the Flask application and PostgreSQL database locally:

### Step 1: Create and Activate Python Virtual Environment
```bash
# Clone/navigate into the project root
cd /path/to/carenest

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
# On Linux / macOS:
source venv/bin/activate
# On Windows (cmd/powershell):
# venv\Scripts\activate
```

### Step 2: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` in `.env` points to your PostgreSQL instance:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carenest_db
SECRET_KEY=carenest_super_secret_session_key_change_in_production_2026
JWT_SECRET_KEY=carenest_jwt_secret_signing_key_secure_vault_9921
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=5242880
```

### Step 4: Create PostgreSQL Database & Apply Schema
```bash
# Create the PostgreSQL database (if not already created)
createdb -U postgres carenest_db

# Option A: Apply schema via psql
psql -U postgres -d carenest_db -f schema.sql

# Option B: Run the automatic Python schema migration script
python init_db.py
```

### Step 5: Seed Demo Account & Sample Prescription
```bash
python seed.py
```

### Step 6: Start the Flask Web Application
```bash
# Run Flask server (defaults to port 5000)
python run.py
```

Visit **http://localhost:5000** in your web browser!

---

## 4. Evaluation Demo Account Credentials

You can test the platform instantly using the seeded demo account or create a new account:
- **Email:** `demo@carenest.in`
- **Mobile:** `9876543210`
- **Password:** `Password@123`

*(On the Login page, an "Auto-Fill Demo" button is also provided for 1-click credential filling.)*

---

## 5. End-to-End Walkthrough of the Six Pages

1. **Sign-Up (`/signup`)**
   - Inputs: Full Name, Email, Mobile (10-digit Indian), Password, Confirm Password, Terms Agreement.
   - Real-time password requirement checklist (8+ chars, uppercase, lowercase, digit, special character).
   - Inserts record into `user_login`, logs the user in with a secure cookie, and routes to `/register`.

2. **Login (`/login`)**
   - Identifier (email or mobile) + password, password visibility toggle, remember me.
   - Brute-force protection: Locks account for 15 minutes after 5 consecutive failed login attempts.

3. **Forgot & Reset Password (`/forgot-password` & `/reset-password`)**
   - Enter email -> generates 15-minute single-use secure reset token.
   - Console logs the token for quick verification and displays it in a testing helper box.
   - Visiting `/reset-password?token=...` allows setting a new password with password strength validation.

4. **User Registration (`/register`)**
   - 3-step wizard with step-by-step progress bar and JavaScript validation:
     - Step 1: Personal Details (First & Last Name, DOB, Gender, Blood Group).
     - Step 2: Contact & Delivery Address (Mobile, Alternate Mobile, Email, Full Street Address, City, State dropdown, 6-digit Pincode).
     - Step 3: Health Background & Emergency Contact (Known Allergies, Chronic Conditions, Current Medications, Emergency Contact Name & Phone).
   - Saves into `user_registration` and sets `is_registered = TRUE` in `user_login`.

5. **Upload Documents (`/documents`)**
   - Drag-and-drop file upload zone + browse file picker.
   - Live client preview (JPG/PNG image thumbnails and PDF badge).
   - Document Type selection: Prescription, ID Proof, Address Proof, Medical Report, Insurance, Other.
   - Dynamic table of user documents showing filename, size, category, status (`Pending`, `Verified`, `Rejected`), and actions:
     - **Preview**: Modal viewer for PDF and images.
     - **Download**: Direct file download.
     - **Replace**: Modal to update document category or replace physical file.
     - **Delete**: Modal to remove document from records.

6. **Edit Current Profile (`/profile`)**
   - Patient hero card showing account metadata, registration badge, and member tenure.
   - Detailed multi-section form displaying all data from `user_registration`.
   - **Edit Details** toggle enabling inline edits with **Save Changes** (`PUT /api/registration`) and **Cancel**.
   - **Change Password** section with current password verification.
   - **Danger Zone**: "Delete My Account" with double-confirmation modal (`DELETE /api/registration`), performing cascade deletion across tables and wiping uploaded files from disk.

---

## 6. Complete API Endpoint Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/auth/signup` | Create user login & session | No |
| `POST` | `/api/auth/login` | Authenticate & issue cookie | No |
| `POST` | `/api/auth/logout` | Clear auth cookie | No |
| `GET` | `/api/auth/me` | Fetch active user identity | Yes |
| `POST` | `/api/auth/forgot-password` | Generate 15-min reset token | No |
| `POST` | `/api/auth/reset-password` | Set new password with token | No |
| `PUT` | `/api/auth/change-password` | Change password with current pwd | Yes |
| `POST` | `/api/registration` | Create patient profile record | Yes |
| `GET` | `/api/registration` | Retrieve own profile | Yes |
| `PUT` | `/api/registration` | Update own profile | Yes |
| `DELETE`| `/api/registration` | Delete account & cascade files | Yes |
| `POST` | `/api/documents` | Upload new medical document | Yes |
| `GET` | `/api/documents` | List own active documents | Yes |
| `GET` | `/api/documents/<id>` | View or download document file | Yes |
| `PUT` | `/api/documents/<id>` | Update document type or replace file | Yes |
| `DELETE`| `/api/documents/<id>` | Delete document record and file | Yes |
