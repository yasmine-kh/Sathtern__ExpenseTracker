/* Sathtern Expense Tracker - frontend logic.
 *
 * Talks to the FastAPI backend. The backend's CORS middleware must list the
 * origin this page is served from (see backend/app/main.py).
 */

const API_BASE = "http://localhost:8000";

const form = document.getElementById("transaction-form");
const typeEl = document.getElementById("type");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const otherField = document.getElementById("other-category-field");
const otherInput = document.getElementById("category-other");
const dateEl = document.getElementById("date");
const descriptionEl = document.getElementById("description");
const submitBtn = document.getElementById("submit-btn");
const formStatus = document.getElementById("form-status");
const tbody = document.getElementById("transactions-body");
const emptyState = document.getElementById("empty-state");
const errorBanner = document.getElementById("error-banner");

const OTHER = "__other__";

/* Errors ---------------------------------------------------------------- */

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

/** Turn any failure into something a person can act on. */
function describeFailure(err) {
  // A refused connection surfaces as a TypeError from fetch, with no response.
  if (err instanceof TypeError) {
    return `Cannot reach the API at ${API_BASE}. Is the backend running? ` +
           `Start it with: uvicorn app.main:app --reload`;
  }
  return err.message || "Something went wrong.";
}

/* API ------------------------------------------------------------------- */

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.detail) {
        // FastAPI validation errors arrive as a list of objects.
        detail = Array.isArray(body.detail)
          ? body.detail.map((d) => `${d.loc?.slice(1).join(".")}: ${d.msg}`).join("; ")
          : body.detail;
      }
    } catch {
      /* response had no JSON body - keep the status line */
    }
    throw new Error(detail);
  }

  return response.status === 204 ? null : response.json();
}

/* Rendering ------------------------------------------------------------- */

function formatAmount(type, amount) {
  const sign = type === "income" ? "+" : "-";
  const value = Number(amount).toFixed(2);
  return `${sign}${value}`;
}

function cell(row, label, text) {
  const td = document.createElement("td");
  td.dataset.label = label; // drives the stacked mobile layout in style.css
  td.textContent = text;
  row.appendChild(td);
  return td;
}

function renderTransactions(transactions) {
  tbody.replaceChildren();
  emptyState.hidden = transactions.length > 0;

  for (const t of transactions) {
    const tr = document.createElement("tr");

    cell(tr, "Date", t.date);

    const typeTd = cell(tr, "Type", "");
    const pill = document.createElement("span");
    pill.className = `pill pill-${t.type}`;
    pill.textContent = t.type;
    typeTd.appendChild(pill);

    cell(tr, "Category", t.category);
    cell(tr, "Description", t.description || "—");

    const amountTd = cell(tr, "Amount", formatAmount(t.type, t.amount));
    amountTd.classList.add("num", "amount", `amount-${t.type}`);

    const actionTd = document.createElement("td");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.dataset.id = t.id;
    del.setAttribute("aria-label", `Delete transaction from ${t.date}`);
    actionTd.appendChild(del);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  }
}

/* Actions --------------------------------------------------------------- */

async function loadTransactions() {
  try {
    const transactions = await request("/transactions");
    renderTransactions(transactions);
    clearError();
  } catch (err) {
    // Leave whatever is on screen; the banner explains why it may be stale.
    showError(describeFailure(err));
  }
}

function resolveCategory() {
  if (categoryEl.value !== OTHER) return categoryEl.value;
  return otherInput.value.trim();
}

async function handleSubmit(event) {
  event.preventDefault();
  clearError();
  formStatus.textContent = "";

  const category = resolveCategory();
  if (!category) {
    showError("Please enter a custom category, or pick one from the list.");
    otherInput.focus();
    return;
  }
  if (!amountEl.value || Number(amountEl.value) <= 0) {
    showError("Amount must be greater than zero.");
    amountEl.focus();
    return;
  }
  if (!dateEl.value) {
    showError("Please choose a date.");
    dateEl.focus();
    return;
  }

  const payload = {
    type: typeEl.value,
    amount: amountEl.value,
    category,
    description: descriptionEl.value.trim() || null,
    date: dateEl.value,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Adding…";

  try {
    await request("/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    form.reset();
    otherField.hidden = true;
    dateEl.value = today();
    formStatus.textContent = "Transaction added.";
    setTimeout(() => (formStatus.textContent = ""), 2500);

    await loadTransactions();
  } catch (err) {
    showError(describeFailure(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add transaction";
  }
}

async function handleDelete(event) {
  const button = event.target.closest(".delete-btn");
  if (!button) return; // click landed somewhere else in the table

  const id = button.dataset.id;
  button.disabled = true;
  button.textContent = "Deleting…";

  try {
    await request(`/transactions/${id}`, { method: "DELETE" });
    await loadTransactions();
  } catch (err) {
    showError(describeFailure(err));
    button.disabled = false;
    button.textContent = "Delete";
  }
}

function handleCategoryChange() {
  const isOther = categoryEl.value === OTHER;
  otherField.hidden = !isOther;
  if (isOther) otherInput.focus();
}

/* Init ------------------------------------------------------------------ */

function today() {
  // Local date, not UTC - toISOString() would shift the day in some zones.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

form.addEventListener("submit", handleSubmit);
categoryEl.addEventListener("change", handleCategoryChange);
tbody.addEventListener("click", handleDelete); // delegated: rows are re-rendered

dateEl.value = today();
loadTransactions();
