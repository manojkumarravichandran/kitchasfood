import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5 group', className)}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-hero font-display text-lg font-bold text-primary-foreground shadow-sm">
        KF
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold text-foreground">Kitcha&apos;s Food</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">since 2007</span>
      </span>
    </Link>
  )
}
