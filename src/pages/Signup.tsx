import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth, type CustomerType } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

// Self-registration only ever picks a customer_type — staff roles are assigned
// by an admin later, never self-selected (master prompt, Part B "Auth & access").
const customerTypes: { value: CustomerType; label: string; description: string }[] = [
  { value: 'KITCHAS_CUSTOMER', label: 'Regular customer', description: 'Retail ordering — vegetarian menu only.' },
  { value: 'KBR_CUSTOMER', label: 'KBR employee', description: 'Corporate catering menu, veg + non-veg.' },
  { value: 'YUBI_CUSTOMER', label: 'Yubi employee', description: 'Corporate catering menu, veg + non-veg.' },
]

const detailsSchema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    phone: z.string().min(10, 'Enter a valid phone number'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type DetailsForm = z.infer<typeof detailsSchema>

export default function Signup() {
  const [step, setStep] = useState<1 | 2>(1)
  const [customerType, setCustomerType] = useState<CustomerType>('KITCHAS_CUSTOMER')
  const { signUp } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DetailsForm>({ resolver: zodResolver(detailsSchema) })

  async function onSubmit(values: DetailsForm) {
    const { error } = await signUp(values.email, values.password, {
      fullName: values.fullName,
      customerType,
      phone: values.phone,
    })

    if (error) {
      const alreadyRegistered = /already registered|already exists/i.test(error.message)
      toast({
        title: alreadyRegistered ? 'Already registered' : 'Sign up failed',
        description: alreadyRegistered
          ? 'An account with this email already exists — try logging in instead.'
          : error.message,
        variant: 'destructive',
      })
      return
    }

    toast({ title: 'Account created', description: 'Welcome to Kitcha\'s Food!' })
    navigate('/')
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl">Create your account</CardTitle>
          <CardDescription>Step {step} of 2 — {step === 1 ? 'choose your customer type' : 'your details'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <div className="space-y-4">
              <RadioGroup value={customerType} onValueChange={(v) => setCustomerType(v as CustomerType)} className="space-y-3">
                {customerTypes.map((ct) => (
                  <Label
                    key={ct.value}
                    htmlFor={ct.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                  >
                    <RadioGroupItem value={ct.value} id={ct.value} className="mt-1" />
                    <span>
                      <span className="block font-medium text-foreground">{ct.label}</span>
                      <span className="block text-xs text-muted-foreground">{ct.description}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <Button className="w-full" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" {...register('fullName')} />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
