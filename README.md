# Zanlink Document Flow System

A client/server workflow application built with React, Vite, Flask, and ReportLab.

## Project structure

```text
.
├── client/                 # React client application
│   └── src/
│       ├── components/     # Reusable UI
│       ├── config/         # Workflow constants
│       ├── pages/          # Application pages
│       ├── services/       # HTTP API client
│       └── utils/          # Formatting and permissions
├── server/                 # Flask API and PDF generation
├── legacy/                 # Original static prototype
└── workflow-smoke.test.js  # Legacy workflow regression test
```

## Start the server

Python 3.11 or newer is required.

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

The API runs at `http://localhost:5000`.

## Start the client

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

The client runs at `http://localhost:5173`.

## Local demo accounts

The development server includes seeded accounts for local workflow testing. Do not use those accounts or their seeded passwords in a deployed environment; configure a real identity provider and rotate all credentials before publishing.

## Password reset

Configure the server's SMTP settings and `SUPPORT_EMAIL` as described in `server/.env.example`. Then restart the server, use **Forgot password**, and sign in with the new password after following the emailed reset link.

## Microsoft Entra ID sign-in

Register a **Web** application in Microsoft Entra ID and add the backend callback as its Redirect URI. For local development, use `http://localhost:5000/api/auth/microsoft/callback`; the configured value must exactly match `MICROSOFT_REDIRECT_URI`.

Set the following values in `server/.env` (never put the client secret in the client environment):

```text
FLASK_SECRET_KEY=replace-with-a-long-random-value
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_TENANT_ID=your-directory-tenant-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/auth/microsoft/callback
```

Only accounts already created by a System Admin can sign in through Microsoft Entra ID. Restart the server after changing environment values.

## Validation

```bash
cd client && npm run build
cd ..
python3 -m py_compile server/app.py server/wsgi.py
node workflow-smoke.test.js
```

The server currently stores workflow state in memory. A future persistence layer can replace `STATE` in `server/app.py` without changing the client API service.
