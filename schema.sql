-- ====================================================================
-- CareNest PostgreSQL Database Schema
-- Online Pharmacy & Healthcare Platform
-- ====================================================================

-- 1. Table: user_login
-- Handles authentication, credentials, lockout policy, and registration state
CREATE TABLE IF NOT EXISTS user_login (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_registered BOOLEAN DEFAULT FALSE,
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    reset_token_hash TEXT NULL,
    reset_token_expiry TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP NULL
);

-- Indexes for fast auth lookups
CREATE INDEX IF NOT EXISTS idx_user_login_email ON user_login(email);
CREATE INDEX IF NOT EXISTS idx_user_login_mobile ON user_login(mobile);

-- 2. Table: user_registration
-- Stores comprehensive personal, contact, address, and health information
CREATE TABLE IF NOT EXISTS user_registration (
    registration_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES user_login(user_id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    mobile VARCHAR(15) NOT NULL,
    alternate_mobile VARCHAR(15),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    emergency_contact_name VARCHAR(100) NOT NULL,
    emergency_contact_phone VARCHAR(15) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for user reference
CREATE INDEX IF NOT EXISTS idx_user_registration_user_id ON user_registration(user_id);

-- 3. Table: document_track
-- Tracks uploaded prescriptions, identity proofs, medical reports with audit state
CREATE TABLE IF NOT EXISTS document_track (
    document_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES user_login(user_id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_kb INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Indexes for document filtering
CREATE INDEX IF NOT EXISTS idx_document_track_user_id ON document_track(user_id);
CREATE INDEX IF NOT EXISTS idx_document_track_status ON document_track(status);
