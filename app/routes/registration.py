import os
import shutil
from flask import Blueprint, request, jsonify, current_app, make_response
from app.db import query_db
from app.utils.security import login_required, get_current_user_id
from app.utils.validators import validate_mobile, validate_pincode, validate_date

registration_bp = Blueprint("registration", __name__, url_prefix="/api/registration")

@registration_bp.route("", methods=["POST"])
@login_required
def create_registration():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    date_of_birth = data.get("date_of_birth", "").strip()
    gender = data.get("gender", "").strip()
    blood_group = data.get("blood_group", "").strip()
    mobile = data.get("mobile", "").strip().replace(" ", "")
    alternate_mobile = data.get("alternate_mobile", "").strip().replace(" ", "")
    address_line1 = data.get("address_line1", "").strip()
    address_line2 = data.get("address_line2", "").strip()
    city = data.get("city", "").strip()
    state = data.get("state", "").strip()
    pincode = data.get("pincode", "").strip()
    allergies = data.get("allergies", "").strip()
    chronic_conditions = data.get("chronic_conditions", "").strip()
    current_medications = data.get("current_medications", "").strip()
    emergency_contact_name = data.get("emergency_contact_name", "").strip()
    emergency_contact_phone = data.get("emergency_contact_phone", "").strip().replace(" ", "")

    # Validations
    if not first_name or not last_name:
        return jsonify({"success": False, "message": "First name and last name are required.", "data": None}), 400

    if not date_of_birth or not validate_date(date_of_birth):
        return jsonify({"success": False, "message": "Please enter a valid date of birth (cannot be a future date).", "data": None}), 400

    if not gender:
        return jsonify({"success": False, "message": "Please specify your gender.", "data": None}), 400

    if not validate_mobile(mobile):
        return jsonify({"success": False, "message": "Please enter a valid 10-digit primary mobile number.", "data": None}), 400

    if alternate_mobile and not validate_mobile(alternate_mobile):
        return jsonify({"success": False, "message": "Alternate mobile number must be 10 digits if provided.", "data": None}), 400

    if not address_line1 or not city or not state:
        return jsonify({"success": False, "message": "Address line 1, city, and state are required.", "data": None}), 400

    if not validate_pincode(pincode):
        return jsonify({"success": False, "message": "Pincode must be exactly 6 digits.", "data": None}), 400

    if not emergency_contact_name or not validate_mobile(emergency_contact_phone):
        return jsonify({"success": False, "message": "Emergency contact name and a valid 10-digit phone number are required.", "data": None}), 400

    # Check if registration already exists
    existing = query_db("SELECT registration_id FROM user_registration WHERE user_id = %s", (user_id,), one=True)
    if existing:
        return jsonify({"success": False, "message": "Registration record already exists. Use PUT to update your profile.", "data": None}), 409

    reg_id = query_db(
        """
        INSERT INTO user_registration (
            user_id, first_name, last_name, date_of_birth, gender, blood_group,
            mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
            allergies, chronic_conditions, current_medications,
            emergency_contact_name, emergency_contact_phone, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, NOW(), NOW()
        )
        RETURNING registration_id;
        """,
        (
            user_id, first_name, last_name, date_of_birth, gender, blood_group,
            mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
            allergies, chronic_conditions, current_medications,
            emergency_contact_name, emergency_contact_phone
        ),
        commit=True
    )

    # Mark user as registered
    query_db("UPDATE user_login SET is_registered = TRUE, updated_at = NOW() WHERE user_id = %s", (user_id,), commit=True)

    return jsonify({
        "success": True,
        "message": "Healthcare profile registered successfully!",
        "data": {
            "registration_id": reg_id,
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name
        }
    }), 201

@registration_bp.route("", methods=["GET"])
@login_required
def get_registration():
    user_id = get_current_user_id()
    
    user = query_db("SELECT email, mobile as login_mobile, is_registered, created_at as member_since FROM user_login WHERE user_id = %s", (user_id,), one=True)
    reg = query_db("SELECT * FROM user_registration WHERE user_id = %s", (user_id,), one=True)

    if not reg:
        return jsonify({
            "success": True,
            "message": "User login found, but detailed profile is not yet completed.",
            "data": {
                "user_id": user_id,
                "email": user["email"] if user else "",
                "login_mobile": user["login_mobile"] if user else "",
                "is_registered": False,
                "profile": None
            }
        }), 200

    profile_data = dict(reg)
    profile_data["email"] = user["email"] if user else ""
    profile_data["member_since"] = user["member_since"] if user else ""

    return jsonify({
        "success": True,
        "message": "Profile retrieved successfully.",
        "data": profile_data
    }), 200

@registration_bp.route("", methods=["PUT"])
@login_required
def update_registration():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    date_of_birth = data.get("date_of_birth", "").strip()
    gender = data.get("gender", "").strip()
    blood_group = data.get("blood_group", "").strip()
    mobile = data.get("mobile", "").strip().replace(" ", "")
    alternate_mobile = data.get("alternate_mobile", "").strip().replace(" ", "")
    address_line1 = data.get("address_line1", "").strip()
    address_line2 = data.get("address_line2", "").strip()
    city = data.get("city", "").strip()
    state = data.get("state", "").strip()
    pincode = data.get("pincode", "").strip()
    allergies = data.get("allergies", "").strip()
    chronic_conditions = data.get("chronic_conditions", "").strip()
    current_medications = data.get("current_medications", "").strip()
    emergency_contact_name = data.get("emergency_contact_name", "").strip()
    emergency_contact_phone = data.get("emergency_contact_phone", "").strip().replace(" ", "")

    if not first_name or not last_name:
        return jsonify({"success": False, "message": "First name and last name are required.", "data": None}), 400

    if not date_of_birth or not validate_date(date_of_birth):
        return jsonify({"success": False, "message": "Please enter a valid date of birth.", "data": None}), 400

    if not validate_mobile(mobile):
        return jsonify({"success": False, "message": "Please enter a valid 10-digit mobile number.", "data": None}), 400

    if alternate_mobile and not validate_mobile(alternate_mobile):
        return jsonify({"success": False, "message": "Alternate mobile must be 10 digits.", "data": None}), 400

    if not address_line1 or not city or not state:
        return jsonify({"success": False, "message": "Address line 1, city, and state are required.", "data": None}), 400

    if not validate_pincode(pincode):
        return jsonify({"success": False, "message": "Pincode must be exactly 6 digits.", "data": None}), 400

    if not emergency_contact_name or not validate_mobile(emergency_contact_phone):
        return jsonify({"success": False, "message": "Emergency contact name and 10-digit phone are required.", "data": None}), 400

    # Ensure profile exists, otherwise create it
    existing = query_db("SELECT registration_id FROM user_registration WHERE user_id = %s", (user_id,), one=True)
    if not existing:
        query_db(
            """
            INSERT INTO user_registration (
                user_id, first_name, last_name, date_of_birth, gender, blood_group,
                mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
                allergies, chronic_conditions, current_medications,
                emergency_contact_name, emergency_contact_phone, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, NOW(), NOW()
            );
            """,
            (
                user_id, first_name, last_name, date_of_birth, gender, blood_group,
                mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
                allergies, chronic_conditions, current_medications,
                emergency_contact_name, emergency_contact_phone
            ),
            commit=True
        )
    else:
        query_db(
            """
            UPDATE user_registration SET
                first_name = %s,
                last_name = %s,
                date_of_birth = %s,
                gender = %s,
                blood_group = %s,
                mobile = %s,
                alternate_mobile = %s,
                address_line1 = %s,
                address_line2 = %s,
                city = %s,
                state = %s,
                pincode = %s,
                allergies = %s,
                chronic_conditions = %s,
                current_medications = %s,
                emergency_contact_name = %s,
                emergency_contact_phone = %s,
                updated_at = NOW()
            WHERE user_id = %s;
            """,
            (
                first_name, last_name, date_of_birth, gender, blood_group,
                mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
                allergies, chronic_conditions, current_medications,
                emergency_contact_name, emergency_contact_phone,
                user_id
            ),
            commit=True
        )

    query_db("UPDATE user_login SET is_registered = TRUE, updated_at = NOW() WHERE user_id = %s", (user_id,), commit=True)

    return jsonify({
        "success": True,
        "message": "Healthcare profile updated successfully.",
        "data": {
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name
        }
    }), 200

@registration_bp.route("", methods=["DELETE"])
@login_required
def delete_account():
    user_id = get_current_user_id()

    # Cascade delete in database
    # foreign keys are ON DELETE CASCADE, so deleting from user_login removes user_registration & document_track
    query_db("DELETE FROM user_login WHERE user_id = %s", (user_id,), commit=True)

    # Delete physical uploaded files directory
    user_upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], str(user_id))
    if os.path.exists(user_upload_dir):
        shutil.rmtree(user_upload_dir, ignore_errors=True)

    resp = make_response(jsonify({
        "success": True,
        "message": "Your CareNest account and all associated health documents have been permanently deleted.",
        "data": None
    }), 200)
    resp.delete_cookie("carenest_token")
    return resp
