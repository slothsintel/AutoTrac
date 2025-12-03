import { Routes, Route} from "react-router-dom";
import Home from "./pages/Home";
import Track from "./pages/Track";
import Projects from "./pages/Projects";
import More from "./pages/More";
import BottomNav from "./components/BottomNav";

export default function App() {
  return (
    <div className="min-h-[100svh] bg-neutral-50 text-neutral-900 flex flex-col">
      {/* content */}
      <main className="flex-1 pb-16"> {/* padding for bottom bar */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/track" element={<Track />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/more" element={<More />} />
        </Routes>
      </main>

      {/* fixed bottom nav like Twitter/IG */}
      <BottomNav />
    </div>
  );
}
