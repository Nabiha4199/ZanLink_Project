# Zanlink Document Flow System

This project is being moved from the first static demo into a React frontend and Flask backend.

## Current Structure

- `frontend/` - React app built with Vite.
- `backend/` - Flask API with in-memory workflow data.
- `index.html`, `app.js`, `styles.css` - original static demo kept for reference.
- `workflow-smoke.test.js` - smoke test for the original static workflow.

## Run Backend

Python must be installed before using `requirements.txt`. Use Python `3.11+`.

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend URL: `http://localhost:5000`

For hosting services that read runtime files, the backend also includes `backend/runtime.txt`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Demo Accounts

All demo accounts use password `demo123`.

- `engineer`
- `sales`
- `accounts`
- `store`
- `management`
- `hod`
- `admin`

## What Is Included

- Login with demo users for all departments.
- Role-aware dashboard with status counts, search, filters, and document visibility.
- Document 1 workflow: Engineer -> Sales -> Accounts -> Store -> Management -> Engineer.
- Store amount validation: matching amounts move to Management, mismatches return to Sales.
- Automatic Client Summary generation using `Zanlink/000001` style numbering.
- Document 3 maintenance workflow: Engineer -> HOD -> Accounts -> Engineer.
- Audit trail for every major workflow movement.
- Print / Save PDF support through the browser print dialog.

## Database Later

The Flask backend currently stores data in memory. When we discuss the database, the natural next step is to replace the in-memory `STATE` object in `backend/app.py` with database models and repositories while keeping the API routes and React screens mostly stable.
