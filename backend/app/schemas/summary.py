"""Response shapes for the dashboard summary."""

from decimal import Decimal

from pydantic import BaseModel


class CategoryBreakdown(BaseModel):
    """Net total for one category: income in that category minus expenses.

    A positive net means the category brought money in, negative means it
    cost money. Collapsing to a single figure keeps dashboard rendering simple.
    """

    category: str
    net: Decimal


class SummaryResponse(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    balance: Decimal
    by_category: list[CategoryBreakdown]
