# Maildrop Agent Guide

## Commands
- **Install**: `pip install -r requirements.txt`
- **Run**: `python app.py` (Starts Flask web + SMTP server + cleanup tasks)
- **Docker**: `docker compose up -d`
- **Test**: No specific test runner; verify via UI or API calls.

## Architecture
- **Stack**: Python Flask (Web) + aiosmtpd (SMTP) + SQLite/JSON (Storage).
- **Entry**: `app.py` handles threading for Flask, SMTP, and cleanup.
- **Structure**: Logic in `src/backend`, UI in `src/frontend` (custom template folder).
- **Data**: persisted in `data/` (SQLite `mailbox.db` or JSON `inbox.json`).

## Style & Conventions
- **Python**: PEP8. Use absolute imports. Logic belongs in `src/backend`.
- **Config**: specific configs in `.env`, loaded via `config.py`.
- **API**: User routes at `/api/*`, Admin at `/api/admin/*`.
- **Frontend**: Plain HTML/JS (no build step). Fetch API for backend interaction.
- **Safety**: Do not commit `.env` or data files.
