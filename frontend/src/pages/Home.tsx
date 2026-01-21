import { useEffect, useMemo, useRef, useState } from "react";
import api, { endpoints } from "../api";
import FeedCard from "../components/FeedCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type RangeMode = "Week" | "Month" | "Year";
const RANGE_DEFAULT: RangeMode = "Month";
const DAYS_WEEK = 7;
const DAYS_MONTH = 30;
const MONTHS_YEAR = 12;

// ---------- FX (Frankfurter, browser-friendly) ----------
type FxRates = Record<string, number>;
const FX_BASE = "GBP";

function normCur(cur?: string) {
  return (cur || "GBP").trim().toUpperCase();
}

async function fetchFxLatest(base = FX_BASE): Promise<FxRates> {
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(
    base
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX latest failed: ${res.status}`);
  const json = await res.json();
  const rates = json?.rates || {};
  return { ...rates, [base]: 1 };
}

function toGBP(
  amount: number,
  currency: string | null | undefined,
  rates?: FxRates
): number | null {
  const cur = normCur(currency || "GBP");
  if (cur === "GBP") return amount;
  if (!rates || !rates[cur]) return null;

  // Frankfurter: base GBP => rates[cur] is 1 GBP in cur (e.g., 1 GBP = 1.17 USD)
  // We want amount(cur) -> GBP: GBP = amount / rate
  const rate = rates[cur];
  if (!rate || rate <= 0) return null;
  return amount / rate;
}

// ---------- Types ----------
type Project = { id: number; name: string };
type TimeEntry = {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
};
type Income = {
  id: number;
  project_id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: string | null;
};

type DailyRow = { date: string; [projectName: string]: number | string };

// ---------- Date helpers ----------
function toDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function toMonthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function makeLastNMonthsKeys(n: number) {
  const keys: string[] = [];
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setMonth(d.getMonth() - i);
    keys.push(toMonthKey(x));
  }
  return keys;
}

function formatMonthLabel(monthKey: string) {
  const [yy, mm] = monthKey.split("-").map((s) => Number(s));
  const d = new Date(yy, (mm || 1) - 1, 1);
  const m = d.toLocaleString(undefined, { month: "short" });
  return `${m} ${yy}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const m = d.toLocaleString(undefined, { month: "short" });
  const day = String(d.getDate());
  return `${m} ${day}`;
}

const emptyDailyRow = (date: string, projectNames: string[]): DailyRow => {
  const row: DailyRow = { date };
  for (const n of projectNames) row[n] = 0;
  return row;
};

// ---------- ggplot-ish styling helpers ----------
const GG = {
  grid: "#e5e7eb",
  axis: "#6b7280",
  tooltipBg: "rgba(255,255,255,0.95)",
  tooltipBorder: "#e5e7eb",
};

// Stable palette + deterministic mapping by project name
const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ec4899", // pink
  "#f59e0b", // amber
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ef4444", // red
  "#84cc16", // lime
  "#f97316", // orange
  "#14b8a6", // teal
];

function colorForProject(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return DEFAULT_COLORS[hash % DEFAULT_COLORS.length];
}

function FixedLegend({ projects }: { projects: Project[] }) {
  if (!projects.length) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4">
      {projects.map((p) => (
        <div key={p.id} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ background: colorForProject(p.name) }}
          />
          <span className="text-neutral-700 dark:text-neutral-300">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

const GgTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((p: any) => ({ name: p.name, value: Number(p.value || 0) }))
    .filter((r: any) => r.value !== 0);

  return (
    <div
      style={{
        background: GG.tooltipBg,
        border: `1px solid ${GG.tooltipBorder}`,
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6b7280" }}>No data</div>
      ) : (
        rows.map((r: any) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 12,
              lineHeight: "18px",
              marginBottom: 2,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: colorForProject(r.name),
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#111827" }}>{r.name}</span>
            </span>
            <span style={{ fontWeight: 700 }}>{r.value.toFixed(2)}</span>
          </div>
        ))
      )}
    </div>
  );
};

// Make the chart wide enough to encourage swipe; on mobile each day ~48px
function chartInnerWidthPx(nKeys: number) {
  return Math.max(320, nKeys * 48);
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<string>("All");
  const [rangeMode, setRangeMode] = useState<RangeMode>(RANGE_DEFAULT);

  const [fxRates, setFxRates] = useState<FxRates>({ GBP: 1 });

  const timeScrollRef = useRef<HTMLDivElement | null>(null);
  const incomeScrollRef = useRef<HTMLDivElement | null>(null);

  async function loadAll({ scrollCharts }: { scrollCharts?: boolean } = {}) {
    setLoading(true);
    try {
      const [pRes, tRes, iRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.timeEntries),
        api.get(endpoints.incomes),
      ]);
      setProjects(pRes.data || []);
      setTimeEntries(tRes.data || []);
      setIncomes(iRes.data || []);

      if (scrollCharts) {
        setTimeout(() => {
          const el1 = timeScrollRef.current;
          const el2 = incomeScrollRef.current;
          if (el1) el1.scrollLeft = el1.scrollWidth;
          if (el2) el2.scrollLeft = el2.scrollWidth;
        }, 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll({ scrollCharts: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const matchesFilter = (projectName?: string) =>
    filter === "All" || (projectName && filter === projectName);

  // Load FX rates for currencies appearing in incomes
  useEffect(() => {
    let cancelled = false;

    const currencies = Array.from(new Set((incomes || []).map((i) => normCur(i.currency))));
    const missing = currencies.filter((c) => c !== "GBP" && !fxRates[c]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const rates = await fetchFxLatest("GBP");
        if (cancelled) return;
        setFxRates((prev) => ({ ...prev, ...rates }));
      } catch (e) {
        console.error("FX load failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes]);

  const periodKeys = useMemo(() => {
    if (rangeMode === "Week") return makeLastNDaysKeys(DAYS_WEEK);
    if (rangeMode === "Month") return makeLastNDaysKeys(DAYS_MONTH);
    return makeLastNMonthsKeys(MONTHS_YEAR);
  }, [rangeMode]);

  const rangeSubtitle = useMemo(() => {
    if (rangeMode === "Week")
      return `Stacked by date (last ${DAYS_WEEK} days) • Swipe left/right on charts`;
    if (rangeMode === "Month")
      return `Stacked by date (last ${DAYS_MONTH} days) • Swipe left/right on charts`;
    return `Stacked by month (last ${MONTHS_YEAR} months) • Swipe left/right on charts`;
  }, [rangeMode]);

  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);

  const dailyTimeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();

    if (rangeMode === "Year") {
      for (const mk of periodKeys)
        rows.set(mk, emptyDailyRow(formatMonthLabel(mk), projectNames));

      for (const e of timeEntries) {
        if (!e.end_time) continue;

        const pname = projectMap[e.project_id];
        if (!pname) continue;

        const start = new Date(e.start_time);
        const end = new Date(e.end_time);
        const mk = toMonthKey(start);
        if (!rows.has(mk)) continue;

        const durationHours = (end.getTime() - start.getTime()) / 1000 / 3600;
        const row = rows.get(mk)!;
        const prev = typeof row[pname] === "number" ? row[pname] : 0;
        row[pname] = prev + Math.max(0, durationHours);
      }

      return Array.from(rows.values());
    }

    for (const day of periodKeys) rows.set(day, emptyDailyRow(day, projectNames));

    for (const e of timeEntries) {
      if (!e.end_time) continue;

      const pname = projectMap[e.project_id];
      if (!pname) continue;

      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      const dayKey = toDayKey(start);
      if (!rows.has(dayKey)) continue;

      const durationHours = (end.getTime() - start.getTime()) / 1000 / 3600;
      const row = rows.get(dayKey)!;
      const prev = typeof row[pname] === "number" ? row[pname] : 0;
      row[pname] = prev + Math.max(0, durationHours);
    }

    return Array.from(rows.values());
  }, [timeEntries, projectMap, periodKeys, projectNames, rangeMode]);

  const dailyIncomeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();

    if (rangeMode === "Year") {
      for (const mk of periodKeys)
        rows.set(mk, emptyDailyRow(formatMonthLabel(mk), projectNames));

      for (const inc of incomes) {
        const pname = projectMap[inc.project_id];
        if (!pname) continue;

        const d = new Date(inc.date + "T00:00:00");
        const mk = toMonthKey(d);
        if (!rows.has(mk)) continue;

        const gbp = toGBP(inc.amount, inc.currency, fxRates);
        const row = rows.get(mk)!;
        const prev = typeof row[pname] === "number" ? row[pname] : 0;
        row[pname] = prev + Math.max(0, gbp ?? 0);
      }

      return Array.from(rows.values());
    }

    for (const day of periodKeys) rows.set(day, emptyDailyRow(day, projectNames));

    for (const inc of incomes) {
      const pname = projectMap[inc.project_id];
      if (!pname) continue;

      const dayKey = inc.date;
      if (!rows.has(dayKey)) continue;

      const gbp = toGBP(inc.amount, inc.currency, fxRates);
      const row = rows.get(dayKey)!;
      const prev = typeof row[pname] === "number" ? row[pname] : 0;
      row[pname] = prev + Math.max(0, gbp ?? 0);
    }

    return Array.from(rows.values());
  }, [incomes, projectMap, periodKeys, projectNames, fxRates, rangeMode]);

  const visibleProjectsFor = (rows: DailyRow[]) => {
    const sums: Record<string, number> = {};
    for (const pn of projectNames) sums[pn] = 0;

    for (const r of rows) {
      for (const pn of projectNames) {
        const v = Number((r as any)[pn] || 0);
        sums[pn] += v;
      }
    }

    const base = projects.filter((p) => sums[p.name] > 0);
    if (filter !== "All") return base.filter((p) => p.name === filter);
    return base;
  };

  const legendProjectsTime = useMemo(
    () => visibleProjectsFor(dailyTimeData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailyTimeData, filter, projects, projectNames]
  );

  const legendProjectsIncome = useMemo(
    () => visibleProjectsFor(dailyIncomeData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailyIncomeData, filter, projects, projectNames]
  );

  const xTickFormatter = useMemo(() => {
    return rangeMode === "Year" ? (v: string) => v : (v: string) => formatShortDate(v);
  }, [rangeMode]);

  // Weekly totals cards (existing behaviour)
  function calculateWeeklyTimeTotals(list: TimeEntry[]) {
    const totals: Record<string, number> = {};
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const e of list) {
      if (!e.end_time) continue;

      const startMs = new Date(e.start_time).getTime();
      if (startMs < sevenDaysAgo) continue;

      const name = projectMap[e.project_id];
      if (!name) continue;

      const durationSec = (new Date(e.end_time).getTime() - startMs) / 1000;
      totals[name] = (totals[name] || 0) + Math.max(0, durationSec);
    }
    return totals;
  }

  function calculateWeeklyIncomeTotals(list: Income[]) {
    const totals: Record<string, number> = {};
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const inc of list) {
      const d = new Date(inc.date).getTime();
      if (d < sevenDaysAgo) continue;

      const name = projectMap[inc.project_id];
      if (!name) continue;

      const gbp = toGBP(inc.amount, inc.currency, fxRates);
      totals[name] = (totals[name] || 0) + (gbp ?? 0);
    }
    return totals;
  }

  const weeklyTimeTotals = calculateWeeklyTimeTotals(timeEntries);
  const weeklyIncomeTotals = calculateWeeklyIncomeTotals(incomes);

  const FIXED = useMemo(() => projects.map((p) => p.name), [projects]);

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-neutral-900 dark:text-neutral-100">
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
          onClick={() => loadAll({ scrollCharts: true })}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <FeedCard title="Totals overview" subtitle={rangeSubtitle}>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-600 dark:text-neutral-400">View:</div>
            <select
              value={rangeMode}
              onChange={(e) => setRangeMode(e.target.value as RangeMode)}
              className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700 text-sm"
              aria-label="Range filter"
            >
              <option value="Week">Week</option>
              <option value="Month">Month</option>
              <option value="Year">Year</option>
            </select>
          </div>

          <div>
            <p className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Daily time (hours) — stacked by project
            </p>

            <div className="rounded-2xl bg-white dark:bg-neutral-900 p-2 shadow-sm border border-neutral-200 dark:border-neutral-800">
              <div className="pb-2">
                <FixedLegend projects={legendProjectsTime} />
              </div>

              <div className="flex items-stretch">
                <div className="pr-2">
                  <div className="h-56 w-[44px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyTimeData}
                        margin={{ top: 6, right: 0, bottom: 6, left: 0 }}
                        barCategoryGap={10}
                      >
                        {projects
                          .filter((p) => (filter === "All" ? true : p.name === filter))
                          .map((p) => (
                            <Bar
                              key={p.id}
                              dataKey={p.name}
                              stackId="time"
                              fill="transparent"
                              fillOpacity={0}
                              isAnimationActive={false}
                            />
                          ))}

                        <YAxis
                          tick={{ fontSize: 11, fill: GG.axis }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                        />
                        <XAxis dataKey="date" hide />
                        <Tooltip content={<></>} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto" ref={timeScrollRef}>
                  <div style={{ width: chartInnerWidthPx(periodKeys.length) }}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dailyTimeData}
                          margin={{ top: 6, right: 12, bottom: 6, left: 0 }}
                          barCategoryGap={10}
                        >
                          <CartesianGrid
                            stroke={GG.grid}
                            strokeDasharray="3 3"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="date"
                            tickFormatter={xTickFormatter}
                            tick={{ fontSize: 11, fill: GG.axis }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={16}
                          />

                          <YAxis hide />

                          <Tooltip content={<GgTooltip />} />

                          {projects
                            .filter((p) => (filter === "All" ? true : p.name === filter))
                            .map((p) => (
                              <Bar
                                key={p.id}
                                dataKey={p.name}
                                stackId="time"
                                fill={colorForProject(p.name)}
                                radius={[6, 6, 0, 0]}
                                fillOpacity={0.85}
                              />
                            ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Swipe left/right to view more {rangeMode === "Year" ? "months" : "days"}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Daily income (£) — stacked by project (auto FX)
            </p>

            <div className="rounded-2xl bg-white dark:bg-neutral-900 p-2 shadow-sm border border-neutral-200 dark:border-neutral-800">
              <div className="pb-2">
                <FixedLegend projects={legendProjectsIncome} />
              </div>

              <div className="flex items-stretch">
                <div className="pr-2">
                  <div className="h-56 w-[44px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyIncomeData}
                        margin={{ top: 6, right: 0, bottom: 6, left: 0 }}
                        barCategoryGap={10}
                      >
                        {projects
                          .filter((p) => (filter === "All" ? true : p.name === filter))
                          .map((p) => (
                            <Bar
                              key={p.id}
                              dataKey={p.name}
                              stackId="income"
                              fill="transparent"
                              fillOpacity={0}
                              isAnimationActive={false}
                            />
                          ))}

                        <YAxis
                          tick={{ fontSize: 11, fill: GG.axis }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                        />
                        <XAxis dataKey="date" hide />
                        <Tooltip content={<></>} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto" ref={incomeScrollRef}>
                  <div style={{ width: chartInnerWidthPx(periodKeys.length) }}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dailyIncomeData}
                          margin={{ top: 6, right: 12, bottom: 6, left: 0 }}
                          barCategoryGap={10}
                        >
                          <CartesianGrid
                            stroke={GG.grid}
                            strokeDasharray="3 3"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="date"
                            tickFormatter={xTickFormatter}
                            tick={{ fontSize: 11, fill: GG.axis }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={16}
                          />

                          <YAxis hide />

                          <Tooltip content={<GgTooltip />} />

                          {projects
                            .filter((p) => (filter === "All" ? true : p.name === filter))
                            .map((p) => (
                              <Bar
                                key={p.id}
                                dataKey={p.name}
                                stackId="income"
                                fill={colorForProject(p.name)}
                                radius={[6, 6, 0, 0]}
                                fillOpacity={0.85}
                              />
                            ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Swipe left/right to view more {rangeMode === "Year" ? "months" : "days"}
              </div>
            </div>
          </div>

          {/* Existing weekly totals sections (kept as-is) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white dark:bg-neutral-900 p-3 shadow-sm border border-neutral-200 dark:border-neutral-800">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Last 7 days (time)
              </div>
              <div className="space-y-1">
                {Object.entries(weeklyTimeTotals)
                  .filter(([name]) => matchesFilter(name))
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, sec]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="truncate">{name}</span>
                      <span className="tabular-nums">
                        {(sec / 3600).toFixed(1)}h
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-neutral-900 p-3 shadow-sm border border-neutral-200 dark:border-neutral-800">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Last 7 days (income)
              </div>
              <div className="space-y-1">
                {Object.entries(weeklyIncomeTotals)
                  .filter(([name]) => matchesFilter(name))
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, gbp]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="truncate">{name}</span>
                      <span className="tabular-nums">£{gbp.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </FeedCard>
    </div>
  );
}
