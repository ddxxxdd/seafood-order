const heroImage = "./assets/seafood-hero.png";

const storageKeys = {
  inventory: "seafood-order.inventory.v1",
  orders: "seafood-order.orders.v1",
};

const products = [
  {
    id: "shrimp",
    name: "南美白虾",
    category: "live",
    status: "鲜活",
    badge: "今日到港",
    desc: "肉质紧实，适合白灼、椒盐或火锅。",
    unit: "500g",
    imageClass: "shrimp",
    specs: [
      { label: "500g", price: 39.8, initialStock: 36 },
      { label: "1kg", price: 76.0, initialStock: 22 },
    ],
  },
  {
    id: "crab",
    name: "帝王蟹腿",
    category: "live",
    status: "热卖",
    badge: "冷鲜优选",
    desc: "蟹肉饱满，家庭宴请和礼盒订单都合适。",
    unit: "份",
    imageClass: "crab",
    specs: [
      { label: "约700g", price: 268.0, initialStock: 12 },
      { label: "约1.2kg", price: 438.0, initialStock: 8 },
    ],
  },
  {
    id: "seabass",
    name: "深海鲈鱼",
    category: "fish",
    status: "低脂",
    badge: "可去鳞去内脏",
    desc: "适合清蒸，支持净膛处理和分切。",
    unit: "条",
    imageClass: "fish",
    specs: [
      { label: "约600g", price: 58.0, initialStock: 28 },
      { label: "约900g", price: 82.0, initialStock: 18 },
    ],
  },
  {
    id: "salmon",
    name: "三文鱼切片",
    category: "ready",
    status: "即食",
    badge: "刺身级",
    desc: "现切装盒，建议当日食用，配送配冰袋。",
    unit: "盒",
    imageClass: "salmon",
    specs: [
      { label: "200g", price: 69.0, initialStock: 30 },
      { label: "400g", price: 128.0, initialStock: 16 },
    ],
  },
  {
    id: "scallop",
    name: "半壳扇贝",
    category: "shell",
    status: "带黄",
    badge: "蒜蓉首选",
    desc: "壳面干净，适合蒸烤，支持按份采购。",
    unit: "份",
    imageClass: "shell",
    specs: [
      { label: "6只", price: 46.0, initialStock: 24 },
      { label: "12只", price: 86.0, initialStock: 14 },
    ],
  },
  {
    id: "clam",
    name: "花蛤",
    category: "shell",
    status: "吐沙",
    badge: "夜宵搭配",
    desc: "已基础吐沙，适合辣炒、煮汤或海鲜粥。",
    unit: "500g",
    imageClass: "clam",
    specs: [
      { label: "500g", price: 18.8, initialStock: 42 },
      { label: "1kg", price: 35.0, initialStock: 26 },
    ],
  },
];

const selectedSpecs = new Map(products.map((product) => [product.id, 0]));
const cart = new Map();

const productGrid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const categoryButtons = document.querySelectorAll("[data-category]");
const cartList = document.querySelector("#cartList");
const cartBadge = document.querySelector("#cartBadge");
const subtotalEl = document.querySelector("#subtotal");
const packFeeEl = document.querySelector("#packFee");
const deliveryFeeEl = document.querySelector("#deliveryFee");
const grandTotalEl = document.querySelector("#grandTotal");
const clearCartBtn = document.querySelector("#clearCart");
const cartJump = document.querySelector("#cartJump");
const form = document.querySelector("#orderForm");
const submitButton = form.querySelector(".submit-order");
const deliveryDate = document.querySelector("#deliveryDate");
const orderStatus = document.querySelector("#orderStatus");
const receiptDialog = document.querySelector("#receiptDialog");
const receiptContent = document.querySelector("#receiptContent");
const closeReceipt = document.querySelector("#closeReceipt");
const finishReceipt = document.querySelector("#finishReceipt");

let activeCategory = "all";
let inventory = getDefaultInventory();
let isSubmitting = false;

const remoteConfig = normalizeRemoteConfig(window.SEAFOOD_ORDER_CONFIG || {});

function normalizeRemoteConfig(config) {
  return {
    supabaseUrl: String(config.supabaseUrl || "").replace(/\/+$/, ""),
    supabaseAnonKey: String(config.supabaseAnonKey || ""),
  };
}

function hasRemoteStorage() {
  return Boolean(remoteConfig.supabaseUrl && remoteConfig.supabaseAnonKey);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTodayString() {
  const today = new Date();
  const offsetDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getProduct(id) {
  return products.find((product) => product.id === id);
}

function getCartKey(productId, specLabel) {
  return `${productId}__${specLabel}`;
}

function getDefaultInventory() {
  return new Map(
    products.flatMap((product) =>
      product.specs.map((spec) => [
        getCartKey(product.id, spec.label),
        {
          key: getCartKey(product.id, spec.label),
          productId: product.id,
          specLabel: spec.label,
          stock: spec.initialStock,
          initialStock: spec.initialStock,
        },
      ])
    )
  );
}

function normalizeInventoryRows(rows) {
  const normalized = getDefaultInventory();

  rows.forEach((row) => {
    const productId = row.product_id || row.productId;
    const specLabel = row.spec_label || row.specLabel;
    const key = row.key || getCartKey(productId, specLabel);
    const base = normalized.get(key);

    if (!base) return;

    normalized.set(key, {
      ...base,
      stock: Number.isFinite(Number(row.stock)) ? Number(row.stock) : base.stock,
      initialStock: Number.isFinite(Number(row.initial_stock || row.initialStock))
        ? Number(row.initial_stock || row.initialStock)
        : base.initialStock,
    });
  });

  return normalized;
}

function inventoryToStorageObject(source = inventory) {
  return Object.fromEntries(
    Array.from(source.values()).map((row) => [
      row.key,
      {
        stock: row.stock,
        initialStock: row.initialStock,
      },
    ])
  );
}

function loadLocalInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.inventory) || "{}");
    return normalizeInventoryRows(
      Object.entries(saved).map(([key, value]) => {
        const [productId, specLabel] = key.split("__");
        return {
          key,
          productId,
          specLabel,
          stock: value.stock,
          initialStock: value.initialStock,
        };
      })
    );
  } catch {
    return getDefaultInventory();
  }
}

function saveLocalInventory() {
  localStorage.setItem(storageKeys.inventory, JSON.stringify(inventoryToStorageObject()));
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${remoteConfig.supabaseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: remoteConfig.supabaseAnonKey,
      Authorization: `Bearer ${remoteConfig.supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || `远端存储请求失败：${response.status}`);
  }

  return data;
}

async function loadRemoteInventory() {
  const rows = await supabaseRequest("/rest/v1/inventory?select=product_id,spec_label,stock,initial_stock");
  return normalizeInventoryRows(rows);
}

function getStock(key) {
  return inventory.get(key)?.stock || 0;
}

function getCartQty(key) {
  return cart.get(key)?.qty || 0;
}

function getAvailableQty(key) {
  return Math.max(0, getStock(key) - getCartQty(key));
}

function getStockText(stock, available) {
  if (stock <= 0) return "售罄";
  if (available <= 0) return "已达库存";
  if (stock <= 5) return `仅剩 ${stock}`;
  return `库存 ${stock}`;
}

function setOrderStatus(message = "", state = "") {
  orderStatus.textContent = message;
  orderStatus.dataset.state = state;
}

function renderProducts() {
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matchesCategory = activeCategory === "all" || product.category === activeCategory;
    const matchesKeyword = [product.name, product.desc, product.badge]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
    return matchesCategory && matchesKeyword;
  });

  productGrid.innerHTML = filtered
    .map((product) => {
      const selectedIndex = selectedSpecs.get(product.id) || 0;
      const selectedSpec = product.specs[selectedIndex];
      const key = getCartKey(product.id, selectedSpec.label);
      const stock = getStock(key);
      const available = getAvailableQty(key);
      const buttonText = stock <= 0 ? "售罄" : available <= 0 ? "已达库存" : "+ 加入";

      return `
        <article class="product-card">
          <div class="product-media">
            <img class="${product.imageClass}" src="${heroImage}" alt="${escapeHtml(product.name)}" />
            <span class="badge">${escapeHtml(product.badge)}</span>
          </div>
          <div class="product-body">
            <div class="product-title">
              <h3>${escapeHtml(product.name)}</h3>
              <span>${escapeHtml(product.status)}</span>
            </div>
            <p class="product-desc">${escapeHtml(product.desc)}</p>
            <div class="spec-options" aria-label="${escapeHtml(product.name)}规格">
              ${product.specs
                .map(
                  (spec, index) => `
                    <button class="${index === selectedIndex ? "active" : ""}" type="button" data-spec="${product.id}" data-index="${index}">
                      ${escapeHtml(spec.label)}
                    </button>
                  `
                )
                .join("")}
            </div>
            <div class="product-footer">
              <div class="price">
                <strong>${formatCurrency(selectedSpec.price)}</strong>
                <small>${escapeHtml(selectedSpec.label)} / ${escapeHtml(product.unit)}</small>
              </div>
              <div class="buy-column">
                <span class="stock-pill ${available <= 0 ? "empty" : ""}">${getStockText(stock, available)}</span>
                <button class="add-btn" type="button" data-add="${product.id}" ${available <= 0 ? "disabled" : ""}>${buttonText}</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  if (!filtered.length) {
    productGrid.innerHTML = `<div class="empty-cart">未找到匹配商品</div>`;
  }
}

function calculateTotals() {
  const subtotal = Array.from(cart.values()).reduce((sum, item) => sum + item.price * item.qty, 0);
  const packFee = subtotal > 0 ? 8 : 0;
  const deliveryFee = subtotal === 0 || subtotal >= 298 ? 0 : 12;
  const grandTotal = subtotal + packFee + deliveryFee;
  return { subtotal, packFee, deliveryFee, grandTotal };
}

function renderCart() {
  const items = Array.from(cart.values());
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  cartBadge.textContent = String(count);

  if (!items.length) {
    cartList.innerHTML = `<div class="empty-cart">购物车为空</div>`;
  } else {
    cartList.innerHTML = items
      .map(
        (item) => `
          <article class="cart-item">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <small>${escapeHtml(item.specLabel)} · ${formatCurrency(item.price)}</small>
            </div>
            <div class="qty-control" aria-label="${escapeHtml(item.name)}数量">
              <button type="button" data-decrease="${item.key}" aria-label="减少">−</button>
              <span>${item.qty}</span>
              <button type="button" data-increase="${item.key}" aria-label="增加" ${getAvailableQty(item.key) <= 0 ? "disabled" : ""}>+</button>
            </div>
            <div class="cart-price">
              <span>小计 ${formatCurrency(item.price * item.qty)}</span>
              <button class="remove-item" type="button" data-remove="${item.key}">删除</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  const totals = calculateTotals();
  subtotalEl.textContent = formatCurrency(totals.subtotal);
  packFeeEl.textContent = formatCurrency(totals.packFee);
  deliveryFeeEl.textContent = totals.deliveryFee === 0 ? "免配送" : formatCurrency(totals.deliveryFee);
  grandTotalEl.textContent = formatCurrency(totals.grandTotal);
}

function addToCart(productId) {
  const product = getProduct(productId);
  const specIndex = selectedSpecs.get(productId) || 0;
  const spec = product.specs[specIndex];
  const key = getCartKey(productId, spec.label);

  if (getAvailableQty(key) <= 0) {
    setOrderStatus("当前规格库存不足", "error");
    return;
  }

  const current = cart.get(key);

  if (current) {
    current.qty += 1;
  } else {
    cart.set(key, {
      key,
      productId,
      name: product.name,
      specLabel: spec.label,
      price: spec.price,
      qty: 1,
    });
  }

  setOrderStatus();
  renderProducts();
  renderCart();
}

function changeQty(key, delta) {
  const item = cart.get(key);
  if (!item) return;

  if (delta > 0 && getAvailableQty(key) <= 0) {
    setOrderStatus("已达到当前库存", "error");
    return;
  }

  item.qty += delta;
  if (item.qty <= 0) {
    cart.delete(key);
  }

  renderProducts();
  renderCart();
}

function validateCartAgainstInventory() {
  for (const item of cart.values()) {
    const stock = getStock(item.key);
    if (item.qty > stock) {
      throw new Error(`${item.name} ${item.specLabel} 库存不足，剩余 ${stock}`);
    }
  }
}

function getLocalOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(storageKeys.orders) || "[]");
    return Array.isArray(orders) ? orders : [];
  } catch {
    return [];
  }
}

function saveLocalOrder(order) {
  const orders = getLocalOrders();
  orders.push(order);
  localStorage.setItem(storageKeys.orders, JSON.stringify(orders));
}

function buildOrderPayload(formData) {
  const totals = calculateTotals();
  return {
    order_id: `SX${Date.now().toString().slice(-8)}`,
    customer: {
      name: formData.get("customerName"),
      phone: formData.get("phone"),
      address: formData.get("address"),
    },
    delivery: {
      date: formData.get("deliveryDate"),
      slot: formData.get("deliverySlot"),
    },
    pay_method: formData.get("payMethod"),
    note: formData.get("note") || "",
    items: Array.from(cart.values()).map((item) => ({
      key: item.key,
      product_id: item.productId,
      name: item.name,
      spec_label: item.specLabel,
      price: item.price,
      qty: item.qty,
    })),
    totals,
  };
}

async function placeLocalOrder(order) {
  validateCartAgainstInventory();

  order.items.forEach((item) => {
    const stockRow = inventory.get(item.key);
    stockRow.stock -= item.qty;
  });

  saveLocalInventory();
  saveLocalOrder({ ...order, created_at: new Date().toISOString() });

  return {
    order_id: order.order_id,
    inventory: Array.from(inventory.values()).map((row) => ({
      product_id: row.productId,
      spec_label: row.specLabel,
      stock: row.stock,
      initial_stock: row.initialStock,
    })),
  };
}

async function placeOrder(order) {
  if (!hasRemoteStorage()) {
    return placeLocalOrder(order);
  }

  return supabaseRequest("/rest/v1/rpc/place_order", {
    method: "POST",
    body: { payload: order },
  });
}

function applyInventoryResult(rows) {
  if (!Array.isArray(rows)) return;
  inventory = normalizeInventoryRows(rows);
}

function buildReceipt(order) {
  const items = order.items.map((item) => `${item.name} ${item.spec_label} × ${item.qty}`).join("、");

  receiptContent.innerHTML = `
    <div class="receipt-summary">
      <div><span>订单号</span><strong>${escapeHtml(order.order_id)}</strong></div>
      <div><span>商品</span><strong>${escapeHtml(items)}</strong></div>
      <div><span>配送</span><strong>${escapeHtml(order.delivery.date)} ${escapeHtml(order.delivery.slot)}</strong></div>
      <div><span>收货人</span><strong>${escapeHtml(order.customer.name)}</strong></div>
      <div><span>支付</span><strong>${escapeHtml(order.pay_method)}</strong></div>
      <div><span>合计</span><strong>${formatCurrency(order.totals.grandTotal)}</strong></div>
    </div>
  `;
}

async function initializeInventory() {
  if (!hasRemoteStorage()) {
    inventory = loadLocalInventory();
    renderProducts();
    renderCart();
    return;
  }

  try {
    inventory = await loadRemoteInventory();
  } catch (error) {
    inventory = loadLocalInventory();
    setOrderStatus(`库存读取失败：${error.message}`, "error");
  }

  renderProducts();
  renderCart();
}

productGrid.addEventListener("click", (event) => {
  const specButton = event.target.closest("[data-spec]");
  const addButton = event.target.closest("[data-add]");

  if (specButton) {
    selectedSpecs.set(specButton.dataset.spec, Number(specButton.dataset.index));
    renderProducts();
  }

  if (addButton && !addButton.disabled) {
    addToCart(addButton.dataset.add);
  }
});

cartList.addEventListener("click", (event) => {
  const increase = event.target.closest("[data-increase]");
  const decrease = event.target.closest("[data-decrease]");
  const remove = event.target.closest("[data-remove]");

  if (increase && !increase.disabled) changeQty(increase.dataset.increase, 1);
  if (decrease) changeQty(decrease.dataset.decrease, -1);
  if (remove) {
    cart.delete(remove.dataset.remove);
    renderProducts();
    renderCart();
  }
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeCategory = button.dataset.category;
    renderProducts();
  });
});

searchInput.addEventListener("input", renderProducts);

clearCartBtn.addEventListener("click", () => {
  cart.clear();
  setOrderStatus();
  renderProducts();
  renderCart();
});

cartJump.addEventListener("click", () => {
  document.querySelector("#checkout").scrollIntoView({ behavior: "smooth", block: "start" });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) return;

  if (!cart.size) {
    cartList.scrollIntoView({ behavior: "smooth", block: "center" });
    setOrderStatus("请先选择至少一件商品", "error");
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const order = buildOrderPayload(new FormData(form));

  try {
    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "提交中";
    setOrderStatus("正在提交订单...", "pending");

    const result = await placeOrder(order);
    order.order_id = result?.order_id || order.order_id;
    applyInventoryResult(result?.inventory);
    buildReceipt(order);

    cart.clear();
    form.reset();
    deliveryDate.value = getTodayString();
    deliveryDate.min = getTodayString();
    renderProducts();
    renderCart();
    setOrderStatus(hasRemoteStorage() ? "订单已保存" : "订单已保存到本地", "success");
    receiptDialog.showModal();
  } catch (error) {
    setOrderStatus(error.message || "订单提交失败", "error");
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
    submitButton.textContent = "提交订单";
  }
});

[closeReceipt, finishReceipt].forEach((button) => {
  button.addEventListener("click", () => {
    receiptDialog.close();
  });
});

deliveryDate.min = getTodayString();
deliveryDate.value = getTodayString();
renderProducts();
renderCart();
initializeInventory();
