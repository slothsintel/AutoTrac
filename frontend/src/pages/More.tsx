import { useEffect, useState } from "react";
import FeedCard from "../components/FeedCard";
import api, { endpoints, clearToken } from "../api";

const THEME_KEY = "autotrac-theme"; // "dark" | "light"

function getInitialTheme(): "dark" | "light" {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type Me = { id: number; email: string };

export default function More() {
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [me, setMe] = useState<Me | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const links = [
    { label: "Privacy", href: "https://slothsintel.com/privacy.html" },
    { label: "Terms", href: "https://slothsintel.com/terms.html" },
    { label: "GitHub", href: "https://github.com/slothsintel" },
  ];

  const loadMe = async () => {
    setLoadingMe(true);
    setMeErr(null);
    try {
      const res = await api.get(endpoints.me);
      setMe(res.data as Me);
    } catch (e: any) {
      setMe(null);
      setMeErr(e?.response?.data?.detail || e?.message || "Failed to load /auth/me");
    } finally {
      setLoadingMe(false);
    }
  };

  useEffect(() => {
    void loadMe();
  }, []);

  const logout = () => {
    clearToken();
    // simplest + reliable: full reload so App.tsx re-checks and shows Auth
    window.location.href = "/";
  };

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-[var(--si-text)] dark:text-neutral-100">
      <FeedCard title="Account" subtitle="Signed-in user on this device">
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--si-border)] dark:border-neutral-700 bg-[var(--si-surface)] dark:bg-neutral-900/30 px-3 py-2">
            <div className="text-xs text-[var(--si-muted)]">Email</div>
            <div className="text-sm font-medium text-[var(--si-text)] dark:text-neutral-100">
              {loadingMe ? "Loading..." : me?.email || "—"}
            </div>
            {meErr ? <div className="text-xs text-red-500 mt-1">{meErr}</div> : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void loadMe()}
              className="px-3 py-2 rounded-xl border border-[var(--si-border)] dark:border-neutral-700
                         bg-[var(--si-surface)] dark:bg-neutral-900 hover:bg-[var(--si-surface-2)] dark:hover:bg-neutral-800 text-sm font-medium"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl border border-[var(--si-border)] dark:border-neutral-700
                         bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
            >
              Logout
            </button>
          </div>

          <p className="text-[11px] text-[var(--si-muted)]">
            Logout clears the token stored on this device.
          </p>
        </div>
      </FeedCard>

      <FeedCard title="More" subtitle="Preferences & app information">
        <div className="space-y-4">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="
              w-full flex items-center justify-between px-4 py-3 rounded-xl border
              border-[var(--si-border)] dark:border-neutral-700
              bg-[var(--si-surface)]
              hover:bg-[var(--si-surface-2)] dark:hover:bg-neutral-800
              text-[var(--si-text)] dark:text-neutral-100
              font-medium
            "
          >
            <span>Dark mode</span>
            <span className="text-sm text-[var(--si-muted)] border-[var(--si-border)] dark:border-neutral-700
                            bg-[var(--si-surface)] dark:bg-neutral-900 hover:bg-[var(--si-surface-2)] dark:hover:bg-neutral-800">
              {theme === "dark" ? "On" : "Off"}
            </span>
          </button>

          {/* Links */}
          <div className="grid grid-cols-3 gap-2">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="
                  text-center px-3 py-2 rounded-xl border
                  border-[var(--si-border)] dark:border-neutral-700
                  bg-[var(--si-surface)] dark:bg-neutral-900 hover:bg-[var(--si-surface-2)] dark:hover:bg-neutral-800 text-sm font-medium"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </FeedCard>
    </div>
  );
}
