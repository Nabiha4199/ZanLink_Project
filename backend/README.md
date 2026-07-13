# Zanlink Flask Backend

This backend exposes the workflow rules from the PDF as HTTP endpoints. Data is stored in memory for now so we can agree on the flow before choosing a database.

## Run

Python must be installed before using `requirements.txt`. Use Python `3.11+`. The file `runtime.txt` declares `python-3.11.9` for hosting platforms that support it.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The API runs at `http://localhost:5000`.

If `python3 -m venv` reports that `ensurepip` is unavailable, install the OS package for virtual environments first, for example `python3.14-venv` on Ubuntu/Debian.

## Important Endpoints

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

After login, send the returned user id as `X-User-Id` on API requests.
