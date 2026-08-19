from __future__ import annotations

import os
import hashlib
import base64
import re
import secrets
import smtplib
from io import BytesIO
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode
from uuid import uuid4

from flask import Flask, jsonify, redirect, request, session
from flask import send_file
from flask_cors import CORS
from dotenv import load_dotenv
try:
    import msal
except ModuleNotFoundError:
    msal = None
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Table
from reportlab.platypus import TableStyle


SERVER_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SERVER_DIRECTORY, ".env"))
load_dotenv(os.path.join(SERVER_DIRECTORY, ".env.local"))
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY") or secrets.token_urlsafe(32)
CORS(app, origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")])
APP_URL = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "").strip()
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "").strip()
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_REDIRECT_URI = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:5000/api/auth/microsoft/callback").strip()
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME).strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
USD_TO_TZS_RATE = float(os.getenv("USD_TO_TZS_RATE", "2500"))
CLIENT_CONFIRMATION_USD_LIMIT = 400
MAX_CONFIRMATION_IMAGE_BYTES = 5 * 1024 * 1024
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "").strip()
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "liquidtelecom.co.tz").strip().lower()
ALLOWED_EMAIL_DOMAINS = sorted(
    {
        domain.strip().lower()
        for domain in os.getenv("ALLOWED_EMAIL_DOMAINS", "").split(",")
        if domain.strip()
    }
    | {ALLOWED_EMAIL_DOMAIN, "liquidtelecom.co.tz", "liquidtech.co.tz"}
)
PASSWORD_RESET_TOKENS = {}
MICROSOFT_LOGIN_CODES = {}
EMAIL_PATTERN = re.compile(r"^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")
USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{2,39}$")
REQUEST_NUMBER_PATTERN = re.compile(r"^REQ-(\d{6})$")
MONTHLY_NUMBER_PATTERN = re.compile(r"^(?:(?P<label>Zanlink)/)?(?P<year>\d{4})/(?P<month>\d{2})/(?:(?P<prefix>[A-Z]+)-)?(?P<value>\d{4,6})$")
DOCUMENT_NUMBER_PREFIXES = {"doc1": "ONB", "maintenance": "MNT", "survey": "SUR"}
DEFAULT_ITEM_PRICES = [
    {"id": "ITM-001", "description": "1GE ONU 862UB - 8653 FGSW/U", "unitCostUsd": 46}, {"id": "ITM-002", "description": "24V Adaptor", "unitCostUsd": 24},
    {"id": "ITM-003", "description": "48V ADAPTOR", "unitCostUsd": 31}, {"id": "ITM-004", "description": "4F ADSS FIBER OPTIC CABLE", "unitCostUsd": 0},
    {"id": "ITM-005", "description": "A86 Socket SC/APC with pigtail", "unitCostUsd": 6}, {"id": "ITM-006", "description": "Cabinet 32U", "unitCostUsd": 0},
    {"id": "ITM-007", "description": "Cabinet 42U", "unitCostUsd": 0}, {"id": "ITM-008", "description": "Cabinet 4U", "unitCostUsd": 71},
    {"id": "ITM-009", "description": "Cabinet 6U", "unitCostUsd": 0}, {"id": "ITM-010", "description": "Cabinet 22U-4 FAN", "unitCostUsd": 0},
    {"id": "ITM-011", "description": "Cabinet 22U-2 FAN", "unitCostUsd": 0}, {"id": "ITM-012", "description": "Cabinet 9U", "unitCostUsd": 0},
    {"id": "ITM-013", "description": "Canopy Power Adaptor", "unitCostUsd": 21}, {"id": "ITM-014", "description": "CISCO AP", "unitCostUsd": 0},
    {"id": "ITM-015", "description": "Cisco Router", "unitCostUsd": 0}, {"id": "ITM-016", "description": "Cisco Switch 24 Port", "unitCostUsd": 0},
    {"id": "ITM-017", "description": "Conduit Pipe - 19mm", "unitCostUsd": 1}, {"id": "ITM-018", "description": "Conduit pipe - white (20mm)", "unitCostUsd": 2},
    {"id": "ITM-019", "description": "D Link Switch 16 Port", "unitCostUsd": 69}, {"id": "ITM-020", "description": "D Link Switch 24 Ports", "unitCostUsd": 0},
    {"id": "ITM-021", "description": "D Link Switch 8 Ports", "unitCostUsd": 20}, {"id": "ITM-022", "description": "Extension Plugs", "unitCostUsd": 20},
    {"id": "ITM-023", "description": "EnGenius (INT) / ENGENIUS FIT WI-FI 6", "unitCostUsd": 116}, {"id": "ITM-024", "description": "EnGenius 2.4GHz+5GHz 11ac/b/g/n Dual", "unitCostUsd": 140},
    {"id": "ITM-025", "description": "EnGenius FIT Series Management", "unitCostUsd": 134}, {"id": "ITM-026", "description": "EnGenius (INT) PRODUCT LFP", "unitCostUsd": 370},
    {"id": "ITM-027", "description": "EnGenius (INT) PRODUCT 1102A1359300", "unitCostUsd": 134}, {"id": "ITM-028", "description": "Face Plate Modules -Double", "unitCostUsd": 8},
    {"id": "ITM-029", "description": "Face Plate Modules - Single", "unitCostUsd": 5}, {"id": "ITM-030", "description": "FTP Cable (Roll)", "unitCostUsd": 269},
    {"id": "ITM-031", "description": "FTTx-OSD-C SC/PC 4 core inclu", "unitCostUsd": 28}, {"id": "ITM-032", "description": "Invertor 3.5KVA/ 48VDC", "unitCostUsd": 0},
    {"id": "ITM-033", "description": "Invertor SK 1100VA 12V", "unitCostUsd": 0}, {"id": "ITM-034", "description": "Linksys Wireless Router", "unitCostUsd": 57},
    {"id": "ITM-035", "description": "Mikrotik 2011", "unitCostUsd": 132}, {"id": "ITM-036", "description": "Mikrotik Billing Router RB 750", "unitCostUsd": 86},
    {"id": "ITM-037", "description": "Mikrotik Billing Router RB 952UI", "unitCostUsd": 79}, {"id": "ITM-038", "description": "Mikrotik Router 1100", "unitCostUsd": 380},
    {"id": "ITM-039", "description": "MIMO OMNI WI-FI ANTENNAE (UBIQ", "unitCostUsd": 317}, {"id": "ITM-040", "description": "Media convertor 1G", "unitCostUsd": 57},
    {"id": "ITM-041", "description": "Media convertor 10/100", "unitCostUsd": 18}, {"id": "ITM-042", "description": "NANO STATION M2", "unitCostUsd": 108},
    {"id": "ITM-043", "description": "NANO STATION M5", "unitCostUsd": 96}, {"id": "ITM-044", "description": "ODF Patch panel 48C fiber", "unitCostUsd": 0},
    {"id": "ITM-045", "description": "ONU Adaptor", "unitCostUsd": 13}, {"id": "ITM-046", "description": "Patch Panel 12 Ports", "unitCostUsd": 0},
    {"id": "ITM-047", "description": "Patch Panel 24 Ports Fiber", "unitCostUsd": 0}, {"id": "ITM-048", "description": "Patch panel 48 Ports Fiber", "unitCostUsd": 0},
    {"id": "ITM-049", "description": "Patch Panel Cat 6", "unitCostUsd": 0}, {"id": "ITM-050", "description": "Pipe 1 & 1/2\"", "unitCostUsd": 40},
    {"id": "ITM-051", "description": "Pipe 1&1/4\"", "unitCostUsd": 32}, {"id": "ITM-052", "description": "Polly pipe (roll) - 1/2\"", "unitCostUsd": 48},
    {"id": "ITM-053", "description": "Poll pipe (roll) - 3/4\"", "unitCostUsd": 53}, {"id": "ITM-054", "description": "Patch Cord SC/APC-SC/PC 1m Single Mode", "unitCostUsd": 3},
    {"id": "ITM-055", "description": "Patch Cord SC/APC-SC/PC 3m Single Mode", "unitCostUsd": 3}, {"id": "ITM-056", "description": "Patch Cord SC/PC-LC/PC 1m Single Mode", "unitCostUsd": 3},
    {"id": "ITM-057", "description": "Patch Cord SC/PC-LC/PC 3m Single Mode", "unitCostUsd": 3}, {"id": "ITM-058", "description": "ROCKET M2 ( UBIQUITY )", "unitCostUsd": 118},
    {"id": "ITM-059", "description": "SECTOR WIFI ANTENNA", "unitCostUsd": 252}, {"id": "ITM-060", "description": "Trunking 1&1/2\" (38*25mm)", "unitCostUsd": 2},
    {"id": "ITM-061", "description": "Trunking 100X50 mm", "unitCostUsd": 13}, {"id": "ITM-062", "description": "TRUNKING 50*50", "unitCostUsd": 12},
    {"id": "ITM-063", "description": "Trunking 0.5", "unitCostUsd": 3}, {"id": "ITM-064", "description": "Unifi AP Ac Pro", "unitCostUsd": 279},
    {"id": "ITM-065", "description": "UNIFI LONG RANGE/ INDOOR", "unitCostUsd": 173}, {"id": "ITM-066", "description": "UNIFI long range U6", "unitCostUsd": 259},
    {"id": "ITM-067", "description": "UNIFI MESH - UAP AC M", "unitCostUsd": 146}, {"id": "ITM-068", "description": "Unifi POE Switch 16 ports", "unitCostUsd": 430},
    {"id": "ITM-069", "description": "Unifi POE Switch 24 ports", "unitCostUsd": 538}, {"id": "ITM-070", "description": "Unifi POE Switch 8 ports", "unitCostUsd": 0},
    {"id": "ITM-071", "description": "BDCOM POE 8port Switch", "unitCostUsd": 106}, {"id": "ITM-072", "description": "Unifi SFP module", "unitCostUsd": 0},
    {"id": "ITM-073", "description": "UNIFI SHORT RANGE / IN DOOR", "unitCostUsd": 0}, {"id": "ITM-074", "description": "UTP Cable CAT6 (Roll)", "unitCostUsd": 167},
    {"id": "ITM-075", "description": "Water Proof box 300*250*120", "unitCostUsd": 24}, {"id": "ITM-076", "description": "Water proof box 400*350*120", "unitCostUsd": 32},
    {"id": "ITM-077", "description": "EAP225-Outdoor-Tp Link", "unitCostUsd": 129}, {"id": "ITM-078", "description": "Deco M5 Tp Link", "unitCostUsd": 201},
    {"id": "ITM-079", "description": "EAP 110 - Outdoor Tp Link", "unitCostUsd": 41}, {"id": "ITM-080", "description": "EAP115 Tp Link", "unitCostUsd": 49},
    {"id": "ITM-081", "description": "EAP 235-Wall Tp Link", "unitCostUsd": 102}, {"id": "ITM-082", "description": "TP Link CPE610 Pair (P2P P2M)", "unitCostUsd": 46},
    {"id": "ITM-083", "description": "TP Link Archer C6 AC1200 Wireless router", "unitCostUsd": 61}, {"id": "ITM-084", "description": "Mikrotik-RB951UI-2HND", "unitCostUsd": 106},
    {"id": "ITM-085", "description": "Mirkotik-L009UIGS", "unitCostUsd": 259}, {"id": "ITM-086", "description": "RG EW1200", "unitCostUsd": 30},
    {"id": "ITM-087", "description": "RG RAP62- OD", "unitCostUsd": 175}, {"id": "ITM-088", "description": "RG-RAP52-OD", "unitCostUsd": 94},
    {"id": "ITM-089", "description": "RG-ES106F-P", "unitCostUsd": 45}, {"id": "ITM-090", "description": "RG-ES110GS-P-L", "unitCostUsd": 153},
    {"id": "ITM-091", "description": "RG-ES118FGS-LP", "unitCostUsd": 207}, {"id": "ITM-092", "description": "RG-ES08G-L", "unitCostUsd": 31},
    {"id": "ITM-093", "description": "RG-ES116G-L", "unitCostUsd": 103}, {"id": "ITM-094", "description": "REYEE RG -RAP6202", "unitCostUsd": 148},
    {"id": "ITM-095", "description": "REYEE RG-RAP6262 (G)", "unitCostUsd": 193}, {"id": "ITM-096", "description": "REYEE RG-RAP2266", "unitCostUsd": 133},
]
DELIVERY_NOTE_TERMS = """If any of the devices above is provided on test basis, it will only be kept for a maximum period of 5 days at client's premises. After that the client should either return the device(s) or will be charged for it.

1. During the test period, the device is entirely client's responsibility. If the device becomes damaged for whatever reason, the client will be charged for it.

2. Client should make payments for any device/accessories or transport cost applicable within 5 days of the Invoice attached with this note. If client fails to settle the bill within this period, ZANLINK will either remove the device from client's premises and/or will deduct any applicable cost from client's subscription costs."""


USERS = [
    {"id": "u1", "name": "Peter Kalezi", "username": "peter", "email": "peter@liquidtelecom.co.tz", "password": "demo1234", "role": "Engineer", "department": "Engineer"},
    {"id": "u2", "name": "Rashad Abdulkadir", "username": "rashad", "email": "rashad@liquidtelecom.co.tz", "password": "demo1234", "role": "Engineer", "department": "Engineer"},
    {"id": "u3", "name": "Nicolaus Libori", "username": "nicolaus.libori", "email": "nicolaus.libori@liquidtelecom.co.tz", "password": "demo1234", "role": "Engineer", "department": "Engineer"},
    {"id": "u4", "name": "Fahmin Ali", "username": "fahmin", "email": "fahmin@liquidtech.co.tz", "password": "demo1234", "role": "Head of Commercial", "department": "HOC"},
    {"id": "u5", "name": "Yona Ngeleja", "username": "yona", "email": "yona@liquidtech.co.tz", "password": "demo1234", "role": "Head of Department", "department": "HOD"},
    {"id": "u6", "name": "Juma Mganga", "username": "juma", "email": "juma@liquidtelecom.co.tz", "password": "demo1234", "role": "Head of Department", "department": "HOD"},
    {"id": "u7", "name": "Fides Kavishe", "username": "fides", "email": "fides@liquidtelecom.co.tz", "password": "demo1234", "role": "System Admin", "department": "Management"},
    {"id": "u8", "name": "Fayza Ali", "username": "fayza", "email": "fayza@liquidtelecom.co.tz", "password": "demo1234", "role": "System Admin", "department": "Management"},
    {"id": "u9", "name": "Zanlink Management", "username": "md-zanlink", "email": "md-zanlink@liquidtelecom.co.tz", "password": "demo1234", "role": "Management", "department": "Management"},
]

LEGACY_USER_NAMES = {
    "u1": "Peter Kalezi",
    "u2": "Rashad Abdulkadir",
    "u3": "Nicolaus Libori",
    "u4": "Fahmin Ali",
}

REGISTERABLE_ROLES = {
    "Engineer": {"role": "Engineer", "department": "Engineer"},
    "Sales": {"role": "Sales", "department": "Sales"},
    "Accounts": {"role": "Accounts", "department": "Accounts"},
    "Store": {"role": "Store", "department": "Store"},
    "Management": {"role": "Management", "department": "Management"},
    "HOD": {"role": "Head of Department", "department": "HOD"},
    "HOC": {"role": "Head of Commercial", "department": "HOC"},
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


def user_display_name(user_id: str | None, fallback: str = "") -> str:
    user = next((item for item in USERS if item["id"] == user_id), None)
    return (user or {}).get("name") or LEGACY_USER_NAMES.get(str(user_id or ""), fallback)


def history(user_id: str, action: str, note: str = "", user_name: str | None = None) -> dict:
    return {"id": str(uuid4()), "at": now_iso(), "userId": user_id, "userName": user_name or user_display_name(user_id), "action": action, "note": note}


def confirmation_owner(equipment: list[dict], currency: str) -> str:
    rate = STATE["pricing"]["usdToTzsRate"] if "STATE" in globals() else USD_TO_TZS_RATE
    limit = CLIENT_CONFIRMATION_USD_LIMIT if currency == "USD" else CLIENT_CONFIRMATION_USD_LIMIT * rate
    equipment_total = sum(
        float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0)
        for item in equipment
    )
    return "Engineer" if equipment_total < limit else "Sales"


def require_confirmation_image(payload: dict) -> dict:
    upload = payload.get("clientConfirmation")
    if not isinstance(upload, dict):
        raise ValueError("Client email confirmation screenshot is required")
    name = require_text(upload, "name", "Confirmation file name", max_length=180)
    data_url = require_text(upload, "dataUrl", "Confirmation image", max_length=8_000_000)
    match = re.fullmatch(r"data:(image/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)", data_url)
    if not match:
        raise ValueError("Confirmation screenshot must be a PNG or JPEG image")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except ValueError:
        raise ValueError("Confirmation screenshot is invalid")
    if not raw or len(raw) > MAX_CONFIRMATION_IMAGE_BYTES:
        raise ValueError("Confirmation screenshot must be 5 MB or smaller")
    return {"name": name, "mimeType": match.group(1), "dataUrl": data_url, "size": len(raw)}


def draw_confirmation_page(pdf: canvas.Canvas, doc: dict) -> None:
    confirmation = doc.get("clientConfirmation")
    if not confirmation:
        return
    pdf.showPage()
    width, height = A4
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawCentredString(width / 2, height - 25 * mm, "CLIENT EMAIL CONFIRMATION")
    pdf.setFont("Helvetica", 9)
    pdf.drawString(20 * mm, height - 35 * mm, f"Uploaded by: {confirmation.get('uploadedByName', '-')}")
    pdf.drawRightString(width - 20 * mm, height - 35 * mm, f"File: {confirmation.get('name', '-')}")
    encoded = confirmation["dataUrl"].split(",", 1)[1]
    image = ImageReader(BytesIO(base64.b64decode(encoded)))
    image_width, image_height = image.getSize()
    max_width, max_height = width - 40 * mm, height - 65 * mm
    scale = min(max_width / image_width, max_height / image_height)
    draw_width, draw_height = image_width * scale, image_height * scale
    pdf.drawImage(image, (width - draw_width) / 2, 15 * mm, draw_width, draw_height, preserveAspectRatio=True)


STATE = {
    "counters": {"request": 3, "summary": 1, "monthly": {}},
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
            "createdByName": user_display_name("u1", "Engineer"),
            "createdAt": now_iso(),
            "engineer": {"notes": "Install router, outdoor radio and cabling for new client."},
            "sales": {"amount": 1250000, "laborCharge": 100000, "packageCost": 1150000, "oneTimeTotal": 1250000, "grandTotal": 1250000, "remarks": "Business 50 Mbps package.", "submittedBy": "u2", "submittedByName": user_display_name("u2", "Sales")},
            "accounts": {"billingAmount": 1250000, "invoiceNumber": "INV-2044", "remarks": "Invoice prepared.", "processedBy": "u3", "processedByName": user_display_name("u3", "Accounts Team")},
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
            "createdByName": user_display_name("u1", "Engineer"),
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
                        "purpose": "General Maintenance",
                        "unitCost": 0,
                    }
                ],
            },
            "hod": {},
            "accounts": {},
            "history": [history("u1", "Created General Maintenance", "Waiting for HOD approval.")],
        },
    ],
    "summaries": [],
    "notifications": [],
    "pricing": {"usdToTzsRate": USD_TO_TZS_RATE, "items": deepcopy(DEFAULT_ITEM_PRICES)},
}


def public_user(user: dict) -> dict:
    safe = deepcopy(user)
    safe["active"] = user.get("active", True)
    safe["pendingApproval"] = user.get("pendingApproval", False)
    safe["hasPassword"] = bool(user.get("password"))
    safe["microsoftLinked"] = bool(user.get("entraOid"))
    safe.pop("password", None)
    safe.pop("entraOid", None)
    return safe


def microsoft_client():
    if not msal or not MICROSOFT_CLIENT_ID or not MICROSOFT_TENANT_ID or not MICROSOFT_CLIENT_SECRET:
        return None
    return msal.ConfidentialClientApplication(
        MICROSOFT_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}",
        client_credential=MICROSOFT_CLIENT_SECRET,
    )


def create_microsoft_login_code(user: dict) -> str:
    now = datetime.now(timezone.utc)
    for code, entry in list(MICROSOFT_LOGIN_CODES.items()):
        if entry["expiresAt"] <= now:
            MICROSOFT_LOGIN_CODES.pop(code, None)
    code = secrets.token_urlsafe(32)
    MICROSOFT_LOGIN_CODES[code] = {"user": public_user(user), "expiresAt": now + timedelta(minutes=2)}
    return code


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
    return any(email.endswith(f"@{domain}") for domain in ALLOWED_EMAIL_DOMAINS)


def require_allowed_email(value: str | None, action: str = "use") -> str:
    email = normalize_email(value)
    if not is_allowed_email(email):
        allowed_domains = ", ".join(ALLOWED_EMAIL_DOMAINS)
        raise ValueError(f"Only {allowed_domains} email accounts can {action}")
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
    if user["role"] in {"System Admin", "Management"}:
        allowed_roles.update({"Management", "System Admin"})
    return selected_role in allowed_roles


def find_document(document_id: str) -> dict | None:
    return next((doc for doc in STATE["documents"] if doc["id"] == document_id), None)


def find_client(client_id: str | None) -> dict | None:
    return next((client for client in STATE["clients"] if client["id"] == client_id), None)


def registered_client_details(payload: dict) -> tuple[dict, str, str, dict | None]:
    client = find_client(str(payload.get("clientId") or ""))
    if not client:
        raise ValueError("Select a registered client")
    location = require_text(payload, "location", "Location", max_length=180)
    contact = require_text(payload, "contact", "Contact number", max_length=80)
    geo_location = next((item for item in client.get("geoLocations", []) if item.get("location") == location), None)
    payload_geo_location = payload.get("geoLocation")
    if isinstance(payload_geo_location, dict) and payload_geo_location.get("location") == location:
        geo_location = payload_geo_location
    client["contact"] = contact
    if location not in client.get("locations", []):
        client.setdefault("locations", []).append(location)
    if geo_location and not any(item.get("location") == location for item in client.get("geoLocations", [])):
        client.setdefault("geoLocations", []).append(geo_location)
    return client, location, contact, geo_location


def requested_service(payload: dict) -> str:
    service = require_text(payload, "service", "Requested service")
    return require_text(payload, "otherService", "Other service") if service == "Other" else service


def find_summary(summary_id: str) -> dict | None:
    return next((summary for summary in STATE["summaries"] if summary["id"] == summary_id), None)


def monthly_counter_key(kind: str, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone(timedelta(hours=3)))
    return f"{kind}:{current.year:04d}:{current.month:02d}"


def format_document_number(kind: str, value: int, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone(timedelta(hours=3)))
    prefix = DOCUMENT_NUMBER_PREFIXES.get(kind, kind.upper())
    return f"{current.year:04d}/{current.month:02d}/{prefix}-{value:04d}"


def format_summary_number(value: int, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone(timedelta(hours=3)))
    return f"Zanlink/{current.year:04d}/{current.month:02d}/{value:04d}"


def normalize_request_numbers() -> None:
    monthly = STATE["counters"].setdefault("monthly", {})
    current = datetime.now(timezone(timedelta(hours=3)))

    documents = sorted(STATE["documents"], key=lambda doc: (str(doc.get("createdAt") or ""), str(doc.get("id") or "")))
    for doc in documents:
        kind = doc.get("type") or "doc1"
        number = str(doc.get("number") or "")
        match = MONTHLY_NUMBER_PATTERN.fullmatch(number)
        if match and match.group("prefix") == DOCUMENT_NUMBER_PREFIXES.get(kind):
            key = f"{kind}:{match.group('year')}:{match.group('month')}"
            monthly[key] = max(int(monthly.get(key, 1)), int(match.group("value")) + 1)
            continue

        key = monthly_counter_key(kind, current)
        value = int(monthly.get(key, 1))
        doc["number"] = format_document_number(kind, value, current)
        monthly[key] = value + 1

    for summary in STATE["summaries"]:
        number = str(summary.get("number") or "")
        match = MONTHLY_NUMBER_PATTERN.fullmatch(number)
        if match and match.group("label") == "Zanlink":
            key = f"summary:{match.group('year')}:{match.group('month')}"
            monthly[key] = max(int(monthly.get(key, 1)), int(match.group("value")) + 1)
            continue
        key = monthly_counter_key("summary", current)
        value = int(monthly.get(key, 1))
        summary["number"] = format_summary_number(value, current)
        monthly[key] = value + 1


def next_number(kind: str) -> str:
    normalize_request_numbers()
    current = datetime.now(timezone(timedelta(hours=3)))
    key = monthly_counter_key(kind, current)
    monthly = STATE["counters"].setdefault("monthly", {})
    value = int(monthly.get(key, 1))
    monthly[key] = value + 1

    if kind == "summary":
        return format_summary_number(value, current)

    return format_document_number(kind, value, current)


normalize_request_numbers()


def current_user() -> dict:
    user = find_user(request.headers.get("X-User-Id"))
    if not user:
        raise PermissionError("Missing or invalid X-User-Id header")
    if not user.get("active", True):
        raise PermissionError("Account access has been revoked")
    return user


def require_department(user: dict, *departments: str) -> None:
    allowed = user["role"] in {"System Admin", "Management"} or user["department"] in departments or user["role"] in departments
    if not allowed:
        raise PermissionError("This action is not allowed for your department")


def require_system_admin(user: dict) -> None:
    if user["role"] not in {"System Admin", "Management"}:
        raise PermissionError("Management or System Admin access is required")


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
        "terms": DELIVERY_NOTE_TERMS,
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


def history_action_at(doc: dict, *actions: str) -> str | None:
    for entry in reversed(doc.get("history", [])):
        if entry.get("action") in actions:
            return entry.get("at")
    return None


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


def build_material_issued_report(docs: list[dict], days: int, document_type: str, start: str | None = None, end: str | None = None) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    start_at = datetime.fromisoformat(start).replace(tzinfo=timezone.utc) if start else None
    end_at = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1) if end else None
    rows = []
    for doc in docs:
        if doc.get("type") != document_type:
            continue
        # Onboarding materials are issued by Store. General Maintenance materials
        # are leased only when Accounts completes its equipment review.
        if document_type == "doc1":
            items = doc.get("store", {}).get("items", [])
            issued_at = history_action_at(doc, "Store completed the workflow") or doc.get("store", {}).get("approvedAt") or doc.get("createdAt")
            purpose = "Sold to Client"
        else:
            if doc.get("status") != "Completed":
                continue
            items = doc.get("maintenance", {}).get("items", [])
            issued_at = history_action_at(doc, "General Maintenance equipment reviewed") or doc.get("accounts", {}).get("processedAt") or doc.get("createdAt")
            purpose = "Leased for General Maintenance"
        issued_at_date = parse_iso(issued_at)
        if issued_at_date < cutoff or (start_at and issued_at_date < start_at) or (end_at and issued_at_date >= end_at):
            continue
        for item in items:
            issued_qty = float(item.get("issuedQty") or 0)
            if issued_qty <= 0:
                continue
            rows.append({
                "id": f"{doc['id']}-{item.get('itemId')}-{len(rows)}",
                "number": doc["number"], "clientName": doc["clientName"], "location": doc.get("location", ""),
                "itemId": item.get("itemId") or item.get("serialNumber") or "-", "name": item.get("name") or "-",
                "purpose": purpose, "issuedQty": issued_qty, "issuedAt": issued_at,
            })
    rows.sort(key=lambda row: parse_iso(row["issuedAt"]), reverse=True)
    return {"days": days, "materials": rows, "totalMaterials": len(rows), "totalIssued": sum(row["issuedQty"] for row in rows)}


def filter_report_dates(docs: list[dict], start: str | None, end: str | None) -> list[dict]:
    if not start and not end:
        return docs
    try:
        start_at = datetime.fromisoformat(start).replace(tzinfo=timezone.utc) if start else datetime.min.replace(tzinfo=timezone.utc)
        end_at = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1) if end else datetime.max.replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValueError("Use valid start and end dates")
    return [doc for doc in docs if start_at <= parse_iso(doc.get("createdAt")) < end_at]


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
        "tt": "TT",
        "shifting_connection": "Shifting Connection",
        "general_maintenance": "General Maintenance",
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
    engineer_name = doc.get("createdByName") or doc.get("engineer", {}).get("submittedByName") or user_display_name(doc.get("createdBy"), "Engineer")
    sales_name = doc.get("sales", {}).get("submittedByName") or doc.get("sales", {}).get("requestedBy") or user_display_name(doc.get("sales", {}).get("submittedBy"), "Sales")
    store_name = doc.get("store", {}).get("approvedByName") or user_display_name(doc.get("store", {}).get("approvedBy"), "Store")
    management_name = doc.get("management", {}).get("approvedByName") or user_display_name(doc.get("management", {}).get("approvedBy"), "Pending Management")

    y = height - 58 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 14, "Customer Information")
    selected_type = doc.get("serviceType", "new_installation")
    draw_checkbox(pdf, "New Installation", selected_type == "new_installation", 22 * mm, y + 22)
    draw_checkbox(pdf, "Reconnection", selected_type == "reconnection", 62 * mm, y + 22)
    draw_checkbox(pdf, "WiFi Extension", selected_type == "wifi_extension", 98 * mm, y + 22)
    draw_checkbox(pdf, "TT", selected_type == "tt", 132 * mm, y + 22)
    draw_checkbox(pdf, "Shifting Connection", selected_type == "shifting_connection", 22 * mm, y + 34)
    draw_checkbox(pdf, "General Maintenance", selected_type == "general_maintenance", 72 * mm, y + 34)
    draw_label_value(pdf, "Client Name", doc["clientName"], 22 * mm, y, 56 * mm)
    draw_label_value(pdf, "Location", doc["location"], 85 * mm, y, 52 * mm)
    draw_label_value(pdf, "Service", doc["service"], 143 * mm, y, 45 * mm)
    draw_label_value(pdf, "Contact", doc["contact"], 22 * mm, y - 18 * mm, 56 * mm)
    currency = doc.get("accounts", {}).get("currency") or doc.get("sales", {}).get("currency") or "TZS"
    equipment_cost = float(doc.get("sales", {}).get("packageCost") or 0)
    one_time_total = float(doc.get("sales", {}).get("oneTimeTotal") or 0) or (
        float(doc.get("sales", {}).get("amount") or 0)
        + equipment_cost
        + float(doc.get("sales", {}).get("additionalNrr", doc.get("sales", {}).get("additionalNpr")) or 0)
    )
    grand_total = float(doc.get("sales", {}).get("grandTotal") or 0) or (
        one_time_total + float(doc.get("sales", {}).get("mrr", doc.get("sales", {}).get("mbr")) or 0)
    )
    draw_label_value(
        pdf,
        "Installation Cost/Labor Charge",
        money_text(doc.get("sales", {}).get("laborCharge", doc.get("sales", {}).get("amount")), doc.get("sales", {}).get("currency") or "TZS"),
        85 * mm,
        y - 18 * mm,
        52 * mm,
    )
    draw_label_value(pdf, "MRR", money_text(doc.get("sales", {}).get("mrr", doc.get("sales", {}).get("mbr", doc.get("accounts", {}).get("billingAmount"))), currency), 143 * mm, y - 18 * mm, 45 * mm)
    draw_label_value(pdf, "Subscription Package", doc.get("sales", {}).get("subscription", doc.get("sales", {}).get("remarks", "")), 22 * mm, y - 36 * mm, 115 * mm)
    draw_label_value(pdf, "Requested By", sales_name, 143 * mm, y - 36 * mm, 45 * mm)
    draw_label_value(pdf, "Equipment Cost", money_text(equipment_cost, currency), 22 * mm, y - 54 * mm, 56 * mm)
    draw_label_value(pdf, "One-time Total", money_text(one_time_total, currency), 85 * mm, y - 54 * mm, 52 * mm)
    draw_label_value(pdf, "First Invoice Total", money_text(grand_total, currency), 143 * mm, y - 54 * mm, 45 * mm)

    y -= 84 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Engineering Confirmation")
    draw_label_value(pdf, "Stock Requisition No.", doc["number"], 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Prepared By", engineer_name, 85 * mm, y - 4, 52 * mm)
    draw_label_value(pdf, "Engineer Notes", doc.get("engineer", {}).get("notes", ""), 143 * mm, y - 4, 45 * mm)

    if doc.get("hoc", {}).get("reviewedBy"):
        y -= 34 * mm
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawCentredString(width / 2, y + 12, "Head of Commercial Approval")
        hoc = doc["hoc"]
        hoc_name = hoc.get("reviewedByName") or user_display_name(hoc.get("reviewedBy"), "-")
        decision = str(hoc.get("decision") or "-").capitalize()
        draw_label_value(pdf, "Reviewed By", hoc_name, 22 * mm, y - 4, 56 * mm)
        draw_label_value(pdf, "Decision", decision, 85 * mm, y - 4, 52 * mm)
        draw_label_value(pdf, "Comments", hoc.get("remarks") or "-", 143 * mm, y - 4, 45 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Management Approval")
    management_approved = bool(doc.get("management", {}).get("approvedBy"))
    draw_label_value(pdf, "Approved By", management_name if management_approved else "Pending Management", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Comments", doc.get("management", {}).get("remarks", "") or "-", 85 * mm, y - 4, 103 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Admin Stock Confirmation")
    draw_label_value(pdf, "Stock Availability", "Confirmed", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Stock Issued By", store_name, 85 * mm, y - 4, 52 * mm)
    draw_label_value(pdf, "Date", datetime.now().strftime("%d/%m/%Y"), 143 * mm, y - 4, 45 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Finance & Billing")
    is_billed = bool(str(doc.get("accounts", {}).get("invoiceNumber") or "").strip())
    processed_at = parse_iso(doc.get("accounts", {}).get("processedAt"))
    billing_date = processed_at.strftime("%d/%m/%Y") if is_billed and processed_at != datetime.min.replace(tzinfo=timezone.utc) else "-"
    draw_label_value(pdf, "Billing Confirmation", "Billed" if is_billed else "Not Billed", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "User Created in System", "Yes" if is_billed else "No", 85 * mm, y - 4, 103 * mm)
    draw_label_value(pdf, "Date", billing_date, 22 * mm, y - 18 * mm, 56 * mm)
    draw_label_value(pdf, "Received by", engineer_name, 85 * mm, y - 18 * mm, 103 * mm)

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
    is_maintenance = doc.get("type") == "maintenance"
    is_survey = doc.get("type") == "survey"
    engineer_name = doc.get("createdByName") or doc.get("engineer", {}).get("submittedByName") or user_display_name(doc.get("createdBy"), "Engineer")
    accounts_name = doc.get("accounts", {}).get("processedByName") or user_display_name(doc.get("accounts", {}).get("processedBy"), "Accounts")
    store_name = doc.get("store", {}).get("approvedByName") or user_display_name(doc.get("store", {}).get("approvedBy"), "Store")
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(
        width - 22 * mm,
        height - 42 * mm,
        f"{'General Maintenance No.' if is_maintenance else 'Survey Requisition No.' if is_survey else 'Install Requisition No.'} {doc['number']}",
    )

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
    pdf.drawString(26 * mm, y - 4, (doc.get("engineer", {}).get("comments") if is_survey else doc.get("engineer", {}).get("notes")) or "-")

    costed_name = (
        doc.get("sales", {}).get("submittedByName")
        or doc.get("sales", {}).get("requestedBy")
        or user_display_name(doc.get("sales", {}).get("submittedBy"), "Not recorded")
    )
    if is_maintenance:
        hod_name = doc.get("hod", {}).get("approvedByName") or user_display_name(doc.get("hod", {}).get("approvedBy"), "Not recorded")
        signature_rows = [
            ("Requested by", engineer_name, doc.get("createdByRole", "Engineer"), doc.get("createdAt")),
            (
                "Reviewed by HOD",
                hod_name,
                doc.get("hod", {}).get("approvedByRole", "HOD"),
                doc.get("hod", {}).get("approvedAt") or history_action_at(doc, "HOD approved General Maintenance"),
            ),
            (
                "Reviewed by Accounts",
                accounts_name,
                doc.get("accounts", {}).get("processedByRole", "Accounts"),
                doc.get("accounts", {}).get("processedAt") or history_action_at(doc, "General Maintenance equipment reviewed"),
            ),
        ]
    elif is_survey:
        signature_rows = [
            ("Requested by", doc.get("sales", {}).get("submittedByName", "Not recorded"), doc.get("sales", {}).get("submittedByRole", "Sales"), doc.get("createdAt")),
            ("Surveyed by", doc.get("engineer", {}).get("submittedByName", "Not recorded"), doc.get("engineer", {}).get("submittedByRole", "Engineer"), doc.get("engineer", {}).get("submittedAt")),
            ("Payment confirmed by", doc.get("hoc", {}).get("reviewedByName", "Not recorded"), doc.get("hoc", {}).get("reviewedByRole", "HOC"), doc.get("hoc", {}).get("reviewedAt")),
            ("Billed by", accounts_name, doc.get("accounts", {}).get("processedByRole", "Accounts"), doc.get("accounts", {}).get("processedAt")),
            ("Issued by", store_name, doc.get("store", {}).get("approvedByRole", "Store"), doc.get("store", {}).get("approvedAt")),
            ("Approved by", doc.get("management", {}).get("approvedByName", "Pending Management"), doc.get("management", {}).get("approvedByRole", "Management"), doc.get("management", {}).get("approvedAt")),
        ]
    else:
        signature_rows = [
            ("Requested by", engineer_name, doc.get("createdByRole", "Engineer"), doc.get("createdAt")),
            (
                "Costed by",
                costed_name,
                doc.get("sales", {}).get("submittedByRole", "Sales"),
                doc.get("sales", {}).get("submittedAt")
                or history_action_at(doc, "Sales cost submitted", "Sales cost updated", "Sales amount added")
                or doc.get("sales", {}).get("requestedDate"),
            ),
            ("Billed by", accounts_name, doc.get("accounts", {}).get("processedByRole", "Accounts"), doc.get("accounts", {}).get("processedAt") or history_action_at(doc, "Billing added")),
            ("Issued by", store_name, doc.get("store", {}).get("approvedByRole", "Store"), doc.get("store", {}).get("approvedAt")),
            ("Approved by", doc.get("management", {}).get("approvedByName", "Not recorded"), doc.get("management", {}).get("approvedByRole", "Management"), doc.get("management", {}).get("approvedAt")),
        ]
    y -= 42 * mm
    signature_table_rows = []
    for label, name, position, acted_at in signature_rows:
        acted_date = parse_iso(acted_at).strftime("%d/%m/%Y") if acted_at else "Not recorded"
        signature_table_rows.append([label, f"Name: {name}", f"Position: {position}", f"Date: {acted_date}"])
    signature_table = Table(signature_table_rows, colWidths=[30 * mm, 58 * mm, 40 * mm, 38 * mm])
    signature_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#6b7280")), ("FONTSIZE", (0, 0), (-1, -1), 7.5), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold")]))
    signature_table.wrapOn(pdf, width, height)
    signature_table.drawOn(pdf, 22 * mm, y - len(signature_table_rows) * 7 * mm)

    pdf.showPage()
    pdf.save()
    return buffer


def build_survey_result_pdf(doc: dict) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    draw_header(pdf, "SITE SURVEY RESULT", doc)
    survey = doc.get("survey", {})
    engineer = doc.get("engineer", {})
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(width - 22 * mm, height - 42 * mm, f"Survey Result No. {survey.get('resultNumber') or doc['number']}")
    y = height - 60 * mm
    fields = [
        ("Survey Request No.", doc["number"]), ("Client Name", doc.get("clientName")),
        ("Location", doc.get("location")), ("Mobile Number", doc.get("contact")),
        ("Package Needed", doc.get("service")), ("Connection Type", engineer.get("connectionType")),
        ("Distance", engineer.get("distance") if engineer.get("connectionType") == "fibre" else "N/A"),
        ("Node", engineer.get("node")), ("Survey Comments", engineer.get("comments")),
        ("Proceed with Installation", "Yes" if engineer.get("proceed") else "No"),
    ]
    for index, (label, value) in enumerate(fields):
        x = 22 * mm if index % 2 == 0 else 108 * mm
        if index and index % 2 == 0:
            y -= 20 * mm
        draw_label_value(pdf, label, value or "-", x, y, 76 * mm)
    pdf.showPage(); pdf.save()
    return buffer


def build_work_order_pdf(doc: dict) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    draw_header(pdf, "WORK ORDER FORM", doc)
    survey, engineer = doc.get("survey", {}), doc.get("engineer", {})
    y = height - 58 * mm
    fields = [
        ("Survey Request No.", doc["number"]), ("Survey Result Form No.", survey.get("resultNumber") or "-"),
        ("Client Name", doc.get("clientName")), ("Location", doc.get("location")),
        ("Mobile Number", doc.get("contact")), ("Package Needed", doc.get("service")),
        ("Client Feedback", engineer.get("clientFeedback")), ("Speed Test Obtained", engineer.get("speedTest")),
        ("Client Confirmation", "Uploaded" if doc.get("paymentConfirmation") else "Not uploaded"),
        ("Connection Type", engineer.get("connectionType")),
    ]
    for index, (label, value) in enumerate(fields):
        x = 22 * mm if index % 2 == 0 else 108 * mm
        if index and index % 2 == 0:
            y -= 20 * mm
        draw_label_value(pdf, label, value or "-", x, y, 76 * mm)
    pdf.showPage(); pdf.save()
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
        "If any of the devices above is provided on test basis, it will only be kept for a maximum period of 5 days at client's premises.",
        "After that the client should either return the device(s) or will be charged for it.",
        "",
        "1. During the test period, the device is entirely client's responsibility. If the device becomes damaged for whatever reason, the client will",
        "be charged for it.",
        "",
        "2. Client should make payments for any device/accessories or transport cost applicable within 5 days of the Invoice attached with this",
        "note. If client fails to settle the bill within this period, ZANLINK will either remove the device from client's premises and/or will deduct",
        "any applicable cost from client's subscription costs.",
    ]:
        text.textLine(line)
    pdf.drawText(text)

    y = 58 * mm
    pdf.setFont("Helvetica", 8)
    pdf.drawString(16 * mm, y, f"Name of Customer: {summary.get('customerName') or (doc or {}).get('clientName', '')}")
    pdf.drawString(112 * mm, y, "Name of ZANLINK Staff:")
    pdf.line(151 * mm, y - 2 * mm, 194 * mm, y - 2 * mm)
    pdf.drawString(16 * mm, y - 22 * mm, "Signature:")
    pdf.line(35 * mm, y - 24 * mm, 100 * mm, y - 24 * mm)
    pdf.drawString(112 * mm, y - 22 * mm, "Signature:")
    pdf.line(131 * mm, y - 24 * mm, 194 * mm, y - 24 * mm)

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
        "microsoftSignInConfigured": bool(microsoft_client()),
        "microsoftAuthInstalled": bool(msal),
        "allowedEmailDomain": ALLOWED_EMAIL_DOMAIN,
        "allowedEmailDomains": ALLOWED_EMAIL_DOMAINS,
    })


@app.get("/api/users")
def users():
    require_system_admin(current_user())
    return jsonify([public_user(user) for user in USERS])


@app.get("/api/account")
def account():
    return jsonify(public_user(current_user()))


@app.get("/api/pricing")
def pricing():
    current_user()
    return jsonify(deepcopy(STATE["pricing"]))


@app.patch("/api/pricing")
def update_pricing():
    require_system_admin(current_user())
    payload = request.get_json(force=True)
    try:
        rate = float(payload.get("usdToTzsRate"))
    except (TypeError, ValueError):
        raise ValueError("USD to TZS rate must be a number")
    if rate <= 0:
        raise ValueError("USD to TZS rate must be greater than zero")

    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("At least one priced item is required")

    cleaned_items = []
    seen_ids = set()
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Item {index} is invalid")
        item_id = require_text(item, "id", f"Item {index} ID", max_length=80)
        if item_id in seen_ids:
            raise ValueError("Item IDs must be unique")
        seen_ids.add(item_id)
        description = require_text(item, "description", f"Item {index} description", max_length=180)
        try:
            unit_cost_usd = float(item.get("unitCostUsd"))
        except (TypeError, ValueError):
            raise ValueError(f"Item {index} USD cost must be a number")
        if unit_cost_usd < 0:
            raise ValueError(f"Item {index} USD cost cannot be negative")
        cleaned_items.append({"id": item_id, "description": description, "unitCostUsd": unit_cost_usd})

    STATE["pricing"] = {"usdToTzsRate": rate, "items": cleaned_items}
    return jsonify(deepcopy(STATE["pricing"]))


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
        raise ValueError("Select a role before approving this Microsoft account")

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
        "geoLocations": [],
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
        return jsonify({"error": "This account uses Microsoft sign-in. Use Sign in with Microsoft or reset your password first."}), 401
    user = next((item for item in USERS if (item.get("email") == identifier or item.get("username") == identifier) and item.get("password") == payload.get("password")), None)
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify(public_user(user))


@app.get("/api/auth/microsoft/login")
def microsoft_login():
    if not msal:
        return jsonify({"error": "Microsoft Entra sign-in dependency is missing. Start the server with server/.venv/bin/python after installing server requirements."}), 503
    missing = [name for name, value in {
        "MICROSOFT_CLIENT_ID": MICROSOFT_CLIENT_ID,
        "MICROSOFT_TENANT_ID": MICROSOFT_TENANT_ID,
        "MICROSOFT_CLIENT_SECRET": MICROSOFT_CLIENT_SECRET,
    }.items() if not value]
    if missing:
        return jsonify({"error": f"Microsoft Entra sign-in is missing: {', '.join(missing)}."}), 503
    client = microsoft_client()
    flow = client.initiate_auth_code_flow(
        scopes=["email"],
        redirect_uri=MICROSOFT_REDIRECT_URI,
    )
    if "auth_uri" not in flow:
        app.logger.error("Could not start Microsoft Entra sign-in: %s", flow)
        return jsonify({"error": "Microsoft Entra sign-in could not be started."}), 503
    session["microsoft_auth_flow"] = flow
    return redirect(flow["auth_uri"])


@app.get("/api/auth/microsoft/callback")
def microsoft_callback():
    client = microsoft_client()
    flow = session.pop("microsoft_auth_flow", None)
    if not client or not flow:
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': 'Microsoft sign-in session expired. Please try again.'})}")
    result = client.acquire_token_by_auth_code_flow(flow, request.args.to_dict(flat=True))
    if "error" in result:
        message = str(result.get("error_description") or result.get("error") or "Microsoft sign-in failed")
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': message})}")

    identity = result.get("id_token_claims") or {}
    email_value = identity.get("preferred_username") or identity.get("email")
    try:
        email = require_allowed_email(email_value, "sign in")
    except ValueError as error:
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': str(error)})}")
    object_id = str(identity.get("oid") or "")
    if not object_id:
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': 'Microsoft Entra did not return a user ID.'})}")

    user = next((item for item in USERS if item.get("email") == email), None)
    if not user:
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': 'No account exists for this email address. Contact a System Admin to create one.'})}")
    if user.get("entraOid") and user["entraOid"] != object_id:
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': 'This account is already linked to a different Microsoft identity. Contact support.'})}")
    if user.get("pendingApproval", False):
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': 'Your Microsoft account is waiting for System Admin approval.'})}")
    if not user.get("active", True):
        return redirect(f"{APP_URL}/?{urlencode({'microsoft_error': 'This account has been disabled. Contact a System Admin.'})}")

    user["entraOid"] = object_id
    user["picture"] = str(identity.get("picture") or user.get("picture") or "")
    login_code = create_microsoft_login_code(user)
    return redirect(f"{APP_URL}/?{urlencode({'microsoft_auth_code': login_code})}")


@app.post("/api/auth/microsoft/complete")
def microsoft_complete_login():
    code = str((request.get_json(force=True) or {}).get("code") or "")
    entry = MICROSOFT_LOGIN_CODES.pop(code, None)
    if not entry or entry["expiresAt"] <= datetime.now(timezone.utc):
        raise ValueError("Microsoft sign-in session expired. Please try again.")
    return jsonify(entry["user"])


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
    if service_type not in {"new_installation", "reconnection", "wifi_extension", "tt", "shifting_connection", "general_maintenance"}:
        raise ValueError("Please select a valid onboarding type")
    client, location, contact, geo_location = registered_client_details(payload)
    currency = str(payload.get("currency") or "TZS").upper()
    if currency not in {"TZS", "USD"}:
        raise ValueError("Display currency must be TZS or USD")
    items = validate_items(payload.get("items", []), context="Stock item")
    for item in items:
        catalog_item = next((entry for entry in STATE["pricing"]["items"] if entry["id"] == item["itemId"]), None)
        if not catalog_item or catalog_item["description"] != item["name"]:
            raise ValueError("Select an item from the approved equipment list")
        item["unitCostUsd"] = catalog_item["unitCostUsd"]
        item["unitCost"] = catalog_item["unitCostUsd"] if currency == "USD" else catalog_item["unitCostUsd"] * STATE["pricing"]["usdToTzsRate"]
        item["costCurrency"] = currency
        if item["purpose"] not in {"Sold to Client", "Lease"}:
            raise ValueError("Stock item purpose must be Sold to Client or Lease")
    owner = confirmation_owner(items, currency)
    confirmation = require_confirmation_image(payload) if owner == "Engineer" else None
    if confirmation:
        confirmation.update({"uploadedBy": user["id"], "uploadedByName": user["name"], "uploadedAt": now_iso()})
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
        "geoLocation": geo_location,
        "status": "Pending Sales",
        "currentDepartment": "Sales",
        "createdBy": user["id"],
        "createdByName": user["name"],
        "createdByRole": user["role"],
        "createdAt": now_iso(),
        "engineer": {"notes": optional_text(payload, "engineerNotes"), "currency": currency, "submittedBy": user["id"], "submittedByName": user["name"]},
        "sales": {},
        "accounts": {},
        "store": {"confirmed": False, "amountMatches": None, "remarks": "", "items": items},
        "management": {},
        "confirmationRequiredFrom": owner,
        "history": [history(user["id"], "Created Document 1", "Submitted to Sales.", user["name"])],
    }
    if confirmation:
        doc["clientConfirmation"] = confirmation
    STATE["documents"].insert(0, doc)
    notify("Sales", f"{doc['number']} is waiting for Sales amount.")
    return jsonify(doc), 201


@app.post("/api/documents/maintenance")
def create_maintenance():
    user = current_user()
    require_department(user, "Engineer")
    payload = request.get_json(force=True)
    client, location, contact, geo_location = registered_client_details(payload)
    items = validate_items(payload.get("items", []), context="General Maintenance material")
    for item in items:
        catalog_item = next((entry for entry in STATE["pricing"]["items"] if entry["id"] == item["itemId"]), None)
        if not catalog_item or catalog_item["description"] != item["name"]:
            raise ValueError("Select an item from the approved equipment list")
        item["issuedQty"] = item["requestedQty"]
        item["unitCostUsd"] = catalog_item["unitCostUsd"]
        item["unitCost"] = 0
        item["costCurrency"] = "TZS"
        item["purpose"] = "General Maintenance"
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
        "geoLocation": geo_location,
        "status": "Pending HOD",
        "currentDepartment": "HOD",
        "createdBy": user["id"],
        "createdByName": user["name"],
        "createdAt": now_iso(),
        "maintenance": {"fault": require_text(payload, "fault", "Fault report", max_length=800), "action": require_text(payload, "action", "Recommended action", max_length=800), "items": items, "submittedBy": user["id"], "submittedByName": user["name"]},
        "hod": {},
        "accounts": {},
        "history": [history(user["id"], "Created General Maintenance", "Submitted to HOD.", user["name"])],
    }
    STATE["documents"].insert(0, doc)
    notify("HOD", f"{doc['number']} is waiting for HOD approval.")
    return jsonify(doc), 201


@app.post("/api/documents/survey")
def create_survey():
    user = current_user()
    if user["role"] not in {"System Admin", "Management"} and user.get("department") != "Sales" and user.get("role") != "Sales":
        raise PermissionError("Only Sales and admin users can request a site survey")
    payload = request.get_json(force=True)
    package = require_text(payload, "package", "Package needed")
    existing_client = find_client(str(payload.get("clientId") or ""))
    if existing_client:
        client_name = existing_client["name"]
        contact = existing_client.get("contact") or require_text(payload, "contact", "Mobile number")
        location = require_text(payload, "location", "Location")
        if location not in existing_client.get("locations", []):
            existing_client.setdefault("locations", []).append(location)
    else:
        client_name = require_text(payload, "clientName", "Client name")
        contact = normalize_tanzania_contact(payload.get("contact"))
        location = require_text(payload, "location", "Location")
        email = normalize_email(payload.get("email"))
        existing_client = next((client for client in STATE["clients"] if client.get("email", "").lower() == email and email), None)
        if existing_client:
            raise ValueError("A client with this email is already registered. Select the client from the list.")
        existing_client = {"id": f"c-{uuid4()}", "name": client_name, "contact": contact, "email": email, "locations": [location], "geoLocations": [], "createdAt": now_iso()}
        STATE["clients"].insert(0, existing_client)
    doc = {
        "id": str(uuid4()), "type": "survey", "number": next_number("survey"),
        "clientId": existing_client["id"], "clientName": client_name,
        "contact": contact, "location": location, "email": existing_client.get("email", ""),
        "service": package, "status": "Pending Engineer", "currentDepartment": "Engineer",
        "createdBy": user["id"], "createdByName": user["name"], "createdByRole": user["role"], "createdAt": now_iso(),
        "sales": {"package": package, "submittedBy": user["id"], "submittedByName": user["name"], "submittedByRole": user["role"], "submittedAt": now_iso()},
        "engineer": {}, "hoc": {}, "accounts": {}, "store": {"confirmed": False, "items": []}, "management": {},
        "history": [history(user["id"], "Created site survey request", "Submitted to Engineer.", user["name"])],
    }
    STATE["documents"].insert(0, doc)
    notify("Engineer", f"{doc['number']} is waiting for site survey.")
    return jsonify(doc), 201


@app.post("/api/documents/<document_id>/survey-engineer")
def survey_engineer_submit(document_id: str):
    user = current_user(); require_department(user, "Engineer")
    doc = find_document(document_id)
    if not doc or doc.get("type") != "survey": raise ValueError("Site survey request not found")
    require_status(doc, "Pending Engineer", "On Hold")
    payload = request.get_json(force=True)
    connection_type = str(payload.get("connectionType") or "").lower()
    if connection_type not in {"fibre", "wireless"}: raise ValueError("Connection type must be Fibre or Radiowaves (Wireless)")
    proceed = str(payload.get("proceed") or "").lower()
    if proceed not in {"yes", "no"}: raise ValueError("Select Yes or No for whether to proceed")
    items = validate_items(payload.get("items", []), context="Survey equipment")
    for item in items:
        item["costCurrency"] = str(payload.get("currency") or "TZS").upper()
    engineer = {
        "connectionType": connection_type, "distance": require_text(payload, "distance", "Distance") if connection_type == "fibre" else "",
        "node": require_text(payload, "node", "Node"), "comments": require_text(payload, "comments", "Comments", max_length=1000),
        "proceed": proceed == "yes", "clientFeedback": require_text(payload, "clientFeedback", "Client feedback", max_length=1000),
        "speedTest": "", "items": items,
        "currency": str(payload.get("currency") or "TZS").upper(), "submittedBy": user["id"], "submittedByName": user["name"], "submittedByRole": user["role"], "submittedAt": now_iso(),
    }
    doc["engineer"] = engineer; doc["store"]["items"] = deepcopy(items)
    equipment_total = sum(float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0) for item in items)
    doc.setdefault("sales", {}).update({
        "equipment": deepcopy(items), "packageCost": equipment_total, "laborCharge": 0,
        "amount": equipment_total, "oneTimeTotal": equipment_total, "grandTotal": equipment_total,
        "currency": engineer["currency"],
    })
    doc["survey"] = {"resultNumber": f"SR-{doc['number']}", "generatedAt": now_iso()}
    if not engineer["proceed"]:
        set_route(doc, "On Hold", "Engineer")
        doc["history"].append(history(user["id"], "Survey placed on hold", engineer["comments"], user["name"]))
    else:
        set_route(doc, "Pending HOC", "HOC")
        doc["history"].append(history(user["id"], "Survey completed", "Survey result generated and sent to HOC for payment confirmation.", user["name"]))
        notify("HOC", f"{doc['number']} is waiting for payment confirmation.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/survey-speed-test")
def survey_speed_test_submit(document_id: str):
    user = current_user(); require_department(user, "Engineer")
    doc = find_document(document_id)
    if not doc or doc.get("type") != "survey": raise ValueError("Site survey request not found")
    require_status(doc, "Pending Management")
    speed_test = require_text(request.get_json(force=True), "speedTest", "Speed test obtained", max_length=500)
    doc.setdefault("engineer", {})["speedTest"] = speed_test
    doc["engineer"]["speedTestSubmittedBy"] = user["id"]
    doc["engineer"]["speedTestSubmittedByName"] = user["name"]
    doc["engineer"]["speedTestSubmittedAt"] = now_iso()
    doc["history"].append(history(user["id"], "Speed test recorded", "Work order updated with the final speed test.", user["name"]))
    return jsonify(doc)


@app.post("/api/documents/<document_id>/survey-hoc")
def survey_hoc_submit(document_id: str):
    user = current_user(); require_department(user, "HOC")
    doc = find_document(document_id)
    if not doc or doc.get("type") != "survey": raise ValueError("Site survey request not found")
    require_status(doc, "Pending HOC")
    payload = request.get_json(force=True)
    if not payload.get("paid"): raise ValueError("Confirm that the client has paid")
    confirmation = require_confirmation_image({"clientConfirmation": payload.get("paymentConfirmation")})
    confirmation.update({"uploadedBy": user["id"], "uploadedByName": user["name"], "uploadedAt": now_iso()})
    doc["paymentConfirmation"] = confirmation
    doc["hoc"] = {"paid": True, "reviewedBy": user["id"], "reviewedByName": user["name"], "reviewedByRole": user["role"], "reviewedAt": now_iso(), "remarks": require_text(payload, "remarks", "HOC comments", max_length=500)}
    set_route(doc, "Pending Accounts", "Accounts")
    doc["history"].append(history(user["id"], "HOC confirmed client payment", "Submitted to Accounts for billing.", user["name"]))
    notify("Accounts", f"{doc['number']} payment was confirmed and is waiting for billing.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/sales")
def sales_submit(document_id: str):
    user = current_user()
    require_department(user, "Sales")
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Document 1 not found")
    requires_hoc_approval = doc.get("serviceType", "new_installation") == "new_installation"
    was_submitted = not requires_hoc_approval and doc.get("status") == "Pending Accounts"
    allowed_statuses = ["Pending Sales", "Returned to Sales"]
    if not requires_hoc_approval:
        allowed_statuses.append("Pending Accounts")
    require_status(doc, *allowed_statuses)
    payload = request.get_json(force=True)
    client_name = require_text(payload, "clientName", "Client name")
    location = doc["location"]
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
        sales_item["unitCostUsd"] = store_item.get("unitCostUsd")
        sales_item["costCurrency"] = currency
    package_cost = sum(float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0) for item in equipment)
    owner = doc.get("confirmationRequiredFrom") or confirmation_owner(doc.get("store", {}).get("items", []), "TZS")
    confirmation = require_confirmation_image(payload) if owner == "Sales" else None
    labor_charge = require_number(payload, "amount", "Installation cost/labor charge", minimum=0, allow_zero=False)
    additional_nrr_field = "additionalNrr" if payload.get("additionalNrr") not in (None, "") else "additionalNpr"
    mrr_field = "mrr" if payload.get("mrr") not in (None, "") else "mbr"
    additional_nrr = require_number(payload, additional_nrr_field, "Additional NRR", minimum=0)
    mrr = require_number(payload, mrr_field, "MRR", minimum=0)
    total_sales_cost = labor_charge + package_cost
    one_time_total = total_sales_cost
    grand_total = total_sales_cost
    submitted_at = datetime.now(timezone(timedelta(hours=3)))
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
        "additionalNrr": additional_nrr,
        "oneTimeTotal": one_time_total,
        "grandTotal": grand_total,
        "subscription": subscription,
        "mrr": mrr,
        "requestedBy": require_text(payload, "requestedBy", "Requested by"),
        "submittedBy": user["id"],
        "submittedByName": user["name"],
        "submittedByRole": user["role"],
        "submittedAt": now_iso(),
        "requestedDate": submitted_at.date().isoformat(),
        "requestedTime": submitted_at.strftime("%I:%M %p"),
        "currency": currency,
        "equipment": deepcopy(equipment),
        "remarks": subscription,
    }
    doc["confirmationRequiredFrom"] = owner
    if confirmation:
        confirmation.update({"uploadedBy": user["id"], "uploadedByName": user["name"], "uploadedAt": now_iso()})
        doc["clientConfirmation"] = confirmation
    elif not doc.get("clientConfirmation"):
        raise ValueError("Engineer client email confirmation screenshot is missing")
    next_status, next_department = ("Pending HOC", "HOC") if requires_hoc_approval else ("Pending Accounts", "Accounts")
    set_route(doc, next_status, next_department)
    action = "Sales cost updated" if was_submitted else "Sales cost submitted"
    destination = "Head of Commercial approval" if requires_hoc_approval else "Accounts"
    detail = f"Labor charge and equipment cost were updated for {destination}." if was_submitted else f"Labor charge and equipment cost were submitted to {destination}."
    doc["history"].append(history(user["id"], action, detail, user["name"]))
    if requires_hoc_approval:
        notify("HOC", f"{doc['number']} is waiting for Head of Commercial approval.")
    else:
        notify("Accounts", f"{doc['number']} is waiting for billing.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/hoc")
def hoc_submit(document_id: str):
    user = current_user()
    require_department(user, "HOC")
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Document 1 not found")
    require_status(doc, "Pending HOC")
    payload = request.get_json(force=True)
    decision = str(payload.get("decision") or "").lower()
    if decision not in {"approve", "decline"}:
        raise ValueError("Select whether to approve or decline this onboarding")

    remarks = require_text(payload, "remarks", "Decline comments", max_length=500) if decision == "decline" else optional_text(payload, "remarks")
    doc["hoc"] = {
        "decision": decision,
        "reviewedBy": user["id"],
        "reviewedByName": user["name"],
        "reviewedByRole": user["role"],
        "reviewedAt": now_iso(),
        "remarks": remarks,
    }
    if decision == "approve":
        set_route(doc, "Pending Accounts", "Accounts")
        doc["history"].append(history(user["id"], "HOC approved onboarding", "Submitted to Accounts.", user["name"]))
        notify("Accounts", f"{doc['number']} was approved by Head of Commercial and is waiting for billing.")
    else:
        set_route(doc, "Returned to Sales", "Sales")
        doc["history"].append(history(user["id"], "HOC declined onboarding", f"Returned to Sales for review. Reason: {remarks}", user["name"]))
        notify("Sales", f"{doc['number']} was declined by Head of Commercial and returned for review.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/accounts")
def accounts_submit(document_id: str):
    user = current_user()
    require_department(user, "Accounts")
    doc = find_document(document_id)
    if not doc:
        raise ValueError("Document not found")
    require_status(doc, "Pending Accounts")
    payload = request.get_json(force=True)
    if doc["type"] == "maintenance":
        doc["accounts"] = {}
        set_route(doc, "Completed", "Engineer")
        doc["history"].append(history(user["id"], "General Maintenance equipment reviewed", "Equipment used was submitted and the document returned to Engineer.", user["name"]))
        notify("Engineer", f"{doc['number']} General Maintenance equipment has been reviewed and the request is complete.")
    elif doc["type"] == "survey":
        billing_amount = require_number(payload, "billingAmount", "Billing amount", minimum=0, allow_zero=False)
        doc["accounts"] = {
            "billingAmount": billing_amount, "invoiceNumber": optional_text(payload, "invoiceNumber", max_length=120),
            "remarks": require_text(payload, "remarks", "Remarks", max_length=500), "currency": doc.get("engineer", {}).get("currency") or "TZS",
            "processedBy": user["id"], "processedByName": user["name"], "processedByRole": user["role"], "processedAt": now_iso(),
        }
        source_equipment = doc.get("sales", {}).get("equipment") or doc.get("engineer", {}).get("items", [])
        equipment = validate_items(source_equipment, require_cost=True, context="Survey equipment")
        doc["store"]["items"] = deepcopy(equipment)
        doc.setdefault("sales", {})["equipment"] = deepcopy(equipment)
        equipment_total = sum(float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0) for item in equipment)
        doc["sales"].update({"packageCost": equipment_total, "laborCharge": 0, "amount": equipment_total, "oneTimeTotal": equipment_total, "grandTotal": equipment_total})
        set_route(doc, "Pending Store", "Store")
        doc["history"].append(history(user["id"], "Survey billing added", "Submitted to Store.", user["name"]))
        notify("Store", f"{doc['number']} is waiting for stock validation.")
    else:
        billing_amount = require_number(payload, "billingAmount", "Billing amount", minimum=0, allow_zero=False)
        doc["accounts"] = {
            "billingAmount": billing_amount,
            "invoiceNumber": optional_text(payload, "invoiceNumber", max_length=120),
            "remarks": require_text(payload, "remarks", "Remarks", max_length=500),
            "billInUsd": bool(payload.get("billInUsd")),
            "currency": "USD" if payload.get("billInUsd") else str(doc.get("sales", {}).get("currency") or "TZS"),
            "processedBy": user["id"],
            "processedByName": user["name"],
            "processedByRole": user["role"],
            "processedAt": now_iso(),
        }
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
        package_cost = sum(float(item.get("requestedQty") or 0) * float(item.get("unitCost") or 0) for item in store_items)
        labor_charge = float(doc["sales"].get("laborCharge") or 0)
        total_sales_cost = labor_charge + package_cost
        doc["sales"]["packageCost"] = package_cost
        doc["sales"]["amount"] = total_sales_cost
        doc["sales"]["oneTimeTotal"] = total_sales_cost
        doc["sales"]["grandTotal"] = total_sales_cost
        set_route(doc, "Pending Store", "Store")
        doc["history"].append(history(user["id"], "Billing added", "Submitted to Store.", user["name"]))
        notify("Store", f"{doc['number']} is waiting for stock validation.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/store")
def store_submit(document_id: str):
    user = current_user()
    require_department(user, "Store")
    doc = find_document(document_id)
    if not doc or doc["type"] not in {"doc1", "survey"}:
        raise ValueError("Workflow document not found")
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
    expected_total = float(doc.get("sales", {}).get("amount") or 0)
    matches = expected_total == float(doc.get("accounts", {}).get("billingAmount") or 0)
    doc["store"] = {
        "confirmed": matches,
        "amountMatches": matches,
        "approvedBy": user["id"],
        "approvedByName": user["name"],
        "approvedByRole": user["role"],
        "approvedAt": now_iso(),
        "remarks": optional_text(payload, "remarks"),
        "items": items,
    }
    if matches:
        doc["workflowCompletedAt"] = now_iso()
        set_route(doc, "Pending Management", "Management")
        generate_summary(doc)
        doc["history"].append(history(user["id"], "Store completed the workflow", "Delivery note generated; Management approval remains optional.", user["name"]))
        notify("Management", f"{doc['number']} is complete and awaiting optional approval.")
        notify("Engineer", f"{doc['number']} is complete; Management approval is still pending.")
    else:
        set_route(doc, "Returned to Sales", "Sales")
        doc["history"].append(history(user["id"], "Returned to Sales", "Sales and Accounts amounts do not match.", user["name"]))
        notify("Sales", f"{doc['number']} was returned because amounts do not match.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/management")
def management_submit(document_id: str):
    user = current_user()
    require_department(user, "Management")
    doc = find_document(document_id)
    if not doc or doc["type"] not in {"doc1", "survey"}:
        raise ValueError("Workflow document not found")
    require_status(doc, "Pending Management")
    payload = request.get_json(force=True)
    doc["management"] = {"approvedBy": user["id"], "approvedByName": user["name"], "approvedByRole": user["role"], "approvedAt": now_iso(), "remarks": optional_text(payload, "remarks")}
    set_route(doc, "Completed", "Engineer")
    doc["history"].append(history(user["id"], "Management approved", "Document completed and returned to Engineer.", user["name"]))
    notify("Engineer", f"{doc['number']} has been completed.")
    return jsonify(doc)


@app.post("/api/documents/<document_id>/hod")
def hod_submit(document_id: str):
    user = current_user()
    require_department(user, "HOD")
    doc = find_document(document_id)
    if not doc or doc["type"] != "maintenance":
        raise ValueError("General Maintenance document not found")
    require_status(doc, "Pending HOD")
    payload = request.get_json(force=True)
    doc["hod"] = {
        "approvedBy": user["id"],
        "approvedByName": user["name"],
        "approvedByRole": user["role"],
        "approvedAt": now_iso(),
        "remarks": optional_text(payload, "remarks"),
    }
    set_route(doc, "Pending Accounts", "Accounts")
    doc["history"].append(history(user["id"], "HOD approved General Maintenance", "Submitted to Accounts.", user["name"]))
    notify("Accounts", f"{doc['number']} General Maintenance is waiting for billing.")
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
        raise ValueError("General Maintenance document not found")
    ensure_document_access(user, doc)
    if doc["status"] != "Completed":
        raise ValueError("The General Maintenance PDF is available only after completion")
    filename = f"{doc['clientName'].replace(' ', '_')}_general_maintenance.pdf"
    return pdf_response(build_maintenance_certificate_pdf(doc), filename)


@app.get("/api/documents/<document_id>/downloads/survey-result")
def download_survey_result(document_id: str):
    user = current_user(); doc = find_document(document_id)
    if not doc or doc.get("type") != "survey": raise ValueError("Site survey request not found")
    ensure_document_access(user, doc)
    if not doc.get("survey"): raise ValueError("Survey result is available after the Engineer submits the survey")
    return pdf_response(build_survey_result_pdf(doc), f"{doc['clientName'].replace(' ', '_')}_survey_result.pdf")


@app.get("/api/documents/<document_id>/downloads/work-order")
def download_work_order(document_id: str):
    user = current_user(); doc = find_document(document_id)
    if not doc or doc.get("type") != "survey": raise ValueError("Site survey request not found")
    ensure_document_access(user, doc)
    if not doc.get("survey"): raise ValueError("Work order is available after the Engineer submits the survey")
    return pdf_response(build_work_order_pdf(doc), f"{doc['clientName'].replace(' ', '_')}_work_order.pdf")


@app.get("/api/documents/<document_id>/downloads/survey-stock-requisition")
def download_survey_stock_requisition(document_id: str):
    user = current_user(); doc = find_document(document_id)
    if not doc or doc.get("type") != "survey": raise ValueError("Site survey request not found")
    ensure_document_access(user, doc)
    if not doc.get("survey"): raise ValueError("Stock requisition is available after the Engineer submits the survey")
    return pdf_response(build_stock_requisition_pdf(doc), f"{doc['clientName'].replace(' ', '_')}_survey_stock_requisition.pdf")


@app.get("/api/reports")
def reports():
    user = current_user()
    docs = deepcopy(visible_documents_for(user))
    custom_docs = filter_report_dates(docs, request.args.get("start"), request.args.get("end"))
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
                "custom": build_request_report(custom_docs, 365000),
            },
            "materialPeriods": {
                "sold": {
                    "day": build_material_issued_report(docs, 1, "doc1"),
                    "week": build_material_issued_report(docs, 7, "doc1"),
                    "month": build_material_issued_report(docs, 30, "doc1"),
                    "custom": build_material_issued_report(docs, 365000, "doc1", request.args.get("start"), request.args.get("end")),
                },
                "leased": {
                    "day": build_material_issued_report(docs, 1, "maintenance"),
                    "week": build_material_issued_report(docs, 7, "maintenance"),
                    "month": build_material_issued_report(docs, 30, "maintenance"),
                    "custom": build_material_issued_report(docs, 365000, "maintenance", request.args.get("start"), request.args.get("end")),
                },
            },
        }
    )


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true",
    )
