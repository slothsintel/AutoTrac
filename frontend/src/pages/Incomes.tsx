import { useEffect, useMemo, useState } from "react";
import api, { endpoints } from "../api";

type Income = {
  id: number;
  project_id: number;
  date: string;
  amount: number;
  currency?: string | null;
  source?: string | null;
};

type Project = { id: number; name: string };

type FxRates = Record<string, number>;
const FX_TTL_MS = 12 * 60 * 60 * 1000;
const fxKey = (cur: string) => `fx_${cur.toUpperCase()}_GBP`;

function normCur(c?: string | null) {
  return (c || "GBP").toUpperCase();
}

async function fetchRateToGBP(curRaw: string): Promise<number> {
  const cur = normCur(curRaw);
  if (cur === "GBP") return 1;

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

  const res = await fetch(
    `https://api.exchangerate.host/latest?base=${encodeURIComponent(cur)}&symbols=GBP`
  );
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

function toGBP(amount: number, currency?: string | null, rates?: FxRates): number {
  const cur = normCur(currency);
  if (cur === "GBP") return Number(amount) || 0;
  const r = rates?.[cur];
  if (!r) return 0; // show 0 until rate arrives (prevents wrong values)
  return (Number(amount) || 0) * r;
}

function formatMoney(curRaw: string | null | undefined, amtRaw: number) {
  const c = normCur(curRaw);
  const v = Number(amtRaw) || 0;
  if (c === "GBP") return `£${v.toFixed(2)}`;
  if (c === "USD") return `$${v.toFixed(2)}`;
  if (c === "EUR") return `€${v.toFixed(2)}`;
  if (c === "HKD") return `HK$${v.toFixed(2)}`;
  if (c === "RMB" || c === "CNY") return `¥${v.toFixed(2)}`;
  return `${c} ${v.toFixed(2)}`;
}

export default function Incomes() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fxRates, setFxRates] = useState<FxRates>({ GBP: 1 });

  const [projectId, setProjectId] = useState<number | "">("");
  const [currency, setCurrency] = useState<string>("USD"); // default USD is fine
  const [amount, setAmount] = useState<string>("");
  const [source, setSource] = useState<string>("");

  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const load = async () => {
    const [pRes, iRes] = await Promise.all([
      api.get(endpoints.projects),
      api.get(endpoints.incomes),
    ]);
    setProjects(pRes.data as Project[]);
    setIncomes(iRes.data as Income[]);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  // load FX rates for any currencies used in list OR selected in input
  useEffect(() => {
    let cancelled = false;
    const currencies = new Set<string>();
    currencies.add(normCur(currency));
    for (const i of incomes) currencies.add(normCur(i.currency));

    const missing = [...currencies].filter((c) => c !== "GBP" && !fxRates[c]);
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
  }, [incomes, currency]);

  const inputGBP = useMemo(() => {
    const amt = Number(amount) || 0;
    return toGBP(amt, currency, fxRates);
  }, [amount, currency, fxRates]);

  const addIncome = async () => {
    if (projectId === "") return alert("Choose project first.");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");

    const cur = normCur(currency);

    // ✅ IMPORTANT:
    // We store what the user entered in the selected currency (USD stays USD).
    // Conversion is for display + analytics (GBP).
    await api.post(endpoints.incomes, {
      project_id: projectId,
      date: new Date().toISOString().split("T")[0],
      amount: amt,
      currency: cur,
      source: source || null,
    });

    setAmount("");
    setSource("");
    await load();
  };

  const deleteIncome = async (id: number) => {
    const yes = window.confirm(`Delete income #${id}?`);
    if (!yes) return;
    await api.delete(`${endpoints.incomes}${id}/`);
    setIncomes((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <div className="flex items-center gap-2 mb-3 text-neutral-900 dark:text-neutral-100">
        <h1 className="text-lg font-semibold">Incomes</h1>
      </div>

      <div className="space-y-3 mb-6">
        <select
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Choose project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
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
          <option value="EUR">EUR (€)</option>
          <option value="HKD">HKD (HK$)</option>
          <option value="RMB">RMB (¥)</option>
          <option value="CNY">CNY (¥)</option>
        </select>

        <input
          type="number"
          placeholder="Amount"
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {normCur(currency) !== "GBP" ? (
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

      <div className="text-neutral-900 dark:text-neutral-100 font-semibold mb-2">
        Recent incomes
      </div>

      <ul className="space-y-2">
        {incomes
          .slice()
          .sort((a, b) => b.id - a.id)
          .map((i) => {
            const cur = normCur(i.currency);
            const gbp = toGBP(i.amount, i.currency, fxRates);
            const pname = projectMap[i.project_id] || `Project #${i.project_id}`;

            return (
              <li
                key={i.id}
                className="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-xl p-3 flex justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">
                    {formatMoney(i.currency, i.amount)}
                  </div>

                  {cur !== "GBP" ? (
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      ≈ £{gbp.toFixed(2)}
                    </div>
                  ) : null}

                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(i.date).toLocaleString()} · #{i.id}
                  </div>

                  <div className="text-xs mt-1 font-medium text-neutral-700 dark:text-neutral-300">
                    {pname}
                  </div>
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
    </div>
  );
}
