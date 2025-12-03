import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE, // e.g. https://autotrac-35sx.onrender.com
  timeout: 15000,
});

export default api;
