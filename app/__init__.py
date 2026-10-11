import os
from flask import Flask, jsonify
from flask_cors import CORS
from app.config import Config
from app.db import init_pool, close_db

def create_app(config_class=Config):
    app = Flask(
        __name__,
        template_folder=os.path.join(Config.BASE_DIR, "templates"),
        static_folder=os.path.join(Config.BASE_DIR, "static")
    )
    app.config.from_object(config_class)

    # Enable CORS
    CORS(app, supports_credentials=True)

    # Ensure upload directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Setup database connection
    with app.app_context():
        init_pool(app)

    # Register teardown
    app.teardown_appcontext(close_db)

    # Try initializing Flask-JWT-Extended if installed
    try:
        from flask_jwt_extended import JWTManager
        jwt = JWTManager(app)
    except Exception:
        pass

    # Register Blueprints
    from app.routes.pages import pages_bp
    from app.routes.auth import auth_bp
    from app.routes.registration import registration_bp
    from app.routes.documents import documents_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(registration_bp)
    app.register_blueprint(documents_bp)

    # Centralized JSON Error Handlers for API endpoints
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"success": False, "message": "Bad request. Please check your submission parameters.", "data": None}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"success": False, "message": "Authentication required to access this resource.", "data": None}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"success": False, "message": "Access forbidden or account is restricted.", "data": None}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"success": False, "message": "The requested resource could not be found.", "data": None}), 404

    @app.errorhandler(413)
    def payload_too_large(error):
        return jsonify({"success": False, "message": "File exceeds the maximum permitted upload limit of 5 MB.", "data": None}), 413

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"success": False, "message": "Internal server error. Our engineering team has been notified.", "data": None}), 500

    return app
