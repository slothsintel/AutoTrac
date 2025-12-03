import { useEffect, useState } from "react";
import api from "../api";
import FeedCard from "../components/FeedCard";

type Project = { id:number; name:string };
type TimeEntry = { id:number; project_id:number; start_time:string; end_time:string|null; note?:string };
type Income = { id:number; project_id:number; date:string; amount:number; source?:string };

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [latest, setLatest] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  useEffect(() => {
    api.get("/projects/").then(r => setProjects(r.data));
    api.get("/time-entries/?limit=10").then(r => setLatest(r.data.slice(0,10)));
    api.get("/incomes/?limit=10").then(r => setIncomes(r.data.slice(0,10)));
  }, []);

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-neutral-900 dark:text-neutral-100">

      <FeedCard title="Projects" subtitle={`${projects.length} total`}>
        <ul className="list-disc ml-5">
          {projects.map(p => (
            <li
              key={p.id}
              className="text-neutral-900 dark:text-neutral-100"
            >
              {p.name}
            </li>
          ))}
        </ul>
      </FeedCard>

      <FeedCard title="Recent time entries">
        <ul className="space-y-2">
          {latest.map(e => (
            <li key={e.id} className="flex justify-between">
              <span className="text-neutral-900 dark:text-neutral-100">
                #{e.id} · {new Date(e.start_time).toLocaleString()}
              </span>

              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {e.end_time ? "stopped" : "running"}
              </span>
            </li>
          ))}
        </ul>
      </FeedCard>

      <FeedCard title="Recent incomes">
        <ul className="space-y-2">
          {incomes.map(i => (
            <li key={i.id} className="flex justify-between">
              <span className="text-neutral-900 dark:text-neutral-100">
                #{i.id} · {new Date(i.date).toLocaleDateString()}
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                £{i.amount.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </FeedCard>

    </div>
  );
}
