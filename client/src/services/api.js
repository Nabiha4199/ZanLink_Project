const API_URL = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}, user) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (user?.id) headers["X-User-Id"] = user.id;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  login: (payload) => request("/api/login", { method: "POST", body: JSON.stringify(payload) }),
  microsoftComplete: (code) => request("/api/auth/microsoft/complete", { method: "POST", body: JSON.stringify({ code }) }),
  setPassword: (user, payload) => request("/api/account/password", { method: "POST", body: JSON.stringify(payload) }, user),
  forgotPassword: (payload) => request("/api/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) => request("/api/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  account: (user) => request("/api/account", {}, user),
  pricing: (user) => request("/api/pricing", {}, user),
  updatePricing: (user, payload) => request("/api/pricing", { method: "PATCH", body: JSON.stringify(payload) }, user),
  users: (user) => request("/api/users", {}, user),
  createUser: (user, payload) => request("/api/users", { method: "POST", body: JSON.stringify(payload) }, user),
  updateUser: (user, userId, payload) => request(`/api/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }, user),
  deleteUser: (user, userId) => request(`/api/users/${userId}`, { method: "DELETE" }, user),
  documents: (user, filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return request(`/api/documents?${params.toString()}`, {}, user);
  },
  clients: (user) => request("/api/clients", {}, user),
  createClient: (user, payload) => request("/api/clients", { method: "POST", body: JSON.stringify(payload) }, user),
  createDoc1: (user, payload) => request("/api/documents/doc1", { method: "POST", body: JSON.stringify(payload) }, user),
  createMaintenance: (user, payload) => request("/api/documents/maintenance", { method: "POST", body: JSON.stringify(payload) }, user),
  sales: (user, id, payload) => request(`/api/documents/${id}/sales`, { method: "POST", body: JSON.stringify(payload) }, user),
  hoc: (user, id, payload) => request(`/api/documents/${id}/hoc`, { method: "POST", body: JSON.stringify(payload) }, user),
  clientConfirmation: (user, id, payload) => request(`/api/documents/${id}/client-confirmation`, { method: "POST", body: JSON.stringify(payload) }, user),
  accounts: (user, id, payload) => request(`/api/documents/${id}/accounts`, { method: "POST", body: JSON.stringify(payload) }, user),
  store: (user, id, payload) => request(`/api/documents/${id}/store`, { method: "POST", body: JSON.stringify(payload) }, user),
  management: (user, id, payload) => request(`/api/documents/${id}/management`, { method: "POST", body: JSON.stringify(payload) }, user),
  hod: (user, id, payload) => request(`/api/documents/${id}/hod`, { method: "POST", body: JSON.stringify(payload) }, user),
  summaries: (user) => request("/api/summaries", {}, user),
  reports: (user, filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return request(`/api/reports?${params.toString()}`, {}, user);
  },
  downloadSummary: async (user, id) => {
    const response = await fetch(`${API_URL}/api/summaries/${id}/download`, {
      headers: { "X-User-Id": user.id },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    return response.blob();
  },
  downloadDocument: async (user, id, kind) => {
    const response = await fetch(`${API_URL}/api/documents/${id}/downloads/${kind}`, {
      headers: { "X-User-Id": user.id },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    return response.blob();
  },
};
