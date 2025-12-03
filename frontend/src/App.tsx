import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Track from "./pages/Track";
import Projects from "./pages/Projects";
import Incomes from "./pages/Incomes";   // ← NEW
import More from "./pages/More";
import BottomNav from "./components/BottomNav";

export default function App() {
  return (
    <div className="min-h-[100svh] bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 flex flex-col">
      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/track" element={<Track />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/incomes" element={<Incomes />} />   {/* NEW */}
          <Route path="/more" element={<More />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}
