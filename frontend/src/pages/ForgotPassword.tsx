// src/pages/ForgotPassword.tsx
import { useState } from "react";
import api, { endpoints } from "../api";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(endpoints.forgotPassword, { email });
      setDone(true); // always show success
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-3 py-6">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
        <div className="text-lg font-semibold mb-2">Forgot password</div>

        {done ? (
          <>
            <div className="text-sm text-green-600 mb-3">
              ✅ If an account exists for this email, a reset link has been sent.
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                         bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <label className="text-xs text-neutral-600 dark:text-neutral-300">
              Email
            </label>
            <input
              className="w-full mt-1 mb-3 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900
                         border-neutral-300 dark:border-neutral-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
            />

            {err ? (
              <div className="text-sm text-red-500 mb-3">{err}</div>
            ) : null}

            <button
              onClick={submit}
              disabled={!email || busy}
              className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                         bg-neutral-900 text-white dark:bg-white dark:text-neutral-900
                         disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>

            <button
              onClick={() => navigate("/")}
              className="mt-3 w-full text-sm underline text-neutral-600 dark:text-neutral-300"
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
