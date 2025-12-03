import { useEffect, useState } from "react";

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
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>

      <div className="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Dark mode</span>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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
