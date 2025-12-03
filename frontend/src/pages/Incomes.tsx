import { useEffect, useState } from "react";
import api from "../api";

type Income = {
  id: number;
  project_id: number;
  date: string;
  amount: number;
  source?: string;
};

type Project = { id:number; name:string };

export default function Incomes() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    api.get("/incomes/").then(r => setIncomes(r.data));
    api.get("/projects/").then(r => setProjects(r.data));
  }, []);

  const addIncome = async () => {
    if (!projectId || !amount) return;

    const res = await api.post("/incomes/", {
      project_id: projectId,
      amount: Number(amount),
      date: new Date().toISOString().slice(0, 10),
      source
    });

    setIncomes([res.data, ...incomes]);
    setAmount("");
    setSource("");
    setProjectId("");
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="text-lg font-semibold mb-3">Incomes</h1>

      <div className="space-y-3 mb-6">
        <select
          className="w-full bg-white dark:bg-neutral-800 border rounded-xl p-2"
          value={projectId}
          onChange={e => setProjectId(Number(e.target.value))}
        >
          <option value="">Choose project…</option>
          {projects.map(p => (
            <option value={p.id} key={p.id}>{p.name}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Amount (£)"
          value={amount}
          className="w-full bg-white dark:bg-neutral-800 border rounded-xl p-2"
          onChange={e => setAmount(e.target.value)}
        />

        <input
          type="text"
          placeholder="Source (optional)"
          value={source}
          className="w-full bg-white dark:bg-neutral-800 border rounded-xl p-2"
          onChange={e => setSource(e.target.value)}
        />

        <button
          onClick={addIncome}
          className="w-full py-3 rounded-full bg-blue-600 text-white font-semibold"
        >
          Add income
        </button>
      </div>

      <ul className="space-y-2">
        {incomes.map(i => (
          <li
            key={i.id}
            className="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-xl p-3 flex justify-between"
          >
            <div>
              <div className="font-medium">£{i.amount.toFixed(2)}</div>
              <div className="text-xs text-neutral-500">{i.date}</div>
            </div>
            <div className="text-xs">{i.source}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
