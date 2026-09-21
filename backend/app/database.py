"""SQLAlchemy engine, session factory, and declarative base.

The connection string is read from the .env file at the backend root so that
credentials never live in source control. See .env.example for the expected
shape of DATABASE_URL.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# .env sits at the backend root, two levels up from this file.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in the "
        "MySQL connection string before starting the app."
    )

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # drop connections MySQL has already timed out
    pool_recycle=3600,    # stay under MySQL's default wait_timeout
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Declarative base every ORM model inherits from."""


def get_db():
    """FastAPI dependency that yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
