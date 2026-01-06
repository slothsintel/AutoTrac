import { useEffect, useState } from "react";
import api, { endpoints } from "../api";

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

const FIXED = ["AutoVisuals", "AutoTrac", "AutoStock"] as const;

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedName, setSelectedName] = useState("");

  // Load existing projects
  useEffect(() => {
    api
      .get(endpoints.projects)
      .then((r) => setProjects(r.data as Project[]))
      .catch(console.error);
  }, []);

  const existingNames = projects.map((p) => p.name);

  const add = async () => {
    if (!selectedName) return;

    if (existingNames.includes(selectedName)) {
      alert("This project already exists.");
      setSelectedName("");
      return;
    }

    try {
      const res = await api.post(endpoints.projects, { name: selectedName });
      const created = res.data as Project;
      setProjects((prev) => [created, ...prev]);
      setSelectedName("");
    } catch (err) {
      alert("Failed to create project. Please check backend.");
      console.error(err);
    }
  };

  const deleteProject = async (projectId: number, projectName?: string) => {
    const yes = window.confirm(
      `Delete project "${projectName ?? projectId}"?\n\nThis may also delete its incomes/time entries.`
    );
    if (!yes) return;

    try {
      await api.delete(`${endpoints.projects}${projectId}/`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      alert("Failed to delete project. Make sure backend DELETE exists.");
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4 text-neutral-900 dark:text-neutral-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-neutral-700 dark:text-neutral-300">
          {FolderIcon}
        </span>
        <h1 className="text-lg font-semibold">Projects</h1>
      </div>

      {/* PROJECT SELECT + ADD */}
      <div className="flex gap-2 mb-4">
        <select
          className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 
                     bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
        >
          <option value="">Choose project to add…</option>
          {FIXED.map((name) => (
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

      {/* EXISTING PROJECTS LIST */}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 
                       rounded-xl p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-neutral-900 dark:text-neutral-100">
                {p.name}
              </div>

              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                #{p.id}
              </div>

              {p.description && (
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 break-words">
                  {p.description}
                </div>
              )}
            </div>

            <button
              onClick={() => deleteProject(p.id, p.name)}
              className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm
                         bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              title="Delete project"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
