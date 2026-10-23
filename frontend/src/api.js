const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "chatbot_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed with status ${res.status}`;
    const error = new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function register(username, password) {
  return request("/auth/register", {
    method: "POST",
    body: { username, password },
  });
}

export async function login(username, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  if (data?.access_token) setToken(data.access_token);
  return data;
}

export function logout() {
  clearToken();
}
export function isLoggedIn() {
  return Boolean(getToken());
}

export async function sendChatMessage(message, sessionId) {
  return request("/chat", {
    method: "POST",
    auth: true,
    body: { message, session_id: sessionId },
  });
}