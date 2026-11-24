const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function apiRequest(path, options = {}) {
  const {
    token,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const headers = new Headers(customHeaders);

  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || "The request failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}