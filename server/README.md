# Zanlink Server

Flask API for the Zanlink document workflow. Workflow state is currently held in memory and completed documents are rendered with ReportLab.

## Environment

Copy `.env.example` to `.env.local`. Set a long random `AUTH_SECRET` before deployment. User accounts are stored in the SQLite database configured by `DATABASE_PATH`; workflow documents are still held in memory.

Google sign-in uses one Web application OAuth client ID on both the client and server. Put the same value in `server/.env.local` as `GOOGLE_CLIENT_ID` and in `client/.env` as `VITE_GOOGLE_CLIENT_ID`. For local development, add `http://localhost:5173` to that OAuth client's Authorized JavaScript origins in Google Cloud Console.

## Development

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

On Windows PowerShell, from the `server` directory:

```powershell
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env.local
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
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/register`
- `GET /api/users` (system administrators only)
- `PATCH /api/admin/users/<id>/access` (system administrators only)
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

Authenticated requests send the issued access token as `Authorization: Bearer <token>`. The server resolves the user from the signed token and applies role and department authorization; client-supplied user IDs are not trusted.

## Account approval

Registration creates a `pending` account and does not create a session. A system administrator signs in, opens **User Access**, verifies or changes the requested role, and selects **Approve**. Disabled or pending accounts cannot use password or Google sign-in. Changing an account's role or status invalidates its existing sessions.

On a new database, the initial system administrator is seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Set both values before the first server start and replace any development defaults before deployment.
