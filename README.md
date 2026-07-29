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

## Google sign-in

Create a Google OAuth 2.0 Web application client, add the client URL (for example `http://localhost:5173`) as an authorized JavaScript origin, and set the same client ID in both environments:

```text
client/.env: VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
server environment: GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

New Google users are created with the least-privileged `Engineer` role. Restart both applications after changing environment values.

## Validation

```bash
cd client && npm run build
cd ..
python3 -m py_compile server/app.py server/wsgi.py
node workflow-smoke.test.js
```

The server currently stores workflow state in memory. A future persistence layer can replace `STATE` in `server/app.py` without changing the client API service.
