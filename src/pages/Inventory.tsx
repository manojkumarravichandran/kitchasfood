import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Minus, Plus, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

// Postgres `numeric` columns come back from PostgREST as strings — same
// string|number convention used in Menu.tsx/Orders.tsx.
interface InventoryItemRow {
  id: string
  name: string
  unit: string
  current_quantity: string | number
  reorder_threshold: string | number
  category: string | null
  source_note: string | null
}

// Loose grouping labels for the `category` values used by the seed
// migrations — not a schema enum, so an unrecognized value just falls
// back to the raw string rather than breaking anything.
const CATEGORY_LABELS: Record<string, string> = {
  pulses_grains: 'Pulses, grains, flours',
  spices_masala: 'Spice powders / masalas',
  whole_spices: 'Whole spices',
  oils_ghee: 'Oils, ghee',
  dairy_eggs: 'Dairy & eggs',
  sauces_condiments: 'Sauces, condiments, ready mixes',
  salt_sugar: 'Salt, sugar, sweeteners',
  dry_fruits_sweets: 'Dry fruits / sweets',
  fresh_produce: 'Fresh produce',
  other: 'Other',
  cleaning_supplies: 'Cleaning supplies',
  utilities: 'Utilities',
  meat_seafood: 'Meat',
  bakery_mixes: 'Bakery / ready-made bases',
}

function categoryLabel(category: string | null) {
  if (!category) return 'Uncategorized'
  return CATEGORY_LABELS[category] ?? category
}

function toNumber(value: string | number) {
  return typeof value === 'number' ? value : parseFloat(value)
}

function formatQty(value: string | number, unit: string) {
  const n = toNumber(value)
  return `${n % 1 === 0 ? n : n.toFixed(2)} ${unit}`
}

function useInventory() {
  return useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      // RLS ("Staff can view inventory") already restricts this to staff —
      // no client-side role check needed to decide what to fetch.
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, unit, current_quantity, reorder_threshold, category, source_note')
        .order('category', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as InventoryItemRow[]
    },
  })
}

function StockAdjustForm({
  item,
  direction,
  onDone,
}: {
  item: InventoryItemRow
  direction: 'in' | 'out'
  onDone: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter a quantity greater than 0')
      // Logs an inventory_transactions row and updates current_quantity in
      // one atomic DB call — see 20261015000000_inventory_transaction_function.sql
      // for why this isn't two separate client-side writes.
      const { error } = await supabase.rpc('record_inventory_transaction', {
        p_inventory_item_id: item.id,
        p_transaction_type: direction,
        p_quantity: qty,
        p_notes: notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      toast({ title: direction === 'in' ? 'Stock added' : 'Stock recorded as used' })
      onDone()
    },
    onError: (error: Error) => toast({ title: 'Could not save', description: error.message, variant: 'destructive' }),
  })

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="space-y-1">
        <Label htmlFor={`qty-${item.id}`} className="text-xs">
          {direction === 'in' ? 'Quantity received' : 'Quantity used'} ({item.unit})
        </Label>
        <Input
          id={`qty-${item.id}`}
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-8 w-28"
          autoFocus
        />
      </div>
      <div className="min-w-[160px] flex-1 space-y-1">
        <Label htmlFor={`notes-${item.id}`} className="text-xs">
          Note (optional)
        </Label>
        <Input
          id={`notes-${item.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8"
          placeholder={direction === 'in' ? 'e.g. received from vendor' : 'e.g. used for today’s lunch'}
        />
      </div>
      <Button size="sm" className="h-8" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onDone}>
        Cancel
      </Button>
    </div>
  )
}

function ThresholdEditor({ item }: { item: InventoryItemRow }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(toNumber(item.reorder_threshold)))
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const num = parseFloat(value)
      if (!Number.isFinite(num) || num < 0) throw new Error('Enter a valid number')
      const { error } = await supabase.from('inventory_items').update({ reorder_threshold: num }).eq('id', item.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      setEditing(false)
    },
    onError: (error: Error) => toast({ title: 'Could not update threshold', description: error.message, variant: 'destructive' }),
  })

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Reorder at {formatQty(item.reorder_threshold, item.unit)}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-20 text-xs"
        autoFocus
      />
      <Button size="sm" className="h-7 px-2 text-xs" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Save
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  )
}

function InventoryRow({ item, canManage }: { item: InventoryItemRow; canManage: boolean }) {
  const [activeForm, setActiveForm] = useState<'in' | 'out' | null>(null)
  const current = toNumber(item.current_quantity)
  const threshold = toNumber(item.reorder_threshold)
  const isOut = current <= 0
  const isLow = !isOut && current <= threshold

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            {item.source_note && <p className="text-xs text-muted-foreground">{item.source_note}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isOut && <Badge variant="destructive">Out of stock</Badge>}
            {isLow && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Low stock
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-semibold text-foreground">{formatQty(item.current_quantity, item.unit)}</span>
          {canManage && <ThresholdEditor item={item} />}
        </div>

        {canManage && (
          <>
            {activeForm ? (
              <StockAdjustForm item={item} direction={activeForm} onDone={() => setActiveForm(null)} />
            ) : (
              <div className="flex gap-2 border-t border-border pt-2">
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setActiveForm('in')}>
                  <Plus className="h-3 w-3" /> Stock in
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setActiveForm('out')}>
                  <Minus className="h-3 w-3" /> Stock out
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !unit.trim()) throw new Error('Name and unit are required')
      const { error } = await supabase.from('inventory_items').insert({
        name: name.trim(),
        unit: unit.trim(),
        category: category.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      toast({ title: 'Item added' })
      setName('')
      setUnit('')
      setCategory('')
      onDone()
    },
    onError: (error: Error) => toast({ title: 'Could not add item', description: error.message, variant: 'destructive' }),
  })

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <Label htmlFor="new-item-name" className="text-xs">
            Item name
          </Label>
          <Input id="new-item-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48" placeholder="e.g. Onion" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-item-unit" className="text-xs">
            Unit
          </Label>
          <Input id="new-item-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-8 w-28" placeholder="kg, g, litre..." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-item-category" className="text-xs">
            Category (optional)
          </Label>
          <Input
            id="new-item-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-48"
            placeholder="e.g. fresh_produce"
          />
        </div>
        <Button size="sm" className="h-8" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add item'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function Inventory() {
  const { isStaff, roles, loading: authLoading } = useAuth()
  const { data: items, isLoading, isError } = useInventory()
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)

  const canManage = roles.includes('admin') || roles.includes('inventory_manager')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of items ?? []) set.add(item.category ?? 'other')
    return Array.from(set).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
  }, [items])

  const filteredItems = useMemo(() => {
    let list = items ?? []
    if (activeTab !== 'all') list = list.filter((item) => (item.category ?? 'other') === activeTab)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((item) => item.name.toLowerCase().includes(q))
    if (lowStockOnly) list = list.filter((item) => toNumber(item.current_quantity) <= toNumber(item.reorder_threshold))
    return list
  }, [items, activeTab, search, lowStockOnly])

  const lowStockCount = useMemo(
    () => (items ?? []).filter((item) => toNumber(item.current_quantity) <= toNumber(item.reorder_threshold)).length,
    [items]
  )

  if (authLoading) {
    return (
      <div className="container flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!isStaff) {
    return (
      <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold text-foreground">Staff only</h1>
        <p className="text-muted-foreground">You don&apos;t have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          {lowStockCount > 0 ? (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {lowStockCount} item{lowStockCount === 1 ? '' : 's'} at or below
              reorder level.
            </span>
          ) : (
            'All items are above their reorder level.'
          )}
        </p>
        {!canManage && (
          <p className="text-xs text-muted-foreground">
            You can view stock here. Adding stock movements or new items needs an admin or inventory manager role.
          </p>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          {showAddForm ? (
            <AddItemForm onDone={() => setShowAddForm(false)} />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              + Add new item
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          variant={lowStockOnly ? 'default' : 'outline'}
          onClick={() => setLowStockOnly((v) => !v)}
        >
          Low stock only
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {categoryLabel(cat)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory...
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load inventory.</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items match.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredItems.map((item) => (
            <InventoryRow key={item.id} item={item} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  )
}