import { useEffect, useState } from "react";

const SettingsIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l-.02.06a2 2 0 0 1-3.3 0l-.02-.06A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82-.33l-.06.02a1.65 1.65 0 0 0-1 .6 2 2 0 1 1-2.83-2.83 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.6-1L3.3 14.8a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 11.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82l.02-.06a2 2 0 0 1 3.3 0l.02.06a1.65 1.65 0 0 0 .33 1.82 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.6 1z" />
  </svg>
);

export default function More() {
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="mx-auto max-w-md px-3 py-4 text-neutral-900 dark:text-neutral-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-neutral-700 dark:text-neutral-300">
          {SettingsIcon}
        </span>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            Dark mode
          </span>

          <button
            onClick={() =>
              setTheme(theme === "dark" ? "light" : "dark")
            }
            className={`px-4 py-2 rounded-xl text-white ${
              theme === "dark" ? "bg-blue-600" : "bg-neutral-400"
            }`}
          >
            {theme === "dark" ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}
