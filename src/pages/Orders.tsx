import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, PackageOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'

interface OrderItemRow {
  id: string
  portion: 'half' | 'full' | null
  quantity: number
  unit_price: string | number
  menu_items: { name: string } | null
}

interface OrderRow {
  id: string
  status: OrderStatus
  total_amount: string | number
  delivery_charge: string | number
  delivery_address: string | null
  payment_method: string | null
  created_at: string
  order_items: OrderItemRow[]
}

function toNumber(value: string | number) {
  return typeof value === 'number' ? value : parseFloat(value)
}

function formatRupees(amount: number) {
  return `₹${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

function statusLabel(status: OrderStatus) {
  return status
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function statusVariant(status: OrderStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'cancelled') return 'destructive'
  if (status === 'delivered') return 'default'
  return 'secondary'
}

function useMyOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['orders', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, menu_items(name))')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OrderRow[]
    },
  })
}

export default function Orders() {
  const { user, loading: authLoading } = useAuth()
  const { data: orders, isLoading, isError } = useMyOrders(user?.id)

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
        <h1 className="font-display text-2xl font-bold text-foreground">Your orders</h1>
        <p className="max-w-md text-muted-foreground">Log in to see your order history.</p>
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

  return (
    <div className="container max-w-2xl space-y-6 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground">Your orders</h1>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading orders...
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load your orders.</p>
      ) : !orders || orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <PackageOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No orders yet.</p>
          <Button asChild>
            <Link to="/menu">Browse the menu</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {format(new Date(order.created_at), 'd MMM yyyy, h:mm a')}
                  </CardTitle>
                  {order.delivery_address && (
                    <p className="text-xs text-muted-foreground">Delivering to: {order.delivery_address}</p>
                  )}
                </div>
                <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.menu_items?.name ?? 'Item'} {item.portion && <span className="text-muted-foreground">({item.portion})</span>}{' '}
                      &times; {item.quantity}
                    </span>
                    <span>{formatRupees(toNumber(item.unit_price) * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatRupees(toNumber(order.total_amount))}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}