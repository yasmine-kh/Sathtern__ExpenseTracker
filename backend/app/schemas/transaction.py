"""Pydantic request/response shapes for transactions."""

from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.transaction import TransactionType


class TransactionBase(BaseModel):
    """Fields a client supplies and the API echoes back."""

    type: TransactionType
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    category: str = Field(min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    date: date_type


class TransactionCreate(TransactionBase):
    """Payload accepted when creating a transaction."""


class TransactionResponse(TransactionBase):
    """Transaction as returned by the API, including server-set fields."""

    id: int
    created_at: datetime

    # Lets FastAPI build this straight from a SQLAlchemy row object.
    model_config = ConfigDict(from_attributes=True)
