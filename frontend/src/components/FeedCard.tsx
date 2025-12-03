export default function FeedCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <article
      className="
        bg-white dark:bg-neutral-800 
        border border-neutral-200 dark:border-neutral-700
        rounded-2xl shadow-sm p-4 mb-3
      "
    >
      <header className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>

          {subtitle && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>

        {right}
      </header>

      <div className="text-sm text-neutral-900 dark:text-neutral-100">
        {children}
      </div>
    </article>
  );
}
