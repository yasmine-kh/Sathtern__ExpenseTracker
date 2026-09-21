"""Transaction ORM model."""

import enum
# 'date' is aliased because the column below is also named 'date';
# SQLAlchemy resolves Mapped[...] annotations against the class namespace,
# where the bare name would resolve to the column, not the type.
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TransactionType(str, enum.Enum):
    """Whether a transaction adds to or subtracts from the balance."""

    INCOME = "income"
    EXPENSE = "expense"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        index=True,
    )
    # Numeric, not Float: money must not accumulate binary rounding error.
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date: Mapped[date_type] = mapped_column(nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<Transaction id={self.id} type={self.type} "
            f"amount={self.amount} category={self.category!r}>"
        )
