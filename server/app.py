from __future__ import annotations

import os
import hashlib
import re
import secrets
import smtplib
from io import BytesIO
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import uuid4

from flask import Flask, jsonify, request
from flask import send_file
from flask_cors import CORS
from dotenv import load_dotenv
try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ModuleNotFoundError:
    google_requests = None
    id_token = None
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Table
from reportlab.platypus import TableStyle


SERVER_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SERVER_DIRECTORY, ".env"))
load_dotenv(os.path.join(SERVER_DIRECTORY, ".env.local"))
app = Flask(__name__)
CORS(app, origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")])
DEFAULT_GOOGLE_CLIENT_ID = "72716325306-vco86obca8h85qeoadsc9gbntqimu85u.apps.googleusercontent.com"
configured_google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_ID = configured_google_client_id or DEFAULT_GOOGLE_CLIENT_ID
APP_URL = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME).strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "").strip()
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "iitmz.ac.in").strip().lower()
PASSWORD_RESET_TOKENS = {}
EMAIL_PATTERN = re.compile(r"^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")
USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{2,39}$")
REQUEST_NUMBER_PATTERN = re.compile(r"^REQ-(\d{6})$")


USERS = [

    {"id": "u3", "name": "Accounts Team", "username": "accounts", "email": "accounts@iitmz.ac.in", "password": "demo1234", "role": "Accounts", "department": "Accounts"},
    {"id": "u4", "name": "System Admin", "username": "admin", "email": "admin@iitmz.ac.in", "password": "demo1234", "role": "System Admin", "department": "Management"},
    {"id": "u8", "name": "Abdallah", "username": "abdallah", "email": "zda23b014@iitmz.ac.in", "role": "System Admin", "department": "Management"},

]

REGISTERABLE_ROLES = {
    "Engineer": {"role": "Engineer", "department": "Engineer"},
    "Sales": {"role": "Sales", "department": "Sales"},
    "Accounts": {"role": "Accounts", "department": "Accounts"},
    "Store": {"role": "Store", "department": "Store"},
    "Management": {"role": "Management", "department": "Management"},
    "HOD": {"role": "Head of Department", "department": "HOD"},
}

MANAGEABLE_ROLES = {
    **REGISTERABLE_ROLES,
    "System Admin": {"role": "System Admin", "department": "Management"},
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def money_text(value: float | int | str | None, currency: str = "TZS") -> str:
    amount = float(value or 0)
    return f"${amount:,.2f}" if currency == "USD" else f"TZS {amount:,.0f}"


def history(user_id: str, action: str, note: str = "") -> dict:
    return {"id": str(uuid4()), "at": now_iso(), "userId": user_id, "action": action, "note": note}


STATE = {
    "counters": {"request": 3, "summary": 1},
    "clients": [
        {"id": "c1", "name": "Stone Town Hotel", "contact": "+255 777 100 400", "email": "info@stonetownhotel.example", "locations": ["Zanzibar"], "createdAt": now_iso()},
        {"id": "c2", "name": "Airport Office", "contact": "+255 777 222 111", "email": "office@airport.example", "locations": ["Abeid Amani Karume Airport"], "createdAt": now_iso()},
    ],
    "documents": [
        {
            "id": "d1",
            "type": "doc1",
            "number": "REQ-000001",
            "clientId": "c1",
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
            "sales": {"amount": 1250000, "laborCharge": 100000, "packageCost": 1150000, "remarks": "Business 50 Mbps package."},
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
            "number": "REQ-000002",
            "clientId": "c2",
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
    safe["active"] = user.get("active", True)
    safe["pendingApproval"] = user.get("pendingApproval", False)
    safe["hasPassword"] = bool(user.get("password"))
    safe["googleLinked"] = bool(user.get("googleSub"))
    safe.pop("password", None)
    safe.pop("googleSub", None)
    return safe


def normalize_username(value: str | None) -> str:
    return str(value or "").strip().lower()


def normalize_email(value: str | None) -> str:
    email = normalize_username(value)
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("Enter a valid email address")
    return email


def require_username(value: str | None) -> str:
    username = normalize_username(value)
    if not USERNAME_PATTERN.fullmatch(username):
        raise ValueError("Username must be 3–40 characters and use only letters, numbers, dots, hyphens, or underscores")
    return username


def require_password(payload: dict, field: str = "password") -> str:
    password = str(payload.get(field) or "")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(password) > 128:
        raise ValueError("Password must be 128 characters or fewer")
    return password


def available_username(email: str) -> str:
    local_part = email.split("@", 1)[0]
    base = "".join(character for character in local_part if character.isalnum() or character in "._-")[:40]
    if len(base) < 3:
        base = f"user-{base}"[:40]
    username = base
    suffix = 2
    while any(user["username"] == username for user in USERS):
        ending = f"-{suffix}"
        username = f"{base[:40 - len(ending)]}{ending}"
        suffix += 1
    return username


def is_allowed_email(email: str) -> bool:
    return email.endswith(f"@{ALLOWED_EMAIL_DOMAIN}")


def require_allowed_email(value: str | None, action: str = "use") -> str:
    email = normalize_email(value)
    if not is_allowed_email(email):
        raise ValueError(f"Only {ALLOWED_EMAIL_DOMAIN} email accounts can {action}")
    return email


def password_reset_support_message() -> str:
    if SUPPORT_EMAIL:
        return f"Contact {SUPPORT_EMAIL} for help."
    return "Contact your system administrator for help."


def password_reset_delivery_error(error: Exception) -> str:
    if isinstance(error, smtplib.SMTPAuthenticationError):
        return "The email provider rejected the SMTP username or app password."
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        return "The email provider rejected the recipient address."
    if isinstance(error, (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError)):
        return "The server could not connect to the configured email provider."
    if isinstance(error, smtplib.SMTPException):
        return "The configured email provider rejected the reset message."
    return "The reset email could not be sent."


def send_email(recipient: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM:
        raise RuntimeError("Email delivery is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM
    message["To"] = recipient
    message.set_content(body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
        if SMTP_USE_TLS:
            smtp.starttls()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    send_email(
        recipient,
        "Reset your Zanlink password",
        "We received a request to reset your Zanlink password.\n\n"
        f"Open this link within 30 minutes:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email.",
    )


def find_user(user_id: str | None) -> dict | None:
    return next((user for user in USERS if user["id"] == user_id), None)


def user_has_role(user: dict, selected_role: str) -> bool:
    allowed_roles = {user["role"], user.get("department", "")}
    if user["role"] == "System Admin":
        allowed_roles.update({"Management", "System Admin"})
    return selected_role in allowed_roles


def find_document(document_id: str) -> dict | None:
    return next((doc for doc in STATE["documents"] if doc["id"] == document_id), None)


def find_client(client_id: str | None) -> dict | None:
    return next((client for client in STATE["clients"] if client["id"] == client_id), None)


def registered_client_details(payload: dict) -> tuple[dict, str, str]:
    client = find_client(str(payload.get("clientId") or ""))
    if not client:
        raise ValueError("Select a registered client")
    location = require_text(payload, "location", "Location", max_length=180)
    contact = require_text(payload, "contact", "Contact number", max_length=80)
    client["contact"] = contact
    if location not in client.get("locations", []):
        client.setdefault("locations", []).append(location)
    return client, location, contact


def requested_service(payload: dict) -> str:
    service = require_text(payload, "service", "Requested service")
    return require_text(payload, "otherService", "Other service") if service == "Other" else service


def find_summary(summary_id: str) -> dict | None:
    return next((summary for summary in STATE["summaries"] if summary["id"] == summary_id), None)


def format_request_number(value: int) -> str:
    return f"REQ-{value:06d}"


def normalize_request_numbers() -> None:
    seen = set()
    next_value = 1
    documents = sorted(STATE["documents"], key=lambda doc: (str(doc.get("createdAt") or ""), str(doc.get("id") or "")))

    for doc in documents:
        match = REQUEST_NUMBER_PATTERN.fullmatch(str(doc.get("number") or ""))
        if match:
            value = int(match.group(1))
            if value not in seen:
                seen.add(value)
                next_value = max(next_value, value + 1)
                continue

        while next_value in seen:
            next_value += 1
        doc["number"] = format_request_number(next_value)
        seen.add(next_value)
        next_value += 1

    STATE["counters"]["request"] = max(int(STATE["counters"].get("request", 1)), next_value)


def next_number(kind: str) -> str:
    if kind == "summary":
        value = STATE["counters"][kind]
        STATE["counters"][kind] = value + 1
        return f"Zanlink/{value:06d}"

    normalize_request_numbers()
    value = STATE["counters"].setdefault("request", 1)
    STATE["counters"]["request"] = value + 1
    return format_request_number(value)


normalize_request_numbers()


def current_user() -> dict:
    user = find_user(request.headers.get("X-User-Id"))
    if not user:
        raise PermissionError("Missing or invalid X-User-Id header")
    if not user.get("active", True):
        raise PermissionError("Account access has been revoked")
    return user


def require_department(user: dict, *departments: str) -> None:
    allowed = user["role"] == "System Admin" or user["department"] in departments or user["role"] in departments
    if not allowed:
        raise PermissionError("This action is not allowed for your department")


def require_system_admin(user: dict) -> None:
    if user["role"] != "System Admin":
        raise PermissionError("System Admin access is required")


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


def normalize_tanzania_contact(value: str | None) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("255"):
        digits = digits[3:]
    if digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[67]\d{8}", digits):
        raise ValueError("Enter a valid Tanzania contact number")
    return f"+255 {digits[:3]} {digits[3:6]} {digits[6:]}"


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
                "costCurrency": optional_text(item, "costCurrency", default="TZS", max_length=3) or "TZS",
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
    labor_charge = float(doc.get("sales", {}).get("laborCharge") or 0)
    billed_amount = float(doc.get("accounts", {}).get("billingAmount") or 0)
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
        "currency": doc.get("accounts", {}).get("currency") or doc.get("sales", {}).get("currency") or "TZS",
        "items": items,
        "subtotal": subtotal,
        "installationCost": labor_charge,
        "transportCost": 0,
        "grandTotal": billed_amount,
        "zanlinkStaff": created_by["name"] if created_by else "",
        "terms": "If any of the devices above is provided on test basis, it will only be kept for a maximum period of 5 days at client's premises. After that the client should either return the device(s) or will be charged for it.",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    STATE["summaries"].insert(0, summary)
    return summary


def visible_documents_for(user: dict) -> list[dict]:
    return STATE["documents"]


def parse_iso(value: str | None) -> datetime:
    try:
        return datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def latest_history_note(doc: dict, *actions: str) -> str:
    matching_actions = tuple(action.lower() for action in actions)
    for item in reversed(doc.get("history", [])):
        action = str(item.get("action", "")).lower()
        if not matching_actions or any(expected in action for expected in matching_actions):
            note = str(item.get("note") or "").strip()
            if note:
                return note
    return ""


def request_report_row(doc: dict) -> dict:
    is_pending = str(doc.get("status", "")).startswith("Pending")
    is_rejected = "Returned" in str(doc.get("status", ""))
    is_successful = doc.get("status") == "Completed" or bool(doc.get("workflowCompletedAt"))
    approval_history = any(
        any(keyword in str(item.get("action", "")).lower() for keyword in ("approved", "submitted", "added", "billing"))
        for item in doc.get("history", [])
    )
    is_approved = not is_rejected and (is_successful or approval_history or any(
        doc.get(section, {}).get("approvedAt")
        for section in ("hod", "store", "management")
    ))
    pending_reason = ""
    rejection_reason = ""
    if is_pending:
        pending_reason = f"Waiting for {doc.get('currentDepartment', 'the next department')} action."
        latest_note = latest_history_note(doc)
        if latest_note:
            pending_reason = f"{pending_reason} Last update: {latest_note}"
    if is_rejected:
        rejection_reason = latest_history_note(doc, "returned", "rejected") or "Returned for correction."
    return {
        "id": doc["id"],
        "number": doc["number"],
        "type": doc["type"],
        "clientName": doc["clientName"],
        "service": doc.get("service", ""),
        "location": doc.get("location", ""),
        "status": doc["status"],
        "currentDepartment": doc["currentDepartment"],
        "createdAt": doc["createdAt"],
        "approved": is_approved,
        "pending": is_pending,
        "successful": is_successful,
        "rejected": is_rejected,
        "pendingReason": pending_reason,
        "rejectionReason": rejection_reason,
    }


def build_request_report(docs: list[dict], days: int) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    period_docs = [doc for doc in docs if parse_iso(doc.get("createdAt")) >= cutoff]
    rows = [request_report_row(doc) for doc in sorted(period_docs, key=lambda item: parse_iso(item.get("createdAt")), reverse=True)]
    return {
        "days": days,
        "requests": rows,
        "totalRequests": len(rows),
        "approvedRequests": len([row for row in rows if row["approved"]]),
        "pendingRequests": len([row for row in rows if row["pending"]]),
        "successfulRequests": len([row for row in rows if row["successful"]]),
        "rejectedRequests": len([row for row in rows if row["rejected"]]),
    }


def ensure_document_access(user: dict, doc: dict) -> None:
    return


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
    draw_checkbox(pdf, "Shifting Connection", selected_type == "shifting_connection", 132 * mm, y + 22)
    draw_checkbox(pdf, "General Maintenance", selected_type == "general_maintenance", 22 * mm, y + 34)
    draw_label_value(pdf, "Client Name", doc["clientName"], 22 * mm, y, 56 * mm)
    draw_label_value(pdf, "Location", doc["location"], 85 * mm, y, 52 * mm)
    draw_label_value(pdf, "Service", doc["service"], 143 * mm, y, 45 * mm)
    draw_label_value(pdf, "Contact", doc["contact"], 22 * mm, y - 18 * mm, 56 * mm)
    currency = doc.get("accounts", {}).get("currency") or doc.get("sales", {}).get("currency") or "TZS"
    equipment_cost = float(doc.get("sales", {}).get("packageCost") or 0)
    one_time_total = float(doc.get("sales", {}).get("oneTimeTotal") or 0) or (
        float(doc.get("sales", {}).get("amount") or 0)
        + equipment_cost
        + float(doc.get("sales", {}).get("additionalNpr") or 0)
    )
    grand_total = float(doc.get("sales", {}).get("grandTotal") or 0) or (
        one_time_total + float(doc.get("sales", {}).get("mbr") or 0)
    )
    draw_label_value(
        pdf,
        "Installation Cost/Labor Charge",
        money_text(doc.get("sales", {}).get("laborCharge", doc.get("sales", {}).get("amount")), doc.get("sales", {}).get("currency") or "TZS"),
        85 * mm,
        y - 18 * mm,
        52 * mm,
    )
    draw_label_value(pdf, "MBR", money_text(doc.get("sales", {}).get("mbr", doc.get("accounts", {}).get("billingAmount")), currency), 143 * mm, y - 18 * mm, 45 * mm)
    draw_label_value(pdf, "Subscription Package", doc.get("sales", {}).get("subscription", doc.get("sales", {}).get("remarks", "")), 22 * mm, y - 36 * mm, 115 * mm)
    draw_label_value(pdf, "Requested By", doc.get("sales", {}).get("requestedBy", "Engineer"), 143 * mm, y - 36 * mm, 45 * mm)
    draw_label_value(pdf, "Equipment Cost", money_text(equipment_cost, currency), 22 * mm, y - 54 * mm, 56 * mm)
    draw_label_value(pdf, "One-time Total", money_text(one_time_total, currency), 85 * mm, y - 54 * mm, 52 * mm)
    draw_label_value(pdf, "First Invoice Total", money_text(grand_total, currency), 143 * mm, y - 54 * mm, 45 * mm)

    y -= 84 * mm
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

    currency = summary.get("currency") or (doc or {}).get("accounts", {}).get("currency") or "TZS"
    installation_cost = float(summary.get("installationCost") or 0)
    info_rows = [
        ["Sheet No.", summary["number"], "Source Document", summary.get("sourceDocumentNumber") or (doc or {}).get("number", "")],
        ["Customer", summary.get("customerName") or (doc or {}).get("clientName", ""), "Location", summary.get("customerLocation") or (doc or {}).get("location", "")],
        ["Date", datetime.fromisoformat(summary["createdAt"]).strftime("%d/%m/%Y") if summary.get("createdAt") else datetime.now().strftime("%d/%m/%Y"), "Invoice Number", summary.get("invoiceNumber", "")],
        ["Billed Amount", money_text(summary.get("billingAmount"), currency), "Contact", summary.get("customerContact") or (doc or {}).get("contact", "")],
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
                money_text(cost, currency),
                money_text(qty * cost, currency),
            ]
        )
    rows.extend(
        [
            ["", "", "", "", "", "Sub Total:", money_text(summary.get("subtotal"), currency)],
            ["", "", "", "", "", "Installation Cost/Labor Charge:", money_text(installation_cost, currency)],
            ["", "", "", "", "", "Transportation Cost:", money_text(summary.get("transportCost"), currency)],
            ["", "", "", "", "", "Grand Total Cost:", money_text(summary.get("grandTotal"), currency)],
        ]
    )
    table = Table(rows, colWidths=[9 * mm, 25 * mm, 52 * mm, 13 * mm, 31 * mm, 25 * mm, 28 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (5, -4), (-1, -1), "Helvetica-Bold"),
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
    pdf.drawRightString(width - 22 * mm, height - 44 * mm, f"General Maintenance No: Zanlink/{doc['number']}")

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(width / 2, height - 58 * mm, "GENERAL MAINTENANCE")
    pdf.setFont("Helvetica", 9)
    text = (
        f"This confirms that the general maintenance work was completed successfully at {doc.get('clientName', '')} "
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
    pdf.drawString(22 * mm, y - 12 * mm, "Head of Department")
    pdf.setFont("Helvetica", 9)
    approved_by = find_user(doc.get("hod", {}).get("approvedBy"))
    approved_by_name = doc.get("hod", {}).get("approvedByName") or (approved_by["name"] if approved_by else "Pending approval")
    pdf.drawString(22 * mm, y - 24 * mm, f"Name: {approved_by_name}")

    pdf.showPage()
    pdf.save()
    return buffer


@app.errorhandler(PermissionError)
def permission_error(error: PermissionError):
    return jsonify({"error": str(error)}), 403


@app.errorhandler(ValueError)
def value_error(error: ValueError):
    return jsonify({"error": str(error)}), 400


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "service": "zanlink-backend",
        "googleSignInConfigured": bool(GOOGLE_CLIENT_ID),
        "googleAuthInstalled": bool(google_requests and id_token),
        "allowedEmailDomain": ALLOWED_EMAIL_DOMAIN,
    })


@app.get("/api/users")
def users():
    require_system_admin(current_user())
    return jsonify([public_user(user) for user in USERS])


@app.get("/api/account")
def account():
    return jsonify(public_user(current_user()))


@app.post("/api/users")
def create_user():
    require_system_admin(current_user())
    payload = request.get_json(force=True)
    email = require_allowed_email(payload.get("email"), "be added")
    if any(user.get("email") == email for user in USERS):
        raise ValueError("Email is already registered")

    role_key = require_text(payload, "role", "Role", max_length=40)
    role_info = MANAGEABLE_ROLES.get(role_key)
    if not role_info:
        raise ValueError("Please select a valid role")

    user = {
        "id": f"u-{uuid4()}",
        "name": require_text(payload, "name", "Full name"),
        "username": available_username(email),
        "email": email,
        "active": True,
        **role_info,
    }
    password = str(payload.get("password") or "")
    if password:
        user["password"] = require_password(payload)
    USERS.append(user)
    return jsonify(public_user(user)), 201


@app.patch("/api/users/<user_id>")
def update_user_role(user_id: str):
    require_system_admin(current_user())
    user = find_user(user_id)
    if not user:
        raise ValueError("User not found")

    payload = request.get_json(force=True)
    role_info = {"role": user["role"], "department": user["department"]}
    if "role" in payload:
        role_key = require_text(payload, "role", "Role", max_length=40)
        role_info = MANAGEABLE_ROLES.get(role_key)
        if not role_info:
            raise ValueError("Please select a valid role")

    active = user.get("active", True)
    if "active" in payload:
        if not isinstance(payload["active"], bool):
            raise ValueError("Active must be true or false")
        active = payload["active"]

    if active and user.get("pendingApproval", False) and role_info["role"] == "Pending Approval":
        raise ValueError("Select a role before approving this Google account")

    active_admin_count = sum(
        (item["id"] != user["id"] and item["role"] == "System Admin" and item.get("active", True))
        or (item["id"] == user["id"] and role_info["role"] == "System Admin" and active)
        for item in USERS
    )
    if active_admin_count < 1:
        raise ValueError("At least one active System Admin account must remain")

    user.update(role_info)
    user["active"] = active
    if active and user.get("pendingApproval", False):
        user["pendingApproval"] = False
    return jsonify(public_user(user))


@app.delete("/api/users/<user_id>")
def delete_user(user_id: str):
    admin = current_user()
    require_system_admin(admin)
    user = find_user(user_id)
    if not user:
        raise ValueError("User not found")
    if user["id"] == admin["id"]:
        raise ValueError("You cannot delete your own account")

    remaining_active_admins = sum(
        item["id"] != user["id"] and item["role"] == "System Admin" and item.get("active", True)
        for item in USERS
    )
    if user["role"] == "System Admin" and user.get("active", True) and remaining_active_admins < 1:
        raise ValueError("At least one active System Admin account must remain")

    USERS.remove(user)
    for token, reset in list(PASSWORD_RESET_TOKENS.items()):
        if reset.get("userId") == user_id:
            PASSWORD_RESET_TOKENS.pop(token)
    return "", 204


@app.get("/api/clients")
def clients():
    current_user()
    return jsonify(deepcopy(STATE["clients"]))


@app.post("/api/clients")
def create_client():
    current_user()
    payload = request.get_json(force=True)
    locations = payload.get("locations")
    if not isinstance(locations, list):
        raise ValueError("Locations must be a list")
    cleaned_locations = list(dict.fromkeys(str(location).strip() for location in locations if str(location).strip()))
    if not cleaned_locations:
        raise ValueError("Add at least one client location")
    if any(len(location) > 180 for location in cleaned_locations):
        raise ValueError("Each location must be 180 characters or fewer")
    email = normalize_email(payload.get("email"))
    if any(client.get("email", "").lower() == email for client in STATE["clients"]):
        raise ValueError("A client with this email is already registered")
    client = {
        "id": f"c-{uuid4()}",
        "name": require_text(payload, "name", "Client name"),
        "contact": normalize_tanzania_contact(payload.get("contact")),
        "email": email,
        "locations": cleaned_locations,
        "createdAt": now_iso(),
    }
    STATE["clients"].insert(0, client)
    return jsonify(client), 201


@app.post("/api/login")
def login():
    payload = request.get_json(force=True)
    identifier = normalize_username(payload.get("identifier") or payload.get("email"))
    if not identifier:
        raise ValueError("Enter your username or email")
    if "@" in identifier:
        identifier = require_allowed_email(identifier, "sign in")
    existing_user = next((item for item in USERS if item.get("email") == identifier or item.get("username") == identifier), None)
    if existing_user and not existing_user.get("active", True):
        return jsonify({"error": "This account has been disabled. Contact a System Admin."}), 403
    if existing_user and not existing_user.get("password"):
        return jsonify({"error": "This account uses Google sign-in. Use Sign in with Google or reset your password first."}), 401
    user = next((item for item in USERS if (item.get("email") == identifier or item.get("username") == identifier) and item.get("password") == payload.get("password")), None)
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify(public_user(user))


@app.post("/api/auth/google")
def google_login():
    if not google_requests or not id_token:
        return jsonify({"error": "Google sign-in dependency is missing on the server. Run: python -m pip install -r requirements.txt"}), 503
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google sign-in is not configured on the server"}), 503

    credential = str((request.get_json(force=True) or {}).get("credential") or "")
    if not credential:
        raise ValueError("Google credential is required")

    try:
        identity = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except ValueError as error:
        app.logger.warning("Google credential verification failed: %s", error)
        return jsonify({"error": f"Google sign-in could not be verified: {error}"}), 401
    except Exception as error:
        app.logger.exception("Google verification service failed")
        return jsonify({"error": f"Google verification service failed: {error}"}), 503

    try:
        email = require_allowed_email(identity.get("email"), "sign in")
    except ValueError as error:
        return jsonify({"error": str(error)}), 403
    google_sub = str(identity.get("sub") or "")
    if not google_sub or not email or identity.get("email_verified") not in (True, "true"):
        return jsonify({"error": "A verified Google account is required"}), 401

    user = next((item for item in USERS if item.get("email") == email), None)
    if user and user.get("googleSub") and user["googleSub"] != google_sub:
        return jsonify({"error": "This account is already linked to a different Google identity. Contact support."}), 403
    if user and user.get("pendingApproval", False):
        return jsonify({"error": "Your Google account is waiting for System Admin approval. You will be able to continue with Google sign-in once it is approved."}), 403
    if user and not user.get("active", True):
        return jsonify({"error": "This account has been disabled. Contact a System Admin."}), 403
    if not user:
        return jsonify({"error": "No account exists for this email address. Contact a System Admin to create one."}), 403

    user["googleSub"] = google_sub
    user["picture"] = str(identity.get("picture") or user.get("picture") or "")

    return jsonify(public_user(user))


@app.post("/api/register")
def register():
    return jsonify({"error": "Public account creation is disabled. Contact a System Admin."}), 403


@app.post("/api/account/password")
def set_account_password():
    user = current_user()
    payload = request.get_json(force=True)
    password = require_password(payload, "password")
    if password != str(payload.get("confirmPassword") or ""):
        raise ValueError("Passwords do not match")
    user["password"] = password
    return jsonify(public_user(user))


@app.post("/api/forgot-password")
def forgot_password():
    payload = request.get_json(force=True)
    email = require_allowed_email(payload.get("email"), "reset a password")
    selected_role = str(payload.get("role") or "").strip()
    if not selected_role:
        raise ValueError("Please select your role")

    user = next((item for item in USERS if item.get("email") == email), None)
    if not user:
        return jsonify({"error": f"No account is registered with that email address. Check the email or {password_reset_support_message()}"}), 404
    if not user.get("active", True):
        return jsonify({"error": "This account has been disabled. Contact a System Admin."}), 403
    if not user_has_role(user, selected_role):
        return jsonify({"error": "That email is not registered for the selected role. Check your email and role."}), 403

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    PASSWORD_RESET_TOKENS[token_hash] = {
        "userId": user["id"],
        "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    try:
        send_password_reset_email(email, f"{APP_URL}/?reset_token={raw_token}")
    except Exception as error:
        PASSWORD_RESET_TOKENS.pop(token_hash, None)
        app.logger.exception("Could not send password reset email")
        return jsonify({"error": f"Your account was found, but the system could not send the reset email. {password_reset_delivery_error(error)} {password_reset_support_message()}"}), 503

    return jsonify({"ok": True, "message": "A password reset link has been sent to your email."})


@app.post("/api/reset-password")
def reset_password():
    payload = request.get_json(force=True)
    raw_token = str(payload.get("token") or "")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    reset = PASSWORD_RESET_TOKENS.get(token_hash)
    if not reset or reset["expiresAt"] < datetime.now(timezone.utc):
        PASSWORD_RESET_TOKENS.pop(token_hash, None)
        return jsonify({"error": "This reset link is invalid or has expired"}), 400

    password = require_password(payload, "newPassword")
    if password != str(payload.get("confirmPassword") or ""):
        raise ValueError("Passwords do not match")
    user = find_user(reset["userId"])
    user["password"] = password
    PASSWORD_RESET_TOKENS.pop(token_hash, None)
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
    if service_type not in {"new_installation", "reconnection", "wifi_extension", "shifting_connection", "general_maintenance"}:
        raise ValueError("Please select a valid onboarding type")
    client, location, contact = registered_client_details(payload)
    items = validate_items(payload.get("items", []), context="Stock item")
    doc = {
        "id": str(uuid4()),
        "type": "doc1",
        "number": next_number("doc1"),
        "clientId": client["id"],
        "clientName": client["name"],
        "contact": contact,
        "email": client["email"],
        "service": requested_service(payload),
        "serviceType": service_type,
        "location": location,
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
    client, location, contact = registered_client_details(payload)
    items = validate_items(payload.get("items", []), context="Maintenance material")
    doc = {
        "id": str(uuid4()),
        "type": "maintenance",
        "number": next_number("maintenance"),
        "clientId": client["id"],
        "clientName": client["name"],
        "contact": contact,
        "email": client["email"],
        "service": requested_service(payload),
        "location": location,
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
    currency = str(payload.get("currency") or "TZS").upper()
    if currency not in {"TZS", "USD"}:
        raise ValueError("Money type must be TZS or USD")
    source_equipment = payload.get("equipment") or doc.get("store", {}).get("items", [])
    equipment = validate_items(source_equipment, require_cost=True, context="Sales equipment")
    store_items = deepcopy(doc.get("store", {}).get("items", []))
    if len(equipment) != len(store_items):
        raise ValueError("Sales must provide a cost for every requested equipment item")
    for index, (sales_item, store_item) in enumerate(zip(equipment, store_items), start=1):
        if sales_item["name"] != store_item.get("name") or float(sales_item["requestedQty"]) != float(store_item.get("requestedQty") or 0):
            raise ValueError(f"Sales equipment {index} must match the original request")
        store_item["unitCost"] = sales_item["unitCost"]
        store_item["costCurrency"] = currency
        sales_item["costCurrency"] = currency
    package_cost = sum(float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0) for item in equipment)
    labor_charge = require_number(payload, "amount", "Installation cost/labor charge", minimum=0, allow_zero=False)
    additional_npr = require_number(payload, "additionalNpr", "Additional NPR", minimum=0)
    mbr = require_number(payload, "mbr", "MBR", minimum=0)
    total_sales_cost = labor_charge + package_cost
    one_time_total = total_sales_cost + additional_npr
    grand_total = one_time_total + mbr
    submitted_at = datetime.now(timezone.utc)
    doc["clientName"] = client_name
    doc["location"] = location
    doc["store"]["items"] = store_items
    doc["sales"] = {
        "clientName": client_name,
        "location": location,
        "surveyFormNo": require_text(payload, "surveyFormNo", "Survey form number"),
        "amount": total_sales_cost,
        "laborCharge": labor_charge,
        "packageCost": package_cost,
        "additionalNpr": additional_npr,
        "oneTimeTotal": one_time_total,
        "grandTotal": grand_total,
        "subscription": subscription,
        "mbr": mbr,
        "requestedBy": require_text(payload, "requestedBy", "Requested by"),
        "requestedDate": submitted_at.date().isoformat(),
        "requestedTime": submitted_at.strftime("%H:%M"),
        "currency": currency,
        "equipment": deepcopy(equipment),
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
    billing_amount = (
        require_number(payload, "billingAmount", "Billing amount", minimum=0, allow_zero=True)
        if doc["type"] == "maintenance"
        else float(doc.get("sales", {}).get("grandTotal") or doc.get("sales", {}).get("amount") or 0)
    )
    doc["accounts"] = {
        "billingAmount": billing_amount,
        "invoiceNumber": optional_text(payload, "invoiceNumber", max_length=120),
        "remarks": require_text(payload, "remarks", "Remarks", max_length=500),
        "billInUsd": bool(payload.get("billInUsd")),
        "currency": "USD" if payload.get("billInUsd") else str(doc.get("sales", {}).get("currency") or "TZS"),
    }
    if doc["type"] == "maintenance":
        set_route(doc, "Completed", "Engineer")
        doc["history"].append(history(user["id"], "Maintenance billing added", "Maintenance completed and returned to Engineer."))
        notify("Engineer", f"{doc['number']} maintenance request has been completed.")
    else:
        source_equipment = doc.get("sales", {}).get("equipment") or doc.get("store", {}).get("items", [])
        equipment = validate_items(source_equipment, require_cost=True, context="Sales equipment")
        store_items = deepcopy(doc.get("store", {}).get("items", []))
        if len(equipment) != len(store_items):
            raise ValueError("Sales must provide a cost for every requested equipment item")
        for index, (sales_item, store_item) in enumerate(zip(equipment, store_items), start=1):
            if sales_item["name"] != store_item.get("name") or float(sales_item["requestedQty"]) != float(store_item.get("requestedQty") or 0):
                raise ValueError(f"Sales equipment {index} must match the original request")
            store_item["unitCost"] = sales_item["unitCost"]
            store_item["costCurrency"] = sales_item.get("costCurrency") or doc.get("sales", {}).get("currency") or doc["accounts"]["currency"]
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
    expected_total = float(doc.get("sales", {}).get("grandTotal") or doc.get("sales", {}).get("amount") or 0)
    matches = expected_total == float(doc.get("accounts", {}).get("billingAmount") or 0)
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
        doc["history"].append(history(user["id"], "Store completed the workflow", "Delivery note generated; Management approval remains optional."))
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
    doc["hod"] = {
        "approvedBy": user["id"],
        "approvedByName": user["name"],
        "approvedAt": now_iso(),
        "remarks": optional_text(payload, "remarks"),
    }
    set_route(doc, "Pending Accounts", "Accounts")
    doc["history"].append(history(user["id"], "HOD approved maintenance", "Submitted to Accounts."))
    notify("Accounts", f"{doc['number']} maintenance request is waiting for billing.")
    return jsonify(doc)


@app.get("/api/summaries")
def summaries():
    user = current_user()
    require_system_admin(user)
    return jsonify(STATE["summaries"])


@app.get("/api/summaries/<summary_id>/download")
def download_summary(summary_id: str):
    user = current_user()
    require_system_admin(user)
    summary = find_summary(summary_id)
    if not summary:
        raise ValueError("Delivery note not found")
    doc = find_document(summary["sourceDocumentId"])
    filename = f"{(summary.get('customerName') or 'client').replace(' ', '_')}_delivery_note.pdf"
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
    user = current_user()
    docs = deepcopy(visible_documents_for(user))
    status_counts = {}
    for doc in docs:
        status_counts[doc["status"]] = status_counts.get(doc["status"], 0) + 1
    return jsonify(
        {
            "totalDocuments": len(docs),
            "totalSummaries": len(STATE["summaries"]),
            "unreadNotifications": len([item for item in STATE["notifications"] if not item["read"]]),
            "statusCounts": status_counts,
            "periods": {
                "day": build_request_report(docs, 1),
                "week": build_request_report(docs, 7),
                "month": build_request_report(docs, 30),
            },
        }
    )


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true",
    )
