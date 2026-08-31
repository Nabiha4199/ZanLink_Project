# Zanlink Server

Flask API for the Zanlink document workflow. Workflow state is currently held in memory and completed documents are rendered with ReportLab.

## Environment

Copy `.env.example` to `.env`. For local-only secrets, use `.env.local`; it overrides no existing environment variables and is loaded after `.env`. Supported settings include `HOST`, `PORT`, `FLASK_DEBUG`, comma-separated `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, and the password-reset settings below.

### Password-reset email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` for an account allowed to send password-reset emails. Use `SMTP_USE_TLS=true` and `SMTP_USE_SSL=false` for STARTTLS (commonly port 587), or `SMTP_USE_TLS=false` and `SMTP_USE_SSL=true` for implicit SSL (commonly port 465). For Gmail, `SMTP_PASSWORD` must be a valid Google app password, not the normal account password. Set `APP_URL` to the public client URL so reset links open the correct app. `SUPPORT_EMAIL` is the contact address shown when delivery fails; leave it empty to show a generic administrator message.

After changing these values, restart the server and request a fresh reset link. Failed requests deliberately invalidate their reset token.

Google sign-in uses one Web application OAuth client ID on both the client and server. Put the same value in `server/.env` as `GOOGLE_CLIENT_ID` and in `client/.env` as `VITE_GOOGLE_CLIENT_ID`. For local development, add `http://localhost:5173` to that OAuth client's Authorized JavaScript origins in Google Cloud Console.

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
Copy-Item .env.example .env
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
- `GET /api/documents`
- `POST /api/documents/doc1`
- `POST /api/documents/maintenance`
- `POST /api/documents/<id>/sales`
- `POST /api/documents/<id>/hoc`
- `POST /api/documents/<id>/accounts`
- `POST /api/documents/<id>/store`
- `POST /api/documents/<id>/management`
- `POST /api/documents/<id>/hod`
- `GET /api/summaries`
- `GET /api/reports`

Authenticated workflow requests send the logged-in user ID through `X-User-Id`.
