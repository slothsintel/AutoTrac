// frontend/src/pages/Verify.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { endpoints } from "../api";

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => params.get("token") || "", [params]);

  const [status, setStatus] = useState<"idle" | "verifying" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setStatus("err");
        setMsg("Missing verification token.");
        return;
      }

      setStatus("verifying");
      setMsg("");

      try {
        const res = await api.get(endpoints.verify, { params: { token } });
        if (cancelled) return;

        if (res.data?.ok) {
          setStatus("ok");
          setMsg("✅ Email verified! You can now log in and track your income!");
        } else {
          setStatus("err");
          setMsg("Verification failed.");
        }
      } catch (e: any) {
        if (cancelled) return;
        setStatus("err");
        setMsg(e?.response?.data?.detail || e?.message || "Verification failed");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-md px-3 py-6">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
        <div className="text-lg font-semibold mb-2">Verify email</div>

        {status === "verifying" ? (
          <div className="text-sm text-neutral-600 dark:text-neutral-300">
            Verifying…
          </div>
        ) : null}

        {msg ? (
          <div
            className={`text-sm mb-3 ${
              status === "ok" ? "text-green-600" : "text-red-500"
            }`}
          >
            {msg}
          </div>
        ) : null}

        <button
          onClick={() => navigate("/")}
          className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                     bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        >
          Go to login
        </button>

        <div className="mt-3 text-[11px] text-neutral-500">
          If the link expired, register again to get a new verification email.
        </div>
      </div>
    </div>
  );
}
