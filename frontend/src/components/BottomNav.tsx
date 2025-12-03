import { NavLink } from "react-router-dom";

const Tab = ({ to, label, icon }: { to:string; label:string; icon:JSX.Element }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center gap-1 flex-1 py-2
       ${isActive ? "text-blue-600" : "text-neutral-500"}`
    }
  >
    {icon}
    <span className="text-[12px]">{label}</span>
  </NavLink>
);

const Icon = {
  home:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10.5 12 3l9 7.5v10a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20.5z"/><path d="M9 22V12h6v10"/></svg>,
  clock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l3 2"/></svg>,
  folder:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h6l2 3h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  more:  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
};

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto max-w-md flex">{/* center on large screens */}
        <Tab to="/" label="Home" icon={Icon.home} />
        <Tab to="/track" label="Track" icon={Icon.clock} />
        <Tab to="/projects" label="Projects" icon={Icon.folder} />
        <Tab to="/more" label="More" icon={Icon.more} />
      </div>
    </nav>
  );
}
