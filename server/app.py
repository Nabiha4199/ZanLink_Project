from __future__ import annotations

import os
import secrets
import smtplib
import sqlite3
import time
from io import BytesIO
from copy import deepcopy
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from uuid import uuid4

from flask import Flask, g, jsonify, request
from flask import send_file
from flask_cors import CORS
from dotenv import load_dotenv
try:
    from google.auth.exceptions import GoogleAuthError
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ModuleNotFoundError:
    class GoogleAuthError(Exception):
        pass

    google_requests = None
    id_token = None
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Table
from reportlab.platypus import TableStyle
from werkzeug.security import check_password_hash, generate_password_hash


SERVER_DIR = Path(__file__).resolve().parent
load_dotenv(SERVER_DIR / ".env.local")

# Local development uses the same public OAuth client ID as the Vite client.
# Explicit server environment variables still take precedence in production.
if not os.getenv("GOOGLE_CLIENT_ID"):
    load_dotenv(SERVER_DIR.parent / "client" / ".env")


def load_auth_secret() -> str:
    configured = os.getenv("AUTH_SECRET", "").strip()
    if configured:
        return configured
    secret_file = SERVER_DIR / ".auth-secret"
    if secret_file.exists():
        persisted = secret_file.read_text(encoding="utf-8").strip()
        if persisted:
            return persisted
    generated = secrets.token_urlsafe(48)
    secret_file.write_text(generated, encoding="utf-8")
    secret_file.chmod(0o600)
    return generated


app = Flask(__name__)
CORS(app, origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")])
GOOGLE_CLIENT_ID = (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID", "")).strip()
APP_URL = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME).strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
AUTH_SECRET = load_auth_secret()
AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "28800"))
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(SERVER_DIR / "zanlink.db")))
if not DATABASE_PATH.is_absolute():
    DATABASE_PATH = SERVER_DIR / DATABASE_PATH
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "zda23b014@iitmz.ac.in").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Abdallah123")
LOGIN_ATTEMPTS = {}
AUTH_SERIALIZER = URLSafeTimedSerializer(AUTH_SECRET)
DUMMY_PASSWORD_HASH = generate_password_hash("not-a-real-user-password")

SEED_USERS = [
    {"id": "u1", "name": "Amina", "username": "engineer", "email": "zda23b007@iitmz.ac.in", "password": "Amina123", "role": "Engineer", "department": "Engineer"},
    {"id": "u2", "name": "Ayman", "username": "sales", "email": "zda23b009@iitmz.ac.in", "password": "Ayman123", "role": "Sales", "department": "Sales"},
    {"id": "u3", "name": "Nabiha", "username": "accounts", "email": "zda23b018@iitmz.ac.in", "password": "Nabiha123", "role": "Accounts", "department": "Accounts"},
    {"id": "u4", "name": "Abdallah", "username": "admin", "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "role": "System Admin", "department": "Management"},
    {"id": "u5", "name": "Store Team", "username": "store", "password": "demo1234", "role": "Store", "department": "Store"},
    {"id": "u6", "name": "Head of Department", "username": "hod", "password": "demo1234", "role": "Head of Department", "department": "HOD"},
]

REGISTERABLE_ROLES = {
    "Engineer": {"role": "Engineer", "department": "Engineer"},
    "Sales": {"role": "Sales", "department": "Sales"},
    "Accounts": {"role": "Accounts", "department": "Accounts"},
    "Store": {"role": "Store", "department": "Store"},
    "Management": {"role": "Management", "department": "Management"},
    "HOD": {"role": "Head of Department", "department": "HOD"},
}

USER_COLUMNS = {
    "name",
    "username",
    "email",
    "passwordHash",
    "role",
    "department",
    "status",
    "googleSub",
    "picture",
    "authVersion",
    "approvedAt",
    "approvedBy",
}


def database_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                email TEXT UNIQUE COLLATE NOCASE,
                passwordHash TEXT,
                role TEXT NOT NULL,
                department TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                googleSub TEXT UNIQUE,
                picture TEXT NOT NULL DEFAULT '',
                authVersion INTEGER NOT NULL DEFAULT 1,
                createdAt TEXT NOT NULL,
                approvedAt TEXT,
                approvedBy TEXT
            )
            """
        )
        existing_ids = {
            row["id"]
            for row in connection.execute("SELECT id FROM users").fetchall()
        }
        for user in SEED_USERS:
            if user["id"] in existing_ids:
                continue
            connection.execute(
                """
                INSERT INTO users (
                    id, name, username, email, passwordHash, role, department,
                    status, authVersion, createdAt, approvedAt, approvedBy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, 'system')
                """,
                (
                    user["id"],
                    user["name"],
                    user["username"],
                    user.get("email"),
                    generate_password_hash(user["password"]),
                    user["role"],
                    user["department"],
                    now_iso(),
                    now_iso(),
                ),
            )

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


initialize_database()


def history(user_id: str, action: str, note: str = "") -> dict:
    return {"id": str(uuid4()), "at": now_iso(), "userId": user_id, "action": action, "note": note}


STATE = {
    "counters": {"doc1": 2, "maintenance": 2, "summary": 1},
    "documents": [
        {
            "id": "d1",
            "type": "doc1",
            "number": "REQ-000001",
            "clientName": "Stone Town Hotel",
            "contact": "+255 777 100 400",
            "service": "Dedicated internet onboarding",
            "serviceType": "new_installation",
            "location": "Zanzibar",
            "status": "Pending Store",
            "currentDepartment": "Store",
            "createdBy": "u1",
            "createdAt": now_iso(),
            "engineer": {"notes": "Install router, outdoor radio and cabling for new client."},
            "sales": {"amount": 1250000, "packageCost": 1150000, "remarks": "Business 50 Mbps package."},
            "accounts": {"billingAmount": 1250000, "invoiceNumber": "INV-2044", "remarks": "Invoice prepared."},
            "store": {
                "confirmed": False,
                "amountMatches": None,
                "remarks": "",
                "items": [
                    {"itemId": "RTR-001", "name": "Router", "requestedQty": 1, "issuedQty": 0, "serialNumber": "", "purpose": "CPE", "unitCost": 180000},
                    {"itemId": "RAD-001", "name": "Outdoor radio", "requestedQty": 1, "issuedQty": 0, "serialNumber": "", "purpose": "Connectivity", "unitCost": 520000},
                ],
            },
            "management": {},
            "history": [
                history("u1", "Created Document 1", "Engineer submitted onboarding and requisition."),
                history("u2", "Sales amount added", "Moved to Accounts."),
                history("u3", "Billing added", "Moved to Store."),
            ],
        },
        {
            "id": "m1",
            "type": "maintenance",
            "number": "MNT-000001",
            "clientName": "Airport Office",
            "contact": "+255 777 222 111",
            "service": "Link maintenance",
            "location": "Abeid Amani Karume Airport",
            "status": "Pending HOD",
            "currentDepartment": "HOD",
            "createdBy": "u1",
            "createdAt": now_iso(),
            "maintenance": {
                "fault": "Intermittent signal during rain.",
                "action": "Inspect mast alignment and replace weatherproofing.",
                "items": [
                    {
                        "name": "Fusion protection sleeve 60mm",
                        "requestedQty": 600,
                        "issuedQty": 600,
                        "serialNumber": "3870",
                        "purpose": "Maintenance",
                        "unitCost": 0,
                    }
                ],
            },
            "hod": {},
            "accounts": {},
            "history": [history("u1", "Created maintenance request", "Waiting for HOD approval.")],
        },
    ],
    "summaries": [],
    "notifications": [],
}


def public_user(user: dict) -> dict:
    safe = deepcopy(user)
    safe.pop("passwordHash", None)
    safe.pop("googleSub", None)
    return safe


def normalize_username(value: str | None) -> str:
    return str(value or "").strip().lower()


def require_password(payload: dict, field: str = "password") -> str:
    password = str(payload.get(field) or "")
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters")
    if len(password) > 128:
        raise ValueError("Password must be 128 characters or fewer")
    if not any(character.isalpha() for character in password) or not any(character.isdigit() for character in password):
        raise ValueError("Password must contain at least one letter and one number")
    return password


def available_username(email: str) -> str:
    local_part = email.split("@", 1)[0]
    base = "".join(character for character in local_part if character.isalnum() or character in "._-")[:40]
    if len(base) < 3:
        base = f"user-{base}"[:40]
    username = base
    suffix = 2
    with database_connection() as connection:
        existing = connection.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
    while existing:
        ending = f"-{suffix}"
        username = f"{base[:40 - len(ending)]}{ending}"
        suffix += 1
        with database_connection() as connection:
            existing = connection.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
    return username


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM:
        raise RuntimeError("Password reset email is not configured")

    message = EmailMessage()
    message["Subject"] = "Reset your Zanlink password"
    message["From"] = SMTP_FROM
    message["To"] = recipient
    message.set_content(
        "We received a request to reset your Zanlink password.\n\n"
        f"Open this link within 30 minutes:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
        if SMTP_USE_TLS:
            smtp.starttls()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)


def find_user(user_id: str | None) -> dict | None:
    if not user_id:
        return None
    with database_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def find_user_by_email(email: str) -> dict | None:
    with database_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
    return dict(row) if row else None


def find_user_by_google_sub(google_sub: str) -> dict | None:
    with database_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE googleSub = ?", (google_sub,)).fetchone()
    return dict(row) if row else None


def list_users() -> list[dict]:
    with database_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM users ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, createdAt DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def insert_user(user: dict) -> None:
    with database_connection() as connection:
        connection.execute(
            """
            INSERT INTO users (
                id, name, username, email, passwordHash, role, department,
                status, googleSub, picture, authVersion, createdAt, approvedAt, approvedBy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                user["name"],
                user["username"],
                user.get("email"),
                user.get("passwordHash"),
                user["role"],
                user["department"],
                user.get("status", "pending"),
                user.get("googleSub"),
                user.get("picture", ""),
                user.get("authVersion", 1),
                user.get("createdAt", now_iso()),
                user.get("approvedAt"),
                user.get("approvedBy"),
            ),
        )


def update_user(user_id: str, **changes) -> dict:
    invalid = set(changes) - USER_COLUMNS
    if invalid:
        raise ValueError(f"Unsupported user fields: {', '.join(sorted(invalid))}")
    if not changes:
        user = find_user(user_id)
        if not user:
            raise ValueError("User not found")
        return user
    assignments = ", ".join(f"{field} = ?" for field in changes)
    with database_connection() as connection:
        connection.execute(
            f"UPDATE users SET {assignments} WHERE id = ?",
            (*changes.values(), user_id),
        )
    user = find_user(user_id)
    if not user:
        raise ValueError("User not found")
    return user


def user_has_role(user: dict, selected_role: str) -> bool:
    allowed_roles = {user["role"], user.get("department", "")}
    if user["role"] == "System Admin":
        allowed_roles.update({"Management", "System Admin"})
    return selected_role in allowed_roles


def find_document(document_id: str) -> dict | None:
    return next((doc for doc in STATE["documents"] if doc["id"] == document_id), None)


def find_summary(summary_id: str) -> dict | None:
    return next((summary for summary in STATE["summaries"] if summary["id"] == summary_id), None)


def next_number(kind: str) -> str:
    value = STATE["counters"][kind]
    STATE["counters"][kind] = value + 1
    if kind == "summary":
        return f"Zanlink/{value:06d}"
    if kind == "maintenance":
        return f"MNT-{value:06d}"
    return f"REQ-{value:06d}"


class AuthenticationError(Exception):
    pass


def issue_session(user: dict) -> dict:
    token = AUTH_SERIALIZER.dumps(
        {"userId": user["id"], "authVersion": user.get("authVersion", 1)},
        salt="zanlink-access",
    )
    return {"accessToken": token, "expiresIn": AUTH_TOKEN_TTL_SECONDS, "user": public_user(user)}


def current_user() -> dict:
    cached = getattr(g, "authenticated_user", None)
    if cached:
        return cached

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthenticationError("Authentication is required")
    try:
        claims = AUTH_SERIALIZER.loads(token, salt="zanlink-access", max_age=AUTH_TOKEN_TTL_SECONDS)
    except SignatureExpired as error:
        raise AuthenticationError("Your session has expired. Sign in again.") from error
    except BadSignature as error:
        raise AuthenticationError("Invalid authentication token") from error

    user = find_user(str(claims.get("userId") or ""))
    if not user or int(claims.get("authVersion", 0)) != int(user.get("authVersion", 1)):
        raise AuthenticationError("Your session is no longer valid")
    if user.get("status") != "active":
        raise AuthenticationError("Your account does not currently have access")
    g.authenticated_user = user
    return user


def require_admin() -> dict:
    user = current_user()
    if user["role"] != "System Admin":
        raise PermissionError("System administrator access is required")
    return user


def enforce_login_rate_limit(email: str) -> None:
    key = (request.remote_addr or "unknown", email)
    now = time.monotonic()
    attempts = [attempt for attempt in LOGIN_ATTEMPTS.get(key, []) if now - attempt < 900]
    LOGIN_ATTEMPTS[key] = attempts
    if len(attempts) >= 5:
        raise AuthenticationError("Too many failed sign-in attempts. Try again in 15 minutes.")


def record_failed_login(email: str) -> None:
    key = (request.remote_addr or "unknown", email)
    LOGIN_ATTEMPTS.setdefault(key, []).append(time.monotonic())


def clear_failed_logins(email: str) -> None:
    LOGIN_ATTEMPTS.pop((request.remote_addr or "unknown", email), None)


def require_department(user: dict, *departments: str) -> None:
    allowed = user["role"] == "System Admin" or user["department"] in departments or user["role"] in departments
    if not allowed:
        raise PermissionError("This action is not allowed for your department")


def set_route(doc: dict, status: str, department: str) -> None:
    doc["status"] = status
    doc["currentDepartment"] = department


def notify(department: str, message: str) -> None:
    STATE["notifications"].append({"id": str(uuid4()), "department": department, "message": message, "read": False, "createdAt": now_iso()})


def require_text(payload: dict, field: str, label: str | None = None, max_length: int = 180) -> str:
    value = payload.get(field)
    if value is None or not str(value).strip():
        raise ValueError(f"{label or field} is required")
    value = str(value).strip()
    if len(value) > max_length:
        raise ValueError(f"{label or field} must be {max_length} characters or fewer")
    return value


def optional_text(payload: dict, field: str, default: str = "", max_length: int = 500) -> str:
    value = str(payload.get(field, default) or "").strip()
    if len(value) > max_length:
        raise ValueError(f"{field} must be {max_length} characters or fewer")
    return value


def require_number(payload: dict, field: str, label: str | None = None, minimum: float = 0, allow_zero: bool = True) -> float:
    raw = payload.get(field)
    if raw is None or raw == "":
        raise ValueError(f"{label or field} is required")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError(f"{label or field} must be a valid number")
    if value < minimum or (value == 0 and not allow_zero):
        rule = f"at least {minimum}" if allow_zero else f"greater than {minimum}"
        raise ValueError(f"{label or field} must be {rule}")
    return value


def validate_items(items: list, *, require_issued: bool = False, require_cost: bool = False, context: str = "Item") -> list[dict]:
    if not isinstance(items, list) or not items:
        raise ValueError(f"{context} list must contain at least one item")
    cleaned = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"{context} {index} is invalid")
        name = require_text(item, "name", f"{context} {index} name")
        requested_qty = require_number(item, "requestedQty", f"{context} {index} requested quantity", minimum=0, allow_zero=False)
        issued_qty = require_number(item, "issuedQty", f"{context} {index} issued quantity", minimum=0) if require_issued else float(item.get("issuedQty") or 0)
        if issued_qty > requested_qty:
            raise ValueError(f"{context} {index} issued quantity cannot exceed requested quantity")
        unit_cost = require_number(item, "unitCost", f"{context} {index} cost", minimum=0, allow_zero=not require_cost)
        cleaned.append(
            {
                "itemId": optional_text(item, "itemId", max_length=120),
                "name": name,
                "requestedQty": requested_qty,
                "issuedQty": issued_qty,
                "serialNumber": optional_text(item, "serialNumber", max_length=120),
                "purpose": optional_text(item, "purpose", default="Sold to Client", max_length=180),
                "unitCost": unit_cost,
            }
        )
    return cleaned


def require_status(doc: dict, *statuses: str) -> None:
    if doc["status"] not in statuses:
        allowed = ", ".join(statuses)
        raise ValueError(f"{doc['number']} is {doc['status']} and cannot be submitted here. Expected: {allowed}")


def generate_summary(doc: dict) -> dict:
    existing = next((summary for summary in STATE["summaries"] if summary["sourceDocumentId"] == doc["id"]), None)
    if existing:
        return existing

    items = deepcopy(doc["store"]["items"])
    subtotal = sum(float(item.get("issuedQty") or 0) * float(item.get("unitCost") or 0) for item in items)
    created_by = find_user(doc.get("createdBy"))
    summary = {
        "id": str(uuid4()),
        "number": next_number("summary"),
        "sourceDocumentId": doc["id"],
        "sourceDocumentNumber": doc["number"],
        "customerName": doc["clientName"],
        "customerLocation": doc["location"],
        "customerContact": doc.get("contact", ""),
        "service": doc.get("service", ""),
        "invoiceNumber": doc.get("accounts", {}).get("invoiceNumber", ""),
        "billingAmount": float(doc.get("accounts", {}).get("billingAmount") or 0),
        "items": items,
        "subtotal": subtotal,
        "transportCost": 0,
        "grandTotal": subtotal,
        "zanlinkStaff": created_by["name"] if created_by else "",
        "terms": "If any of the devices above is provided on test basis, it will only be kept for a maximum period of 5 days at client's premises. After that the client should either return the device(s) or will be charged for it.",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    STATE["summaries"].insert(0, summary)
    return summary


def visible_documents_for(user: dict) -> list[dict]:
    if user["role"] == "System Admin":
        return STATE["documents"]
    if user["role"] == "Management" or user["department"] == "Management":
        return [doc for doc in STATE["documents"] if doc.get("workflowCompletedAt") or (doc.get("type") == "doc1" and doc.get("status") == "Completed")]
    return [
        doc
        for doc in STATE["documents"]
        if doc["createdBy"] == user["id"] or doc["currentDepartment"] == user["department"] or doc["status"] == "Completed"
    ]


def ensure_document_access(user: dict, doc: dict) -> None:
    if user["role"] == "System Admin":
        return
    if (user["role"] == "Management" or user["department"] == "Management") and (doc.get("workflowCompletedAt") or (doc.get("type") == "doc1" and doc.get("status") == "Completed")):
        return
    if doc["createdBy"] == user["id"] or doc["currentDepartment"] == user["department"] or doc["status"] == "Completed":
        return
    raise PermissionError("This document is not visible to your role")


def require_completed_doc1(user: dict, document_id: str) -> dict:
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Completed Document 1 not found")
    ensure_document_access(user, doc)
    if doc["status"] != "Completed" and not doc.get("workflowCompletedAt"):
        raise ValueError("Final PDFs are available only after the document is completed")
    return doc


def pdf_response(buffer: BytesIO, filename: str):
    buffer.seek(0)
    return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name=filename)


def draw_header(pdf: canvas.Canvas, title: str, doc: dict) -> None:
    width, height = A4
    pdf.setFont("Helvetica-Bold", 24)
    pdf.setFillColor(colors.HexColor("#b8c1cc"))
    pdf.drawString(22 * mm, height - 28 * mm, "zanlink")
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawCentredString(width / 2, height - 34 * mm, title)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(width - 22 * mm, height - 24 * mm, f"Document No. {doc['number']}")
    pdf.drawRightString(width - 22 * mm, height - 30 * mm, f"Date {datetime.now().strftime('%d/%m/%Y')}")


def draw_label_value(pdf: canvas.Canvas, label: str, value: str, x: float, y: float, w: float = 45 * mm) -> None:
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(colors.HexColor("#5f6b7a"))
    pdf.drawString(x, y + 8, label)
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 9)
    pdf.rect(x, y - 5, w, 15, stroke=1, fill=0)
    pdf.drawString(x + 3, y, str(value or "-")[:36])


def service_type_label(value: str | None) -> str:
    labels = {
        "new_installation": "New Installation",
        "reconnection": "Reconnection",
        "wifi_extension": "WiFi Extension",
    }
    return labels.get(value or "new_installation", "New Installation")


def draw_checkbox(pdf: canvas.Canvas, label: str, checked: bool, x: float, y: float) -> None:
    pdf.rect(x, y, 9, 9, stroke=1, fill=0)
    if checked:
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(x + 1.5, y + 1, "X")
    pdf.setFont("Helvetica", 8)
    pdf.drawString(x + 12, y + 1, label)


def build_onboarding_pdf(doc: dict) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    draw_header(pdf, "CUSTOMER ONBOARDING FORM", doc)

    y = height - 58 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 14, "Customer Information")
    selected_type = doc.get("serviceType", "new_installation")
    draw_checkbox(pdf, "New Installation", selected_type == "new_installation", 22 * mm, y + 22)
    draw_checkbox(pdf, "Reconnection", selected_type == "reconnection", 62 * mm, y + 22)
    draw_checkbox(pdf, "WiFi Extension", selected_type == "wifi_extension", 98 * mm, y + 22)
    draw_label_value(pdf, "Client Name", doc["clientName"], 22 * mm, y, 56 * mm)
    draw_label_value(pdf, "Location", doc["location"], 85 * mm, y, 52 * mm)
    draw_label_value(pdf, "Service", doc["service"], 143 * mm, y, 45 * mm)
    draw_label_value(pdf, "Contact", doc["contact"], 22 * mm, y - 18 * mm, 56 * mm)
    draw_label_value(pdf, "Installation Cost", f"{doc.get('sales', {}).get('amount', '-')}", 85 * mm, y - 18 * mm, 52 * mm)
    draw_label_value(pdf, "MBR", f"{doc.get('sales', {}).get('mbr', doc.get('accounts', {}).get('billingAmount', '-'))}", 143 * mm, y - 18 * mm, 45 * mm)
    draw_label_value(pdf, "Subscription Package", doc.get("sales", {}).get("subscription", doc.get("sales", {}).get("remarks", "")), 22 * mm, y - 36 * mm, 115 * mm)
    draw_label_value(pdf, "Requested By", doc.get("sales", {}).get("requestedBy", "Engineer"), 143 * mm, y - 36 * mm, 45 * mm)

    y -= 66 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Engineering Confirmation")
    draw_label_value(pdf, "Stock Requisition No.", doc["number"], 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Engineer Notes", doc.get("engineer", {}).get("notes", ""), 85 * mm, y - 4, 103 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Management Approval")
    management_approved = bool(doc.get("management", {}).get("approvedBy"))
    draw_label_value(pdf, "Approved By", "Management" if management_approved else "Pending Management", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Comments", doc.get("management", {}).get("remarks", "") if management_approved else "Approval optional", 85 * mm, y - 4, 103 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Admin Stock Confirmation")
    draw_label_value(pdf, "Stock Availability", "Confirmed", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Stock Issued By", "Store", 85 * mm, y - 4, 52 * mm)
    draw_label_value(pdf, "Date", datetime.now().strftime("%d/%m/%Y"), 143 * mm, y - 4, 45 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Finance & Billing")
    draw_label_value(pdf, "Billing Confirmation", "Confirmed", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Invoice Number", doc.get("accounts", {}).get("invoiceNumber", ""), 85 * mm, y - 4, 52 * mm)
    draw_label_value(pdf, "Received By", "Engineer", 143 * mm, y - 4, 45 * mm)

    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawString(22 * mm, 22 * mm, "Internal All Employees")
    pdf.showPage()
    pdf.save()
    return buffer


def build_stock_requisition_pdf(doc: dict) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    draw_header(pdf, "STOCK REQUISITION FORM", doc)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(width - 22 * mm, height - 42 * mm, f"Install Requisition No. {doc['number']}")

    rows = [["S/N", "ITEM ID", "DESCRIPTION", "QUANTITY REQUESTED", "QUANTITY ISSUED"]]
    for index, item in enumerate(doc.get("store", {}).get("items", []), start=1):
        rows.append(
            [
                str(index),
                item.get("itemId") or item.get("serialNumber") or "-",
                item.get("name") or "-",
                str(item.get("requestedQty") or "-"),
                str(item.get("issuedQty") or "-"),
            ]
        )
    if len(rows) == 1:
        rows.append(["1", "-", "-", "-", "-"])

    table = Table(rows, colWidths=[12 * mm, 28 * mm, 78 * mm, 35 * mm, 35 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.7, colors.HexColor("#6b7280")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    table.wrapOn(pdf, width, height)
    table.drawOn(pdf, 22 * mm, height - 90 * mm)

    y = height - 112 * mm
    pdf.setFont("Helvetica", 8)
    pdf.drawString(22 * mm, y + 12, "Narration")
    pdf.rect(22 * mm, y - 20, 166 * mm, 30, stroke=1, fill=0)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(26 * mm, y - 4, doc.get("engineer", {}).get("notes") or f"Installation for {doc['clientName']}")

    signature_rows = [
        ("Requested by", "Engineer", "S.E"),
        ("Approved by", "Accounts", "Accounts"),
        ("Issued by", "Store", "Admin"),
        ("Received by", "Engineer", "N/A"),
    ]
    y -= 42 * mm
    for label, name, position in signature_rows:
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(22 * mm, y, f"{label}:")
        draw_label_value(pdf, "Name", name, 58 * mm, y - 1, 38 * mm)
        draw_label_value(pdf, "Position", position, 103 * mm, y - 1, 38 * mm)
        draw_label_value(pdf, "Signature", "", 147 * mm, y - 1, 22 * mm)
        draw_label_value(pdf, "Date", datetime.now().strftime("%d/%m/%Y"), 173 * mm, y - 1, 20 * mm)
        y -= 20 * mm

    pdf.showPage()
    pdf.save()
    return buffer


def build_client_summary_pdf(summary: dict, doc: dict | None) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 24)
    pdf.setFillColor(colors.HexColor("#9aa4b2"))
    pdf.drawString(22 * mm, height - 25 * mm, "zanlink")
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(width - 22 * mm, height - 20 * mm, "P.O. Box 4204,")
    pdf.drawRightString(width - 22 * mm, height - 24 * mm, "Zanzibar, TANZANIA.")
    pdf.drawRightString(width - 22 * mm, height - 28 * mm, "Tel: +255 777 476 666")
    pdf.drawRightString(width - 22 * mm, height - 32 * mm, "E-Mail: info-zanlink@liquidtelecom.co.tz")

    info_rows = [
        ["Sheet No.", summary["number"], "Source Document", summary.get("sourceDocumentNumber") or (doc or {}).get("number", "")],
        ["Customer", summary.get("customerName") or (doc or {}).get("clientName", ""), "Location", summary.get("customerLocation") or (doc or {}).get("location", "")],
        ["Date", datetime.fromisoformat(summary["createdAt"]).strftime("%d/%m/%Y") if summary.get("createdAt") else datetime.now().strftime("%d/%m/%Y"), "Invoice Number", summary.get("invoiceNumber", "")],
        ["Billing Amount", f"${float(summary.get('billingAmount') or 0):,.2f}", "Contact", summary.get("customerContact") or (doc or {}).get("contact", "")],
    ]
    info_table = Table(info_rows, colWidths=[28 * mm, 61 * mm, 28 * mm, 61 * mm])
    info_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.6, colors.black), ("FONTSIZE", (0, 0), (-1, -1), 8), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold")]))
    info_table.wrapOn(pdf, width, height)
    info_table.drawOn(pdf, 16 * mm, height - 62 * mm)

    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(width / 2, height - 78 * mm, "Equipment/Accessories delivered")

    rows = [["No.", "Item ID", "Equipment/Accessory", "Qty", "Purpose", "Unit Cost", "Total"]]
    for index, item in enumerate(summary.get("items", []), start=1):
        qty = float(item.get("issuedQty") or 0)
        cost = float(item.get("unitCost") or 0)
        rows.append(
            [
                str(index),
                item.get("itemId") or item.get("serialNumber", ""),
                item.get("name", ""),
                f"{qty:g}",
                item.get("purpose") or "Sold to Client",
                f"${cost:,.2f}",
                f"${qty * cost:,.2f}",
            ]
        )
    rows.extend(
        [
            ["", "", "", "", "", "Sub Total:", f"${float(summary.get('subtotal') or 0):,.2f}"],
            ["", "", "", "", "", "Transportation Cost:", f"${float(summary.get('transportCost') or 0):,.2f}"],
            ["", "", "", "", "", "Grand Total Cost:", f"${float(summary.get('grandTotal') or 0):,.2f}"],
        ]
    )
    table = Table(rows, colWidths=[9 * mm, 25 * mm, 52 * mm, 13 * mm, 31 * mm, 25 * mm, 28 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (5, -3), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("ALIGN", (5, 1), (6, -1), "RIGHT"),
            ]
        )
    )
    table.wrapOn(pdf, width, height)
    table.drawOn(pdf, 14 * mm, height - 140 * mm)

    y = height - 154 * mm
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(16 * mm, y, "Terms & Conditions")
    pdf.setFont("Helvetica", 6.5)
    text = pdf.beginText(16 * mm, y - 8)
    for line in [
        summary.get("terms", ""),
        "1. During the test period, the device is entirely client's responsibility. If damaged, the client will be charged for it.",
        "2. Client should make payments for any device/accessories or transport cost applicable within 5 days of invoice attachment.",
    ]:
        text.textLine(line[:132])
    pdf.drawText(text)

    y = 58 * mm
    pdf.setFont("Helvetica", 8)
    pdf.drawString(16 * mm, y, f"Name of Customer: {summary.get('customerName') or (doc or {}).get('clientName', '')}")
    pdf.drawString(112 * mm, y, f"Name of ZANLINK Staff: {summary.get('zanlinkStaff') or '-'}")
    pdf.drawString(16 * mm, y - 22 * mm, "Signature")
    pdf.drawString(112 * mm, y - 22 * mm, "Signature")
    pdf.line(16 * mm, y - 15 * mm, 76 * mm, y - 15 * mm)
    pdf.line(112 * mm, y - 15 * mm, 178 * mm, y - 15 * mm)

    pdf.showPage()
    pdf.save()
    return buffer


def build_maintenance_certificate_pdf(doc: dict) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 24)
    pdf.setFillColor(colors.HexColor("#b8c1cc"))
    pdf.drawRightString(width - 22 * mm, height - 24 * mm, "zanlink")
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(22 * mm, height - 44 * mm, f"Date: {datetime.now().strftime('%d/%m/%Y')}")
    pdf.drawRightString(width - 22 * mm, height - 44 * mm, f"Certificate No: Zanlink/{doc['number']}")

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(width / 2, height - 58 * mm, "CERTIFICATE OF COMPLETION")
    pdf.setFont("Helvetica", 9)
    text = (
        f"This is to confirm and certify that the job was done successfully at {doc.get('clientName', '')} "
        f"and the below materials were issued through requisition no. {doc['number']}."
    )
    wrapped = [text[i : i + 95] for i in range(0, len(text), 95)]
    y = height - 74 * mm
    for line in wrapped:
        pdf.drawCentredString(width / 2, y, line)
        y -= 5 * mm

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(22 * mm, y - 6 * mm, f"SITE NAME: {doc.get('clientName', '')}")
    pdf.drawString(22 * mm, y - 22 * mm, "MATERIALS USED")

    rows = [["S/N", "ITEM ID", "DESCRIPTION", "QUANTITY REQUESTED", "QUANTITY ISSUED"]]
    for index, item in enumerate(doc.get("maintenance", {}).get("items", []), start=1):
        rows.append(
            [
                str(index),
                item.get("itemId") or item.get("serialNumber") or "-",
                item.get("name") or "-",
                str(item.get("requestedQty") or "-"),
                str(item.get("issuedQty") or "-"),
            ]
        )
    if len(rows) == 1:
        rows.append(["1", "-", doc.get("maintenance", {}).get("action", "-"), "-", "-"])

    table = Table(rows, colWidths=[12 * mm, 28 * mm, 78 * mm, 35 * mm, 35 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ]
        )
    )
    table.wrapOn(pdf, width, height)
    table.drawOn(pdf, 22 * mm, y - 50 * mm)

    y -= 64 * mm
    pdf.setFont("Helvetica", 8)
    pdf.drawString(22 * mm, y, "The site has been inspected for the completion of the job carried.")
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(22 * mm, y - 12 * mm, "Certified by Head of Department")
    pdf.setFont("Helvetica", 9)
    pdf.drawString(22 * mm, y - 24 * mm, "Name: ----------------")
    pdf.drawString(22 * mm, y - 36 * mm, "Signature: ------------")
    pdf.drawString(22 * mm, y - 48 * mm, "Date: -----------------")
    pdf.drawString(70 * mm, y - 24 * mm, find_user(doc.get("hod", {}).get("approvedBy"))["name"] if doc.get("hod", {}).get("approvedBy") else "Head of Department")
    pdf.drawString(70 * mm, y - 48 * mm, datetime.now().strftime("%d/%m/%Y"))

    pdf.showPage()
    pdf.save()
    return buffer


@app.errorhandler(PermissionError)
def permission_error(error: PermissionError):
    return jsonify({"error": str(error)}), 403


@app.errorhandler(AuthenticationError)
def authentication_error(error: AuthenticationError):
    return jsonify({"error": str(error)}), 401


@app.errorhandler(ValueError)
def value_error(error: ValueError):
    return jsonify({"error": str(error)}), 400


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "zanlink-backend"})


@app.get("/api/users")
def users():
    require_admin()
    return jsonify([public_user(user) for user in list_users()])


@app.get("/api/auth/me")
def auth_me():
    return jsonify(public_user(current_user()))


@app.post("/api/login")
def login():
    payload = request.get_json(force=True)
    email = normalize_username(payload.get("email"))
    enforce_login_rate_limit(email)
    user = find_user_by_email(email)
    password_hash = user.get("passwordHash") if user else DUMMY_PASSWORD_HASH
    password_valid = check_password_hash(password_hash or DUMMY_PASSWORD_HASH, str(payload.get("password") or ""))
    if not user or not password_valid:
        record_failed_login(email)
        return jsonify({"error": "Invalid email or password"}), 401
    if user.get("status") == "pending":
        return jsonify({"error": "Your account is awaiting administrator approval."}), 403
    if user.get("status") != "active":
        return jsonify({"error": "Your account access has been disabled. Contact the system administrator."}), 403
    clear_failed_logins(email)
    return jsonify(issue_session(user))


@app.post("/api/auth/google")
def google_login():
    if not GOOGLE_CLIENT_ID or not google_requests or not id_token:
        return jsonify({"error": "Google sign-in is not configured on the server"}), 503

    credential = str((request.get_json(force=True) or {}).get("credential") or "")
    if not credential:
        raise ValueError("Google credential is required")

    try:
        identity = id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except ValueError:
        return jsonify({"error": "Google sign-in could not be verified"}), 401
    except GoogleAuthError:
        return jsonify({"error": "Google verification service is temporarily unavailable"}), 503

    email = normalize_username(identity.get("email"))
    google_sub = str(identity.get("sub") or "")
    if not google_sub or not email or identity.get("email_verified") not in (True, "true"):
        return jsonify({"error": "A verified Google account is required"}), 401

    user = find_user_by_google_sub(google_sub)
    if not user:
        user = find_user_by_email(email)
    if not user:
        return jsonify({"error": "This Google account is not registered. Register an account first or contact the system administrator."}), 403
    if user.get("status") == "pending":
        return jsonify({"error": "Your account is awaiting administrator approval."}), 403
    if user.get("status") != "active":
        return jsonify({"error": "Your account access has been disabled. Contact the system administrator."}), 403

    user = update_user(user["id"], googleSub=google_sub)
    return jsonify(issue_session(user))


@app.post("/api/register")
def register():
    payload = request.get_json(force=True)
    email = normalize_username(payload.get("email"))
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise ValueError("Enter a valid email address")
    if find_user_by_email(email):
        raise ValueError("Email is already registered")

    role_key = require_text(payload, "role", "Role", max_length=40)
    role_info = REGISTERABLE_ROLES.get(role_key)
    if not role_info:
        raise ValueError("Please select a valid role")

    user = {
        "id": f"u-{uuid4()}",
        "name": require_text(payload, "name", "Full name"),
        "username": available_username(email),
        "email": email,
        "passwordHash": generate_password_hash(require_password(payload)),
        "status": "pending",
        "authVersion": 1,
        "createdAt": now_iso(),
        **role_info,
    }
    insert_user(user)
    return jsonify({
        "message": "Registration submitted. A system administrator must approve your account before you can sign in.",
        "user": public_user(find_user(user["id"])),
    }), 202


@app.patch("/api/admin/users/<user_id>/access")
def update_user_access(user_id: str):
    administrator = require_admin()
    target = find_user(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    payload = request.get_json(force=True) or {}
    status = str(payload.get("status") or target["status"]).strip().lower()
    if status not in {"pending", "active", "disabled"}:
        raise ValueError("Status must be pending, active, or disabled")
    if target["id"] == administrator["id"] and status != "active":
        raise ValueError("You cannot disable your own administrator account")

    changes = {"status": status, "authVersion": int(target.get("authVersion", 1)) + 1}
    role_key = str(payload.get("role") or "").strip()
    if role_key:
        role_info = REGISTERABLE_ROLES.get(role_key)
        if not role_info:
            raise ValueError("Please select a valid role")
        changes.update(role_info)
    if status == "active":
        changes.update({"approvedAt": now_iso(), "approvedBy": administrator["id"]})

    updated = update_user(user_id, **changes)
    return jsonify(public_user(updated))


@app.post("/api/forgot-password")
def forgot_password():
    payload = request.get_json(force=True)
    email = normalize_username(payload.get("email"))
    if "@" not in email:
        raise ValueError("Enter a valid email address")
    generic_response = {"ok": True, "message": "If an active account exists for that email, a password reset link has been sent."}
    user = find_user_by_email(email)
    if not user or user.get("status") != "active":
        return jsonify(generic_response)

    raw_token = AUTH_SERIALIZER.dumps(
        {"userId": user["id"], "authVersion": user.get("authVersion", 1)},
        salt="zanlink-password-reset",
    )
    try:
        send_password_reset_email(email, f"{APP_URL}/?reset_token={raw_token}")
    except RuntimeError:
        app.logger.exception("Could not send password reset email")
        return jsonify({"error": "Your account was found, but the system could not send the reset email because email delivery is not configured. Contact zda23b014@iitmz.ac.in."}), 503
    except smtplib.SMTPAuthenticationError:
        app.logger.exception("SMTP credentials were rejected")
        return jsonify({"error": "The email account rejected its SMTP credentials. Configure a valid Google App Password and restart the server."}), 503
    except (smtplib.SMTPException, OSError):
        app.logger.exception("Could not send password reset email")
        return jsonify({"error": "The email service is temporarily unavailable. Please try again later."}), 503

    return jsonify(generic_response)


@app.post("/api/reset-password")
def reset_password():
    payload = request.get_json(force=True)
    raw_token = str(payload.get("token") or "")
    try:
        reset = AUTH_SERIALIZER.loads(raw_token, salt="zanlink-password-reset", max_age=1800)
    except (BadSignature, SignatureExpired):
        return jsonify({"error": "This reset link is invalid or has expired"}), 400

    password = require_password(payload, "newPassword")
    if password != str(payload.get("confirmPassword") or ""):
        raise ValueError("Passwords do not match")
    user = find_user(reset["userId"])
    if not user or int(reset.get("authVersion", 0)) != int(user.get("authVersion", 1)):
        return jsonify({"error": "This reset link is invalid or has expired"}), 400
    update_user(
        user["id"],
        passwordHash=generate_password_hash(password),
        authVersion=int(user.get("authVersion", 1)) + 1,
    )
    return jsonify({"ok": True, "message": "Password updated. You can sign in now."})


@app.get("/api/documents")
def documents():
    user = current_user()
    docs = deepcopy(visible_documents_for(user))
    query = (request.args.get("q") or "").lower()
    doc_type = request.args.get("type") or ""
    status = request.args.get("status") or ""
    department = request.args.get("department") or ""
    if query:
        docs = [doc for doc in docs if query in f"{doc['number']} {doc['clientName']} {doc['status']} {doc['currentDepartment']}".lower()]
    if doc_type:
        docs = [doc for doc in docs if doc["type"] == doc_type]
    if status:
        docs = [doc for doc in docs if doc["status"] == status]
    if department:
        docs = [doc for doc in docs if doc["currentDepartment"] == department]
    return jsonify(docs)


@app.post("/api/documents/doc1")
def create_doc1():
    user = current_user()
    require_department(user, "Engineer")
    payload = request.get_json(force=True)
    service_type = payload.get("serviceType", "new_installation")
    if service_type not in {"new_installation", "reconnection", "wifi_extension"}:
        raise ValueError("Onboarding type must be New Installation, Reconnection, or WiFi Extension")
    items = validate_items(payload.get("items", []), context="Stock item")
    doc = {
        "id": str(uuid4()),
        "type": "doc1",
        "number": next_number("doc1"),
        "clientName": require_text(payload, "clientName", "Client name"),
        "contact": require_text(payload, "contact", "Contact"),
        "service": require_text(payload, "service", "Requested service"),
        "serviceType": service_type,
        "location": require_text(payload, "location", "Location"),
        "status": "Pending Sales",
        "currentDepartment": "Sales",
        "createdBy": user["id"],
        "createdAt": now_iso(),
        "engineer": {"notes": optional_text(payload, "engineerNotes")},
        "sales": {},
        "accounts": {},
        "store": {"confirmed": False, "amountMatches": None, "remarks": "", "items": items},
        "management": {},
        "history": [history(user["id"], "Created Document 1", "Submitted to Sales.")],
    }
    STATE["documents"].insert(0, doc)
    notify("Sales", f"{doc['number']} is waiting for Sales amount.")
    return jsonify(doc), 201


@app.post("/api/documents/maintenance")
def create_maintenance():
    user = current_user()
    require_department(user, "Engineer")
    payload = request.get_json(force=True)
    items = validate_items(payload.get("items", []), context="Maintenance material")
    doc = {
        "id": str(uuid4()),
        "type": "maintenance",
        "number": next_number("maintenance"),
        "clientName": require_text(payload, "clientName", "Client/site name"),
        "contact": require_text(payload, "contact", "Contact"),
        "service": require_text(payload, "service", "Service"),
        "location": require_text(payload, "location", "Location"),
        "status": "Pending HOD",
        "currentDepartment": "HOD",
        "createdBy": user["id"],
        "createdAt": now_iso(),
        "maintenance": {"fault": require_text(payload, "fault", "Fault report", max_length=800), "action": require_text(payload, "action", "Recommended action", max_length=800), "items": items},
        "hod": {},
        "accounts": {},
        "history": [history(user["id"], "Created maintenance request", "Submitted to HOD.")],
    }
    STATE["documents"].insert(0, doc)
    notify("HOD", f"{doc['number']} is waiting for HOD approval.")
    return jsonify(doc), 201


@app.post("/api/documents/<document_id>/sales")
def sales_submit(document_id: str):
    user = current_user()
    require_department(user, "Sales")
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Document 1 not found")
    require_status(doc, "Pending Sales", "Returned to Sales")
    payload = request.get_json(force=True)
    client_name = require_text(payload, "clientName", "Client name")
    location = require_text(payload, "location", "Location")
    subscription = require_text(payload, "subscription", "Subscription")
    equipment = deepcopy(doc.get("store", {}).get("items", []))
    doc["clientName"] = client_name
    doc["location"] = location
    doc["sales"] = {
        "clientName": client_name,
        "location": location,
        "surveyFormNo": require_text(payload, "surveyFormNo", "Survey form number"),
        "amount": require_number(payload, "amount", "Sales total amount", minimum=0, allow_zero=False),
        "packageCost": require_number(payload, "packageCost", "Package cost", minimum=0) if payload.get("packageCost") not in (None, "") else 0,
        "additionalNpr": require_number(payload, "additionalNpr", "Additional NPR", minimum=0),
        "subscription": subscription,
        "mbr": require_number(payload, "mbr", "MBR", minimum=0),
        "requestedBy": require_text(payload, "requestedBy", "Requested by"),
        "requestedDate": require_text(payload, "requestedDate", "Date", max_length=20),
        "equipment": equipment,
        "remarks": subscription,
    }
    set_route(doc, "Pending Accounts", "Accounts")
    doc["history"].append(history(user["id"], "Sales amount added", "Submitted to Accounts."))
    notify("Accounts", f"{doc['number']} is waiting for billing.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/accounts")
def accounts_submit(document_id: str):
    user = current_user()
    require_department(user, "Accounts")
    doc = find_document(document_id)
    if not doc:
        raise ValueError("Document not found")
    if doc["type"] == "maintenance":
        require_status(doc, "Pending Accounts")
    else:
        require_status(doc, "Pending Accounts")
    payload = request.get_json(force=True)
    doc["accounts"] = {
        "billingAmount": require_number(payload, "billingAmount", "Billing amount", minimum=0, allow_zero=doc["type"] == "maintenance"),
        "invoiceNumber": require_text(payload, "invoiceNumber", "Invoice number"),
        "remarks": optional_text(payload, "remarks"),
    }
    if doc["type"] == "maintenance":
        set_route(doc, "Completed", "Engineer")
        doc["history"].append(history(user["id"], "Maintenance billing added", "Maintenance completed and returned to Engineer."))
        notify("Engineer", f"{doc['number']} maintenance request has been completed.")
    else:
        source_equipment = payload.get("equipment") or doc.get("sales", {}).get("equipment") or doc.get("store", {}).get("items", [])
        equipment = validate_items(source_equipment, require_cost=True, context="Account equipment")
        store_items = deepcopy(doc.get("store", {}).get("items", []))
        if len(equipment) != len(store_items):
            raise ValueError("Accounts must provide a cost for every requested equipment item")
        for index, (account_item, store_item) in enumerate(zip(equipment, store_items), start=1):
            if account_item["name"] != store_item.get("name") or float(account_item["requestedQty"]) != float(store_item.get("requestedQty") or 0):
                raise ValueError(f"Account equipment {index} must match the original request")
            store_item["unitCost"] = account_item["unitCost"]
        doc["store"]["items"] = store_items
        doc.setdefault("sales", {})["equipment"] = deepcopy(store_items)
        doc["sales"]["packageCost"] = sum(float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0) for item in store_items)
        set_route(doc, "Pending Store", "Store")
        doc["history"].append(history(user["id"], "Billing added", "Submitted to Store."))
        notify("Store", f"{doc['number']} is waiting for stock validation.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/store")
def store_submit(document_id: str):
    user = current_user()
    require_department(user, "Store")
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Document 1 not found")
    require_status(doc, "Pending Store")
    payload = request.get_json(force=True)
    items = deepcopy(doc.get("store", {}).get("items", []))
    submitted_items = payload.get("items")
    if not isinstance(submitted_items, list) or len(submitted_items) != len(items):
        raise ValueError("Issued quantities must be provided for every requested equipment item")
    for index, item in enumerate(items, start=1):
        issued_qty = require_number(
            submitted_items[index - 1],
            "issuedQty",
            f"Equipment {index} issued quantity",
            minimum=0,
            allow_zero=False,
        )
        if issued_qty > float(item.get("requestedQty") or 0):
            raise ValueError(f"Equipment {index} issued quantity cannot exceed requested quantity")
        item["issuedQty"] = issued_qty
    matches = float(doc.get("sales", {}).get("amount") or 0) == float(doc.get("accounts", {}).get("billingAmount") or 0)
    doc["store"] = {
        "confirmed": matches,
        "amountMatches": matches,
        "approvedBy": user["id"],
        "approvedAt": now_iso(),
        "remarks": doc.get("store", {}).get("remarks", ""),
        "items": items,
    }
    if matches:
        doc["workflowCompletedAt"] = now_iso()
        set_route(doc, "Pending Management", "Management")
        generate_summary(doc)
        doc["history"].append(history(user["id"], "Store completed the workflow", "Client summary generated; Management approval remains optional."))
        notify("Management", f"{doc['number']} is complete and awaiting optional approval.")
        notify("Engineer", f"{doc['number']} is complete; Management approval is still pending.")
    else:
        set_route(doc, "Returned to Sales", "Sales")
        doc["history"].append(history(user["id"], "Returned to Sales", "Sales and Accounts amounts do not match."))
        notify("Sales", f"{doc['number']} was returned because amounts do not match.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/management")
def management_submit(document_id: str):
    user = current_user()
    require_department(user, "Management")
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Document 1 not found")
    require_status(doc, "Pending Management")
    payload = request.get_json(force=True)
    doc["management"] = {"approvedBy": user["id"], "approvedAt": now_iso(), "remarks": optional_text(payload, "remarks")}
    set_route(doc, "Completed", "Engineer")
    doc["history"].append(history(user["id"], "Management approved", "Document completed and returned to Engineer."))
    notify("Engineer", f"{doc['number']} has been completed.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/hod")
def hod_submit(document_id: str):
    user = current_user()
    require_department(user, "HOD")
    doc = find_document(document_id)
    if not doc or doc["type"] != "maintenance":
        raise ValueError("Maintenance document not found")
    require_status(doc, "Pending HOD")
    payload = request.get_json(force=True)
    doc["hod"] = {"approvedBy": user["id"], "approvedAt": now_iso(), "remarks": optional_text(payload, "remarks")}
    set_route(doc, "Pending Accounts", "Accounts")
    doc["history"].append(history(user["id"], "HOD approved maintenance", "Submitted to Accounts."))
    notify("Accounts", f"{doc['number']} maintenance request is waiting for billing.")
    return jsonify(doc)


@app.get("/api/summaries")
def summaries():
    current_user()
    return jsonify(STATE["summaries"])


@app.get("/api/summaries/<summary_id>/download")
def download_summary(summary_id: str):
    user = current_user()
    summary = find_summary(summary_id)
    if not summary:
        raise ValueError("Client summary not found")
    doc = find_document(summary["sourceDocumentId"])
    if doc and user["department"] != "Accounts" and user["role"] != "System Admin":
        ensure_document_access(user, doc)
    filename = f"{(summary.get('customerName') or 'client').replace(' ', '_')}_client_summary.pdf"
    return pdf_response(build_client_summary_pdf(summary, doc), filename)


@app.get("/api/documents/<document_id>/downloads/onboarding")
def download_onboarding(document_id: str):
    user = current_user()
    doc = require_completed_doc1(user, document_id)
    filename = f"{doc['clientName'].replace(' ', '_')}_onboarding.pdf"
    return pdf_response(build_onboarding_pdf(doc), filename)


@app.get("/api/documents/<document_id>/downloads/stock-requisition")
def download_stock_requisition(document_id: str):
    user = current_user()
    doc = require_completed_doc1(user, document_id)
    filename = f"{doc['clientName'].replace(' ', '_')}_stock_requisition.pdf"
    return pdf_response(build_stock_requisition_pdf(doc), filename)


@app.get("/api/documents/<document_id>/downloads/maintenance-certificate")
def download_maintenance_certificate(document_id: str):
    user = current_user()
    doc = find_document(document_id)
    if not doc or doc["type"] != "maintenance":
        raise ValueError("Maintenance document not found")
    ensure_document_access(user, doc)
    if doc["status"] != "Completed":
        raise ValueError("Certificate is available only after maintenance is completed")
    filename = f"{doc['clientName'].replace(' ', '_')}_maintenance_certificate.pdf"
    return pdf_response(build_maintenance_certificate_pdf(doc), filename)


@app.get("/api/reports")
def reports():
    current_user()
    status_counts = {}
    for doc in STATE["documents"]:
        status_counts[doc["status"]] = status_counts.get(doc["status"], 0) + 1
    return jsonify(
        {
            "totalDocuments": len(STATE["documents"]),
            "totalSummaries": len(STATE["summaries"]),
            "unreadNotifications": len([item for item in STATE["notifications"] if not item["read"]]),
            "statusCounts": status_counts,
        }
    )


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true",
    )
