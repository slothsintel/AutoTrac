import axios from "axios";

// Ensure base URL never ends with a slash
const BASE = String(import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

// Centralised API endpoints
export const endpoints = {
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
