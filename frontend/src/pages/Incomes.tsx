import { useEffect, useMemo, useState } from "react";
import api, { endpoints } from "../api";

type Income = {
  id: number;
  project_id: number;
  date: string;
  amount: number;
  currency?: string;
  source?: string;
};

type Project = { id: number; name: string };

const MoneyIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const FIXED = ["AutoVisuals", "AutoTrac", "AutoStock"] as const;

// --------------------
// FX (client-side GBP conversion)
// --------------------
type FxRates = Record<string, number>;
const FX_TTL_MS = 12 * 60 * 60 * 1000;

const fxKey = (cur: string) => `fx_${cur.toUpperCase()}_GBP`;

async function fetchRateToGBP(curRaw: string): Promise<number> {
  const cur = (curRaw || "GBP").toUpperCase();
  if (cur === "GBP") return 1;

  // localStorage cache
  try {
    const cached = localStorage.getItem(fxKey(cur));
    if (cached) {
      const parsed = JSON.parse(cached) as { rate: number; ts: number };
      if (
        parsed &&
        Number.isFinite(parsed.rate) &&
        parsed.rate > 0 &&
        Date.now() - parsed.ts < FX_TTL_MS
      ) {
        return parsed.rate;
      }
    }
  } catch {
    // ignore
  }

  const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(
    cur
  )}&symbols=GBP`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const data = await res.json();

  const rate = Number(data?.rates?.GBP);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Bad FX rate");

  try {
    localStorage.setItem(fxKey(cur), JSON.stringify({ rate, ts: Date.now() }));
  } catch {
    // ignore
  }

  return rate;
}

function toGBP(amount: number, currency?: string, rates?: FxRates): number {
  const cur = (currency || "GBP").toUpperCase();
  if (cur === "GBP") return Number(amount) || 0;
  const r = rates?.[cur];
  if (!r) return 0; // until loaded
  return (Number(amount) || 0) * r;
}

export default function Incomes() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [currency, setCurrency] = useState("GBP");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState(FIXED[0]);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");

  const [fxRates, setFxRates] = useState<FxRates>({ GBP: 1 });

  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const projectColorClass = (name?: string) => {
    if (name === "AutoVisuals") return "text-pink-500";
    if (name === "AutoTrac") return "text-blue-500";
    if (name === "AutoStock") return "text-green-500";
    return "text-neutral-900 dark:text-neutral-100";
  };

  const formatAmount = (cur?: string, amt?: number) => {
    const c = (cur || "GBP").toUpperCase();
    const v = Number(amt) || 0;
    if (c === "GBP") return `£${v.toFixed(2)}`;
    if (c === "USD") return `$${v.toFixed(2)}`;
    if (c === "EUR") return `€${v.toFixed(2)}`;
    if (c === "HKD") return `HK$${v.toFixed(2)}`;
    if (c === "RMB") return `¥${v.toFixed(2)}`;
    return `${c} ${v.toFixed(2)}`;
  };

  const load = async () => {
    try {
      const [pRes, iRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.incomes),
      ]);
      setProjects(pRes.data as Project[]);
      setIncomes(iRes.data as Income[]);
    } catch (e) {
      console.error("Incomes load failed:", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // FX: load missing currencies present in incomes list
  useEffect(() => {
    let cancelled = false;

    const currencies = Array.from(
      new Set((incomes || []).map((i) => (i.currency || "GBP").toUpperCase()))
    );

    const missing = currencies.filter((c) => c !== "GBP" && !fxRates[c]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const pairs = await Promise.all(
          missing.map(async (c) => [c, await fetchRateToGBP(c)] as const)
        );
        if (cancelled) return;

        setFxRates((prev) => {
          const next = { ...prev };
          for (const [c, r] of pairs) next[c] = r;
          return next;
        });
      } catch (e) {
        console.error("FX load failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes]);

  const addIncome = async () => {
    const p = projects.find((x) => x.name === projectName);
    if (!p) return alert("Project not found. Create projects first.");

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");

    try {
      await api.post(endpoints.incomes, {
        project_id: p.id,
        date: new Date().toISOString().split("T")[0], // store YYYY-MM-DD
        amount: amt,
        currency: currency.toUpperCase(),
        source: source || null,
      });

      setAmount("");
      setSource("");
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to add income. Check backend.");
    }
  };

  const deleteIncome = async (id: number) => {
    const yes = window.confirm(`Delete income #${id}?`);
    if (!yes) return;

    try {
      await api.delete(`${endpoints.incomes}${id}/`);
      setIncomes((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert("Delete failed. (Backend must support DELETE /incomes/{id}/)");
    }
  };

  // Derived GBP value for the input preview
  const inputGBP = useMemo(() => {
    const amt = Number(amount) || 0;
    return toGBP(amt, currency, fxRates);
  }, [amount, currency, fxRates]);

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 text-neutral-900 dark:text-neutral-100">
        <span className="text-neutral-700 dark:text-neutral-300">
          {MoneyIcon}
        </span>
        <h1 className="text-lg font-semibold">Incomes</h1>
      </div>

      {/* Form */}
      <div className="space-y-3 mb-6">
        <select
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        >
          {FIXED.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="GBP">GBP (£)</option>
          <option value="USD">USD ($)</option>
          <option value="HKD">HKD (HK$)</option>
          <option value="EUR">EUR (€)</option>
          <option value="RMB">RMB (¥)</option>
        </select>

        <input
          type="number"
          placeholder="Amount"
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* GBP preview */}
        {currency.toUpperCase() !== "GBP" ? (
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            ≈ £{inputGBP.toFixed(2)} (auto FX)
          </div>
        ) : null}

        <input
          type="text"
          placeholder="Source (optional)"
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />

        <button
          onClick={addIncome}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-full py-3 font-semibold"
        >
          Add income
        </button>
      </div>

      {/* List */}
      <div className="text-neutral-900 dark:text-neutral-100 font-semibold mb-2">
        Recent incomes
      </div>

      <ul className="space-y-2">
        {incomes
          .slice()
          .sort((a, b) => b.id - a.id)
          .map((i) => {
            const pname = projectMap[i.project_id];
            const gbp = toGBP(i.amount, i.currency, fxRates);
            const cur = (i.currency || "GBP").toUpperCase();

            return (
              <li
                key={i.id}
                className="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-xl p-3 flex justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">
                    {formatAmount(i.currency, i.amount)}
                  </div>

                  {cur !== "GBP" ? (
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      ≈ £{gbp.toFixed(2)}
                    </div>
                  ) : null}

                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(i.date).toLocaleString()}
                  </div>

                  {pname && (
                    <div
                      className={
                        "text-xs mt-1 font-medium " + projectColorClass(pname)
                      }
                    >
                      {pname}
                    </div>
                  )}

                  {i.source ? (
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 break-words">
                      {i.source}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => deleteIncome(i.id)}
                  className="h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm
                             bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  title="Delete income"
                >
                  🗑️
                </button>
              </li>
            );
          })}
      </ul>

      {Object.keys(fxRates).length <= 1 ? (
        <div className="text-xs mt-3 text-neutral-500 dark:text-neutral-400">
          Loading FX rates…
        </div>
      ) : null}
    </div>
  );
}
