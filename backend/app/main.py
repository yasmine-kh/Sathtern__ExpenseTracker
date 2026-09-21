"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import summary, transactions

app = FastAPI(
    title="Sathtern Expense Tracker API",
    description="Backend for tracking income and expense transactions.",
    version="0.1.0",
)

# Local dev front-ends. Credentials are allowed, so origins must be listed
# explicitly - a wildcard is not permitted alongside allow_credentials.
# Covers the common static-server ports: 5500/5501 (VS Code Live Server),
# 8080 (python -m http.server), 3000 and 5173 (Node dev servers).
_ports = [3000, 5173, 5500, 5501, 8080]
origins = [
    "http://localhost",
    "http://127.0.0.1",
    *[f"http://localhost:{port}" for port in _ports],
    *[f"http://127.0.0.1:{port}" for port in _ports],
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(summary.router)


@app.get("/", tags=["health"])
def health_check():
    """Liveness probe, useful for confirming the app starts."""
    return {"status": "ok", "service": "expense-tracker-api"}
