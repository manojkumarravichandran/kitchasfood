import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Loader2, ShoppingBag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

// Payment method is a label only — no gateway is integrated anywhere in this
// project (flagged in the master prompt's own operational-rules notes). This
// just records what the customer said they'll pay with.
const PAYMENT_METHODS = [
  { value: 'cash_on_delivery', label: 'Cash on delivery' },
  { value: 'upi', label: 'UPI (pay at delivery)' },
  { value: 'card', label: 'Card (pay at delivery)' },
]

function formatRupees(amount: number) {
  return `₹${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

export default function Checkout() {
  const { user, loading: authLoading } = useAuth()
  const { items, subtotal, clear } = useCart()
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value)
  const { toast } = useToast()
  const navigate = useNavigate()

  // Distance-based delivery charge (₹20 first 2km + ₹10/km, credited to the
  // driver) is a documented operational rule but belongs to backlog item 5
  // (catering rules) and needs address geocoding this project doesn't have
  // set up yet — left at 0 rather than guessed at. orders.delivery_charge
  // defaults to 0 in the schema, so this is a safe, honest placeholder.
  const deliveryCharge = 0
  const total = subtotal + deliveryCharge

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in')
      // Two sequential inserts, not one atomic transaction — the client SDK
      // has no multi-table transaction here (would need a Postgres function
      // to do properly). If the order_items insert fails after the order
      // succeeds, the order is left with no items; acceptable for now but a
      // known limitation, not silently pretended away.
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          status: 'pending',
          order_type: 'retail',
          total_amount: total,
          delivery_address: deliveryAddress || null,
          delivery_charge: deliveryCharge,
          payment_method: paymentMethod,
        })
        .select('id')
        .single()
      if (orderError) throw orderError

      const { error: itemsError } = await supabase.from('order_items').insert(
        items.map((item) => ({
          order_id: order.id,
          menu_item_id: item.menuItemId,
          portion: item.portion,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        }))
      )
      if (itemsError) throw itemsError

      return order.id
    },
    onSuccess: () => {
      toast({ title: 'Order placed!', description: 'We’ve received your order.' })
      clear()
      navigate('/orders')
    },
    onError: (error: Error) => {
      toast({ title: 'Could not place order', description: error.message, variant: 'destructive' })
    },
  })

  if (authLoading) {
    return (
      <div className="container flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Checkout</h1>
        <p className="max-w-md text-muted-foreground">Log in or create an account to place an order.</p>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-24 text-center">
        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold text-foreground">Your cart is empty</h1>
        <Button asChild>
          <Link to="/menu">Browse the menu</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container max-w-xl space-y-6 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground">Checkout</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.name} {item.portion && <span className="text-muted-foreground">({item.portion})</span>} &times; {item.quantity}
              </span>
              <span>{formatRupees(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-sm text-muted-foreground">
            <span>Delivery charge</span>
            <span>{formatRupees(deliveryCharge)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
            <span>Total</span>
            <span>{formatRupees(total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delivery &amp; payment</CardTitle>
          <CardDescription>Payment is collected at delivery — no online payment is set up yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deliveryAddress">Delivery address</Label>
            <Input
              id="deliveryAddress"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Where should we deliver?"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <Label
                  key={m.value}
                  htmlFor={`pay-${m.value}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50"
                >
                  <RadioGroupItem value={m.value} id={`pay-${m.value}`} />
                  <span className="text-sm font-medium text-foreground">{m.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <Button className="w-full" size="lg" onClick={() => placeOrder.mutate()} disabled={placeOrder.isPending}>
            {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Place order &middot; {formatRupees(total)}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}