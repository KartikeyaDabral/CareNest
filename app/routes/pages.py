from flask import Blueprint, render_template, redirect, url_for, request
from app.utils.security import get_current_user_id

pages_bp = Blueprint("pages", __name__)

@pages_bp.route("/")
def home():
    user_id = get_current_user_id()
    return render_template("home.html", is_authenticated=bool(user_id))

@pages_bp.route("/signup")
def signup():
    user_id = get_current_user_id()
    if user_id:
        return redirect(url_for("pages.profile"))
    return render_template("signup.html", is_authenticated=False)

@pages_bp.route("/login")
def login():
    user_id = get_current_user_id()
    if user_id:
        return redirect(url_for("pages.profile"))
    return render_template("login.html", is_authenticated=False)

@pages_bp.route("/forgot-password")
def forgot_password():
    return render_template("forgot_password.html", is_authenticated=False)

@pages_bp.route("/reset-password")
def reset_password():
    token = request.args.get("token", "")
    return render_template("reset_password.html", token=token, is_authenticated=False)

@pages_bp.route("/register")
def register():
    user_id = get_current_user_id()
    if not user_id:
        return redirect(url_for("pages.login"))
    return render_template("register.html", is_authenticated=True)

@pages_bp.route("/documents")
def documents():
    user_id = get_current_user_id()
    if not user_id:
        return redirect(url_for("pages.login"))
    return render_template("documents.html", is_authenticated=True)

@pages_bp.route("/profile")
def profile():
    user_id = get_current_user_id()
    if not user_id:
        return redirect(url_for("pages.login"))
    return render_template("profile.html", is_authenticated=True)
