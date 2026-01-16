// frontend/src/api.ts
import axios from "axios";

/**
 * Backend base URL
 * - In production, set VITE_API_BASE in your Render Static Site env vars if you want.
 * - Fallback points to your Render FastAPI service.
 */
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "https://autotrac-35sx.onrender.com";

/**
 * Token storage key (one-device-token MVP A)
 */
const TOKEN_KEY = "autotrac_token";

/**
 * Axios instance
 */
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // Render free tier can cold-start; keep this >= 10s
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Attach Bearer token automatically
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Endpoints (keep these as the single source of truth)
 */
export const endpoints = {
  // auth
  register: "/auth/register",
  login: "/auth/login",
  me: "/auth/me",

  // core
  projects: "/projects/",
  timeEntries: "/time-entries/",
  stopEntry: (id: number) => `/time-entries/${id}/stop`,
  incomes: "/incomes/",
  exportProjectIncomesCsv: (projectId: number) =>
    `/projects/${projectId}/incomes/export`,
};

/**
 * Token helpers
 */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export default api;
