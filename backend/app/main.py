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
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
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
