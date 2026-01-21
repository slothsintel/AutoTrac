// frontend/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Track from "./pages/Track";
import Projects from "./pages/Projects";
import Incomes from "./pages/Incomes";
import More from "./pages/More";
import BottomNav from "./components/BottomNav";
import Auth from "./pages/Auth";
import Verify from "./pages/Verify";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import api, { endpoints, getToken, clearToken } from "./api";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const check = async () => {
    const t = getToken();
    if (!t) {
      setAuthed(false);
      setReady(true);
      return;
    }
    try {
      await api.get(endpoints.me);
      setAuthed(true);
    } catch {
      clearToken();
      setAuthed(false);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void check();

    const onAuthChanged = () => void check();
    window.addEventListener("autotrac:auth-changed", onAuthChanged);
    return () => window.removeEventListener("autotrac:auth-changed", onAuthChanged);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[100svh] bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // ✅ Public routes always available: /verify + / (Auth)
  if (!authed) {
    return (
      <div className="min-h-[100svh] bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
        <Routes>
          {/* public auth-related routes */}
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* default auth screen */}
          <Route path="/" element={<Auth onAuthed={() => void check()} />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  // ✅ Authed app
  return (
    <div className="min-h-[100svh] bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 flex flex-col">
      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/track" element={<Track />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/incomes" element={<Incomes />} />
          <Route path="/more" element={<More />} />
          <Route path="/verify" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
