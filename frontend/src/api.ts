// frontend/src/api.ts
import axios from "axios";

const TOKEN_KEY = "autotrac_token_v1";

export const endpoints = {
  // auth
  register: "/auth/register",
  login: "/auth/login",
  me: "/auth/me",

  // app
  projects: "/projects/",
  timeEntries: "/time-entries/",
  stopEntry: (id: number) => `/time-entries/${id}/stop`,
  incomes: "/incomes/",
  exportProjectIncomesCsv: (projectId: number) =>
    `/projects/${projectId}/incomes/export`,
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("autotrac:auth-changed"));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("autotrac:auth-changed"));
}

const baseURL =
  (import.meta as any).env?.VITE_API_BASE?.replace(/\/+$/, "") ||
  "https://autotrac-35sx.onrender.com";

const api = axios.create({
  baseURL,
  timeout: 65_000, // Render free tier can cold-start ~50s
  headers: { "Content-Type": "application/json" },
});

// Attach Bearer token
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${t}`;
  }
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // token expired/invalid → force logout
      clearToken();
    }
    return Promise.reject(err);
  }
);

export default api;
