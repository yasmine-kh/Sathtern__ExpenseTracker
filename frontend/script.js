/* Sathtern Expense Tracker - frontend logic.
 *
 * Talks to the FastAPI backend. The backend's CORS middleware must list the
 * origin this page is served from (see backend/app/main.py).
 */

const API_BASE = "http://localhost:8000";

const form = document.getElementById("transaction-form");
const formCard = form.closest(".card");
const formHeading = document.getElementById("form-heading");
const typeEl = document.getElementById("type");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const otherField = document.getElementById("other-category-field");
const otherInput = document.getElementById("category-other");
const dateEl = document.getElementById("date");
const descriptionEl = document.getElementById("description");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formStatus = document.getElementById("form-status");
const tbody = document.getElementById("transactions-body");
const emptyState = document.getElementById("empty-state");
const errorBanner = document.getElementById("error-banner");

const statIncome = document.getElementById("stat-income");
const statExpenses = document.getElementById("stat-expenses");
const statBalance = document.getElementById("stat-balance");
const breakdownList = document.getElementById("breakdown");
const breakdownEmpty = document.getElementById("breakdown-empty");

const OTHER = "__other__";

/** id of the transaction being edited, or null when adding a new one. */
let editingId = null;

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

/* Formatting ------------------------------------------------------------ */

const money = (value) => Number(value).toFixed(2);

function formatAmount(type, amount) {
  return `${type === "income" ? "+" : "-"}${money(amount)}`;
}

/* Dashboard ------------------------------------------------------------- */

function renderSummary(summary) {
  statIncome.textContent = money(summary.total_income);
  statExpenses.textContent = money(summary.total_expenses);

  const balance = Number(summary.balance);
  statBalance.textContent = money(balance);
  statBalance.classList.toggle("balance-positive", balance >= 0);
  statBalance.classList.toggle("balance-negative", balance < 0);

  breakdownList.replaceChildren();
  breakdownEmpty.hidden = summary.by_category.length > 0;

  // Income and expenses get their own scale, each maxed against the largest
  // value of its own type. A single shared scale would let one big salary
  // flatten every expense bar to a near-invisible sliver.
  const nets = summary.by_category.map((c) => Number(c.net));
  const widestPositive = Math.max(...nets.filter((n) => n >= 0).map((n) => Math.abs(n)), 0);
  const widestNegative = Math.max(...nets.filter((n) => n < 0).map((n) => Math.abs(n)), 0);

  for (const entry of summary.by_category) {
    const net = Number(entry.net);
    const positive = net >= 0;

    const li = document.createElement("li");

    const top = document.createElement("div");
    top.className = "bd-top";

    const name = document.createElement("span");
    name.className = "bd-name";
    name.textContent = entry.category;

    const value = document.createElement("span");
    value.className = `bd-value ${positive ? "amount-income" : "amount-expense"}`;
    value.textContent = `${positive ? "+" : "-"}${money(Math.abs(net))}`;

    top.append(name, value);

    const track = document.createElement("div");
    track.className = "bd-track";
    const fill = document.createElement("div");
    fill.className = `bd-fill ${positive ? "bd-fill-positive" : "bd-fill-negative"}`;
    const scale = positive ? widestPositive : widestNegative;
    fill.style.width = scale > 0 ? `${(Math.abs(net) / scale) * 100}%` : "0%";
    track.appendChild(fill);

    li.append(top, track);
    breakdownList.appendChild(li);
  }
}

/* Table ----------------------------------------------------------------- */

function cell(row, label, text) {
  const td = document.createElement("td");
  td.dataset.label = label; // drives the stacked mobile layout in style.css
  td.textContent = text;
  row.appendChild(td);
  return td;
}

function actionButton(className, label, id, ariaLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.dataset.id = id;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

function renderTransactions(transactions) {
  tbody.replaceChildren();
  emptyState.hidden = transactions.length > 0;

  for (const t of transactions) {
    const tr = document.createElement("tr");
    if (String(t.id) === String(editingId)) tr.classList.add("row-editing");

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
    const group = document.createElement("div");
    group.className = "row-actions";
    group.append(
      actionButton("edit-btn", "Edit", t.id, `Edit transaction from ${t.date}`),
      actionButton("delete-btn", "Delete", t.id, `Delete transaction from ${t.date}`),
    );
    actionTd.appendChild(group);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  }
}

/* Loading --------------------------------------------------------------- */

/** Transactions and summary always move together, so refresh them together. */
async function refreshAll() {
  try {
    const [transactions, summary] = await Promise.all([
      request("/transactions"),
      request("/summary"),
    ]);
    renderTransactions(transactions);
    renderSummary(summary);
    clearError();
  } catch (err) {
    // Leave whatever is on screen; the banner explains why it may be stale.
    showError(describeFailure(err));
  }
}

/* Edit mode ------------------------------------------------------------- */

const knownCategories = () =>
  [...categoryEl.options].map((o) => o.value).filter((v) => v !== OTHER);

function enterEditMode(transaction) {
  editingId = transaction.id;

  typeEl.value = transaction.type;
  amountEl.value = Number(transaction.amount).toFixed(2);
  dateEl.value = transaction.date;
  descriptionEl.value = transaction.description || "";

  // A category that is not in the dropdown has to go in the free-text field.
  if (knownCategories().includes(transaction.category)) {
    categoryEl.value = transaction.category;
    otherInput.value = "";
  } else {
    categoryEl.value = OTHER;
    otherInput.value = transaction.category;
  }
  handleCategoryChange({ focus: false });

  formHeading.textContent = "Edit transaction";
  submitBtn.textContent = "Update transaction";
  cancelBtn.hidden = false;
  formCard.classList.add("editing");
  formStatus.textContent = "";

  for (const tr of tbody.querySelectorAll("tr")) tr.classList.remove("row-editing");
  const row = tbody.querySelector(`.edit-btn[data-id="${transaction.id}"]`)?.closest("tr");
  if (row) row.classList.add("row-editing");

  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  amountEl.focus();
}

function exitEditMode() {
  editingId = null;
  form.reset();
  otherField.hidden = true;
  dateEl.value = today();

  formHeading.textContent = "Add a transaction";
  submitBtn.textContent = "Add transaction";
  cancelBtn.hidden = true;
  formCard.classList.remove("editing");

  for (const tr of tbody.querySelectorAll("tr")) tr.classList.remove("row-editing");
}

/* Actions --------------------------------------------------------------- */

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

  const isEditing = editingId !== null;
  submitBtn.disabled = true;
  submitBtn.textContent = isEditing ? "Updating…" : "Adding…";

  try {
    await request(isEditing ? `/transactions/${editingId}` : "/transactions", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    exitEditMode();
    formStatus.textContent = isEditing ? "Transaction updated." : "Transaction added.";
    setTimeout(() => (formStatus.textContent = ""), 2500);

    await refreshAll();
  } catch (err) {
    showError(describeFailure(err));
    submitBtn.textContent = isEditing ? "Update transaction" : "Add transaction";
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleEdit(button) {
  clearError();
  try {
    const transaction = await request(`/transactions/${button.dataset.id}`);
    enterEditMode(transaction);
  } catch (err) {
    showError(describeFailure(err));
  }
}

async function handleDelete(button) {
  const id = button.dataset.id;
  button.disabled = true;
  button.textContent = "Deleting…";

  try {
    await request(`/transactions/${id}`, { method: "DELETE" });
    // Don't leave the form bound to a row that no longer exists.
    if (String(id) === String(editingId)) exitEditMode();
    await refreshAll();
  } catch (err) {
    showError(describeFailure(err));
    button.disabled = false;
    button.textContent = "Delete";
  }
}

/** One delegated listener: rows are replaced on every refresh. */
function handleTableClick(event) {
  const editBtn = event.target.closest(".edit-btn");
  if (editBtn) return handleEdit(editBtn);

  const deleteBtn = event.target.closest(".delete-btn");
  if (deleteBtn) return handleDelete(deleteBtn);
}

function handleCategoryChange({ focus = true } = {}) {
  const isOther = categoryEl.value === OTHER;
  otherField.hidden = !isOther;
  if (isOther && focus) otherInput.focus();
}

/* Init ------------------------------------------------------------------ */

function today() {
  // Local date, not UTC - toISOString() would shift the day in some zones.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

form.addEventListener("submit", handleSubmit);
cancelBtn.addEventListener("click", exitEditMode);
categoryEl.addEventListener("change", () => handleCategoryChange());
tbody.addEventListener("click", handleTableClick);

dateEl.value = today();
refreshAll();
