from __future__ import annotations

from io import BytesIO
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from flask import Flask, jsonify, request
from flask import send_file
from flask_cors import CORS
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Table
from reportlab.platypus import TableStyle


app = Flask(__name__)
CORS(app)


USERS = [
    {"id": "u1", "name": "Eng. Amina", "username": "engineer", "password": "demo123", "role": "Engineer", "department": "Engineer"},
    {"id": "u2", "name": "Sales Team", "username": "sales", "password": "demo123", "role": "Sales", "department": "Sales"},
    {"id": "u3", "name": "Accounts Team", "username": "accounts", "password": "demo123", "role": "Accounts", "department": "Accounts"},
    {"id": "u4", "name": "Store Team", "username": "store", "password": "demo123", "role": "Store", "department": "Store"},
    {"id": "u5", "name": "Managing Director", "username": "management", "password": "demo123", "role": "Management", "department": "Management"},
    {"id": "u6", "name": "Head of Department", "username": "hod", "password": "demo123", "role": "Head of Department", "department": "HOD"},
    {"id": "u7", "name": "System Admin", "username": "admin", "password": "demo123", "role": "System Admin", "department": "Admin"},
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
                    {"name": "Router", "requestedQty": 1, "issuedQty": 0, "serialNumber": "", "purpose": "CPE", "unitCost": 180000},
                    {"name": "Outdoor radio", "requestedQty": 1, "issuedQty": 0, "serialNumber": "", "purpose": "Connectivity", "unitCost": 520000},
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
    safe.pop("password", None)
    return safe


def find_user(user_id: str | None) -> dict | None:
    return next((user for user in USERS if user["id"] == user_id), None)


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


def current_user() -> dict:
    user = find_user(request.headers.get("X-User-Id"))
    if not user:
        raise PermissionError("Missing or invalid X-User-Id header")
    return user


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
    summary = {
        "id": str(uuid4()),
        "number": next_number("summary"),
        "sourceDocumentId": doc["id"],
        "customerName": doc["clientName"],
        "customerLocation": doc["location"],
        "invoiceNumber": doc.get("accounts", {}).get("invoiceNumber", ""),
        "items": items,
        "subtotal": subtotal,
        "transportCost": 0,
        "grandTotal": subtotal,
        "zanlinkStaff": "",
        "terms": "If any of the devices above is provided on test basis, it will only be kept for a maximum period of 5 days at client's premises. After that the client should either return the device(s) or will be charged for it.",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    STATE["summaries"].insert(0, summary)
    return summary


def visible_documents_for(user: dict) -> list[dict]:
    if user["role"] in {"System Admin", "Management"}:
        return STATE["documents"]
    return [
        doc
        for doc in STATE["documents"]
        if doc["createdBy"] == user["id"] or doc["currentDepartment"] == user["department"] or doc["status"] == "Completed"
    ]


def ensure_document_access(user: dict, doc: dict) -> None:
    if user["role"] in {"System Admin", "Management"}:
        return
    if doc["createdBy"] == user["id"] or doc["currentDepartment"] == user["department"] or doc["status"] == "Completed":
        return
    raise PermissionError("This document is not visible to your role")


def require_completed_doc1(user: dict, document_id: str) -> dict:
    doc = find_document(document_id)
    if not doc or doc["type"] != "doc1":
        raise ValueError("Completed Document 1 not found")
    ensure_document_access(user, doc)
    if doc["status"] != "Completed":
        raise ValueError("Final PDFs are available only after the document is completed")
    return doc


def pdf_response(buffer: BytesIO, filename: str):
    buffer.seek(0)
    return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name=filename)


def recalculate_summary(summary: dict) -> None:
    subtotal = sum(float(item.get("issuedQty") or 0) * float(item.get("unitCost") or 0) for item in summary.get("items", []))
    transport = float(summary.get("transportCost") or 0)
    summary["subtotal"] = subtotal
    summary["transportCost"] = transport
    summary["grandTotal"] = subtotal + transport
    summary["updatedAt"] = now_iso()


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
    draw_label_value(pdf, "Sales Amount", f"{doc.get('sales', {}).get('amount', '-')}", 85 * mm, y - 18 * mm, 52 * mm)
    draw_label_value(pdf, "Billing Amount", f"{doc.get('accounts', {}).get('billingAmount', '-')}", 143 * mm, y - 18 * mm, 45 * mm)
    draw_label_value(pdf, "Subscription Package", doc.get("sales", {}).get("remarks", ""), 22 * mm, y - 36 * mm, 115 * mm)
    draw_label_value(pdf, "Requested By", "Engineer", 143 * mm, y - 36 * mm, 45 * mm)

    y -= 66 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Engineering Confirmation")
    draw_label_value(pdf, "Stock Requisition No.", doc["number"], 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Engineer Notes", doc.get("engineer", {}).get("notes", ""), 85 * mm, y - 4, 103 * mm)

    y -= 34 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, y + 12, "Management Approval")
    draw_label_value(pdf, "Approved By", "Management", 22 * mm, y - 4, 56 * mm)
    draw_label_value(pdf, "Comments", doc.get("management", {}).get("remarks", ""), 85 * mm, y - 4, 103 * mm)

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
                item.get("serialNumber") or "-",
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
        ["Sheet No.", summary["number"]],
        ["Customer", summary.get("customerName") or (doc or {}).get("clientName", "")],
        ["Date", datetime.fromisoformat(summary["createdAt"]).strftime("%d/%m/%Y") if summary.get("createdAt") else datetime.now().strftime("%d/%m/%Y")],
        ["Invoice Number", summary.get("invoiceNumber", "")],
    ]
    info_table = Table(info_rows, colWidths=[34 * mm, 144 * mm])
    info_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.6, colors.black), ("FONTSIZE", (0, 0), (-1, -1), 8), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold")]))
    info_table.wrapOn(pdf, width, height)
    info_table.drawOn(pdf, 16 * mm, height - 62 * mm)

    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(width / 2, height - 78 * mm, "Equipment/Accessories delivered")

    rows = [["No.", "Equipment/Accessory", "Serial No", "Qty", "Purpose", "Cost"]]
    for index, item in enumerate(summary.get("items", []), start=1):
        qty = float(item.get("issuedQty") or 0)
        cost = float(item.get("unitCost") or 0)
        rows.append(
            [
                str(index),
                item.get("name", ""),
                item.get("serialNumber", ""),
                f"{qty:g}",
                item.get("purpose") or "Sold to Client",
                f"${qty * cost:,.2f}",
            ]
        )
    rows.extend(
        [
            ["", "", "", "", "Sub Total:", f"${float(summary.get('subtotal') or 0):,.2f}"],
            ["", "", "", "", "Transportation Cost:", f"${float(summary.get('transportCost') or 0):,.2f}"],
            ["", "", "", "", "Grand Total Cost:", f"${float(summary.get('grandTotal') or 0):,.2f}"],
        ]
    )
    table = Table(rows, colWidths=[10 * mm, 52 * mm, 42 * mm, 16 * mm, 39 * mm, 24 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (4, -3), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("ALIGN", (5, 1), (5, -1), "RIGHT"),
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
                item.get("serialNumber") or "-",
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


@app.errorhandler(ValueError)
def value_error(error: ValueError):
    return jsonify({"error": str(error)}), 400


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "zanlink-backend"})


@app.get("/api/users")
def users():
    return jsonify([public_user(user) for user in USERS])


@app.post("/api/login")
def login():
    payload = request.get_json(force=True)
    user = next((item for item in USERS if item["username"] == payload.get("username") and item["password"] == payload.get("password")), None)
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401
    return jsonify(public_user(user))


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
    doc["sales"] = {
        "amount": require_number(payload, "amount", "Sales total amount", minimum=0, allow_zero=False),
        "packageCost": require_number(payload, "packageCost", "Package cost", minimum=0) if payload.get("packageCost") not in (None, "") else 0,
        "remarks": optional_text(payload, "remarks"),
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
    items = validate_items(payload.get("items", []), require_issued=True, context="Issued stock item")
    matches = float(doc.get("sales", {}).get("amount") or 0) == float(doc.get("accounts", {}).get("billingAmount") or 0)
    doc["store"] = {"confirmed": matches, "amountMatches": matches, "remarks": optional_text(payload, "remarks"), "items": items}
    if matches:
        set_route(doc, "Pending Management", "Management")
        generate_summary(doc)
        doc["history"].append(history(user["id"], "Store confirmed stock and amount match", "Client summary generated."))
        notify("Management", f"{doc['number']} is waiting for approval.")
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


@app.put("/api/summaries/<summary_id>")
def update_summary(summary_id: str):
    user = current_user()
    require_department(user, "Accounts")
    summary = find_summary(summary_id)
    if not summary:
        raise ValueError("Client summary not found")
    payload = request.get_json(force=True)
    summary["invoiceNumber"] = require_text(payload, "invoiceNumber", "Invoice number")
    summary["customerName"] = require_text(payload, "customerName", "Customer name")
    summary["customerLocation"] = optional_text(payload, "customerLocation", summary.get("customerLocation", ""), max_length=180)
    summary["zanlinkStaff"] = require_text(payload, "zanlinkStaff", "Zanlink staff name")
    summary["transportCost"] = require_number(payload, "transportCost", "Transportation cost", minimum=0) if payload.get("transportCost") not in (None, "") else 0
    summary["terms"] = require_text(payload, "terms", "Terms and conditions", max_length=1200)
    summary["items"] = validate_items(payload.get("items", []), require_issued=True, require_cost=True, context="Delivered equipment")
    recalculate_summary(summary)
    return jsonify(summary)


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
    app.run(debug=True, port=5000)
