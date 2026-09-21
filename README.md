# Sathtern Expense Tracker

A personal expense tracker: record income and expenses, categorise them, filter the
history, and see where the money actually goes on a dashboard.

Built as a full-stack project with a FastAPI + MySQL backend and a dependency-free
vanilla JavaScript frontend — no React, no build step, no bundler.

---

## Features

- **Add, edit and delete transactions** — each one is either income or an expense.
- **Categories** — pick from a list of common categories (Salary, Groceries, Rent,
  Transport, Dining, Utilities, Entertainment, Health, Shopping) or type your own
  via the "Other…" option.
- **Filtering** — narrow the transaction list by type, category, and a date range,
  in any combination.
- **Dashboard** — total income, total expenses, and the resulting balance as stat
  cards, plus a per-category breakdown showing the *net* for each category
  (income minus expenses) as a proportional bar chart.
- **Live updates** — the dashboard and the table refresh together whenever a
  transaction is added, edited or removed.
- **Responsive layout** — the table collapses into stacked cards on narrow screens.

---

## Screenshots

<!-- Add screenshots here before publishing. Suggested captures:
     1. Dashboard with populated stat cards and category breakdown
     2. The add/edit form in edit mode
     3. Mobile / narrow-screen layout
-->

_Screenshots to be added._

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| ORM | SQLAlchemy 2.0 (declarative, typed `Mapped[...]` models) |
| Migrations | Alembic |
| Database | MySQL 8.4 |
| DB driver | PyMySQL (with `cryptography` for `caching_sha2_password`) |
| Validation | Pydantic v2 |
| Frontend | Plain HTML, CSS and JavaScript — no framework, no build step |
| Server (dev) | Uvicorn (API), `python -m http.server` (static frontend) |

---

## Project structure

```
Sathtern_ExpenseTracker/
├── backend/
│   ├── alembic/                 # migration environment + versions
│   ├── alembic.ini
│   ├── app/
│   │   ├── database.py          # engine, session factory, Base, get_db dependency
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── routers/             # transactions + summary endpoints
│   │   └── schemas/             # Pydantic request/response models
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── script.js
    └── style.css
```

---

## Running it locally

### Prerequisites

- Python 3.13
- MySQL 8.x running locally

### 1. Create the database

Connect to MySQL as a privileged user and run:

```sql
CREATE DATABASE sathtern_expense_tracker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'expense_app'@'localhost' IDENTIFIED BY 'your-password-here';
GRANT ALL PRIVILEGES ON sathtern_expense_tracker.* TO 'expense_app'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Configure credentials

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set the connection string:

```
DATABASE_URL=mysql+pymysql://expense_app:your-password-here@localhost:3306/sathtern_expense_tracker
```

`.env` is git-ignored and must never be committed.

### 3. Set up the virtual environment

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# Windows (Git Bash)
source venv/Scripts/activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Apply migrations

```bash
alembic upgrade head
```

This creates the `transactions` table, with a native MySQL `ENUM` for the
transaction type and `DECIMAL(10,2)` for amounts.

### 5. Start the backend

```bash
cd backend
uvicorn app.main:app --reload
```

The API runs on **http://localhost:8000**. Interactive docs: **http://localhost:8000/docs**

### 6. Start the frontend

In a second terminal:

```bash
cd frontend
python -m http.server 5500
```

Open **http://localhost:5500**.

> **Do not open `index.html` directly from the filesystem.** A `file://` page sends
> `Origin: null`, which the backend's CORS policy rejects. The frontend must be
> served over HTTP. VS Code's Live Server (port 5500) works too.

---

## API reference

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/transactions` | Create a transaction → `201` |
| `GET` | `/transactions` | List transactions, newest first (supports filters) |
| `GET` | `/transactions/{id}` | Fetch one transaction → `404` if absent |
| `PUT` | `/transactions/{id}` | Replace a transaction |
| `DELETE` | `/transactions/{id}` | Delete a transaction → `204` |
| `GET` | `/summary` | Totals, balance, and net-per-category breakdown |

### Filter parameters on `GET /transactions`

| Parameter | Type | Description |
|---|---|---|
| `type` | `income` \| `expense` | Filter by transaction type |
| `category` | string | Exact category match |
| `date_from` | `YYYY-MM-DD` | Inclusive lower bound |
| `date_to` | `YYYY-MM-DD` | Inclusive upper bound |

All parameters are optional and can be combined.

### Transaction shape

```json
{
  "id": 1,
  "type": "expense",
  "amount": "162.40",
  "category": "Groceries",
  "description": "Weekly shop",
  "date": "2026-09-07",
  "created_at": "2026-09-07T10:31:22"
}
```

Amounts are stored as `DECIMAL(10,2)` and serialised as strings to avoid
floating-point rounding errors on money.

### Summary shape

```json
{
  "total_income": "3200.00",
  "total_expenses": "1007.40",
  "balance": "2192.60",
  "by_category": [
    { "category": "Salary", "net": "3200.00" },
    { "category": "Rent", "net": "-845.00" }
  ]
}
```

`net` is income minus expenses for that category, so a category containing both
(for example a refund against a purchase) collapses to a single figure.

---

## Known limitations

This is a portfolio/learning project, not a production application.

- **No authentication.** There is no login, no sessions, and no user accounts.
- **No authorisation on any endpoint.** Every endpoint is fully public — anyone who
  can reach the API can read, modify, or delete every transaction.
- **Single-user by design.** Transactions are not scoped to an owner; there is no
  `user_id` column and no concept of separate accounts. All data is one shared set.
- **Intended for local use only.** Because of the above, this should not be deployed
  to a public host as-is. Exposing it publicly would expose all data to everyone.
- **No currency handling.** Amounts are bare decimals with no currency field; all
  figures are assumed to be in a single, unspecified currency.
- **No pagination.** `GET /transactions` returns every matching row, which will not
  scale to large datasets.
- **No automated test suite** is committed. The application was verified manually and
  through browser-driven end-to-end checks during development.
- **Migrations are manual.** The app does not run `alembic upgrade` on startup.

### If this were taken further

Authentication with per-user data scoping would be the first requirement, followed by
pagination, a currency field, and a committed test suite.
