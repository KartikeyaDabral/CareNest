import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from werkzeug.utils import secure_filename
from app.db import query_db
from app.utils.security import login_required, get_current_user_id
from app.utils.validators import allowed_file

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

VALID_DOCUMENT_TYPES = {
    "Prescription",
    "ID Proof",
    "Address Proof",
    "Medical Report",
    "Insurance",
    "Other"
}

@documents_bp.route("", methods=["POST"])
@login_required
def upload_document():
    user_id = get_current_user_id()

    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file uploaded in the request.", "data": None}), 400

    file = request.files["file"]
    document_type = request.form.get("document_type", "Prescription").strip()

    if document_type not in VALID_DOCUMENT_TYPES:
        return jsonify({"success": False, "message": f"Invalid document type. Allowed types: {', '.join(VALID_DOCUMENT_TYPES)}", "data": None}), 400

    if file.filename == "":
        return jsonify({"success": False, "message": "No file was selected.", "data": None}), 400

    original_name = file.filename
    if not allowed_file(original_name, current_app.config["ALLOWED_EXTENSIONS"]):
        return jsonify({"success": False, "message": "Invalid file format. Allowed formats: PDF, JPG, JPEG, PNG.", "data": None}), 400

    # Read content length / file size
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)

    if file_length > current_app.config["MAX_CONTENT_LENGTH"]:
        return jsonify({"success": False, "message": "File exceeds maximum permitted size of 5 MB.", "data": None}), 413

    file_size_kb = max(1, round(file_length / 1024))
    mime_type = file.mimetype or "application/octet-stream"

    # User uploads directory
    user_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    clean_filename = secure_filename(original_name) or "document"
    ext = clean_filename.rsplit(".", 1)[1].lower() if "." in clean_filename else "bin"
    stored_name = f"{uuid.uuid4().hex[:12]}_{int(file_length)}_{clean_filename}"
    file_path = os.path.join(user_dir, stored_name)

    # Save to disk
    file.save(file_path)

    # Insert into database
    doc_id = query_db(
        """
        INSERT INTO document_track (
            user_id, document_type, original_file_name, stored_file_name,
            file_path, file_size_kb, mime_type, status, uploaded_at, updated_at, is_deleted
        )
VALUES (
    %s, %s, %s, %s,
    %s, %s, %s, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE
)

        RETURNING document_id;
        """,
        (
            user_id, document_type, original_name, stored_name,
            file_path, file_size_kb, mime_type
        ),
        commit=True
    )

    doc_record = query_db(
        "SELECT * FROM document_track WHERE user_id = %s AND stored_file_name = %s",
        (user_id, stored_name),
        one=True
    )

    return jsonify({
        "success": True,
        "message": f"{document_type} uploaded successfully and queued for verification.",
        "data": doc_record
    }), 201

@documents_bp.route("", methods=["GET"])
@login_required
def get_documents():
    user_id = get_current_user_id()
    docs = query_db(
        """
        SELECT document_id, user_id, document_type, original_file_name, stored_file_name,
               file_size_kb, mime_type, status, uploaded_at, updated_at
        FROM document_track
        WHERE user_id = %s AND (is_deleted = FALSE OR is_deleted = 0)
        ORDER BY uploaded_at DESC;
        """,
        (user_id,)
    )

    return jsonify({
        "success": True,
        "message": f"Retrieved {len(docs)} documents.",
        "data": docs
    }), 200

@documents_bp.route("/<int:doc_id>", methods=["GET"])
@login_required
def download_document(doc_id):
    user_id = get_current_user_id()
    doc = query_db(
        "SELECT * FROM document_track WHERE document_id = %s AND user_id = %s AND (is_deleted = FALSE OR is_deleted = 0)",
        (doc_id, user_id),
        one=True
    )

    if not doc:
        return jsonify({"success": False, "message": "Document not found or access denied.", "data": None}), 404

    user_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], str(user_id))
    as_attachment = request.args.get("download", "0") == "1"

    return send_from_directory(
        user_dir,
        doc["stored_file_name"],
        as_attachment=as_attachment,
        download_name=doc["original_file_name"],
        mimetype=doc["mime_type"]
    )

@documents_bp.route("/<int:doc_id>", methods=["PUT"])
@login_required
def update_document(doc_id):
    user_id = get_current_user_id()
    doc = query_db(
        "SELECT * FROM document_track WHERE document_id = %s AND user_id = %s AND (is_deleted = FALSE OR is_deleted = 0)",
        (doc_id, user_id),
        one=True
    )

    if not doc:
        return jsonify({"success": False, "message": "Document not found.", "data": None}), 404

    document_type = request.form.get("document_type") or (request.json.get("document_type") if request.is_json else None)
    if document_type and document_type not in VALID_DOCUMENT_TYPES:
        return jsonify({"success": False, "message": f"Invalid document type. Allowed: {', '.join(VALID_DOCUMENT_TYPES)}", "data": None}), 400

    # If new file is uploaded to replace
    if "file" in request.files and request.files["file"].filename != "":
        file = request.files["file"]
        original_name = file.filename
        if not allowed_file(original_name, current_app.config["ALLOWED_EXTENSIONS"]):
            return jsonify({"success": False, "message": "Invalid file format. Allowed: PDF, JPG, PNG.", "data": None}), 400

        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0)

        if file_length > current_app.config["MAX_CONTENT_LENGTH"]:
            return jsonify({"success": False, "message": "File exceeds maximum permitted size of 5 MB.", "data": None}), 413

        user_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], str(user_id))
        clean_filename = secure_filename(original_name) or "document"
        new_stored_name = f"{uuid.uuid4().hex[:12]}_{int(file_length)}_{clean_filename}"
        new_file_path = os.path.join(user_dir, new_stored_name)
        file.save(new_file_path)

        # Delete previous stored file from disk
        old_path = os.path.join(user_dir, doc["stored_file_name"])
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

        file_size_kb = max(1, round(file_length / 1024))
        mime_type = file.mimetype or "application/octet-stream"

        query_db(
            """
            UPDATE document_track SET
                document_type = COALESCE(%s, document_type),
                original_file_name = %s,
                stored_file_name = %s,
                file_path = %s,
                file_size_kb = %s,
                mime_type = %s,
                status = 'Pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE document_id = %s;
            """,
            (document_type, original_name, new_stored_name, new_file_path, file_size_kb, mime_type, doc_id),
            commit=True
        )
    elif document_type:
        query_db(
            "UPDATE document_track SET document_type = %s, updated_at = CURRENT_TIMESTAMP WHERE document_id = %s",
            (document_type, doc_id),
            commit=True
        )

    updated_doc = query_db("SELECT * FROM document_track WHERE document_id = %s", (doc_id,), one=True)
    return jsonify({
        "success": True,
        "message": "Document updated successfully.",
        "data": updated_doc
    }), 200

@documents_bp.route("/<int:doc_id>", methods=["DELETE"])
@login_required
def delete_document(doc_id):
    user_id = get_current_user_id()
    doc = query_db(
        "SELECT * FROM document_track WHERE document_id = %s AND user_id = %s",
        (doc_id, user_id),
        one=True
    )

    if not doc:
        return jsonify({"success": False, "message": "Document not found.", "data": None}), 404

    # Remove file from disk
    user_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], str(user_id))
    disk_path = os.path.join(user_dir, doc["stored_file_name"])
    if os.path.exists(disk_path):
        try:
            os.remove(disk_path)
        except OSError:
            pass

    # Soft delete in table
    query_db(
        "UPDATE document_track SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE document_id = %s",
        (doc_id,),
        commit=True
    )

    return jsonify({
        "success": True,
        "message": "Document deleted successfully.",
        "data": None
    }), 200
