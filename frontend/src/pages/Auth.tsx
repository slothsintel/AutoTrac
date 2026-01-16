// frontend/src/pages/Auth.tsx
import { useMemo, useState } from "react";
import api, { endpoints, setToken } from "../api";

function utf8ByteLen(s: string) {
  return new TextEncoder().encode(s).length;
}

function friendlyError(e: any) {
  // Axios: timeout / network / server error
  if (e?.code === "ECONNABORTED" || /timeout/i.test(e?.message ?? "")) {
    return "Backend is waking up (Render free tier). Please try again in ~10–30 seconds.";
  }
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => x?.msg ?? "").join(", ");
  const msg = e?.message;
  if (typeof msg === "string" && msg.length) return msg;
  return "Network Error";
}

export default function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pwBytes = useMemo(() => utf8ByteLen(password), [password]);
  const pwTooLong = pwBytes > 72;

  async function doLogin() {
    const res = await api.post(endpoints.login, { email, password });
    const token = res.data?.access_token;
    if (!token) throw new Error("No access_token returned from server.");
    setToken(token);
    onAuthed();
  }

  async function doRegisterThenLogin() {
    await api.post(endpoints.register, { email, password });
    await doLogin();
  }

  async function onSubmit() {
    setErr(null);

    if (!email.trim()) {
      setErr("Please enter email.");
      return;
    }
    if (!password) {
      setErr("Please enter password.");
      return;
    }
    if (pwTooLong) {
      setErr("Password too long (max 72 bytes). Use a shorter password.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await doLogin();
      } else {
        await doRegisterThenLogin();
      }
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100svh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">
            {mode === "register" ? "Create account" : "Login"}
          </h1>
          <button
            className="text-sm underline opacity-80 hover:opacity-100"
            onClick={() => {
              setErr(null);
              setMode((m) => (m === "register" ? "login" : "register"));
            }}
            type="button"
            disabled={busy}
          >
            {mode === "register" ? "Login" : "Register"}
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm opacity-80">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent px-4 py-3 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm opacity-80">Password</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent px-4 py-3 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={busy}
            />
            <div className="mt-1 text-xs opacity-70">
              {pwBytes} bytes (bcrypt max 72)
              {pwTooLong ? <span className="text-red-500"> — too long</span> : null}
            </div>
          </div>

          {err ? <div className="text-sm text-red-500">{err}</div> : null}

          <button
            className="w-full rounded-xl bg-black text-white py-3 font-medium disabled:opacity-60"
            onClick={onSubmit}
            disabled={busy}
            type="button"
          >
            {busy ? "Please wait…" : mode === "register" ? "Register" : "Login"}
          </button>

          <div className="text-xs opacity-60">
            MVP A: one device token, no password reset yet.
          </div>
        </div>
      </div>
    </div>
  );
}
