import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Leaf, Loader2, ShoppingBag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCart } from '@/contexts/CartContext'
import { supabase } from '@/integrations/supabase/client'

// Shapes returned by the nested select below. `types.ts` is still the untyped
// placeholder (see that file's header comment) until `supabase gen types` is run
// against the live project, so these are hand-written to match the real schema
// in supabase/migrations/20261008000000_initial_schema.sql. Postgres `numeric`
// columns come back from PostgREST as strings, hence the string|number unions.
interface MenuItemRow {
  id: string
  category_id: string
  name: string
  description: string | null
  half_price: string | number | null
  full_price: string | number
  kitchen_type: 'veg' | 'nonveg'
  is_veg: boolean
  is_available: boolean
  is_preorder_only: boolean
  display_order: number
}

interface MenuCategoryRow {
  id: string
  name: string
  kitchen_type: 'veg' | 'nonveg'
  description: string | null
  display_order: number
  is_active: boolean
  menu_items: MenuItemRow[]
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function formatRupees(amount: number) {
  return `₹${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      // RLS (can_view_category / the menu_items select policy) already filters
      // this down to exactly what the current viewer — anonymous, retail, or a
      // KBR/Yubi corporate account — is allowed to see, server-side. No
      // client-side customer_type or category-name matching here.
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*, menu_items(*)')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      return (data ?? []) as unknown as MenuCategoryRow[]
    },
    staleTime: 60_000,
  })
}

function MenuItemCard({ item }: { item: MenuItemRow }) {
  const { addItem } = useCart()
  const half = toNumber(item.half_price)
  const full = toNumber(item.full_price)

  function handleAdd(portion: 'half' | 'full', unitPrice: number) {
    addItem({
      menuItemId: item.id,
      name: item.name,
      portion: half !== null ? portion : null,
      unitPrice,
      quantity: 1,
    })
  }

  return (
    <Card className={!item.is_available ? 'opacity-60' : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span
              className={
                'mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ' +
                (item.is_veg ? 'bg-green-600' : 'bg-red-600')
              }
              title={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
              aria-hidden
            />
            <div>
              <p className="font-medium leading-snug text-foreground">{item.name}</p>
              {item.description && (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                  <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                  {item.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {!item.is_available ? (
          <Badge variant="secondary" className="w-fit">
            Coming soon
          </Badge>
        ) : item.is_preorder_only ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {full !== null ? formatRupees(full) : null}
            </span>
            <Button asChild size="sm" variant="outline">
              <a href="/preorder">Pre-order only</a>
            </Button>
          </div>
        ) : half !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleAdd('half', half)}>
              Half &middot; {formatRupees(half)}
            </Button>
            {full !== null && (
              <Button size="sm" onClick={() => handleAdd('full', full)}>
                Full &middot; {formatRupees(full)}
              </Button>
            )}
          </div>
        ) : full !== null ? (
          <Button size="sm" className="w-fit" onClick={() => handleAdd('full', full)}>
            <ShoppingBag className="h-4 w-4" />
            Add &middot; {formatRupees(full)}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function Menu() {
  const { data: categories, isLoading, isError, refetch } = useMenu()
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined)

  const sortedCategories = useMemo(() => {
    if (!categories) return []
    return categories.map((c) => ({
      ...c,
      menu_items: [...c.menu_items].sort(
        (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
      ),
    }))
  }, [categories])

  const resolvedTab = activeTab ?? sortedCategories[0]?.id

  if (isLoading) {
    return (
      <div className="container flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading the menu...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="container flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-foreground">Couldn&apos;t load the menu right now.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (sortedCategories.length === 0) {
    return (
      <div className="container flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
        <p>No menu categories are available right now — check back soon.</p>
      </div>
    )
  }

  return (
    <div className="container flex flex-col gap-6 py-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-foreground">Menu</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Leaf className="h-4 w-4 text-green-600" />
          Veg and non-veg items are prepared in separate kitchens.
        </p>
      </div>

      <Tabs value={resolvedTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            {sortedCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {sortedCategories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="pt-4">
            {category.description && (
              <p className="mb-3 text-sm text-muted-foreground">{category.description}</p>
            )}
            {category.menu_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Coming soon — check back later.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.menu_items.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
