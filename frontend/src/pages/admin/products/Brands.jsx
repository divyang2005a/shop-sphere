import React, { useEffect, useState } from "react";

const BASE_URL = "http://localhost:5000";
const API_URL = `${BASE_URL}/api/admin/brands`;

function Brands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "1",
  });

  const token = localStorage.getItem("shopsphereToken");

  // Automatically generate slug
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Convert database image path to URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://") ||
      imagePath.startsWith("blob:")
    ) {
      return imagePath;
    }

    return `${BASE_URL}${
      imagePath.startsWith("/") ? imagePath : `/${imagePath}`
    }`;
  };

  // Fetch all brands
  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch brands");
      }

      setBrands(data.brands || []);
    } catch (err) {
      setError(err.message || "Unable to load brands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // Automatically update slug when name changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "name") {
      setFormData((prev) => ({
        ...prev,
        name: value,
        slug: generateSlug(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Select image from computer
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Select a JPG, PNG, WEBP, GIF or SVG image.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      e.target.value = "";
      return;
    }

    // Revoke previous temporary preview
    if (preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setError("");
    setSuccess("");
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // Reset form
  const resetForm = () => {
    if (preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setFormData({
      name: "",
      slug: "",
      description: "",
      status: "1",
    });

    setImage(null);
    setPreview("");
    setEditingId(null);
    setError("");
    setSuccess("");

    const fileInput = document.getElementById("brand-image");

    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Create or update brand
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError("Please login again. Authentication token not found.");
      return;
    }

    if (!formData.name.trim()) {
      setError("Brand name is required.");
      return;
    }

    if (!formData.slug) {
      setError("Please enter a valid brand name.");
      return;
    }

    try {
      setSaving(true);

      const body = new FormData();

      body.append("name", formData.name.trim());
      body.append("slug", formData.slug);
      body.append("description", formData.description);
      body.append("status", formData.status);

      // Backend multer field name must be "image"
      if (image) {
        body.append("image", image);
      }

      const url = editingId
        ? `${API_URL}/${editingId}`
        : API_URL;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save brand");
      }

      const message = editingId
        ? "Brand updated successfully!"
        : "Brand added successfully!";

      resetForm();
      setSuccess(message);

      await fetchBrands();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Load brand details into form
  const handleEdit = (brand) => {
    if (preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setEditingId(brand.id);

    setFormData({
      name: brand.name || "",
      slug: brand.slug || "",
      description: brand.description || "",
      status: String(brand.status ?? "1"),
    });

    setImage(null);
    setPreview(getImageUrl(brand.logo || brand.image || ""));
    setError("");
    setSuccess("");

    const fileInput = document.getElementById("brand-image");

    if (fileInput) {
      fileInput.value = "";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete brand
  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this brand?"
    );

    if (!confirmed) return;

    if (!token) {
      setError("Please login again. Authentication token not found.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      setDeletingId(id);

      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete brand");
      }

      if (String(editingId) === String(id)) {
        resetForm();
      }

      setSuccess("Brand deleted successfully!");
      await fetchBrands();
    } catch (err) {
      setError(err.message || "Unable to delete brand");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
              Brand Management
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your store brands and their logos.
            </p>
          </div>

          <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Total Brands</p>
            <p className="text-2xl font-bold text-ocean-green">
              {brands.length}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div
            role="status"
            className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
          >
            <span>{success}</span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Close success message"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* Brand Form */}
        <div className="mb-8 rounded-xl bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-cyprus">
              {editingId ? "Edit Brand" : "Add New Brand"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-gray-500 hover:text-red-500"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* Brand Name */}
              <div>
                <label
                  htmlFor="brand-name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Brand Name *
                </label>

                <input
                  id="brand-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Nike"
                  required
                  maxLength={150}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                />
              </div>

              {/* Automatic Slug */}
              <div>
                <label
                  htmlFor="brand-slug"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Slug (Automatic)
                </label>

                <input
                  id="brand-slug"
                  type="text"
                  name="slug"
                  value={formData.slug}
                  readOnly
                  placeholder="nike"
                  className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Automatically generated from brand name.
                </p>
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor="brand-status"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Status
                </label>

                <select
                  id="brand-status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-ocean-green"
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="brand-description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>

                <textarea
                  id="brand-description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Enter brand description"
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-ocean-green"
                />
              </div>

              {/* Logo Upload */}
              <div className="md:col-span-2">
                <label
                  htmlFor="brand-image"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Brand Logo / Image
                </label>

                <div className="flex flex-col gap-4 rounded-lg border-2 border-dashed border-gray-300 p-4 sm:flex-row sm:items-center">

                  {/* Preview */}
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Brand logo preview"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <i className="fa-solid fa-image text-3xl" />
                        <p className="mt-2 text-xs">Logo Preview</p>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      id="brand-image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      onChange={handleImageChange}
                      className="block w-full cursor-pointer text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-aqua-spring file:px-4 file:py-2.5 file:font-medium file:text-cyprus hover:file:bg-surf-crest"
                    />

                    <p className="mt-2 text-xs text-gray-500">
                      PNG, JPG, WEBP, GIF or SVG. Maximum 5 MB.
                    </p>

                    {image && (
                      <p className="mt-1 break-all text-xs text-ocean-green">
                        Selected: {image.name}
                      </p>
                    )}

                    {editingId && !image && preview && (
                      <p className="mt-1 text-xs text-gray-500">
                        Existing logo will be kept unless you select a new one.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-ocean-green px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Update Brand"
                ) : (
                  "Add Brand"
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>

        {/* Brand List */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-cyprus">
              All Brands
            </h2>

            <button
              type="button"
              onClick={fetchBrands}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <i className="fa-solid fa-rotate-right mr-2" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Loading brands...
            </div>
          ) : brands.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <i className="fa-solid fa-tags mb-3 block text-3xl" />
              No brands found. Add your first brand above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Logo</th>
                    <th className="px-5 py-4 font-semibold">Brand Name</th>
                    <th className="px-5 py-4 font-semibold">Slug</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {brands.map((brand) => {
                    const brandImage = brand.logo || brand.image;

                    const isActive =
                      String(brand.status) === "1" ||
                      String(brand.status).toLowerCase() === "active";

                    return (
                      <tr
                        key={brand.id}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
                            {brandImage ? (
                              <img
                                src={getImageUrl(brandImage)}
                                alt={brand.name}
                                className="h-full w-full object-contain p-1"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <i className="fa-solid fa-image text-xl text-gray-400" />
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-800">
                            {brand.name}
                          </p>

                          <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                            {brand.description || "No description"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {brand.slug}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={
                              isActive
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                            }
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(brand)}
                              title="Edit brand"
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(brand.id)}
                              disabled={deletingId === brand.id}
                              title="Delete brand"
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                            >
                              {deletingId === brand.id ? (
                                <i className="fa-solid fa-spinner fa-spin" />
                              ) : (
                                <i className="fa-solid fa-trash" />
                              )}
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
        </div>
      </div>
    </div>
  );
}

export default Brands;
