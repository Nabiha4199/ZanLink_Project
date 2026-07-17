const API_URL = import.meta.env.VITE_API_URL || "";
const SESSION_KEY = "zanlink-session";

function storedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function authenticationHeaders() {
  const token = storedSession()?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}, authenticated = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(authenticated ? authenticationHeaders() : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && authenticated) {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent("zanlink:session-expired", { detail: data.error }));
  }
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  login: (payload) => request("/api/login", { method: "POST", body: JSON.stringify(payload) }),
  googleLogin: (credential) => request("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  register: (payload) => request("/api/register", { method: "POST", body: JSON.stringify(payload) }),
  forgotPassword: (payload) => request("/api/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) => request("/api/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me", {}, true),
  users: () => request("/api/users", {}, true),
  updateUserAccess: (id, payload) => request(`/api/admin/users/${id}/access`, { method: "PATCH", body: JSON.stringify(payload) }, true),
  documents: (user, filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return request(`/api/documents?${params.toString()}`, {}, true);
  },
  createDoc1: (user, payload) => request("/api/documents/doc1", { method: "POST", body: JSON.stringify(payload) }, true),
  createMaintenance: (user, payload) => request("/api/documents/maintenance", { method: "POST", body: JSON.stringify(payload) }, true),
  sales: (user, id, payload) => request(`/api/documents/${id}/sales`, { method: "POST", body: JSON.stringify(payload) }, true),
  accounts: (user, id, payload) => request(`/api/documents/${id}/accounts`, { method: "POST", body: JSON.stringify(payload) }, true),
  store: (user, id, payload) => request(`/api/documents/${id}/store`, { method: "POST", body: JSON.stringify(payload) }, true),
  management: (user, id, payload) => request(`/api/documents/${id}/management`, { method: "POST", body: JSON.stringify(payload) }, true),
  hod: (user, id, payload) => request(`/api/documents/${id}/hod`, { method: "POST", body: JSON.stringify(payload) }, true),
  summaries: () => request("/api/summaries", {}, true),
  reports: () => request("/api/reports", {}, true),
  downloadSummary: async (user, id) => {
    const response = await fetch(`${API_URL}/api/summaries/${id}/download`, {
      headers: authenticationHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    return response.blob();
  },
  downloadDocument: async (user, id, kind) => {
    const response = await fetch(`${API_URL}/api/documents/${id}/downloads/${kind}`, {
      headers: authenticationHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    return response.blob();
  },
};
