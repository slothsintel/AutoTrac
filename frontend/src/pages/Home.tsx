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
  Cell,
} from "recharts";

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
  date: string;
  amount: number;
  currency?: string;
  source?: string;
};

const FIXED = ["AutoVisuals", "AutoTrac", "AutoStock"] as const;
type FixedProject = (typeof FIXED)[number];

const PROJECT_COLORS: Record<FixedProject, string> = {
  AutoVisuals: "#ec4899",
  AutoTrac: "#3b82f6",
  AutoStock: "#22c55e",
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [latest, setLatest] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [filter, setFilter] = useState<string>("All");

  const loadAll = async () => {
    try {
      const [pRes, tRes, iRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.timeEntries),
        api.get(endpoints.incomes),
      ]);

      setProjects(pRes.data as Project[]);
      setLatest(tRes.data as TimeEntry[]);
      setIncomes(iRes.data as Income[]);
    } catch (err) {
      console.error("Home loadAll failed:", err);
      // Keep UI usable; you can add a toast later if you want
    }
  };

  // Load once
  useEffect(() => {
    loadAll();
  }, []);

  // Reload whenever user returns to the tab/app (mobile + desktop friendly)
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

  // Map project_id -> project name (memo so it updates correctly)
  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const matchesFilter = (projectName?: string) =>
    filter === "All" || (projectName && filter === projectName);

  // ---------- TOTALS (all time) ----------
  function calculateTimeTotals(entries: TimeEntry[]) {
    const totals: Record<FixedProject, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    for (const e of entries) {
      if (!e.end_time) continue;

      const durationSec =
        (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) /
        1000;

      const name = projectMap[e.project_id] as FixedProject | undefined;
      if (name && totals[name] != null) totals[name] += durationSec;
    }

    return totals;
  }

  function calculateIncomeTotals(list: Income[]) {
    const totals: Record<FixedProject, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    for (const inc of list) {
      const name = projectMap[inc.project_id] as FixedProject | undefined;
      if (name && totals[name] != null) totals[name] += inc.amount;
    }

    return totals;
  }

  const timeTotals = calculateTimeTotals(latest);
  const incomeTotals = calculateIncomeTotals(incomes);

  // ---------- WEEKLY SUMMARY (last 7 days) ----------
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
      if (name && totals[name] != null) totals[name] += inc.amount;
    }

    return totals;
  }

  const weeklyTimeTotals = calculateWeeklyTimeTotals(latest);
  const weeklyIncomeTotals = calculateWeeklyIncomeTotals(incomes);

  const fmtHours = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const perProjectChartData = FIXED.map((name) => ({
    name,
    hours: timeTotals[name] / 3600,
    income: incomeTotals[name],
  }));

  const filteredTimeEntries = latest.filter((e) =>
    matchesFilter(projectMap[e.project_id])
  );

  const filteredIncomes = incomes.filter((i) =>
    matchesFilter(projectMap[i.project_id])
  );

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-neutral-900 dark:text-neutral-100">
      {/* FILTER DROPDOWN */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800 
                   text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700 w-full"
      >
        <option value="All">All projects</option>
        {FIXED.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {/* TOTALS BAR CHARTS */}
      <FeedCard title="Totals overview">
        <div className="space-y-4">
          <div>
            <p className="text-xs mb-1 text-neutral-600 dark:text-neutral-400">
              Total time (hours) per project
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perProjectChartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hours" name="Hours">
                    {perProjectChartData.map((row, idx) => (
                      <Cell
                        key={idx}
                        fill={PROJECT_COLORS[row.name as FixedProject]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-xs mb-1 text-neutral-600 dark:text-neutral-400">
              Total income (£) per project
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perProjectChartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" name="Income (£)">
                    {perProjectChartData.map((row, idx) => (
                      <Cell
                        key={idx}
                        fill={PROJECT_COLORS[row.name as FixedProject]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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

      <FeedCard title="Projects" subtitle={`${projects.length} total`}>
        <ul className="list-disc ml-5">
          {projects.filter((p) => matchesFilter(p.name)).map((p) => (
            <li
              key={p.id}
              className={
                p.name === "AutoVisuals"
                  ? "text-pink-500"
                  : p.name === "AutoTrac"
                  ? "text-blue-500"
                  : p.name === "AutoStock"
                  ? "text-green-500"
                  : ""
              }
            >
              {p.name}
            </li>
          ))}
        </ul>
      </FeedCard>

      <FeedCard title="Recent time entries">
        <ul className="space-y-2">
          {filteredTimeEntries.map((e) => {
            const pname = projectMap[e.project_id] || `Project #${e.project_id}`;
            const colorClass =
              pname === "AutoVisuals"
                ? "text-pink-500"
                : pname === "AutoTrac"
                ? "text-blue-500"
                : pname === "AutoStock"
                ? "text-green-500"
                : "text-neutral-900 dark:text-neutral-100";

            return (
              <li key={e.id} className="flex justify-between">
                <span className={colorClass}>
                  {pname} · #{e.id}
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {e.end_time ? "stopped" : "running"}
                </span>
              </li>
            );
          })}
        </ul>
      </FeedCard>

      <FeedCard title="Recent incomes">
        <ul className="space-y-2">
          {filteredIncomes.map((i) => {
            const pname = projectMap[i.project_id] || `Project #${i.project_id}`;
            const colorClass =
              pname === "AutoVisuals"
                ? "text-pink-500"
                : pname === "AutoTrac"
                ? "text-blue-500"
                : pname === "AutoStock"
                ? "text-green-500"
                : "text-neutral-900 dark:text-neutral-100";

            return (
              <li key={i.id} className="flex justify-between">
                <span className={colorClass}>
                  {pname} · #{i.id}
                </span>
                <span>£{i.amount.toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
      </FeedCard>
    </div>
  );
}
