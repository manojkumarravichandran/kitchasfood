import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu as MenuIcon, ShoppingBag, X } from 'lucide-react'

import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'

const customerNavLinks = [
  { to: '/menu', label: 'Menu' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/preorder', label: 'Pre-order' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, isStaff, isKbrOrYubi, signOut } = useAuth()
  const { itemCount, setIsOpen } = useCart()
  const navigate = useNavigate()

  const links = isKbrOrYubi ? [...customerNavLinks, { to: '/catering', label: 'Catering' }] : customerNavLinks
  // "My Orders" only makes sense once logged in — order history is tied to
  // the signed-in account, same gating the Orders page itself already does.
  const visibleLinks = user ? [...links, { to: '/orders', label: 'My Orders' }] : links

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex">
          {visibleLinks.map((link) => (
            <Link key={link.to} to={link.to} className="text-sm font-medium text-foreground/80 hover:text-foreground">
              {link.label}
            </Link>
          ))}
          {isStaff && (
            <Link to="/admin" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              Staff dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Open cart" onClick={() => setIsOpen(true)}>
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </div>
          </Button>

          {user ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate('/login')}>
              Login
            </Button>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border bg-background px-4 py-3 md:hidden">
          {visibleLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
          {isStaff && (
            <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
              Staff dashboard
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}