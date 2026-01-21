// src/pages/ResetPassword.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { endpoints } from "../api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => params.get("token") || "", [params]);

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  const pwBytes = useMemo(() => {
    try {
      return new TextEncoder().encode(password).length;
    } catch {
      return password.length;
    }
  }, [password]);

  const pwTooLong = pwBytes > 72;

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMsg("Missing or invalid reset token.");
    }
  }, [token]);

  const submit = async () => {
    if (pwTooLong || password.length < 8) return;

    setBusy(true);
    setMsg("");
    try {
      await api.post(endpoints.resetPassword, {
        token,
        new_password: password,
      });
      setStatus("ok");
      setMsg("✅ Password reset successfully. You can now log in.");
    } catch (e: any) {
      setStatus("err");
      setMsg(e?.response?.data?.detail || e?.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-3 py-6">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
        <div className="text-lg font-semibold mb-2">Reset password</div>

        {status === "ok" ? (
          <>
            <div className="text-sm text-green-600 mb-3">{msg}</div>
            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                         bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            >
              Go to login
            </button>
          </>
        ) : (
          <>
            <label className="text-xs text-neutral-600 dark:text-neutral-300">
              New password
            </label>
            <input
              className="w-full mt-1 mb-2 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900
                         border-neutral-300 dark:border-neutral-700"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

            {msg ? (
              <div
                className={`text-sm mb-3 ${
                  status === "err" ? "text-red-500" : "text-neutral-600"
                }`}
              >
                {msg}
              </div>
            ) : null}

            <button
              onClick={submit}
              disabled={!token || password.length < 8 || pwTooLong || busy}
              className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                         bg-neutral-900 text-white dark:bg-white dark:text-neutral-900
                         disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Reset password"}
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
