import React, { useEffect, useState } from "react";

const BASE_URL = "http://192.168.1.20:5000";
const API_URL = `${BASE_URL}/api/admin/categories`;

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    parent_id: "",
    description: "",
    status: "1",
  });

  const token = localStorage.getItem("shopsphereToken");

  // Generate slug automatically
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Fetch categories
  const fetchCategories = async () => {
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
        throw new Error(data.message || "Failed to fetch categories");
      }

      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Form input change
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

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      e.target.value = "";
      return;
    }

    setError("");
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      parent_id: "",
      description: "",
      status: "1",
    });

    setImage(null);
    setPreview("");
    setEditingId(null);
    setError("");
    setSuccess("");

    const fileInput = document.getElementById("category-image");
    if (fileInput) fileInput.value = "";
  };

  // Add or update category
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!formData.name.trim()) {
      setError("Category name is required.");
      return;
    }

    if (!formData.slug.trim()) {
      setError("Slug could not be generated.");
      return;
    }

    try {
      setSaving(true);

      const body = new FormData();

      body.append("name", formData.name.trim());
      body.append("slug", formData.slug);
      body.append("description", formData.description);
      body.append("status", formData.status);

      body.append(
        "parent_id",
        formData.parent_id === "" ? "" : formData.parent_id
      );

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
        throw new Error(data.message || "Unable to save category");
      }

      setSuccess(
        editingId
          ? "Category updated successfully!"
          : "Category added successfully!"
      );

      resetForm();
      await fetchCategories();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Edit category
  const handleEdit = (category) => {
    setEditingId(category.id);

    setFormData({
      name: category.name || "",
      slug: category.slug || "",
      parent_id: category.parent_id
        ? String(category.parent_id)
        : "",
      description: category.description || "",
      status: String(category.status ?? "1"),
    });

    setImage(null);

    setPreview(
      category.image
        ? category.image.startsWith("http")
          ? category.image
          : `${BASE_URL}${
              category.image.startsWith("/")
                ? category.image
                : `/${category.image}`
            }`
        : ""
    );

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete category
  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this category?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete category");
      }

      setSuccess("Category deleted successfully!");
      await fetchCategories();
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
  };

  // Resolve category image URL
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
              Category Management
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Create and manage your product categories.
            </p>
          </div>

          <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
            <p className="text-sm text-gray-500">Total Categories</p>
            <p className="text-2xl font-bold text-ocean-green">
              {categories.length}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Category Form */}
        <div className="mb-8 rounded-xl bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-cyprus">
              {editingId ? "Edit Category" : "Add New Category"}
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
              {/* Category Name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Category Name *
                </label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Men's Fashion"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                  required
                />
              </div>

              {/* Auto Slug */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Slug (Automatic)
                </label>

                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  readOnly
                  placeholder="men-s-fashion"
                  className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600 outline-none"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Generated automatically from category name.
                </p>
              </div>

              {/* Parent Category */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Parent Category
                </label>

                <select
                  name="parent_id"
                  value={formData.parent_id}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-ocean-green"
                >
                  <option value="">None (Main Category)</option>

                  {categories
                    .filter(
                      (category) =>
                        String(category.id) !== String(editingId)
                    )
                    .map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>

                <select
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
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Enter category description"
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-ocean-green"
                />
              </div>

              {/* Image Upload */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Category Image
                </label>

                <div className="flex flex-col gap-4 rounded-lg border-2 border-dashed border-gray-300 p-4 sm:flex-row sm:items-center">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Category preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <i className="fa-solid fa-image text-3xl" />
                        <p className="mt-2 text-xs">Image Preview</p>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      id="category-image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleImageChange}
                      className="block w-full cursor-pointer text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-aqua-spring file:px-4 file:py-2.5 file:font-medium file:text-cyprus hover:file:bg-surf-crest"
                    />

                    <p className="mt-2 text-xs text-gray-500">
                      PNG, JPG, WEBP or GIF. Maximum 5 MB.
                    </p>

                    {image && (
                      <p className="mt-1 break-all text-xs text-ocean-green">
                        Selected: {image.name}
                      </p>
                    )}

                    {editingId && !image && preview && (
                      <p className="mt-1 text-xs text-gray-500">
                        Current image retained unless you select a new one.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-ocean-green px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Category"
                  : "Add Category"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>

        {/* Category Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-cyprus">
              All Categories
            </h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No categories found. Add your first category above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Image</th>
                    <th className="px-5 py-4 font-semibold">Category</th>
                    <th className="px-5 py-4 font-semibold">Slug</th>
                    <th className="px-5 py-4 font-semibold">Parent ID</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {categories.map((category) => (
                    <tr
                      key={category.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100">
                          {category.image ? (
                            <img
                              src={getImageUrl(category.image)}
                              alt={category.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-400">
                              <i className="fa-solid fa-image text-xl" />
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800">
                          {category.name}
                        </p>

                        <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                          {category.description || "No description"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {category.slug}
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {category.parent_id || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {String(category.status) === "1" ||
                        String(category.status).toLowerCase() === "active" ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(category)}
                            title="Edit category"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(category.id)}
                            title="Delete category"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Categories;