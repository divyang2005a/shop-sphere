import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://192.168.1.20:5000/api/admin";
const ITEMS_PER_PAGE = 5;

const statusStyles = {
  delivered: "bg-green-100 text-green-700",
  processing: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  shipped: "bg-purple-100 text-purple-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

function ReportsAnalytics() {
  const [dateRange, setDateRange] = useState("30 Days");
  const [orderSearch, setOrderSearch] = useState("");

  const [salesReport, setSalesReport] = useState(null);
  const [ordersReport, setOrdersReport] = useState(null);
  const [productsReport, setProductsReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination states
  const [ordersPage, setOrdersPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);

  // --------------------------------------------------
  // Authentication headers
  // --------------------------------------------------

  const getHeaders = useCallback(() => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("shopsphereToken");

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // --------------------------------------------------
  // Currency formatter
  // --------------------------------------------------

  const formatCurrency = (amount) => {
    const value = Number(amount);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  };

  const formatNumber = (value) => {
    const number = Number(value);

    return new Intl.NumberFormat("en-IN").format(
      Number.isFinite(number) ? number : 0
    );
  };

  // --------------------------------------------------
  // Date range
  // --------------------------------------------------

  const getDateRange = useCallback(() => {
    const end = new Date();
    const start = new Date(end);

    if (dateRange === "7 Days") {
      start.setDate(start.getDate() - 6);
    } else if (dateRange === "30 Days") {
      start.setDate(start.getDate() - 29);
    } else {
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
    }

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    return {
      start_date: formatDate(start),
      end_date: formatDate(end),
    };
  }, [dateRange]);

  // --------------------------------------------------
  // Fetch reports
  // --------------------------------------------------

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { start_date, end_date } = getDateRange();

      const query = new URLSearchParams({
        start_date,
        end_date,
      }).toString();

      const headers = getHeaders();

      const endpoints = [
        `${API_BASE_URL}/reports/sales?${query}`,
        `${API_BASE_URL}/reports/orders?${query}`,
        `${API_BASE_URL}/reports/products`,
        `${API_BASE_URL}/reports/inventory?${query}`,
        `${API_BASE_URL}/dashboard`,
      ];

      const responses = await Promise.all(
        endpoints.map((url) =>
          fetch(url, {
            method: "GET",
            headers,
          })
        )
      );

      const failedResponse = responses.find(
        (response) => !response.ok
      );

      if (failedResponse) {
        if (failedResponse.status === 401) {
          throw new Error(
            "Authentication failed. Please log in again."
          );
        }

        if (failedResponse.status === 403) {
          throw new Error(
            "You do not have permission to view these reports."
          );
        }

        throw new Error(
          `Failed to load reports. Server returned ${failedResponse.status}.`
        );
      }

      const [
        salesData,
        ordersData,
        productsData,
        inventoryData,
        dashboardData,
      ] = await Promise.all(
        responses.map((response) => response.json())
      );

      if (
        !salesData.success ||
        !ordersData.success ||
        !productsData.success ||
        !inventoryData.success ||
        !dashboardData.success
      ) {
        throw new Error(
          "The server could not load all report data."
        );
      }

      setSalesReport(salesData.data);
      setOrdersReport(ordersData.data);
      setProductsReport(productsData.data);
      setInventoryReport(inventoryData.data);
      setDashboard(dashboardData.data);
    } catch (err) {
      console.error("Reports Analytics error:", err);

      setError(
        err.message ||
          "Unable to load reports. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [getDateRange, getHeaders]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Reset pagination when date range changes
  useEffect(() => {
    setOrdersPage(1);
    setProductsPage(1);
    setInventoryPage(1);
  }, [dateRange]);

  // Reset orders pagination when search changes
  useEffect(() => {
    setOrdersPage(1);
  }, [orderSearch]);

  // --------------------------------------------------
  // Safe report data
  // --------------------------------------------------

  const salesSummary = salesReport?.summary || {};
  const productSummary = productsReport?.summary || {};
  const inventorySummary = inventoryReport?.summary || {};

  const recentOrders = dashboard?.recent_orders || [];
  const products = productsReport?.products || [];
  const movements = inventoryReport?.movements || [];

  // --------------------------------------------------
  // Search recent orders
  // --------------------------------------------------

  const filteredOrders = useMemo(() => {
    const search = orderSearch.trim().toLowerCase();

    if (!search) {
      return recentOrders;
    }

    return recentOrders.filter((order) => {
      const orderId = String(
        order.order_number || order.id || ""
      ).toLowerCase();

      const customer = String(
        order.customer_name ||
          order.user_name ||
          order.name ||
          ""
      ).toLowerCase();

      return (
        orderId.includes(search) ||
        customer.includes(search)
      );
    });
  }, [recentOrders, orderSearch]);

  // --------------------------------------------------
  // Pagination calculations
  // --------------------------------------------------

  const totalOrderPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)
  );

  const totalProductPages = Math.max(
    1,
    Math.ceil(products.length / ITEMS_PER_PAGE)
  );

  const totalInventoryPages = Math.max(
    1,
    Math.ceil(movements.length / ITEMS_PER_PAGE)
  );

  // Keep current pages valid when data changes
  useEffect(() => {
    setOrdersPage((page) =>
      Math.min(page, totalOrderPages)
    );
  }, [totalOrderPages]);

  useEffect(() => {
    setProductsPage((page) =>
      Math.min(page, totalProductPages)
    );
  }, [totalProductPages]);

  useEffect(() => {
    setInventoryPage((page) =>
      Math.min(page, totalInventoryPages)
    );
  }, [totalInventoryPages]);

  // Recent Orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (ordersPage - 1) * ITEMS_PER_PAGE;

    return filteredOrders.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [filteredOrders, ordersPage]);

  // Products
  const paginatedProducts = useMemo(() => {
    const startIndex = (productsPage - 1) * ITEMS_PER_PAGE;

    return products.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [products, productsPage]);

  // Inventory movements
  const paginatedMovements = useMemo(() => {
    const startIndex =
      (inventoryPage - 1) * ITEMS_PER_PAGE;

    return movements.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [movements, inventoryPage]);

  // --------------------------------------------------
  // CSV export
  // --------------------------------------------------

  const exportCSV = () => {
    const rows = [
      [
        "Order ID",
        "Customer",
        "Date",
        "Amount (INR)",
        "Payment Status",
        "Order Status",
      ],

      ...filteredOrders.map((order) => [
        order.order_number || order.id || "",
        order.customer_name ||
          order.user_name ||
          order.name ||
          "Customer",
        order.created_at
          ? new Date(order.created_at).toLocaleDateString(
              "en-IN"
            )
          : "",
        order.total_amount ?? 0,
        order.payment_status || "",
        order.order_status || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "shopsphere-reports.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------
  // Chart data
  // --------------------------------------------------

  const chartData = useMemo(() => {
    const dailySales = salesReport?.daily_sales || [];

    return [...dailySales]
      .sort(
        (a, b) =>
          new Date(a.sale_date) - new Date(b.sale_date)
      )
      .map((item) => ({
        label: item.sale_date
          ? new Date(
              `${String(item.sale_date).slice(0, 10)}T00:00:00`
            ).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })
          : "N/A",
        revenue: Number(item.paid_revenue || 0),
        orders: Number(item.total_orders || 0),
      }));
  }, [salesReport]);

  const maxRevenue = Math.max(
    ...chartData.map((item) => item.revenue),
    1
  );

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-cyprus" />

          <p className="mt-4 text-sm font-medium text-gray-600">
            Loading reports and analytics...
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Error state
  // --------------------------------------------------

  if (error) {
    return (
      <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
            Reports & Analytics
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Track your store performance and business growth.
          </p>
        </div>

        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <i className="fa-solid fa-triangle-exclamation text-xl" />
          </div>

          <h2 className="mt-4 text-lg font-bold text-gray-800">
            Unable to load reports
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            {error}
          </p>

          <button
            onClick={fetchReports}
            className="mt-5 rounded-xl bg-cyprus px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <i className="fa-solid fa-rotate-right mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Main UI
  // --------------------------------------------------

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}

      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
            Reports & Analytics
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Track your store performance and business growth.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={dateRange}
            onChange={(event) =>
              setDateRange(event.target.value)
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyprus"
            aria-label="Select report date range"
          >
            <option>7 Days</option>
            <option>30 Days</option>
            <option>12 Months</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <i className="fa-solid fa-download" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Paid Revenue"
          value={formatCurrency(salesSummary.paid_revenue)}
          icon="fa-indian-rupee-sign"
          iconColor="bg-green-100 text-green-600"
        />

        <StatCard
          title="Total Orders"
          value={formatNumber(salesSummary.total_orders)}
          icon="fa-bag-shopping"
          iconColor="bg-blue-100 text-blue-600"
        />

        <StatCard
          title="Paid Orders"
          value={formatNumber(salesSummary.paid_orders)}
          icon="fa-credit-card"
          iconColor="bg-purple-100 text-purple-600"
        />

        <StatCard
          title="Average Order Value"
          value={formatCurrency(
            Number(salesSummary.total_orders || 0) > 0
              ? Number(salesSummary.total_order_value || 0) /
                  Number(salesSummary.total_orders)
              : 0
          )}
          icon="fa-chart-line"
          iconColor="bg-orange-100 text-orange-600"
        />
      </div>

      {/* Inventory Summary */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          title="Total Products"
          value={productSummary.total_products}
          icon="fa-box"
        />

        <MiniStat
          title="Total Stock Units"
          value={productSummary.total_stock_units}
          icon="fa-warehouse"
        />

        <MiniStat
          title="Low Stock Products"
          value={productSummary.low_stock_products}
          icon="fa-triangle-exclamation"
          warning
        />

        <MiniStat
          title="Out of Stock"
          value={productSummary.out_of_stock_products}
          icon="fa-box-open"
          warning
        />
      </div>

      {/* Sales Chart */}

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-cyprus">
              Sales Overview
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Paid revenue for the selected period
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-3 w-3 rounded-full bg-brand-primary" />
            Paid Revenue
          </div>
        </div>

        {chartData.length === 0 ? (
          <EmptyState message="No sales data available for this period." />
        ) : (
          <>
            <div className="flex h-64 gap-3 sm:h-72">
              <div className="flex flex-col justify-between pb-7 text-xs text-gray-400">
                <span>{formatCurrency(maxRevenue)}</span>
                <span>{formatCurrency(maxRevenue * 0.75)}</span>
                <span>{formatCurrency(maxRevenue * 0.5)}</span>
                <span>{formatCurrency(maxRevenue * 0.25)}</span>
                <span>₹0</span>
              </div>

              <div className="relative flex min-w-0 flex-1 items-end justify-around gap-2 border-b border-l border-gray-200 px-2">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-7">
                  {[1, 2, 3, 4].map((line) => (
                    <div
                      key={line}
                      className="w-full border-t border-dashed border-gray-100"
                    />
                  ))}
                </div>

                {chartData.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-2 max-w-full truncate text-[10px] font-semibold text-gray-500 sm:text-xs">
                      {formatCurrency(item.revenue)}
                    </span>

                    <div
                      title={`${item.label}: ${formatCurrency(item.revenue)} | ${item.orders} orders`}
                      className="w-full max-w-12 rounded-t-lg bg-brand-primary transition-all duration-300 hover:opacity-75"
                      style={{
                        height: `${Math.max(
                          (item.revenue / maxRevenue) * 100,
                          2
                        )}%`,
                        minHeight: "5px",
                      }}
                    />

                    <span className="absolute -bottom-6 max-w-full truncate text-[10px] text-gray-500 sm:text-xs">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-10 text-xs text-gray-400">
              Chart uses the daily paid revenue returned by your backend.
            </p>
          </>
        )}
      </div>

      {/* Order and Payment Analytics */}

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportBreakdown
          title="Orders by Status"
          subtitle="Order distribution from your database"
          rows={ordersReport?.by_order_status || []}
          labelKey="order_status"
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
        />

        <ReportBreakdown
          title="Payments by Status"
          subtitle="Payment distribution from your database"
          rows={ordersReport?.by_payment_status || []}
          labelKey="payment_status"
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* Product and Inventory Report */}

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-cyprus">
            Product & Inventory Report
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Products ranked by current stock level and units sold.
          </p>
        </div>

        {products.length === 0 ? (
          <EmptyState message="No products found." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="rounded-l-lg px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Base Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Units Sold</th>
                    <th className="rounded-r-lg px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.map((product, index) => (
                    <tr
                      key={product.id ?? index}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-spring font-bold text-cyprus">
                            {(productsPage - 1) *
                              ITEMS_PER_PAGE +
                              index +
                              1}
                          </div>

                          <span className="font-medium text-gray-800">
                            {product.title || "Unnamed Product"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-500">
                        {product.sku || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-700">
                        {formatCurrency(
                          product.sale_price ??
                            product.base_price ??
                            0
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                        {formatNumber(product.stock_quantity)}
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                        {formatNumber(product.total_sold)}
                      </td>

                      <td className="px-4 py-4">
                        <ProductStockBadge product={product} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={productsPage}
              totalPages={totalProductPages}
              onPageChange={setProductsPage}
              totalItems={products.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Backend currently returns a maximum of 100 products.
        </p>
      </div>

      {/* Inventory Movements */}

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-cyprus">
            Inventory Movement Summary
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Stock movements for the selected date range.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniStat
            title="Total Movements"
            value={inventorySummary.total_movements}
            icon="fa-arrows-rotate"
          />

          <MiniStat
            title="Stock Added"
            value={inventorySummary.positive_quantity_total}
            icon="fa-arrow-trend-up"
          />

          <MiniStat
            title="Stock Removed"
            value={inventorySummary.negative_quantity_total}
            icon="fa-arrow-trend-down"
            warning
          />
        </div>

        {movements.length === 0 ? (
          <EmptyState message="No inventory movements found." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedMovements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 text-sm font-medium text-gray-800">
                        {movement.product_title || "Product"}
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-600">
                        {movement.type || "—"}
                      </td>

                      <td
                        className={`px-4 py-4 text-sm font-semibold ${
                          Number(movement.quantity) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {Number(movement.quantity) > 0 ? "+" : ""}
                        {formatNumber(movement.quantity)}
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-600">
                        {movement.reference_type || "—"}
                        {movement.reference_id
                          ? ` #${movement.reference_id}`
                          : ""}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                        {movement.created_at
                          ? new Date(
                              movement.created_at
                            ).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={inventoryPage}
              totalPages={totalInventoryPages}
              onPageChange={setInventoryPage}
              totalItems={movements.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>

      {/* Recent Orders */}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-cyprus">
              Recent Orders
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              A quick look at your latest orders.
            </p>
          </div>

          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              value={orderSearch}
              onChange={(event) =>
                setOrderSearch(event.target.value)
              }
              placeholder="Search orders..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyprus sm:w-64"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <EmptyState message="No orders found." />
        ) : (
          <>
            {/* Desktop table */}

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Order ID</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedOrders.map((order, index) => (
                    <tr
                      key={order.id ?? index}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4 font-semibold text-brand-primary">
                        {order.order_number || `#${order.id}`}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {order.customer_name ||
                          order.user_name ||
                          order.name ||
                          "Customer"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                        {order.created_at
                          ? new Date(
                              order.created_at
                            ).toLocaleDateString("en-IN")
                          : "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-800">
                        {formatCurrency(order.total_amount)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={order.payment_status || "Unknown"}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={order.order_status || "Unknown"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}

            <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
              {paginatedOrders.map((order, index) => (
                <div
                  key={order.id ?? index}
                  className="rounded-xl border border-gray-100 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-brand-primary">
                      {order.order_number || `#${order.id}`}
                    </span>

                    <StatusBadge
                      status={order.order_status || "Unknown"}
                    />
                  </div>

                  <p className="font-medium text-gray-800">
                    {order.customer_name ||
                      order.user_name ||
                      order.name ||
                      "Customer"}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-500">
                      {order.created_at
                        ? new Date(
                            order.created_at
                          ).toLocaleDateString("en-IN")
                        : "—"}
                    </span>

                    <span className="font-bold text-cyprus">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              currentPage={ordersPage}
              totalPages={totalOrderPages}
              onPageChange={setOrdersPage}
              totalItems={filteredOrders.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// Summary Card
// --------------------------------------------------

function StatCard({ title, value, icon, iconColor }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{title}</p>

          <h3 className="mt-2 break-words text-xl font-bold text-cyprus sm:text-2xl">
            {value}
          </h3>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconColor}`}
        >
          <i className={`fa-solid ${icon} text-lg`} />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Small Summary Card
// --------------------------------------------------

function MiniStat({ title, value, icon, warning = false }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{title}</p>

          <p
            className={`mt-2 break-words text-xl font-bold ${
              warning ? "text-orange-600" : "text-cyprus"
            }`}
          >
            {value == null
              ? "—"
              : new Intl.NumberFormat("en-IN").format(
                  Number(value) || 0
                )}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            warning
              ? "bg-orange-100 text-orange-600"
              : "bg-aqua-spring text-cyprus"
          }`}
        >
          <i className={`fa-solid ${icon}`} />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Status Badge
// --------------------------------------------------

function StatusBadge({ status }) {
  const normalizedStatus = String(
    status || "Unknown"
  ).toLowerCase();

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        statusStyles[normalizedStatus] ||
        "bg-gray-100 text-gray-600"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

// --------------------------------------------------
// Product Stock Badge
// --------------------------------------------------

function ProductStockBadge({ product }) {
  const stock = Number(product.stock_quantity || 0);
  const threshold = Number(
    product.low_stock_threshold || 0
  );

  let label =
    product.stock_status || product.status || "Available";

  let style = "bg-green-100 text-green-700";

  if (stock <= 0) {
    label = "Out of Stock";
    style = "bg-red-100 text-red-700";
  } else if (stock <= threshold) {
    label = "Low Stock";
    style = "bg-orange-100 text-orange-700";
  }

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}

// --------------------------------------------------
// Report Breakdown
// --------------------------------------------------

function ReportBreakdown({
  title,
  subtitle,
  rows,
  labelKey,
  formatNumber,
  formatCurrency,
}) {
  const maxOrders = Math.max(
    ...rows.map((row) => Number(row.total_orders || 0)),
    1
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-cyprus">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {subtitle}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No report data available." />
      ) : (
        <div className="space-y-4">
          {rows.map((row, index) => {
            const label = String(
              row[labelKey] || "Unknown"
            );

            const count = Number(row.total_orders || 0);
            const percentage = (count / maxOrders) * 100;

            return (
              <div key={`${label}-${index}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium capitalize text-gray-700">
                    {label.replace(/_/g, " ")}
                  </span>

                  <span className="text-sm font-semibold text-cyprus">
                    {formatNumber(count)} orders
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <p className="mt-1 text-right text-xs text-gray-500">
                  {formatCurrency(row.total_order_value || 0)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// Reusable Pagination
// --------------------------------------------------

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}) {
  if (totalItems === 0) {
    return null;
  }

  const startItem =
    (currentPage - 1) * itemsPerPage + 1;

  const endItem = Math.min(
    currentPage * itemsPerPage,
    totalItems
  );

  return (
    <div className="m-4 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-4 sm:flex-row">
      <p className="text-center text-sm text-gray-500 sm:text-left">
        Showing{" "}
        <span className="font-semibold text-cyprus">
          {startItem}-{endItem}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-cyprus">
          {totalItems}
        </span>
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onPageChange(currentPage - 1)
            }
            disabled={currentPage === 1}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="fa-solid fa-chevron-left mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          <span className="whitespace-nowrap px-2 text-sm font-semibold text-cyprus">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              onPageChange(currentPage + 1)
            }
            disabled={currentPage === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
            <i className="fa-solid fa-chevron-right ml-1 sm:ml-2" />
          </button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// Empty State
// --------------------------------------------------

function EmptyState({ message }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <i className="fa-solid fa-inbox text-xl" />
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {message}
      </p>
    </div>
  );
}

export default ReportsAnalytics;