// frontend/src/pages/Auth.tsx
import { useMemo, useState } from "react";
import api, { endpoints, setToken } from "../api";

export default function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pwBytes = useMemo(() => {
    try {
      return new TextEncoder().encode(password).length;
    } catch {
      return password.length;
    }
  }, [password]);

  const pwTooLong = pwBytes > 72;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (pwTooLong) {
        throw new Error("Password is too long (max 72 bytes for bcrypt).");
      }

      if (mode === "register") {
        await api.post(endpoints.register, { email, password });

        // ✅ Do NOT auto-login. User must verify first.
        setErr("✅ Account created. Please check your inbox to verify your email, log in, and enjoy income tracking!");
        setMode("login");
        setBusy(false);
        return;
      }

      const res = await api.post(endpoints.login, { email, password });
      const token = String(res.data?.access_token || "");
      if (!token) throw new Error("No token returned");
      setToken(token);
      onAuthed();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !!email && password.length >= 8 && !pwTooLong && !busy;

  return (
    <div className="mx-auto max-w-md px-3 py-6">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">
            {mode === "login" ? "Login" : "Create account"}
          </div>
          <button
            className="text-sm underline text-neutral-600 dark:text-neutral-300"
            onClick={() => {
              setErr(null);
              setMode(mode === "login" ? "register" : "login");
            }}
            disabled={busy}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </div>

        <label className="text-xs text-neutral-600 dark:text-neutral-300">
          Email
        </label>
        <input
          className="w-full mt-1 mb-3 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
        />

        <label className="text-xs text-neutral-600 dark:text-neutral-300">
          Password
        </label>
        <input
          className="w-full mt-1 mb-2 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
        />

        <div className="text-[11px] text-neutral-500 mb-3">
          {pwTooLong ? (
            <span className="text-red-500">
              Password too long ({pwBytes} bytes). Max is 72 bytes.
            </span>
          ) : (
            <span>Length: {pwBytes} bytes • Min 8 chars</span>
          )}
        </div>

        {err ? <div className="text-sm text-red-500 mb-3">{err}</div> : null}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                     bg-neutral-900 text-white dark:bg-white dark:text-neutral-900
                     disabled:opacity-50"
        >
          {busy ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>

        <div className="mt-3 text-[11px] text-neutral-500">
          You must verify your email before logging in.
        </div>
      </div>
    </div>
  );
}
