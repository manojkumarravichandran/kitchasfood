import { Logo } from '@/components/layout/Logo'

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container grid gap-8 py-10 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Pure vegetarian counter-sale restaurant in Alwarpet, Chennai, since 2007. Veg and non-veg are
            prepared in separate kitchens.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-display text-base font-semibold text-foreground">Contact</h3>
          <p className="text-muted-foreground">
            <a href="tel:+919894846436" className="hover:text-foreground">
              +91-(989)484-6436
            </a>
          </p>
          <p className="text-muted-foreground">
            <a href="mailto:srkitchasfood@gmail.com" className="hover:text-foreground">
              srkitchasfood@gmail.com
            </a>
          </p>
          <p className="text-muted-foreground">
            <a
              href="https://maps.app.goo.gl/gDuyhUAeigz7LZye9"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              55/119 Alwarpet Street, Alwarpet, Chennai, Tamil Nadu - 600018
            </a>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-display text-base font-semibold text-foreground">Hours</h3>
          <p className="text-muted-foreground">Monday – Saturday: full day</p>
          <p className="text-muted-foreground">Sunday: open till lunch only</p>
          <p className="text-xs text-muted-foreground">Snacks and brunch coming soon.</p>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Kitcha&apos;s Food. All rights reserved.
      </div>
    </footer>
  )
}
