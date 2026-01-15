// frontend/src/api.ts
import axios from "axios";

// Ensure base URL never ends with a slash
const BASE = String(import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

export const tokenKey = "autotrac_token";

export function setToken(token: string) {
  localStorage.setItem(tokenKey, token);
}

export function clearToken() {
  localStorage.removeItem(tokenKey);
}

export function getToken(): string | null {
  return localStorage.getItem(tokenKey);
}

// Attach Authorization header automatically
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// Centralised API endpoints
export const endpoints = {
  // Auth
  register: "/auth/register",
  login: "/auth/login",
  me: "/auth/me",

  // Core CRUD (FastAPI requires trailing slash)
  projects: "/projects/",
  timeEntries: "/time-entries/",
  incomes: "/incomes/",

  // Actions / special routes (NO trailing slash in backend)
  stopTimeEntry: (entryId: number) => `/time-entries/${entryId}/stop`,
  exportProjectIncomes: (projectId: number) =>
    `/projects/${projectId}/incomes/export`,
};

export default api;
