let menu = [],
  cart = [],
  orderType = "dine-in",
  paymentMethod = "Cash",
  currentHeldId = null,
  filter = "all",
  sessionUser = null;
const money = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function discountPercentage() {
  return Math.max(
    0,
    Math.min(
      100,
      Number(document.getElementById("discount-percentage").value || 0),
    ),
  );
}
function discountedTotal() {
  const subtotal = total();
  return Math.round(subtotal * (1 - discountPercentage() / 100) * 100) / 100;
}
function esc(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
function toast(message, error = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.style.background = error ? "#b42318" : "#124b32";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function loadMenu() {
  try {
    menu = await api("/pos/api/menu");
    renderMenu();
  } catch (error) {
    document.getElementById("menu-grid").innerHTML =
      `<p class="loading">${esc(error.message)}</p>`;
  }
}
async function loadSession() {
  try {
    sessionUser = await api("/pos/api/session");
  } catch (error) {
    sessionUser = null;
  }
}
function openMenuEditor() {
  document.getElementById("menu-item-select").innerHTML = menu
    .map((item) => `<option value="${item.id}">${esc(item.name)}</option>`)
    .join("");
  populateMenuEditor();
  document.getElementById("menu-error").textContent = "";
  document.getElementById("menu-modal").classList.remove("hidden");
}
function populateMenuEditor() {
  const item = menu.find(
    (row) =>
      row.id === Number(document.getElementById("menu-item-select").value),
  );
  if (!item) return;
  document.getElementById("menu-name").value = item.name;
  document.getElementById("menu-price").value = Number(item.price).toFixed(2);
  document.getElementById("menu-available").checked = item.is_available === 1;
}
function renderMenu() {
  const search = document
    .getElementById("menu-search")
    .value.trim()
    .toLowerCase();
  const rows = menu.filter(
    (item) =>
      (filter === "all" ||
        (filter === "available" && item.is_available === 1) ||
        (filter === "unavailable" && item.is_available === 0)) &&
      item.name.toLowerCase().includes(search),
  );
  document.getElementById("menu-grid").innerHTML = rows.length
    ? rows
        .map(
          (item) =>
            `<article class="menu-card ${item.is_available ? "" : "unavailable"}" data-item-id="${item.id}"><div class="menu-card-top"><h3>${esc(item.name)}</h3><span class="status-dot"></span></div><div><span class="menu-card-price">${money(item.price)}</span><br><small>${item.is_available ? "Available" : "Unavailable"}</small></div></article>`,
        )
        .join("")
    : '<p class="loading">No menu items found.</p>';
}
function total() {
  return (
    Math.round(
      cart.reduce((sum, row) => sum + Number(row.price) * row.quantity, 0) *
        100,
    ) / 100
  );
}
function renderCart() {
  const count = cart.reduce((sum, row) => sum + row.quantity, 0);
  document.getElementById("order-title").textContent = count
    ? `New Order · ${count} item${count === 1 ? "" : "s"}`
    : "New Order";
  document.getElementById("order-items").innerHTML = cart.length
    ? cart
        .map(
          (row) =>
            `<div class="order-row"><div><strong>${esc(row.name)}</strong><small>${money(row.price)}</div><div class="quantity-control"><button type="button" data-minus="${row.id}" aria-label="Decrease">−</button><span>${row.quantity}</span><button type="button" data-plus="${row.id}" aria-label="Increase">+</button></div></div>`,
        )
        .join("")
    : '<div class="empty-order"><span>+</span><p>No items yet</p><small>Select an item from the menu</small></div>';
  const value = total();
  document.getElementById("subtotal").textContent = money(value);
  document.getElementById("total").textContent = money(value);
}
document.getElementById("menu-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".menu-card");
  if (!card) return;
  const item = menu.find((row) => row.id === Number(card.dataset.itemId));
  if (!item || item.is_available !== 1)
    return toast("This item is unavailable.", true);
  const existing = cart.find((row) => row.id === item.id);
  if (existing) existing.quantity++;
  else
    cart.push({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: 1,
    });
  renderCart();
});
document.getElementById("order-items").addEventListener("click", (event) => {
  const plus = event.target.closest("[data-plus]");
  const minus = event.target.closest("[data-minus]");
  if (!plus && !minus) return;
  const id = Number(
    (plus || minus).dataset.plus || (plus || minus).dataset.minus,
  );
  const row = cart.find((item) => item.id === id);
  if (!row) return;
  if (plus) row.quantity++;
  else row.quantity--;
  if (row.quantity <= 0) cart = cart.filter((item) => item.id !== id);
  renderCart();
});
document.querySelectorAll("[data-order-type]").forEach((button) =>
  button.addEventListener("click", () => {
    orderType = button.dataset.orderType;
    document
      .querySelectorAll("[data-order-type]")
      .forEach((row) => row.classList.toggle("active", row === button));
    document
      .getElementById("table-number-wrap")
      .classList.toggle("hidden", orderType !== "dine-in");
  }),
);
document.getElementById("category-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  filter = button.dataset.filter;
  document
    .querySelectorAll("[data-filter]")
    .forEach((row) => row.classList.toggle("active", row === button));
  renderMenu();
});
document.getElementById("menu-search").addEventListener("input", renderMenu);
document.getElementById("clear-order").addEventListener("click", () => {
  cart = [];
  currentHeldId = null;
  document.getElementById("table-number").value = "";
  renderCart();
});
document
  .getElementById("edit-menu-button")
  .addEventListener("click", openMenuEditor);
document
  .getElementById("menu-item-select")
  .addEventListener("change", populateMenuEditor);
document
  .getElementById("menu-edit-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = Number(document.getElementById("menu-item-select").value);
    const body = {
      name: document.getElementById("menu-name").value.trim(),
      price: Number(document.getElementById("menu-price").value),
      is_available: document.getElementById("menu-available").checked,
    };
    try {
      await api(`/pos/api/menu/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      document.getElementById("menu-modal").classList.add("hidden");
      toast("Menu item updated.");
      await loadMenu();
    } catch (error) {
      document.getElementById("menu-error").textContent = error.message;
    }
  });
function payload() {
  return {
    order_type: orderType,
    table_number: document.getElementById("table-number").value.trim(),
    items: cart.map((row) => ({
      menu_item_id: row.id,
      quantity: row.quantity,
    })),
  };
}
document.getElementById("hold-order").addEventListener("click", async () => {
  if (!cart.length) return toast("Add items before holding the order.", true);
  try {
    await api("/pos/api/orders", {
      method: "POST",
      body: JSON.stringify(payload()),
    });
    cart = [];
    currentHeldId = null;
    renderCart();
    toast("Order held.");
    loadHeld();
  } catch (error) {
    toast(error.message, true);
  }
});
async function loadHeld() {
  try {
    const orders = await api("/pos/api/orders");
    document.getElementById("held-count").textContent = orders.length;
    document.getElementById("held-list").innerHTML = orders.length
      ? orders
          .map(
            (order) =>
              `<article class="held-order"><div class="held-order-top"><div><strong>${esc(order.order_code)}</strong><small>${esc(order.order_type)}</small></div><strong>${money(order.total)}</strong></div><div class="held-order-actions"><button class="small-button" data-load-held="${order.id}" type="button">Load</button><button class="small-button cancel" data-cancel-held="${order.id}" type="button">Cancel</button></div></article>`,
          )
          .join("")
      : '<p class="empty">No held orders.</p>';
    return orders;
  } catch (error) {
    toast(error.message, true);
    return [];
  }
}
document
  .getElementById("held-list")
  .addEventListener("click", async (event) => {
    const load = event.target.closest("[data-load-held]");
    const cancel = event.target.closest("[data-cancel-held]");
    if (load) {
      const orders = await api("/pos/api/orders");
      const order = orders.find(
        (row) => row.id === Number(load.dataset.loadHeld),
      );
      if (!order) return;
      cart = order.items.map((row) => {
        const menuItem =
          menu.find((item) => item.id === row.menu_item_id) || {};
        return {
          id: row.menu_item_id,
          name: row.item_name,
          price: Number(row.unit_price),
          quantity: row.quantity,
        };
      });
      orderType = order.order_type;
      document.getElementById("table-number").value = order.table_number || "";
      document
        .querySelectorAll("[data-order-type]")
        .forEach((button) =>
          button.classList.toggle(
            "active",
            button.dataset.orderType === orderType,
          ),
        );
      document
        .getElementById("table-number-wrap")
        .classList.toggle("hidden", orderType !== "dine-in");
      currentHeldId = order.id;
      renderCart();
      document.getElementById("held-drawer").classList.add("hidden");
    }
    if (cancel) {
      try {
        await api(
          `/pos/api/orders/${Number(cancel.dataset.cancelHeld)}/cancel`,
          { method: "POST" },
        );
        toast("Held order cancelled.");
        loadHeld();
      } catch (error) {
        toast(error.message, true);
      }
    }
  });
document.getElementById("held-button").addEventListener("click", () => {
  document.getElementById("held-drawer").classList.remove("hidden");
  loadHeld();
});
async function loadSummary() {
  try {
    const summary = await api("/pos/api/summary");
    document.getElementById("summary-count").textContent = summary.count;
    document.getElementById("summary-sales").textContent = money(summary.sales);
    document.getElementById("summary-list").innerHTML = summary.transactions
      .length
      ? summary.transactions
          .map(
            (row) =>
              `<div class="summary-row"><div><strong>${esc(row.transaction_code)}</strong><small>${esc(row.transaction_date).replace("T", " ").slice(0, 16)}</small></div><div><strong>${money(row.total)}</strong><small>${esc(row.payment_method)}</small></div></div>`,
          )
          .join("")
      : '<p class="empty">No completed transactions this shift.</p>';
  } catch (error) {
    toast(error.message, true);
  }
}
document.getElementById("summary-button").addEventListener("click", () => {
  document.getElementById("summary-drawer").classList.remove("hidden");
  loadSummary();
});
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      document.getElementById(button.dataset.close).classList.add("hidden"),
    ),
  );
document.getElementById("pay-order").addEventListener("click", () => {
  if (!cart.length) return toast("Add items before payment.", true);
  document.getElementById("discount-percentage").value = "0";
  document.getElementById("payment-total").textContent = money(total());
  document.getElementById("cash-amount").value = "";
  document.getElementById("change-total").textContent = money(0);
  document.getElementById("payment-error").textContent = "";
  document.getElementById("payment-modal").classList.remove("hidden");
});
document
  .getElementById("payment-methods")
  .addEventListener("click", (event) => {
    const button = event.target.closest("[data-method]");
    if (!button) return;
    paymentMethod = button.dataset.method;
    document
      .querySelectorAll("[data-method]")
      .forEach((row) => row.classList.toggle("active", row === button));
    document.getElementById("cash-amount").disabled = paymentMethod !== "Cash";
    if (paymentMethod !== "Cash") {
      document.getElementById("cash-amount").value =
        discountedTotal().toFixed(2);
      document.getElementById("change-total").textContent = money(0);
    }
  });
document.getElementById("cash-amount").addEventListener("input", (event) => {
  const change = Number(event.target.value || 0) - discountedTotal();
  document.getElementById("change-total").textContent = money(
    Math.max(0, change),
  );
});
document.getElementById("discount-percentage").addEventListener("input", () => {
  const due = discountedTotal();
  document.getElementById("payment-total").textContent = money(due);
  if (paymentMethod !== "Cash")
    document.getElementById("cash-amount").value = due.toFixed(2);
  const change =
    Number(document.getElementById("cash-amount").value || 0) - due;
  document.getElementById("change-total").textContent = money(
    Math.max(0, change),
  );
});
document
  .getElementById("confirm-payment")
  .addEventListener("click", async () => {
    const due = discountedTotal();
    if (
      paymentMethod === "Cash" &&
      Number(document.getElementById("cash-amount").value || 0) < due
    ) {
      document.getElementById("payment-error").textContent =
        "Amount received is less than the total.";
      return;
    }
    try {
      let receipt;
      if (currentHeldId) {
        receipt = await api(`/pos/api/orders/${currentHeldId}/checkout`, {
          method: "POST",
          body: JSON.stringify({
            payment_method: paymentMethod,
            discount_percentage: discountPercentage(),
          }),
        });
      } else {
        receipt = await api("/pos/api/checkout", {
          method: "POST",
          body: JSON.stringify({
            ...payload(),
            payment_method: paymentMethod,
            discount_percentage: discountPercentage(),
          }),
        });
      }
      document.getElementById("payment-modal").classList.add("hidden");
      showReceipt(receipt);
      cart = [];
      currentHeldId = null;
      renderCart();
      loadHeld();
      loadSummary();
    } catch (error) {
      document.getElementById("payment-error").textContent = error.message;
    }
  });
function showReceipt(receipt) {
  const now = new Date(receipt.transaction_date || Date.now());
  const orderLabel =
    receipt.order_type === "dine-in"
      ? `Table ${receipt.table_number || "-"}`
      : "Take Out";
  const employeeName = sessionUser?.full_name || "Owner";
  const subtotal =
    receipt.subtotal ??
    receipt.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const discount = Number(receipt.discount_percentage || 0);
  document.getElementById("receipt-content").innerHTML =
    `<div class="receipt-head"><h2>Scrap-Wise</h2><div>Naic Cavite</div><div>#090909090909</div></div>
    <div class="receipt-rule"></div>
    <div class="receipt-meta"><strong>BILL</strong><br>Order: ${esc(orderLabel)}<br>Employee: Owner<br>POS: ${esc(employeeName)}</div>
    <div class="receipt-rule"></div>
    <div style="text-align:center">${esc(receipt.order_type === "dine-in" ? "Dine In" : "Take Out")}</div>
    <div class="receipt-rule"></div>
    <div class="receipt-items">${receipt.items
      .map(
        (item) =>
          `<div class="receipt-product"><div class="receipt-product-name"><strong>${esc(item.item_name)}</strong><small>${item.quantity} x ${money(item.unit_price)}</small></div><strong>${money(item.subtotal)}</strong></div>`,
      )
      .join("")}</div>
    <div class="receipt-rule"></div>
    <div class="receipt-summary">
      <div class="receipt-line"><strong>SR</strong><strong>${esc(receipt.transaction_code)}</strong></div>
      <div class="receipt-rule"></div>
      <div class="receipt-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
      <div class="receipt-line"><span>Discount%</span><strong>${discount.toFixed(2)}%</strong></div>
      <div class="receipt-line"><strong>Total</strong><strong>${money(receipt.total)}</strong></div>
      <div class="receipt-line"><span>Payment</span><strong>${esc(receipt.payment_method)}</strong></div>
    </div>`;
  document.getElementById("receipt-modal").classList.remove("hidden");
}

document.getElementById("print-receipt").addEventListener("click", () => {
  window.print();
  document.getElementById("receipt-modal").classList.add("hidden");
});

loadSession();
loadMenu();
loadHeld();
loadSummary();
