import { useEffect, useState } from "react";
import api from "../api";

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
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function Incomes() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [currency, setCurrency] = useState("GBP");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    api.get("/incomes/").then((r) => setIncomes(r.data));
    api.get("/projects/").then((r) => setProjects(r.data));
  }, []);

  const addIncome = async () => {
    if (!projectId || !amount) return;

    const res = await api.post("/incomes/", {
      project_id: projectId,
      amount: Number(amount),
      currency,
      date: new Date().toISOString().slice(0, 10),
      source,
    });

    setIncomes([res.data, ...incomes]);
    setAmount("");
    setSource("");
    setProjectId("");
  };

  const formatAmount = (cur: string | undefined, n: number) => {
    switch (cur) {
      case "USD":
        return `$${n.toFixed(2)}`;
      case "HKD":
        return `HK$${n.toFixed(2)}`;
      case "EUR":
        return `€${n.toFixed(2)}`;
      case "RMB":
      case "CNY":
        return `¥${n.toFixed(2)}`;
      default:
        return `£${n.toFixed(2)}`;
    }
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <div className="flex items-center gap-2 mb-3 text-neutral-900 dark:text-neutral-100">
        <span className="text-neutral-700 dark:text-neutral-300">
          {MoneyIcon}
        </span>
        <h1 className="text-lg font-semibold">Incomes</h1>
      </div>

      <div className="space-y-3 mb-6">
        <select
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          value={projectId}
          onChange={(e) => setProjectId(Number(e.target.value))}
        >
          <option value="">Choose project…</option>
          {projects.map((p) => (
            <option value={p.id} key={p.id}>
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
          <option value="HKD">HKD (HK$)</option>
          <option value="EUR">EUR (€)</option>
          <option value="RMB">RMB (¥)</option>
        </select>

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          type="text"
          placeholder="Source (optional)"
          value={source}
          className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border rounded-xl p-2"
          onChange={(e) => setSource(e.target.value)}
        />

        <button
          onClick={addIncome}
          className="w-full py-3 rounded-full bg-blue-600 text-white font-semibold"
        >
          Add income
        </button>
      </div>

      <ul className="space-y-2">
        {incomes.map((i) => (
          <li
            key={i.id}
            className="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-xl p-3 flex justify-between"
          >
            <div>
              <div className="font-medium text-neutral-900 dark:text-neutral-100">
                {formatAmount(i.currency, i.amount)}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {i.date}
              </div>
            </div>

            {i.source && (
              <div className="text-xs text-neutral-600 dark:text-neutral-300">
                {i.source}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
