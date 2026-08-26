export function CardGrid({children}: {children: React.ReactNode}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}
