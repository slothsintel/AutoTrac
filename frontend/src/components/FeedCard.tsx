export default function FeedCard({
  title, subtitle, right, children,
}: { title:string; subtitle?:string; right?:React.ReactNode; children?:React.ReactNode }) {
  return (
    <article className="bg-white rounded-2xl shadow-sm border p-4 mb-3">
      <header className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="text-sm">{children}</div>
    </article>
  );
}
