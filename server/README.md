# Zanlink Server

Flask API for the Zanlink document workflow. Workflow state is currently held in memory and completed documents are rendered with ReportLab.

## Environment

Copy `.env.example` values into your shell or hosting environment. Supported settings are `HOST`, `PORT`, `FLASK_DEBUG`, and comma-separated `CORS_ORIGINS`.

## Development

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

The API defaults to `http://localhost:5000`.

## Production entry point

WSGI platforms can import:

```text
wsgi:app
```

## Main endpoints

- `GET /api/health`
- `POST /api/login`
- `GET /api/documents`
- `POST /api/documents/doc1`
- `POST /api/documents/maintenance`
- `POST /api/documents/<id>/sales`
- `POST /api/documents/<id>/accounts`
- `POST /api/documents/<id>/store`
- `POST /api/documents/<id>/management`
- `POST /api/documents/<id>/hod`
- `GET /api/summaries`
- `GET /api/reports`

Authenticated workflow requests send the logged-in user ID through `X-User-Id`.
