import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, Leaf, ShoppingBag, Sparkles, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  { icon: Leaf, title: 'Pure vegetarian counter', description: 'Fresh South Indian breakfast, lunch and dinner, every day.' },
  { icon: Users, title: 'Corporate catering', description: 'Daily breakfast through evening snacks for our corporate clients.' },
  { icon: Sparkles, title: 'Protein subscriptions', description: 'Age-tailored veg and non-veg protein plans, delivered daily.' },
  { icon: CalendarClock, title: 'Pre-order & bulk catering', description: 'Plan ahead for a pickup, delivery, or an event.' },
]

export default function Index() {
  return (
    <div>
      <section className="container flex flex-col items-center gap-6 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-5">
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
            Chennai&apos;s <span className="gradient-text">Kitcha&apos;s Food</span>, since 2007
          </h1>
          <p className="text-lg text-muted-foreground">
            Pure vegetarian counter-sale restaurant in Alwarpet. Veg and non-veg are prepared in separate
            kitchens for our corporate catering clients.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="btn-hero">
              <Link to="/menu">
                <ShoppingBag className="h-4 w-4" />
                View the menu
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/preorder">Pre-order</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/catering">Bulk catering</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="container grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="h-full">
              <CardContent className="flex flex-col items-start gap-3 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
