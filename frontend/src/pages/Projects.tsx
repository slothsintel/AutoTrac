import { useEffect, useState } from "react";
import api from "../api";

type Project = { id: number; name: string; description?: string };

const FolderIcon = (
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
    <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const FIXED_PROJECTS = ["AutoVisuals", "AutoTrac", "AutoStock"];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    api.get("/projects/").then((r) => setProjects(r.data));
  }, []);

  const existingNames = projects.map((p) => p.name);
  const availableChoices = FIXED_PROJECTS.filter(
    (name) => !existingNames.includes(name)
  );

  const add = async () => {
    if (!selectedName) return;
    if (existingNames.includes(selectedName)) {
      setSelectedName("");
      return;
    }

    const res = await api.post("/projects/", { name: selectedName });
    setProjects([res.data, ...projects]);
    setSelectedName("");
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4 text-neutral-900 dark:text-neutral-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-neutral-700 dark:text-neutral-300">
          {FolderIcon}
        </span>
        <h1 className="text-lg font-semibold">Projects</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <select
          className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 
                     bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
        >
          <option value="">
            {availableChoices.length
              ? "Choose project to add…"
              : "All default projects added"}
          </option>
          {availableChoices.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          onClick={add}
          disabled={!selectedName}
          className="px-4 rounded-xl bg-blue-600 text-white disabled:bg-neutral-400 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 
                       rounded-xl p-3"
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-100">
              {p.name}
            </div>

            {p.description && (
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                {p.description}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
