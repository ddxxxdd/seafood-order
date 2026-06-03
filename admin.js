const storageKeys = {
  inventory: "seafood-order.inventory.v1",
  orders: "seafood-order.orders.v1",
};

const inventoryDefaults = [
  ["南美白虾", "shrimp", "500g", 36],
  ["南美白虾", "shrimp", "1kg", 22],
  ["帝王蟹腿", "crab", "约700g", 12],
  ["帝王蟹腿", "crab", "约1.2kg", 8],
  ["深海鲈鱼", "seabass", "约600g", 28],
  ["深海鲈鱼", "seabass", "约900g", 18],
  ["三文鱼切片", "salmon", "200g", 30],
  ["三文鱼切片", "salmon", "400g", 16],
  ["半壳扇贝", "scallop", "6只", 24],
  ["半壳扇贝", "scallop", "12只", 14],
  ["花蛤", "clam", "500g", 42],
  ["花蛤", "clam", "1kg", 26],
];

const inventoryRows = document.querySelector("#inventoryRows");
const adminStatus = document.querySelector("#adminStatus");
const adminToken = document.querySelector("#adminToken");
const refreshInventory = document.querySelector("#refreshInventory");
const resetLocal = document.querySelector("#resetLocal");
const resetRemote = document.querySelector("#resetRemote");

const remoteConfig = {
  supabaseUrl: String(window.SEAFOOD_ORDER_CONFIG?.supabaseUrl || "").replace(/\/+$/, ""),
  supabaseAnonKey: String(window.SEAFOOD_ORDER_CONFIG?.supabaseAnonKey || ""),
};

function hasRemoteStorage() {
  return Boolean(remoteConfig.supabaseUrl && remoteConfig.supabaseAnonKey);
}

function getCartKey(productId, specLabel) {
  return `${productId}__${specLabel}`;
}

function setStatus(message = "", state = "") {
  adminStatus.textContent = message;
  adminStatus.dataset.state = state;
}

function getDefaultInventoryObject() {
  return Object.fromEntries(
    inventoryDefaults.map(([, productId, specLabel, stock]) => [
      getCartKey(productId, specLabel),
      { stock, initialStock: stock },
    ])
  );
}

function readLocalInventory() {
  try {
    return { ...getDefaultInventoryObject(), ...JSON.parse(localStorage.getItem(storageKeys.inventory) || "{}") };
  } catch {
    return getDefaultInventoryObject();
  }
}

function renderInventory(rows) {
  const rowMap = new Map(rows.map((row) => [getCartKey(row.product_id, row.spec_label), row]));

  inventoryRows.innerHTML = inventoryDefaults
    .map(([name, productId, specLabel, initialStock]) => {
      const remoteRow = rowMap.get(getCartKey(productId, specLabel));
      const stock = remoteRow?.stock ?? readLocalInventory()[getCartKey(productId, specLabel)]?.stock ?? initialStock;

      return `
        <tr>
          <td>${name}</td>
          <td>${specLabel}</td>
          <td>${stock}</td>
          <td>${remoteRow?.initial_stock ?? initialStock}</td>
        </tr>
      `;
    })
    .join("");
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
    throw new Error(data?.message || data?.hint || `远端请求失败：${response.status}`);
  }

  return data;
}

async function loadInventory() {
  if (!hasRemoteStorage()) {
    renderInventory([]);
    setStatus("当前为本地数据", "pending");
    return;
  }

  const rows = await supabaseRequest("/rest/v1/inventory?select=product_id,spec_label,stock,initial_stock");
  renderInventory(rows);
  setStatus("远端库存已刷新", "success");
}

resetLocal.addEventListener("click", () => {
  localStorage.removeItem(storageKeys.orders);
  localStorage.setItem(storageKeys.inventory, JSON.stringify(getDefaultInventoryObject()));
  renderInventory([]);
  setStatus("本地订单已清空，库存已恢复", "success");
});

resetRemote.addEventListener("click", async () => {
  if (!hasRemoteStorage()) {
    setStatus("请先配置 Supabase", "error");
    return;
  }

  if (!adminToken.value.trim()) {
    setStatus("请输入远端管理密钥", "error");
    return;
  }

  try {
    resetRemote.disabled = true;
    setStatus("正在重置远端数据...", "pending");
    const result = await supabaseRequest("/rest/v1/rpc/reset_launch_data", {
      method: "POST",
      body: { admin_token: adminToken.value.trim() },
    });
    renderInventory(result?.inventory || []);
    setStatus("远端订单已清空，库存已恢复", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    resetRemote.disabled = false;
  }
});

refreshInventory.addEventListener("click", () => {
  loadInventory().catch((error) => setStatus(error.message, "error"));
});

loadInventory().catch((error) => setStatus(error.message, "error"));
