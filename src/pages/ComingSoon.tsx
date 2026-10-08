// Shared placeholder for routes whose real page is built in a later step of the
// rebuild (see the project task list) — keeps every route in App.tsx resolving to
// something real instead of a 404 while the feature pages are built incrementally.
export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-muted-foreground">This page is being built next — check back soon.</p>
    </div>
  )
}
