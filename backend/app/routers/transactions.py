"""CRUD endpoints for transactions."""

from datetime import date as date_type
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.transaction import Transaction, TransactionType
from app.schemas.transaction import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])

DbSession = Annotated[Session, Depends(get_db)]


def _get_or_404(db: Session, transaction_id: int) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )
    return transaction


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, db: DbSession):
    """Record a new income or expense transaction."""
    transaction = Transaction(**payload.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    db: DbSession,
    type: Annotated[TransactionType | None, Query(description="Filter by income or expense")] = None,
    category: Annotated[str | None, Query(description="Exact category match")] = None,
    date_from: Annotated[date_type | None, Query(description="Inclusive lower bound")] = None,
    date_to: Annotated[date_type | None, Query(description="Inclusive upper bound")] = None,
):
    """List transactions, newest first, narrowed by any combination of filters."""
    stmt = select(Transaction)

    if type is not None:
        stmt = stmt.where(Transaction.type == type)
    if category is not None:
        stmt = stmt.where(Transaction.category == category)
    if date_from is not None:
        stmt = stmt.where(Transaction.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Transaction.date <= date_to)

    stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc())
    return db.execute(stmt).scalars().all()


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: DbSession):
    """Fetch a single transaction by id."""
    return _get_or_404(db, transaction_id)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: int, payload: TransactionCreate, db: DbSession):
    """Replace every client-settable field on an existing transaction."""
    transaction = _get_or_404(db, transaction_id)
    for field, value in payload.model_dump().items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, db: DbSession):
    """Delete a transaction."""
    transaction = _get_or_404(db, transaction_id)
    db.delete(transaction)
    db.commit()
