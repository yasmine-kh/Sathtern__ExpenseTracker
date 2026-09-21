"""Aggregate dashboard figures."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.transaction import Transaction, TransactionType
from app.schemas.summary import CategoryBreakdown, SummaryResponse

router = APIRouter(tags=["summary"])

DbSession = Annotated[Session, Depends(get_db)]

# Signed amount: income counts positive, expense negative. Used to net a
# category down to one figure in SQL rather than reconciling rows in Python.
_signed_amount = case(
    (Transaction.type == TransactionType.INCOME, Transaction.amount),
    else_=-Transaction.amount,
)


def _total_for(db: Session, transaction_type: TransactionType) -> Decimal:
    """Sum of all amounts of one type, 0 when there are none."""
    stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.type == transaction_type
    )
    return Decimal(db.execute(stmt).scalar_one())


@router.get("/summary", response_model=SummaryResponse)
def get_summary(db: DbSession):
    """Totals, balance, and a net-per-category breakdown across all transactions."""
    total_income = _total_for(db, TransactionType.INCOME)
    total_expenses = _total_for(db, TransactionType.EXPENSE)

    breakdown_stmt = (
        select(
            Transaction.category,
            func.sum(_signed_amount).label("net"),
        )
        .group_by(Transaction.category)
        .order_by(func.sum(_signed_amount).desc())
    )

    by_category = [
        CategoryBreakdown(category=row.category, net=row.net)
        for row in db.execute(breakdown_stmt)
    ]

    return SummaryResponse(
        total_income=total_income,
        total_expenses=total_expenses,
        balance=total_income - total_expenses,
        by_category=by_category,
    )
