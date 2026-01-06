import { useEffect, useMemo, useState } from "react";
import api, { endpoints } from "../api";
import FeedCard from "../components/FeedCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Project = { id: number; name: string };

type TimeEntry = {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  note?: string;
};

type Income = {
  id: number;
  project_id: number;
  date: string; // may be "YYYY-MM-DD" OR full datetime string
  amount: number;
  currency?: string; // GBP, USD, HKD, EUR, RMB...
  source?: string;
};

const FIXED = ["AutoVisuals", "AutoTrac", "AutoStock"] as const;
type FixedProject = (typeof FIXED)[number];

const PROJECT_COLORS: Record<FixedProject, string> = {
  AutoVisuals: "#ec4899",
  AutoTrac: "#3b82f6",
  AutoStock: "#22c55e",
};

const DAYS = 30;

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
    // ignore cache errors
  }

  // fetch live rate (no key)
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
  if (!r) return 0; // will render 0 until rates arrive
  return (Number(amount) || 0) * r;
}

// --------------------
// Date helpers
// --------------------
const pad2 = (n: number) => String(n).padStart(2, "0");
const toDayKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function makeLastNDaysKeys(n: number) {
  const keys: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(toDayKey(d));
  }
  return keys;
}

type DailyRow = { date: string } & Record<FixedProject, number>;
const emptyDailyRow = (date: string): DailyRow => ({
  date,
  AutoVisuals: 0,
  AutoTrac: 0,
  AutoStock: 0,
});

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [filter, setFilter] = useState<string>("All");

  const [fxRates, setFxRates] = useState<FxRates>({ GBP: 1 });

  const loadAll = async () => {
    try {
      const [pRes, tRes, iRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.timeEntries),
        api.get(endpoints.incomes),
      ]);

      setProjects(pRes.data as Project[]);
      setTimeEntries(tRes.data as TimeEntry[]);
      setIncomes(iRes.data as Income[]);
    } catch (err) {
      console.error("Home loadAll failed:", err);
    }
  };

  // initial load
  useEffect(() => {
    loadAll();
  }, []);

  // refresh on focus/visibility
  useEffect(() => {
    const onFocus = () => loadAll();
    const onVis = () => {
      if (!document.hidden) loadAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // map project_id -> name
  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const matchesFilter = (projectName?: string) =>
    filter === "All" || (projectName && filter === projectName);

  const projectColorClass = (name?: string) => {
    if (name === "AutoVisuals") return "text-pink-500";
    if (name === "AutoTrac") return "text-blue-500";
    if (name === "AutoStock") return "text-green-500";
    return "text-neutral-900 dark:text-neutral-100";
  };

  // --------------------
  // FX: load missing currencies seen in incomes
  // --------------------
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

  // --------------------
  // Delete handlers (optional, if your backend supports these DELETE endpoints)
  // --------------------
  const deleteTimeEntry = async (entryId: number) => {
    const yes = window.confirm(`Delete time entry #${entryId}?`);
    if (!yes) return;

    try {
      await api.delete(`${endpoints.timeEntries}${entryId}/`);
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      alert("Failed to delete time entry.");
      console.error(err);
    }
  };

  const deleteIncome = async (incomeId: number) => {
    const yes = window.confirm(`Delete income #${incomeId}?`);
    if (!yes) return;

    try {
      await api.delete(`${endpoints.incomes}${incomeId}/`);
      setIncomes((prev) => prev.filter((i) => i.id !== incomeId));
    } catch (err) {
      alert("Failed to delete income.");
      console.error(err);
    }
  };

  // --------------------
  // Stacked-by-date data (last N days)
  // --------------------
  const lastNDaysKeys = useMemo(() => makeLastNDaysKeys(DAYS), []);

  const dailyTimeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();
    for (const day of lastNDaysKeys) rows.set(day, emptyDailyRow(day));

    for (const e of timeEntries) {
      if (!e.end_time) continue;

      const pname = projectMap[e.project_id] as FixedProject | undefined;
      if (!pname || !(pname in PROJECT_COLORS)) continue;

      const start = new Date(e.start_time);
      const end = new Date(e.end_time);

      const dayKey = toDayKey(start); // start-date attribution
      if (!rows.has(dayKey)) continue;

      const durationHours = (end.getTime() - start.getTime()) / 1000 / 3600;
      rows.get(dayKey)![pname] += Math.max(0, durationHours);
    }

    return Array.from(rows.values());
  }, [timeEntries, projectMap, lastNDaysKeys]);

  const dailyIncomeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();
    for (const day of lastNDaysKeys) rows.set(day, emptyDailyRow(day));

    for (const inc of incomes) {
      const pname = projectMap[inc.project_id] as FixedProject | undefined;
      if (!pname || !(pname in PROJECT_COLORS)) continue;

      // ✅ Robust: works for "YYYY-MM-DD" OR datetime strings
      const dayKey = toDayKey(new Date(inc.date));
      if (!rows.has(dayKey)) continue;

      // ✅ Convert to GBP for charts
      rows.get(dayKey)![pname] += toGBP(inc.amount, inc.currency, fxRates);
    }

    return Array.from(rows.values());
  }, [incomes, projectMap, lastNDaysKeys, fxRates]);

  // --------------------
  // Weekly summary (last 7 days)
  // --------------------
  function calculateWeeklyTimeTotals(entries: TimeEntry[]) {
    const totals: Record<FixedProject, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const e of entries) {
      if (!e.end_time) continue;

      const start = new Date(e.start_time).getTime();
      if (start < sevenDaysAgo) continue;

      const durationSec = (new Date(e.end_time).getTime() - start) / 1000;
      const name = projectMap[e.project_id] as FixedProject | undefined;
      if (name && totals[name] != null) totals[name] += durationSec;
    }

    return totals;
  }

  function calculateWeeklyIncomeTotals(list: Income[]) {
    const totals: Record<FixedProject, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const inc of list) {
      const d = new Date(inc.date).getTime();
      if (d < sevenDaysAgo) continue;

      const name = projectMap[inc.project_id] as FixedProject | undefined;
      if (name && totals[name] != null)
        totals[name] += toGBP(inc.amount, inc.currency, fxRates);
    }

    return totals;
  }

  const weeklyTimeTotals = calculateWeeklyTimeTotals(timeEntries);
  const weeklyIncomeTotals = calculateWeeklyIncomeTotals(incomes);

  const fmtHours = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Latest 10 lists (newest-first)
  const recentTimeEntries = useMemo(() => {
    return [...timeEntries]
      .sort((a, b) => b.id - a.id)
      .filter((e) => matchesFilter(projectMap[e.project_id]))
      .slice(0, 10);
  }, [timeEntries, filter, projectMap]);

  const recentIncomes = useMemo(() => {
    return [...incomes]
      .sort((a, b) => b.id - a.id)
      .filter((i) => matchesFilter(projectMap[i.project_id]))
      .slice(0, 10);
  }, [incomes, filter, projectMap]);

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-neutral-900 dark:text-neutral-100">
      {/* FILTER + REFRESH */}
      <div className="flex gap-2 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800 
                     text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
        >
          <option value="All">All projects</option>
          {FIXED.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={loadAll}
          className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                     bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {/* STACKED BAR CHARTS BY DATE */}
      <FeedCard
        title="Totals overview"
        subtitle={`Stacked by date (last ${DAYS} days) • Income shown in GBP`}
      >
        <div className="space-y-6">
          <div>
            <p className="text-xs mb-1 text-neutral-600 dark:text-neutral-400">
              Daily time (hours) — stacked by project
            </p>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTimeData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="AutoVisuals"
                    stackId="time"
                    fill={PROJECT_COLORS.AutoVisuals}
                  />
                  <Bar
                    dataKey="AutoTrac"
                    stackId="time"
                    fill={PROJECT_COLORS.AutoTrac}
                  />
                  <Bar
                    dataKey="AutoStock"
                    stackId="time"
                    fill={PROJECT_COLORS.AutoStock}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-xs mb-1 text-neutral-600 dark:text-neutral-400">
              Daily income (£) — stacked by project (auto FX)
            </p>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyIncomeData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="AutoVisuals"
                    stackId="income"
                    fill={PROJECT_COLORS.AutoVisuals}
                  />
                  <Bar
                    dataKey="AutoTrac"
                    stackId="income"
                    fill={PROJECT_COLORS.AutoTrac}
                  />
                  <Bar
                    dataKey="AutoStock"
                    stackId="income"
                    fill={PROJECT_COLORS.AutoStock}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Helpful hint if FX still loading */}
            {Object.keys(fxRates).length <= 1 ? (
              <div className="text-xs mt-2 text-neutral-500 dark:text-neutral-400">
                Loading FX rates…
              </div>
            ) : null}
          </div>
        </div>
      </FeedCard>

      {/* WEEKLY SUMMARY */}
      <FeedCard title="This week (last 7 days)">
        <ul className="space-y-2 text-sm">
          {FIXED.map((name) => (
            <li key={name} className="flex justify-between items-center">
              <span
                className={
                  name === "AutoVisuals"
                    ? "font-medium text-pink-500"
                    : name === "AutoTrac"
                    ? "font-medium text-blue-500"
                    : "font-medium text-green-500"
                }
              >
                {name}
              </span>
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                ⏱ {fmtHours(weeklyTimeTotals[name])} · 💰 £
                {weeklyIncomeTotals[name].toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </FeedCard>

      {/* RECENT TIME ENTRIES */}
      <FeedCard title="Recent time entries" subtitle="Latest 10">
        <ul className="space-y-2">
          {recentTimeEntries.map((e) => {
            const pname = projectMap[e.project_id] || `Project #${e.project_id}`;
            const colorClass = projectColorClass(pname);

            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-700
                           bg-white dark:bg-neutral-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <div className={colorClass}>
                    {pname} · #{e.id}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {e.end_time ? "stopped" : "running"} ·{" "}
                    {new Date(e.start_time).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => deleteTimeEntry(e.id)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm
                             bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  title="Delete time entry"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      </FeedCard>

      {/* RECENT INCOMES */}
      <FeedCard title="Recent incomes" subtitle="Latest 10 (shows GBP)">
        <ul className="space-y-2">
          {recentIncomes.map((i) => {
            const pname = projectMap[i.project_id] || `Project #${i.project_id}`;
            const colorClass = projectColorClass(pname);

            const originalCur = (i.currency || "GBP").toUpperCase();
            const gbp = toGBP(i.amount, i.currency, fxRates);

            return (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-700
                           bg-white dark:bg-neutral-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <div className={colorClass}>
                    {pname} · #{i.id}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {new Date(i.date).toLocaleDateString()} ·{" "}
                    {originalCur === "GBP"
                      ? `£${Number(i.amount).toFixed(2)}`
                      : `${originalCur} ${Number(i.amount).toFixed(2)}  ≈  £${gbp.toFixed(2)}`}
                  </div>

                  {i.source ? (
                    <div className="text-xs text-neutral-700 dark:text-neutral-300 mt-1 break-words">
                      {i.source}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => deleteIncome(i.id)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm
                             bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  title="Delete income"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      </FeedCard>
    </div>
  );
}
