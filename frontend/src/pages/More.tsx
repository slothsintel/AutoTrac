// frontend/src/pages/More.tsx
import FeedCard from "../components/FeedCard";

export default function More() {
  const links = [
    {
      label: "Privacy",
      href: "https://slothsintel.com/privacy.html",
    },
    {
      label: "Terms",
      href: "https://slothsintel.com/terms.html",
    },
    {
      label: "GitHub",
      href: "https://github.com/slothsintel",
    },
  ];

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-neutral-900 dark:text-neutral-100">
      <FeedCard title="More" subtitle="Links & app info">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-center px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                           bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800
                           text-sm font-medium"
              >
                {l.label}
              </a>
            ))}
          </div>

          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Tip: These links open in a new tab so you don’t lose your current session.
          </p>
        </div>
      </FeedCard>

      {/* Footer ONLY on More page */}
      <footer className="mt-10 pt-6 border-t border-neutral-300 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400 space-y-2 opacity-90">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">
          AutoTrac is powered by Sloths Intel
        </p>

        <p>
          © 2025–2026 <strong>Sloths Intel</strong>, is a trading name of Sloths Intel Ltd.
        </p>

        <p>
          Registered office: 82A James Carter Road, Mildenhall, Suffolk, United Kingdom,
          IP28&nbsp;7DE.
        </p>

        <p>Registered number: 16907507 (England and Wales).</p>
      </footer>
    </div>
  );
}
