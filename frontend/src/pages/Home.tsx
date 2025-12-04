import { useEffect, useState } from "react";
import api from "../api";
import FeedCard from "../components/FeedCard";

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

const FIXED = ["AutoVisuals", "AutoTrac", "AutoStock"];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [latest, setLatest] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    api.get("/projects/").then((r) => setProjects(r.data));
    api.get("/time-entries/").then((r) => setLatest(r.data));
    api.get("/incomes/").then((r) => setIncomes(r.data));
  }, []);

  // Map project_id → "AutoVisuals" / "AutoTrac" / "AutoStock"
  const projectMap: Record<number, string> = {};
  for (const p of projects) projectMap[p.id] = p.name;

  // --------- TOTAL TIME ---------
  function calculateTimeTotals(entries: TimeEntry[]) {
    const totals: Record<string, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    for (const e of entries) {
      if (!e.end_time) continue;
      const durationSec =
        (new Date(e.end_time).getTime() -
          new Date(e.start_time).getTime()) /
        1000;

      const pname = projectMap[e.project_id];
      if (pname && totals[pname] != null) {
        totals[pname] += durationSec;
      }
    }

    return totals;
  }

  const timeTotals = calculateTimeTotals(latest);

  function fmt(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }

  // --------- TOTAL INCOME ---------
  function calculateIncomeTotals(list: Income[]) {
    const totals: Record<string, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    for (const inc of list) {
      const pname = projectMap[inc.project_id];
      if (pname && totals[pname] != null) {
        totals[pname] += inc.amount;
      }
    }

    return totals;
  }

  const incomeTotals = calculateIncomeTotals(incomes);

  // Filtering helper
  const matchesFilter = (projectName: string) =>
    filter === "All" || filter === projectName;

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
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* TOTALS CARD */}
      <FeedCard title="Totals (by Project)">
        <ul className="space-y-2">
          {FIXED.map((name) => (
            <li key={name} className="flex justify-between">
              <span>{name}</span>
              <span>
                ⏱ {fmt(timeTotals[name])} — 💰 £{incomeTotals[name].toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </FeedCard>

      {/* PROJECT LIST */}
      <FeedCard title="Projects" subtitle={`${projects.length} total`}>
        <ul className="list-disc ml-5">
          {projects
            .filter((p) => matchesFilter(p.name))
            .map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
        </ul>
      </FeedCard>

      {/* TIME ENTRIES */}
      <FeedCard title="Recent time entries">
        <ul className="space-y-2">
          {latest
            .filter((e) => matchesFilter(projectMap[e.project_id]))
            .map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>
                  #{e.id} · {new Date(e.start_time).toLocaleString()}
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {e.end_time ? "stopped" : "running"}
                </span>
              </li>
            ))}
        </ul>
      </FeedCard>

      {/* INCOMES */}
      <FeedCard title="Recent incomes">
        <ul className="space-y-2">
          {incomes
            .filter((i) => matchesFilter(projectMap[i.project_id]))
            .map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>
                  #{i.id} · {new Date(i.date).toLocaleDateString()}
                </span>
                <span>£{i.amount.toFixed(2)}</span>
              </li>
            ))}
        </ul>
      </FeedCard>

    </div>
  );
}
