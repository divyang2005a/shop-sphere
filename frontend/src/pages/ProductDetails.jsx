import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";

const API_BASE_URL = "http://192.168.1.10:5000";
const API_URL = `${API_BASE_URL}/api`;

const FALLBACK_IMAGE =
  "https://placehold.co/700x700/f3f4f6/64748b?text=Product";

const getToken = () => localStorage.getItem("shopsphereToken");

const getHeaders = (json = false) => {
  const headers = { Accept: "application/json" };
  const token = getToken();

  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";

  return headers;
};

const getId = (p) =>
  p?.product_id ?? p?.productId ?? p?.id ?? p?._id ?? null;

const getName = (p) =>
  p?.name ?? p?.product_name ?? p?.title ?? p?.productName ?? "Product";

const getPrice = (p) =>
  Number(
    p?.sale_price ??
      p?.selling_price ??
      p?.sellingPrice ??
      p?.discount_price ??
      p?.price ??
      p?.base_price ??
      0
  );

const getRegularPrice = (p) =>
  Number(
    p?.regular_price ??
      p?.original_price ??
      p?.mrp ??
      p?.base_price ??
      p?.price ??
      getPrice(p)
  );

const normalizeDescription = (value) => {
  if (value == null) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDescription(item))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof value === "object") {
    const nested =
      value.text ??
      value.value ??
      value.description ??
      value.short_description ??
      value.long_description ??
      value.product_description ??
      value.content ??
      "";

    return normalizeDescription(nested);
  }

  return String(value).trim();
};

const getDescription = (p) =>
  normalizeDescription(
    p?.description ??
      p?.long_description ??
      p?.short_description ??
      p?.product_description
  ) || "No product description is available.";

const getImageUrl = (image) => {
  if (!image) return "";

  if (typeof image === "object") {
    image =
      image.image_url ??
      image.imageUrl ??
      image.url ??
      image.image ??
      image.path ??
      image.file_path;
  }

  if (typeof image !== "string" || !image.trim()) return "";

  if (/^(https?:\/\/|data:|blob:)/i.test(image)) return image;

  return `${API_BASE_URL}/${image.replace(/^\/+/, "")}`;
};

const getProductImages = (p) => {
  const sources = [
    ...(Array.isArray(p?.images) ? p.images : []),
    ...(Array.isArray(p?.product_images) ? p.product_images : []),
    p?.image,
    p?.image_url,
    p?.imageUrl,
    p?.thumbnail,
    p?.primary_image,
  ];

  return [...new Set(sources.map(getImageUrl).filter(Boolean))];
};

const getList = (data) => {
  if (Array.isArray(data)) return data;

  for (const key of ["product", "products", "data", "result", "rows"]) {
    const value = data?.[key];

    if (Array.isArray(value)) return value;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (key === "product") return [value];

      for (const nested of ["product", "products", "rows", "data"]) {
        if (Array.isArray(value[nested])) return value[nested];
      }
    }
  }

  return [];
};

const getStock = (p) => {
  const value =
    p?.stock_quantity ??
    p?.quantity_in_stock ??
    p?.stock ??
    p?.quantity ??
    p?.inventory ??
    p?.available_quantity;

  return value === undefined || value === null ? null : Number(value);
};

const getCategory = (p) =>
  p?.category_name ??
  p?.category?.name ??
  p?.category ??
  p?.categoryName ??
  "General";

const getSubcategory = (p) =>
  p?.subcategory_name ??
  p?.subcategory?.name ??
  p?.subcategory ??
  p?.sub_category ??
  "Not specified";

const getBrand = (p) =>
  p?.brand_name ?? p?.brand?.name ?? p?.brand ?? "Not specified";

const getRating = (p) =>
  Number(p?.average_rating ?? p?.rating_average ?? p?.rating ?? 0);

const getReviewCount = (p) =>
  Number(p?.review_count ?? p?.total_reviews ?? p?.reviews_count ?? 0);

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function Stars({ rating = 0, size = "text-sm" }) {
  const safeRating = Number(rating) || 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${size}`}
      aria-label={`${safeRating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= Math.floor(safeRating)
              ? "text-amber-400"
              : star - 1 < safeRating
                ? "text-amber-400"
                : "text-gray-300"
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-bold text-slate-900">{children}</h2>;
}

function ProductDetails() {
  const params = useParams();
  const navigate = useNavigate();

  const productId = params.productId ?? params.id;

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState("");

  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [pincode, setPincode] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");

  const [wishlist, setWishlist] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [cartLoading, setCartLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const [reviewSummary, setReviewSummary] = useState(null);

  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  const [detailsOpen, setDetailsOpen] = useState(false);

  const stock = getStock(product || {});
  const price = getPrice(product || {});
  const regularPrice = getRegularPrice(product || {});

  const discount =
    regularPrice > price && regularPrice > 0
      ? Math.round(((regularPrice - price) / regularPrice) * 100)
      : 0;

  const rating =
    reviewSummary && reviewSummary.total_reviews > 0
      ? reviewSummary.average_rating
      : getRating(product || {});

  const reviewCount =
    reviewSummary !== null
      ? reviewSummary.total_reviews
      : getReviewCount(product || {});

  const colors = useMemo(() => {
    const variants = product?.variants ?? product?.product_variants ?? [];

    if (Array.isArray(product?.colors)) return product.colors;

    if (Array.isArray(variants)) {
      return [
        ...new Set(
          variants.map((v) => v?.color ?? v?.color_name).filter(Boolean)
        ),
      ];
    }

    return [];
  }, [product]);

  const sizes = useMemo(() => {
    const variants = product?.variants ?? product?.product_variants ?? [];

    if (Array.isArray(product?.sizes)) return product.sizes;

    if (Array.isArray(variants)) {
      return [
        ...new Set(
          variants.map((v) => v?.size ?? v?.size_name).filter(Boolean)
        ),
      ];
    }

    return [];
  }, [product]);

  // Fetch product and its images.
  const fetchProduct = useCallback(
    async (signal) => {
      if (!productId) {
        setError("Product ID is missing from the URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        let response = await fetch(
          `${API_URL}/products/${encodeURIComponent(productId)}`,
          { signal, headers: getHeaders() }
        );

        let data;

        if (response.ok) {
          data = await response.json();
        } else if ([404, 405].includes(response.status)) {
          response = await fetch(`${API_URL}/products`, {
            signal,
            headers: getHeaders(),
          });

          if (!response.ok) {
            throw new Error(`Unable to load product (${response.status}).`);
          }

          const listData = await response.json();

          const match = getList(listData).find(
            (item) => String(getId(item)) === String(productId)
          );

          if (!match) {
            throw new Error("Product not found.");
          }

          data = match;
        } else {
          throw new Error(`Unable to load product (${response.status}).`);
        }

        let found = Array.isArray(data)
          ? data.find((item) => String(getId(item)) === String(productId))
          : data?.product ?? data?.data?.product ?? data?.data ?? data;

        if (Array.isArray(found)) {
          found = found.find(
            (item) => String(getId(item)) === String(productId)
          );
        }

        if (!found || typeof found !== "object" || !getId(found)) {
          const matchingListItem = getList(data).find(
            (item) => String(getId(item)) === String(productId)
          );

          if (matchingListItem) found = matchingListItem;
        }

        if (!found || typeof found !== "object") {
          throw new Error("Product details were not found in the API response.");
        }

        setProduct(found);

        let productImages = getProductImages(found);

        if (productImages.length === 0) {
          try {
            const imageResponse = await fetch(
              `${API_URL}/products/${encodeURIComponent(productId)}/images`,
              { signal, headers: getHeaders() }
            );

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();

              productImages = getList(imageData)
                .map(getImageUrl)
                .filter(Boolean);

              if (productImages.length === 0) {
                productImages = [
                  imageData?.image_url,
                  imageData?.image,
                  imageData?.data?.image_url,
                  imageData?.data?.image,
                ]
                  .map(getImageUrl)
                  .filter(Boolean);
              }
            }
          } catch (imageError) {
            if (imageError.name !== "AbortError") {
              console.warn("Product image request failed:", imageError);
            }
          }
        }

        if (!signal.aborted) {
          setImages(productImages.length ? productImages : [FALLBACK_IMAGE]);
          setActiveImage(0);

          try {
            const saved = JSON.parse(
              localStorage.getItem("shopsphereRecentlyViewed") || "[]"
            );

            const updated = [
              found,
              ...saved.filter(
                (item) => String(getId(item)) !== String(getId(found))
              ),
            ].slice(0, 10);

            localStorage.setItem(
              "shopsphereRecentlyViewed",
              JSON.stringify(updated)
            );
          } catch {
            // Ignore local storage errors.
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Product details error:", err);
          setError(err.message || "Unable to load product details.");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [productId]
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchProduct(controller.signal);

    return () => controller.abort();
  }, [fetchProduct]);

  // Fetch related products.
  useEffect(() => {
    if (!product) return;

    const controller = new AbortController();

    async function fetchRelated() {
      setRelatedLoading(true);

      try {
        const category = getCategory(product);

        const response = await fetch(
          `${API_URL}/products?category=${encodeURIComponent(category)}`,
          { signal: controller.signal, headers: getHeaders() }
        );

        if (!response.ok) return;

        const data = await response.json();
        const currentId = String(getId(product));

        const list = getList(data)
          .filter((item) => String(getId(item)) !== currentId)
          .slice(0, 8);

        if (!controller.signal.aborted) {
          setRelatedProducts(list);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Related products could not be loaded:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRelatedLoading(false);
        }
      }
    }

    fetchRelated();

    return () => controller.abort();
  }, [product]);

  // Load wishlist state for the current product.
  useEffect(() => {
    if (!productId || !getToken()) {
      setWishlist(false);
      setWishlistItemId(null);
      return;
    }

    const controller = new AbortController();

    async function fetchWishlist() {
      try {
        const response = await fetch(`${API_URL}/wishlist`, {
          signal: controller.signal,
          headers: getHeaders(),
        });

        if (!response.ok) return;

        const data = await response.json();
        const items = getList(data);

        const match = items.find((item) => {
          const id =
            item?.product_id ??
            item?.productId ??
            item?.product?.product_id ??
            item?.product?.id;

          return String(id) === String(productId);
        });

        if (!controller.signal.aborted) {
          setWishlist(Boolean(match));

          setWishlistItemId(
            match?.wishlist_item_id ??
              match?.item_id ??
              match?.wishlistItemId ??
              match?.id ??
              null
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Wishlist could not be loaded:", err);
        }
      }
    }

    fetchWishlist();

    return () => controller.abort();
  }, [productId]);

  // Fetch approved reviews for this product.
  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();

    async function fetchReviews() {
      setReviewLoading(true);

      try {
        const response = await fetch(
          `${API_URL}/reviews/product/${encodeURIComponent(productId)}`,
          {
            signal: controller.signal,
            headers: getHeaders(),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Unable to load reviews.");
        }

        if (!controller.signal.aborted) {
          const reviewData = data?.data ?? data;

          setReviews(
            Array.isArray(reviewData?.reviews)
              ? reviewData.reviews
              : getList(reviewData)
          );

          setReviewSummary({
            average_rating: Number(reviewData?.average_rating ?? 0),
            total_reviews: Number(reviewData?.total_reviews ?? 0),
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Reviews could not be loaded:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setReviewLoading(false);
        }
      }
    }

    fetchReviews();

    return () => controller.abort();
  }, [productId]);

  // Find delivered orders containing the current product.
  useEffect(() => {
    if (!productId || !getToken()) {
      setDeliveredOrders([]);
      setSelectedOrderId("");
      setOrdersError("");
      return;
    }

    const controller = new AbortController();

    async function fetchEligibleOrders() {
      setOrdersLoading(true);
      setOrdersError("");
      setDeliveredOrders([]);
      setSelectedOrderId("");

      try {
        const ordersResponse = await fetch(`${API_URL}/orders`, {
          signal: controller.signal,
          headers: getHeaders(),
        });

        const ordersData = await ordersResponse.json().catch(() => ({}));

        if (!ordersResponse.ok) {
          throw new Error(
            ordersData.message || "Unable to load your orders."
          );
        }

        const allOrders = Array.isArray(ordersData?.data)
          ? ordersData.data
          : getList(ordersData);

        const delivered = allOrders.filter(
          (order) =>
            String(order?.order_status ?? "").toLowerCase() === "delivered"
        );

        if (controller.signal.aborted) return;

        if (delivered.length === 0) {
          setDeliveredOrders([]);
          return;
        }

        const orderResults = await Promise.all(
          delivered.map(async (order) => {
            try {
              const orderId = order?.id ?? order?.order_id;

              if (orderId == null) return null;

              const response = await fetch(
                `${API_URL}/orders/${encodeURIComponent(orderId)}`,
                {
                  signal: controller.signal,
                  headers: getHeaders(),
                }
              );

              if (!response.ok) return null;

              const detailsData = await response.json();
              const orderDetails = detailsData?.data ?? detailsData;

              const orderInfo = orderDetails?.order ?? order;
              const items = Array.isArray(orderDetails?.items)
                ? orderDetails.items
                : [];

              const containsProduct = items.some(
                (item) =>
                  String(item?.product_id ?? item?.productId) ===
                  String(productId)
              );

              if (!containsProduct) return null;

              return {
                ...orderInfo,
                id: orderInfo?.id ?? orderInfo?.order_id ?? orderId,
              };
            } catch (err) {
              if (err.name !== "AbortError") {
                console.warn("Unable to check order details:", err);
              }

              return null;
            }
          })
        );

        if (controller.signal.aborted) return;

        const eligibleOrders = orderResults.filter(Boolean);

        setDeliveredOrders(eligibleOrders);

        if (eligibleOrders.length > 0) {
          setSelectedOrderId(String(eligibleOrders[0].id));
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setOrdersError(
            err.message || "Unable to check delivered orders."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setOrdersLoading(false);
        }
      }
    }

    fetchEligibleOrders();

    return () => controller.abort();
  }, [productId]);

  async function toggleWishlist() {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    if (!productId || wishlistLoading) return;

    setWishlistLoading(true);
    setActionMessage("");

    try {
      let response;

      if (wishlist) {
        if (wishlistItemId == null) {
          throw new Error(
            "Wishlist item ID is unavailable. Refresh and try again."
          );
        }

        response = await fetch(
          `${API_URL}/wishlist/items/${encodeURIComponent(wishlistItemId)}`,
          { method: "DELETE", headers: getHeaders() }
        );
      } else {
        response = await fetch(`${API_URL}/wishlist/items`, {
          method: "POST",
          headers: getHeaders(true),
          body: JSON.stringify({ product_id: getId(product) }),
        });
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to update wishlist.");
      }

      setWishlist(!wishlist);

      if (!wishlist) {
        const itemId =
          data?.wishlist_item_id ??
          data?.data?.wishlist_item_id ??
          data?.item?.id ??
          data?.id ??
          null;

        setWishlistItemId(itemId);
      } else {
        setWishlistItemId(null);
      }

      setActionMessage(
        wishlist ? "Removed from wishlist." : "Added to wishlist."
      );
    } catch (err) {
      setActionMessage(err.message || "Wishlist update failed.");
    } finally {
      setWishlistLoading(false);
    }
  }

  async function addToCart(buyNow = false) {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    if (!productId) return;

    if (stock !== null && (!Number.isFinite(stock) || stock < 1)) {
      setActionMessage("This product is currently out of stock.");
      return;
    }

    if (stock !== null && quantity > stock) {
      setActionMessage(`Only ${stock} item(s) are available.`);
      return;
    }

    setActionMessage("");
    buyNow ? setBuyLoading(true) : setCartLoading(true);

    try {
      const response = await fetch(`${API_URL}/cart`, {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify({
          product_id: getId(product),
          quantity,
          ...(selectedColor ? { color: selectedColor } : {}),
          ...(selectedSize ? { size: selectedSize } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to add to cart (${response.status}).`
        );
      }

      if (buyNow) {
        navigate("/checkout");
      } else {
        setActionMessage("Product added to cart successfully.");
      }
    } catch (err) {
      setActionMessage(err.message || "Unable to update cart.");
    } finally {
      setCartLoading(false);
      setBuyLoading(false);
    }
  }

  async function shareProduct() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: getName(product),
          text: getDescription(product),
          url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setActionMessage("Product link copied.");
      } else {
        setActionMessage(`Copy this product link: ${url}`);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setActionMessage("Unable to share this product.");
      }
    }
  }

  function checkDelivery() {
    setDeliveryMessage("");

    if (!/^\d{6}$/.test(pincode)) {
      setDeliveryMessage("Enter a valid 6-digit Indian pincode.");
      return;
    }

    setDeliveryMessage(
      `Pincode ${pincode} is valid. Final delivery availability and date will be confirmed at checkout.`
    );
  }

  async function submitReview(event) {
    event.preventDefault();
    setReviewError("");
    setActionMessage("");

    if (!getToken()) {
      navigate("/login");
      return;
    }

    if (!selectedOrderId) {
      setReviewError(
        "You can review this product only after purchasing it in a delivered order."
      );
      return;
    }

    if (!reviewText.trim()) {
      setReviewError("Please enter your review.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Please select a rating between 1 and 5.");
      return;
    }

    const selectedOrder = deliveredOrders.find(
      (order) => String(order.id) === String(selectedOrderId)
    );

    if (!selectedOrder) {
      setReviewError("Please select a valid delivered order.");
      return;
    }

    setReviewSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify({
          product_id: getId(product),
          order_id: Number(selectedOrderId),
          rating: reviewRating,
          review: reviewText.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit review.");
      }

      // The review is pending approval, so do not add it to public reviews.
      setReviewText("");
      setReviewRating(5);
      setShowReviewForm(false);

      setActionMessage(
        data.message ||
          "Your review was submitted successfully and is pending approval."
      );
    } catch (err) {
      setReviewError(err.message || "Unable to submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  // Loading state.
  if (loading) {
    return (
      <main className="min-h-[60vh] bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-6 h-4 w-48 rounded bg-gray-200" />

          <div className="grid gap-8 md:grid-cols-2">
            <div className="aspect-square rounded-2xl bg-gray-200" />

            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded bg-gray-200" />
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-24 rounded bg-gray-200" />
              <div className="h-12 rounded bg-gray-200" />
              <div className="h-12 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error state.
  if (error || !product) {
    return (
      <main className="flex min-h-[55vh] items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <i className="fa-solid fa-box-open text-4xl text-gray-300" />

          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Unable to load product
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {error || "This product could not be found."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Try Again
            </button>

            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border px-5 py-2.5 text-sm font-semibold"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const name = getName(product);
  const available = stock === null || (Number.isFinite(stock) && stock > 0);

  const specs = product?.specifications ?? product?.specs ?? {};
  const attributes = product?.attributes ?? {};
  const seo = product?.seo ?? product?.seo_information ?? {};

  const productInformation = [
    ["Product ID", getId(product)],
    [
      "Product Code / SKU",
      product?.sku ?? product?.product_code ?? "Not specified",
    ],
    ["Brand", getBrand(product)],
    ["Category", getCategory(product)],
    ["Subcategory", getSubcategory(product)],
    [
      "Product Status",
      product?.status ?? (product?.is_active === false ? "Inactive" : "Active"),
    ],
    [
      "Created Date",
      product?.created_at
        ? new Date(product.created_at).toLocaleDateString()
        : "Not available",
    ],
    [
      "Updated Date",
      product?.updated_at
        ? new Date(product.updated_at).toLocaleDateString()
        : "Not available",
    ],
  ];

  const specifications = [
    ...Object.entries(specs && typeof specs === "object" ? specs : {}),
  ];

  const attributeList = Array.isArray(attributes)
    ? attributes.map((item, index) => [
        item?.name ?? `Attribute ${index + 1}`,
        item?.value ?? item?.attribute_value ?? "Not specified",
      ])
    : Object.entries(
        attributes && typeof attributes === "object" ? attributes : {}
      );

  const returnPolicy =
    product?.return_policy ??
    product?.return_refund_policy ??
    "Return eligibility and refund terms should be confirmed from the store's official policy.";

  const warranty =
    product?.warranty_information ??
    product?.warranty ??
    "Check the product packaging or contact the seller for warranty coverage.";

  const seoInformation = [
    ["Meta Title", seo?.meta_title ?? product?.meta_title],
    ["Meta Description", seo?.meta_description ?? product?.meta_description],
    ["Meta Keywords", seo?.meta_keywords ?? product?.meta_keywords],
    ["Slug / URL", seo?.slug ?? product?.slug],
  ].filter(([, value]) => value);

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 text-xs text-gray-500 sm:text-sm"
        >
          <Link to="/" className="hover:text-emerald-700">
            Home
          </Link>

          <span>/</span>
          <span>{getCategory(product)}</span>
          <span>/</span>

          <span className="max-w-[220px] truncate font-medium text-slate-700">
            {name}
          </span>
        </nav>

        {/* Main product layout */}
        <section className="grid items-start gap-6 lg:grid-cols-2 lg:gap-9">
          {/* Image gallery */}
          <div className="grid grid-cols-[60px_minmax(0,1fr)] gap-3 sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-4">
            <div className="flex flex-col gap-2 overflow-y-auto">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={() => setActiveImage(index)}
                  className={`aspect-square overflow-hidden rounded-lg border-2 bg-gray-50 ${
                    activeImage === index
                      ? "border-slate-800"
                      : "border-transparent hover:border-gray-300"
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`${name} ${index + 1}`}
                    className="h-full w-full object-contain"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="group relative flex aspect-[4/5] max-h-[660px] items-center justify-center overflow-hidden rounded-xl bg-gray-50 sm:aspect-square">
              <img
                src={images[activeImage] || FALLBACK_IMAGE}
                alt={name}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
                onClick={() => setZoomOpen(true)}
                className="h-full w-full cursor-zoom-in object-contain transition duration-300 group-hover:scale-[1.03]"
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImage(
                        (activeImage - 1 + images.length) % images.length
                      )
                    }
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow transition hover:bg-white"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveImage((activeImage + 1) % images.length)
                    }
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow transition hover:bg-white"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                aria-label="Zoom product image"
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
              >
                <i className="fa-solid fa-expand" />
              </button>

              <button
                type="button"
                onClick={shareProduct}
                aria-label="Share product"
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
              >
                <i className="fa-solid fa-share-nodes" />
              </button>
            </div>
          </div>

          {/* Product purchase information */}
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  available
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {available
                  ? stock === null
                    ? "Availability on request"
                    : "In Stock"
                  : "Out of Stock"}
              </span>

              {product?.sku && (
                <span className="text-xs text-gray-500">
                  SKU: {product.sku}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
              {name}
            </h1>

            {/* Rating and review count */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Stars rating={rating} size="text-base" />

              <span className="font-semibold text-slate-800">
                {rating.toFixed(1)}
              </span>

              <button
                type="button"
                onClick={() =>
                  document.getElementById("customer-reviews")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
                className="text-gray-500 underline-offset-2 hover:underline"
              >
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {formatPrice(price)}
              </span>

              {regularPrice > price && (
                <>
                  <span className="text-base text-gray-400 line-through">
                    {formatPrice(regularPrice)}
                  </span>

                  {discount > 0 && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
                      {discount}% OFF
                    </span>
                  )}
                </>
              )}
            </div>

            <p className="mt-4 line-clamp-4 text-sm leading-6 text-gray-600">
              {getDescription(product)}
            </p>

            {/* Brand and category */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-gray-100 px-3 py-2">
                Brand: <strong>{getBrand(product)}</strong>
              </span>

              <span className="rounded-md bg-gray-100 px-3 py-2">
                Category: <strong>{getCategory(product)}</strong>
              </span>
            </div>

            {/* Color variants */}
            {colors.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  Color{selectedColor ? `: ${selectedColor}` : ""}
                </p>

                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={String(color)}
                      type="button"
                      onClick={() => setSelectedColor(String(color))}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        selectedColor === String(color)
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {typeof color === "object"
                        ? color?.name ?? color?.color_name ?? "Color"
                        : color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size variants */}
            {sizes.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  Size{selectedSize ? `: ${selectedSize}` : ""}
                </p>

                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={String(size)}
                      type="button"
                      onClick={() => setSelectedSize(String(size))}
                      className={`min-w-12 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        selectedSize === String(size)
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {typeof size === "object"
                        ? size?.name ?? size?.size_name ?? "Size"
                        : size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex h-11 items-center rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="h-full w-10 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  −
                </button>

                <span className="min-w-8 text-center text-sm font-semibold">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) =>
                      stock === null ? q + 1 : Math.min(stock, q + 1)
                    )
                  }
                  disabled={stock !== null && quantity >= stock}
                  aria-label="Increase quantity"
                  className="h-full w-10 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              {stock !== null && available && (
                <span className="text-xs text-gray-500">
                  {stock} item(s) available
                </span>
              )}
            </div>

            {/* Purchase actions */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => addToCart(false)}
                disabled={!available || cartLoading || buyLoading}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-cart-shopping" />
                {cartLoading ? "Adding..." : "Add to Cart"}
              </button>

              <button
                type="button"
                onClick={() => addToCart(true)}
                disabled={!available || cartLoading || buyLoading}
                className="min-h-12 rounded-lg border border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buyLoading ? "Processing..." : "Buy Now"}
              </button>
            </div>

            <button
              type="button"
              onClick={toggleWishlist}
              disabled={wishlistLoading}
              className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                wishlist
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-gray-200 text-slate-800 hover:bg-gray-50"
              }`}
            >
              <i
                className={`${wishlist ? "fa-solid" : "fa-regular"} fa-heart`}
              />

              {wishlistLoading
                ? "Updating..."
                : wishlist
                  ? "Remove from Wishlist"
                  : "Add to Wishlist"}
            </button>

            {actionMessage && (
              <div
                role="status"
                className="mt-3 break-words rounded-lg bg-gray-50 px-3 py-2 text-sm text-slate-700"
              >
                {actionMessage}

                {actionMessage.startsWith("Copy this product link:") && (
                  <button
                    type="button"
                    className="ml-2 font-semibold underline"
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                    }}
                  >
                    Copy
                  </button>
                )}
              </div>
            )}

            {/* Compact benefits */}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-center">
              <div className="px-1 py-2">
                <i className="fa-solid fa-truck text-lg text-slate-700" />
                <p className="mt-2 text-xs font-semibold">Delivery</p>
                <p className="mt-1 text-[11px] text-gray-500">Check pincode</p>
              </div>

              <div className="px-1 py-2">
                <i className="fa-solid fa-shield-halved text-lg text-slate-700" />
                <p className="mt-2 text-xs font-semibold">Secure Payment</p>
                <p className="mt-1 text-[11px] text-gray-500">At checkout</p>
              </div>

              <div className="px-1 py-2">
                <i className="fa-solid fa-rotate-left text-lg text-slate-700" />
                <p className="mt-2 text-xs font-semibold">Returns</p>
                <p className="mt-1 text-[11px] text-gray-500">Policy applies</p>
              </div>
            </div>
          </div>
        </section>

        {/* Product details dropdown */}
        <section className="mt-8 border-t border-gray-200 pt-5">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:bg-gray-100 sm:px-5"
          >
            <span>
              <span className="block text-lg font-bold text-slate-900">
                All Product Details
              </span>

              <span className="mt-1 block text-xs text-gray-500">
                Information, specifications, attributes, policies and SEO
              </span>
            </span>

            <i
              className={`fa-solid fa-chevron-down shrink-0 transition-transform ${
                detailsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {detailsOpen && (
            <div className="mt-4 space-y-5 rounded-xl border border-gray-100 p-4 sm:p-6">
              <div>
                <SectionTitle>Product Information</SectionTitle>

                <div className="mt-3 divide-y divide-gray-100">
                  {productInformation.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 py-2.5 text-sm"
                    >
                      <span className="text-gray-500">{label}</span>

                      <span className="break-words font-medium text-slate-800">
                        {value ?? "Not specified"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Product Description</SectionTitle>

                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600">
                  {getDescription(product)}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Product Specifications</SectionTitle>

                {specifications.length ? (
                  <div className="mt-3 divide-y divide-gray-100">
                    {specifications.map(([key, value]) => (
                      <div
                        key={key}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 py-2.5 text-sm"
                      >
                        <span className="text-gray-500">{key}</span>

                        <span className="break-words font-medium">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value ?? "Not specified")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No specifications have been provided for this product.
                  </p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Product Attributes & Variants</SectionTitle>

                {attributeList.length ? (
                  <div className="mt-3 divide-y divide-gray-100">
                    {attributeList.map(([key, value]) => (
                      <div
                        key={key}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 py-2.5 text-sm"
                      >
                        <span className="text-gray-500">{key}</span>

                        <span className="break-words font-medium">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value ?? "Not specified")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No additional attributes are available.
                  </p>
                )}

                <p className="mt-3 text-sm text-gray-600">
                  Selected color: {selectedColor || "Default"}
                  {" · "}
                  Selected size: {selectedSize || "Default"}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Shipping & Returns</SectionTitle>

                <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                  <p>
                    <strong className="text-slate-800">
                      Shipping charges:
                    </strong>{" "}
                    {product?.shipping_charges != null
                      ? formatPrice(product.shipping_charges)
                      : "Shown at checkout"}
                  </p>

                  <p>
                    <strong className="text-slate-800">
                      Estimated delivery:
                    </strong>{" "}
                    {product?.estimated_delivery ??
                      product?.delivery_estimate ??
                      "Confirmed at checkout"}
                  </p>

                  <p>
                    <strong className="text-slate-800">
                      Return & Refund Policy:
                    </strong>{" "}
                    {returnPolicy}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Warranty Information</SectionTitle>

                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">
                  {warranty}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>Available Offers & Coupons</SectionTitle>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {product?.offers ??
                    product?.available_offers ??
                    "Applicable offers and coupons, if any, will be displayed during checkout."}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <SectionTitle>SEO Information</SectionTitle>

                {seoInformation.length ? (
                  <div className="mt-3 divide-y divide-gray-100">
                    {seoInformation.map(([label, value]) => (
                      <div
                        key={label}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 py-2.5 text-sm"
                      >
                        <span className="text-gray-500">{label}</span>

                        <span className="break-words font-medium">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    SEO metadata has not been provided by the backend.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Customer ratings and reviews */}
        <section
          id="customer-reviews"
          className="mt-8 border-t border-gray-200 pt-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionTitle>Customer Ratings & Reviews</SectionTitle>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {rating.toFixed(1)}
                </span>

                <Stars rating={rating} size="text-lg" />

                <span className="text-sm text-gray-500">
                  ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!getToken()) {
                  navigate("/login");
                  return;
                }

                setReviewError("");
                setShowReviewForm((open) => !open);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-gray-50"
            >
              {showReviewForm ? "Cancel" : "Write a Review"}
            </button>
          </div>

          {/* Review submission form */}
          {showReviewForm && (
            <form
              onSubmit={submitReview}
              className="mt-5 rounded-xl border border-gray-200 p-4 sm:p-5"
            >
              <h3 className="text-base font-bold text-slate-900">
                Write a Product Review
              </h3>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                You can review this product only if it appears in one of your
                delivered orders.
              </p>

              {/* Delivered order selection */}
              <div className="mt-4">
                <label
                  htmlFor="reviewOrder"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Select Delivered Order
                </label>

                {ordersLoading ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Checking your delivered orders...
                  </p>
                ) : (
                  <select
                    id="reviewOrder"
                    value={selectedOrderId}
                    onChange={(event) =>
                      setSelectedOrderId(event.target.value)
                    }
                    disabled={
                      deliveredOrders.length === 0 || reviewSubmitting
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    <option value="">Select a delivered order</option>

                    {deliveredOrders.map((order) => (
                      <option key={order.id} value={String(order.id)}>
                        {order.order_number || `Order #${order.id}`}
                        {order.created_at
                          ? ` — ${new Date(
                              order.created_at
                            ).toLocaleDateString()}`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}

                {ordersError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {ordersError}
                  </p>
                )}

                {!ordersLoading &&
                  !ordersError &&
                  deliveredOrders.length === 0 && (
                    <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                      You cannot review this product yet. You need a delivered
                      order containing this product before submitting a review.
                    </p>
                  )}
              </div>

              {/* Rating */}
              <label className="mt-5 block text-sm font-semibold text-slate-800">
                Your Rating
              </label>

              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    disabled={reviewSubmitting}
                    aria-label={`Rate ${star} stars`}
                    aria-pressed={reviewRating === star}
                    className={`text-2xl transition ${
                      star <= reviewRating
                        ? "text-amber-400"
                        : "text-gray-300"
                    } disabled:cursor-not-allowed`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Selected rating: {reviewRating} out of 5
              </p>

              {/* Review text */}
              <label
                htmlFor="reviewText"
                className="mt-4 block text-sm font-semibold text-slate-800"
              >
                Your Review
              </label>

              <textarea
                id="reviewText"
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Share your experience with this product..."
                disabled={
                  ordersLoading ||
                  deliveredOrders.length === 0 ||
                  reviewSubmitting
                }
                className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                required
              />

              <p className="mt-1 text-right text-xs text-gray-400">
                {reviewText.length}/2000 characters
              </p>

              {reviewError && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {reviewError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  reviewSubmitting ||
                  ordersLoading ||
                  deliveredOrders.length === 0 ||
                  !selectedOrderId ||
                  !reviewText.trim()
                }
                className="mt-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reviewSubmitting ? "Submitting..." : "Submit Review"}
              </button>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                Your review will appear publicly after it has been approved.
              </p>
            </form>
          )}

          {/* Public approved reviews */}
          {reviewLoading ? (
            <p className="mt-5 text-sm text-gray-500">
              Loading reviews...
            </p>
          ) : reviews.length ? (
            <div className="mt-4 divide-y divide-gray-100">
              {reviews.map((review, index) => (
                <article
                  key={review?.review_id ?? review?.id ?? index}
                  className="py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {review?.reviewer_name ??
                        review?.user_name ??
                        review?.username ??
                        review?.user?.name ??
                        "Verified customer"}
                    </p>

                    <span className="text-xs text-gray-500">
                      {review?.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>

                  <div className="mt-1">
                    <Stars rating={Number(review?.rating ?? 0)} />
                  </div>

                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                    {review?.review ??
                      review?.comment ??
                      review?.review_text ??
                      review?.description ??
                      ""}
                  </p>

                  {(review?.images ?? review?.review_images ?? []).length >
                    0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(review.images ?? review.review_images).map(
                        (image, imageIndex) => (
                          <img
                            key={imageIndex}
                            src={getImageUrl(image)}
                            alt={`Customer review ${imageIndex + 1}`}
                            className="h-20 w-20 rounded-lg border border-gray-100 object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No customer reviews are available yet.
            </p>
          )}
        </section>

        {/* Related products */}
        <section className="mt-8 border-t border-gray-200 pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <SectionTitle>You May Also Like</SectionTitle>

              <p className="mt-1 text-xs text-gray-500">
                More products from this category
              </p>
            </div>

            <Link
              to={`/category/${String(getCategory(product))
                .toLowerCase()
                .replaceAll(" ", "-")}`}
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              View Category
            </Link>
          </div>

          {relatedLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="aspect-[3/4] animate-pulse rounded-xl bg-gray-100"
                />
              ))}
            </div>
          ) : relatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {relatedProducts.map((item, index) => (
                <div
                  key={getId(item) ?? index}
                  className="min-w-0 cursor-pointer"
                  onClick={() => {
                    const id = getId(item);
                    if (id != null) navigate(`/product/${id}`);
                  }}
                >
                  <ProductCard product={item} />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
              No related products are available right now.
            </p>
          )}
        </section>

        {/* Recently viewed */}
        <section className="mt-8 border-t border-gray-200 pt-6">
          <SectionTitle>Recently Viewed Products</SectionTitle>

          {(() => {
            let recent = [];

            try {
              recent = JSON.parse(
                localStorage.getItem("shopsphereRecentlyViewed") || "[]"
              ).filter((item) => String(getId(item)) !== String(productId));
            } catch {
              recent = [];
            }

            return recent.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {recent.slice(0, 5).map((item, index) => (
                  <div
                    key={getId(item) ?? index}
                    className="min-w-0 cursor-pointer"
                    onClick={() => {
                      const id = getId(item);
                      if (id != null) navigate(`/product/${id}`);
                    }}
                  >
                    <ProductCard product={item} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                Products you view will appear here.
              </p>
            );
          })()}
        </section>
      </div>

      {/* Full-screen image zoom */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-3 sm:p-8"
          onClick={() => setZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image zoom"
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            aria-label="Close zoom"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-slate-900"
          >
            ×
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();

                  setActiveImage(
                    (activeImage - 1 + images.length) % images.length
                  );
                }}
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900 sm:left-6"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>

              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();

                  setActiveImage((activeImage + 1) % images.length);
                }}
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900 sm:right-6"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </>
          )}

          <img
            src={images[activeImage] || FALLBACK_IMAGE}
            alt={name}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-full cursor-zoom-out object-contain"
          />
        </div>
      )}
    </main>
  );
} 

export default ProductDetails;