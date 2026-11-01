import React, { useEffect, useState } from "react";

const API = "http://192.168.1.10:5000/api/admin";
const SERVER_URL = "http://192.168.1.10:5000";

function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockMode, setStockMode] = useState("add");

  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("shopsphereToken");

  // Fetch all products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API}/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load products");
      }

      const productList = Array.isArray(data)
        ? data
        : data.products || data.data || [];

      setProducts(productList);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Get product ID
  const getProductId = (product) =>
    product.product_id ?? product.id;

  // Get product name
  const getProductName = (product) =>
    product.name ||
    product.product_name ||
    product.title ||
    "Unnamed Product";

  // Get current stock
  const getStock = (product) =>
    Number(
      product.stock_quantity ??
      product.stock ??
      product.quantity ??
      product.available_stock ??
      0
    );

  // Get product image
  const getProductImage = (product) =>
    product.image ||
    product.image_url ||
    product.thumbnail ||
    product.product_image ||
    "";

  // Get stock threshold
  const getThreshold = (product) =>
    Number(
      product.low_stock_threshold ??
      product.low_stock_limit ??
      5
    );

  // Stock status
  const getStatus = (product) => {
    const stock = getStock(product);

    if (stock <= 0) {
      return {
        label: "Out of Stock",
        style: "bg-red-100 text-red-700",
      };
    }

    if (stock <= getThreshold(product)) {
      return {
        label: "Low Stock",
        style: "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      label: "In Stock",
      style: "bg-green-100 text-green-700",
    };
  };

  // Open stock modal
  const openStockModal = (product, mode) => {
    setSelectedProduct(product);
    setStockMode(mode);
    setQuantity("");
    setReason("");
    setMessage("");
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setSelectedProduct(null);
    setQuantity("");
    setReason("");
    setMessage("");
  };

  // Add stock or update stock
  const handleStockSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProduct) return;

    const enteredQuantity = Number(quantity);

    if (
      quantity.trim() === "" ||
      !Number.isFinite(enteredQuantity) ||
      !Number.isInteger(enteredQuantity) ||
      enteredQuantity < 0
    ) {
      setMessage("Please enter a valid whole number.");
      return;
    }

    if (stockMode === "add" && enteredQuantity <= 0) {
      setMessage("Quantity must be greater than zero.");
      return;
    }

    const productId = getProductId(selectedProduct);

    if (productId == null) {
      setMessage("Product ID is missing.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const currentStock = getStock(selectedProduct);

      // Add Stock: calculate new total
      // Update Stock: use entered quantity as final total
      const newStock =
        stockMode === "add"
          ? currentStock + enteredQuantity
          : enteredQuantity;

      const response = await fetch(
        `${API}/inventory/${productId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stock_quantity: newStock,
            reason:
              reason.trim() ||
              (stockMode === "add"
                ? "Stock added"
                : "Stock updated"),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Stock update failed");
      }

      setShowModal(false);
      setSelectedProduct(null);
      setQuantity("");
      setReason("");

      await fetchProducts();
    } catch (err) {
      setMessage(err.message || "Unable to update stock");
    } finally {
      setSaving(false);
    }
  };

  // Search products
  const filteredProducts = products.filter((product) => {
    const searchText = search.toLowerCase().trim();

    return (
      getProductName(product).toLowerCase().includes(searchText) ||
      String(product.sku || "")
        .toLowerCase()
        .includes(searchText) ||
      String(product.product_code || "")
        .toLowerCase()
        .includes(searchText)
    );
  });

  // Summary values
  const totalProducts = products.length;

  const totalStock = products.reduce(
    (total, product) => total + getStock(product),
    0
  );

  const lowStock = products.filter((product) => {
    const stock = getStock(product);

    return stock > 0 && stock <= getThreshold(product);
  }).length;

  const outOfStock = products.filter(
    (product) => getStock(product) <= 0
  ).length;

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-gray-50 p-3 sm:p-5 lg:p-6">

      {/* Page Header */}
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
            Inventory Management
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage products and stock quantities.
          </p>
        </div>

        <button
          onClick={fetchProducts}
          disabled={loading}
          className="flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 sm:self-auto"
        >
          <i
            className={`fa-solid fa-rotate-right ${
              loading ? "animate-spin" : ""
            }`}
          ></i>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="flex h-28 min-w-0 items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-500">
              Total Products
            </p>
            <h2 className="mt-2 text-3xl font-bold text-cyprus">
              {totalProducts}
            </h2>
          </div>

          <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aqua-spring text-cyprus">
            <i className="fa-solid fa-boxes-stacked text-xl"></i>
          </div>
        </div>

        <div className="flex h-28 min-w-0 items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-500">
              Total Stock Units
            </p>
            <h2 className="mt-2 text-3xl font-bold text-ocean-green">
              {totalStock}
            </h2>
          </div>

          <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-ocean-green">
            <i className="fa-solid fa-cubes-stacked text-xl"></i>
          </div>
        </div>

        <div className="flex h-28 min-w-0 items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-500">
              Low Stock Products
            </p>
            <h2 className="mt-2 text-3xl font-bold text-yellow-600">
              {lowStock}
            </h2>
          </div>

          <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          </div>
        </div>

        <div className="flex h-28 min-w-0 items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-500">
              Out of Stock
            </p>
            <h2 className="mt-2 text-3xl font-bold text-red-600">
              {outOfStock}
            </h2>
          </div>

          <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <i className="fa-solid fa-box-open text-xl"></i>
          </div>
        </div>

      </div>

      {/* Inventory Table Card */}
      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">

        {/* Table Toolbar */}
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-cyprus">
              All Products Stock
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View and manage every product's stock.
            </p>
          </div>

          <div className="relative w-full sm:w-72 sm:shrink-0">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or SKU..."
              className="h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="m-4 flex flex-col gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>

            <button
              onClick={fetchProducts}
              className="shrink-0 font-semibold underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner animate-spin text-3xl text-ocean-green"></i>
            <p className="text-sm">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
              <i className="fa-solid fa-box-open text-2xl"></i>
            </div>

            <h3 className="mt-4 font-semibold text-gray-700">
              No products found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try another search or add products first.
            </p>
          </div>
        ) : (
          /* Fixed Table */
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[950px] table-fixed border-collapse text-left">

              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>

              <thead className="h-14 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 sm:text-sm">
                <tr>
                  <th className="px-4 font-semibold">
                    Product
                  </th>
                  <th className="px-4 font-semibold">
                    SKU
                  </th>
                  <th className="px-4 font-semibold">
                    Current Stock
                  </th>
                  <th className="px-4 font-semibold">
                    Status
                  </th>
                  <th className="px-4 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => {
                  const stock = getStock(product);
                  const status = getStatus(product);
                  const name = getProductName(product);
                  const image = getProductImage(product);
                  const productId = getProductId(product);
                  const sku =
                    product.sku || product.product_code || "-";

                  const imageUrl = image
                    ? image.startsWith("http")
                      ? image
                      : `${SERVER_URL}${
                          image.startsWith("/")
                            ? image
                            : `/${image}`
                        }`
                    : "";

                  return (
                    <tr
                      key={productId}
                      className="h-[88px] transition hover:bg-gray-50"
                    >
                      {/* Product Column */}
                      <td className="overflow-hidden px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={name}
                              className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                              <i className="fa-solid fa-box text-xl"></i>
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p
                              title={name}
                              className="truncate text-sm font-semibold text-gray-800"
                            >
                              {name}
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-500">
                              ID: {productId ?? "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* SKU Column */}
                      <td className="overflow-hidden px-4">
                        <span
                          title={sku}
                          className="block truncate text-sm text-gray-600"
                        >
                          {sku}
                        </span>
                      </td>

                      {/* Stock Column */}
                      <td className="px-4">
                        <div className="whitespace-nowrap">
                          <span className="text-xl font-bold text-cyprus">
                            {stock}
                          </span>

                          <span className="ml-1 text-xs text-gray-500">
                            units
                          </span>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="px-4">
                        <span
                          className={`inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold ${status.style}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      {/* Action Column */}
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              openStockModal(product, "add")
                            }
                            title="Add stock quantity"
                            className="flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-ocean-green px-3 text-xs font-semibold text-white transition hover:opacity-90"
                          >
                            <i className="fa-solid fa-plus mr-1.5"></i>
                            Add Stock
                          </button>

                          <button
                            onClick={() =>
                              openStockModal(product, "update")
                            }
                            title="Set current stock"
                            className="flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-cyprus bg-white px-3 text-xs font-semibold text-cyprus transition hover:bg-aqua-spring"
                          >
                            <i className="fa-solid fa-pen-to-square mr-1.5"></i>
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

        {/* Table Footer */}
        {!loading && (
          <div className="flex min-h-14 flex-col justify-center gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p>
              Showing{" "}
              <span className="font-semibold text-gray-700">
                {filteredProducts.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700">
                {products.length}
              </span>{" "}
              products
            </p>

            <p className="text-xs">
              Inventory Management
            </p>
          </div>
        )}

      </div>

      {/* Add Stock / Update Stock Modal */}
      {showModal && selectedProduct && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">

            {/* Modal Header */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-cyprus">
                  {stockMode === "add"
                    ? "Add Stock"
                    : "Update Stock"}
                </h2>

                <p className="mt-1 truncate text-sm text-gray-500">
                  {getProductName(selectedProduct)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Current Stock */}
            <div className="mb-5 flex items-center justify-between rounded-xl bg-aqua-spring p-4">
              <div>
                <p className="text-sm text-gray-600">
                  Current Stock
                </p>

                <p className="mt-1 text-2xl font-bold text-cyprus">
                  {getStock(selectedProduct)} units
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-ocean-green">
                <i className="fa-solid fa-boxes-stacked text-xl"></i>
              </div>
            </div>

            {/* Stock Form */}
            <form
              onSubmit={handleStockSubmit}
              className="space-y-4"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  {stockMode === "add"
                    ? "Quantity to Add"
                    : "New Total Stock"}
                </label>

                <input
                  type="number"
                  min={stockMode === "add" ? "1" : "0"}
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={
                    stockMode === "add"
                      ? "Enter quantity to add"
                      : "Enter final stock quantity"
                  }
                  className="h-12 w-full rounded-lg border border-gray-300 px-4 outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                />

                {stockMode === "add" && quantity !== "" && (
                  <p className="mt-2 text-sm font-medium text-ocean-green">
                    New stock:{" "}
                    {getStock(selectedProduct) +
                      (Number(quantity) || 0)}{" "}
                    units
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Reason
                  <span className="ml-1 font-normal text-gray-400">
                    (Optional)
                  </span>
                </label>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. New shipment, stock correction"
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                />
              </div>

              {message && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-11 flex-1 rounded-lg border border-gray-300 px-4 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 flex-1 rounded-lg bg-ocean-green px-4 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <i className="fa-solid fa-spinner mr-2 animate-spin"></i>
                      Saving...
                    </>
                  ) : stockMode === "add" ? (
                    <>
                      <i className="fa-solid fa-plus mr-2"></i>
                      Add Stock
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check mr-2"></i>
                      Update Stock
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

export default Inventory;