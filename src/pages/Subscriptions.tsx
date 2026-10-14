import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { CalendarClock, CheckCircle2, Loader2, UtensilsCrossed } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

// Mirrors public.age_category / public.subscription_plan / public.subscription_status
// from supabase/migrations/20261008000000_initial_schema.sql.
type AgeCategory = 'kids' | 'teens' | 'adults' | 'seniors'
type SubscriptionPlan = '3_days' | '1_week' | '2_weeks' | '1_month' | '3_months'
type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'completed'

interface SubscriptionRow {
  id: string
  user_id: string
  age_category: AgeCategory
  plan: SubscriptionPlan
  is_veg: boolean
  base_price: string | number
  discount_percent: string | number
  total_price: string | number
  status: SubscriptionStatus
  start_date: string
  end_date: string
  delivery_time: string | null
  delivery_address: string | null
}

interface DietPlanRow {
  id: string
  age_category: AgeCategory
  is_veg: boolean
  day_of_week: string
  meal_time: string
  description: string
  calories: number | null
}

// Flat daily pricing, confirmed live in the original app's Subscriptions.tsx and
// re-confirmed against market research (see project docs) — no veg/non-veg split.
const DAILY_PRICE: Record<AgeCategory, number> = { kids: 150, teens: 200, adults: 250, seniors: 200 }

const AGE_CATEGORIES: { value: AgeCategory; label: string }[] = [
  { value: 'kids', label: 'Kids' },
  { value: 'teens', label: 'Teens' },
  { value: 'adults', label: 'Adults' },
  { value: 'seniors', label: 'Seniors' },
]

// Day counts are an implementation choice (not a documented business rule beyond
// the plan names themselves) — "1 month" / "3 months" are treated as 30/90 days.
const PLAN_DAYS: Record<SubscriptionPlan, number> = {
  '3_days': 3,
  '1_week': 7,
  '2_weeks': 14,
  '1_month': 30,
  '3_months': 90,
}

const PLANS: { value: SubscriptionPlan; label: string }[] = [
  { value: '3_days', label: '3 days' },
  { value: '1_week', label: '1 week' },
  { value: '2_weeks', label: '2 weeks' },
  { value: '1_month', label: '1 month' },
  { value: '3_months', label: '3 months' },
]

// public.day_of_week only defines monday–saturday (the restaurant's own schema
// has no 'sunday' value), so Sunday is handled as "no delivery" rather than
// queried against a value that doesn't exist.
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

function formatRupees(amount: number) {
  return `₹${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

function toNumber(value: string | number) {
  return typeof value === 'number' ? value : parseFloat(value)
}

function useActiveSubscription(userId: string | undefined) {
  return useQuery({
    queryKey: ['subscription', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protein_subscriptions')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as SubscriptionRow | null
    },
  })
}

function useTodaysMeal(sub: SubscriptionRow | null | undefined, isCurrentlyActive: boolean) {
  const todayName = DAY_NAMES[new Date().getDay()]
  return useQuery({
    queryKey: ['diet-plan-today', sub?.age_category, sub?.is_veg, todayName],
    enabled: isCurrentlyActive && !!sub && todayName !== 'sunday',
    queryFn: async () => {
      if (!sub) return []
      const { data, error } = await supabase
        .from('protein_diet_plans')
        .select('*')
        .eq('age_category', sub.age_category)
        .eq('is_veg', sub.is_veg)
        .eq('day_of_week', todayName)
        .order('meal_time', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DietPlanRow[]
    },
  })
}

function SubscribeForm({ userId }: { userId: string }) {
  const [ageCategory, setAgeCategory] = useState<AgeCategory>('adults')
  const [isVeg, setIsVeg] = useState(true)
  const [plan, setPlan] = useState<SubscriptionPlan>('1_week')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const days = PLAN_DAYS[plan]
  const totalPrice = DAILY_PRICE[ageCategory] * days

  const subscribe = useMutation({
    mutationFn: async () => {
      const startDate = new Date()
      const endDate = addDays(startDate, days - 1)
      const { error } = await supabase.from('protein_subscriptions').insert({
        user_id: userId,
        age_category: ageCategory,
        plan,
        is_veg: isVeg,
        base_price: totalPrice,
        discount_percent: 0,
        total_price: totalPrice,
        status: 'active',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        delivery_time: deliveryTime || null,
        delivery_address: deliveryAddress || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Subscribed!', description: `Your ${days}-day protein plan starts today.` })
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] })
    },
    onError: (error: Error) => {
      toast({ title: 'Could not subscribe', description: error.message, variant: 'destructive' })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">Protein subscription</CardTitle>
        <CardDescription>Age-tailored veg and non-veg protein plans, delivered daily.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Age group</Label>
          <RadioGroup
            value={ageCategory}
            onValueChange={(v) => setAgeCategory(v as AgeCategory)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {AGE_CATEGORIES.map((a) => (
              <Label
                key={a.value}
                htmlFor={`age-${a.value}`}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value={a.value} id={`age-${a.value}`} />
                <span>
                  <span className="block text-sm font-medium text-foreground">{a.label}</span>
                  <span className="block text-xs text-muted-foreground">{formatRupees(DAILY_PRICE[a.value])}/day</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Diet</Label>
          <RadioGroup
            value={isVeg ? 'veg' : 'nonveg'}
            onValueChange={(v) => setIsVeg(v === 'veg')}
            className="grid grid-cols-2 gap-2"
          >
            <Label htmlFor="diet-veg" className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50">
              <RadioGroupItem value="veg" id="diet-veg" />
              <span className="text-sm font-medium text-foreground">Vegetarian</span>
            </Label>
            <Label htmlFor="diet-nonveg" className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50">
              <RadioGroupItem value="nonveg" id="diet-nonveg" />
              <span className="text-sm font-medium text-foreground">Non-vegetarian</span>
            </Label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Plan length</Label>
          <RadioGroup value={plan} onValueChange={(v) => setPlan(v as SubscriptionPlan)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PLANS.map((p) => (
              <Label
                key={p.value}
                htmlFor={`plan-${p.value}`}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value={p.value} id={`plan-${p.value}`} />
                <span className="text-sm font-medium text-foreground">{p.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="deliveryAddress">Delivery address (optional)</Label>
          <Input
            id="deliveryAddress"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Where should we deliver?"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="deliveryTime">Preferred delivery time (optional)</Label>
          <Input id="deliveryTime" type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {days} days &times; {formatRupees(DAILY_PRICE[ageCategory])}/day
            </p>
            <p className="text-lg font-semibold text-foreground">{formatRupees(totalPrice)} total</p>
          </div>
          <Button size="lg" onClick={() => subscribe.mutate()} disabled={subscribe.isPending}>
            {subscribe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Subscribe
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActiveSubscriptionView({ sub }: { sub: SubscriptionRow }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const todayName = DAY_NAMES[new Date().getDay()]
  const { data: meals, isLoading: mealsLoading } = useTodaysMeal(sub, true)

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('protein_subscriptions').update({ status: 'cancelled' }).eq('id', sub.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Subscription cancelled' })
      queryClient.invalidateQueries({ queryKey: ['subscription', sub.user_id] })
    },
    onError: (error: Error) => {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' })
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Active subscription
            </CardTitle>
            <CardDescription>
              {sub.age_category.charAt(0).toUpperCase() + sub.age_category.slice(1)} &middot; {sub.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
            </CardDescription>
          </div>
          <Badge>{formatRupees(toNumber(sub.total_price))}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {format(new Date(sub.start_date), 'd MMM yyyy')} &ndash; {format(new Date(sub.end_date), 'd MMM yyyy')}
          </p>
          {sub.delivery_address && <p className="text-sm text-muted-foreground">Delivering to: {sub.delivery_address}</p>}
          <Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UtensilsCrossed className="h-5 w-5" />
            Today&apos;s protein meal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayName === 'sunday' ? (
            <p className="text-sm text-muted-foreground">No subscription deliveries on Sundays.</p>
          ) : mealsLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading today&apos;s meal...
            </p>
          ) : !meals || meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Today&apos;s plan hasn&apos;t been configured yet — check back soon.</p>
          ) : (
            <ul className="space-y-2">
              {meals.map((m) => (
                <li key={m.id} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.meal_time.replace('_', ' ')}
                  </p>
                  <p className="text-sm text-foreground">{m.description}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function Subscriptions() {
  const { user, loading: authLoading } = useAuth()
  const { data: sub, isLoading: subLoading } = useActiveSubscription(user?.id)

  const isCurrentlyActive = useMemo(() => {
    if (!sub || sub.status !== 'active') return false
    return sub.end_date >= format(new Date(), 'yyyy-MM-dd')
  }, [sub])

  if (authLoading || (user && subLoading)) {
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
        <h1 className="font-display text-2xl font-bold text-foreground">Protein subscriptions</h1>
        <p className="max-w-md text-muted-foreground">Log in or create an account to subscribe to a daily protein plan.</p>
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
    <div className="container max-w-2xl py-10">
      {isCurrentlyActive && sub ? <ActiveSubscriptionView sub={sub} /> : <SubscribeForm userId={user.id} />}
    </div>
  )
}