// frontend/src/api.ts
import axios from "axios";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "https://autotrac-35sx.onrender.com";

const TOKEN_KEY = "autotrac_token";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const endpoints = {
  // auth
  register: "/auth/register",
  verify: "/auth/verify",
  login: "/auth/login",
  me: "/auth/me",

  // ✅ password reset
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",

  // core
  projects: "/projects/",
  timeEntries: "/time-entries/",
  stopEntry: (id: number) => `/time-entries/${id}/stop`,
  incomes: "/incomes/",
  exportProjectIncomesCsv: (projectId: number) =>
    `/projects/${projectId}/incomes/export`,
};

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("autotrac:auth-changed"));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("autotrac:auth-changed"));
}

export default api;
