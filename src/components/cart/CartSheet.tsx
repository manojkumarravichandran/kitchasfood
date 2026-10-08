import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCart } from '@/contexts/CartContext'
import { cn } from '@/lib/utils'

// Uses useNavigate, so it must render inside <BrowserRouter> (see App.tsx comment).
export function CartSheet() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, subtotal } = useCart()
  const navigate = useNavigate()

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity',
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
      <div
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-background shadow-xl transition-transform',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Your cart</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close cart">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-foreground">
                      {item.name} {item.portion && <span className="text-muted-foreground">({item.portion})</span>}
                    </p>
                    <p className="text-muted-foreground">
                      ₹{item.unitPrice} ×{' '}
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                        className="w-12 border-b border-border bg-transparent text-center"
                      />
                    </p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-xs text-destructive hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          <Button
            className="w-full"
            disabled={items.length === 0}
            onClick={() => {
              setIsOpen(false)
              navigate('/checkout')
            }}
          >
            Checkout
          </Button>
        </div>
      </div>
    </div>
  )
}
