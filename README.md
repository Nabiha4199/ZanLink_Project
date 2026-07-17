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
└── server/                 # Flask API, authentication, and PDF generation
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

## Authentication and account approval

Passwords are hashed in SQLite and successful login returns a signed, expiring access token. Registration creates a pending account:

1. The user submits their name, email, requested role, and password.
2. A system administrator signs in and opens **User Access**.
3. The administrator verifies the role and selects **Approve**.
4. The user can then sign in with their password or the same registered Google email.

Pending and disabled accounts cannot sign in. Role and status changes invalidate existing sessions.

## Google sign-in

Create a Google OAuth 2.0 Web application client, add the client URL (for example `http://localhost:5173`) as an authorized JavaScript origin, and set the same client ID in both environments:

```text
client/.env: VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
server/.env.local: GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Google sign-in is limited to email addresses that are already registered in the system. Restart both applications after changing environment values.

## Validation

```bash
cd client && npm run build
cd ..
python3 -m py_compile server/app.py server/wsgi.py
```

The server currently stores workflow state in memory. A future persistence layer can replace `STATE` in `server/app.py` without changing the client API service.
