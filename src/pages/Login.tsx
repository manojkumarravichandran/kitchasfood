import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  // "Employee login" is the same page, just a toggle — per the master prompt,
  // staff never self-register, so this only changes where we redirect after
  // a successful sign-in (home for customers, /admin for staff).
  const [employeeMode, setEmployeeMode] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginForm) {
    const { error } = await signIn(values.email, values.password)
    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' })
      return
    }
    navigate(employeeMode ? '/admin' : '/')
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl">{employeeMode ? 'Staff login' : 'Welcome back'}</CardTitle>
          <CardDescription>
            {employeeMode ? 'For Kitcha\'s Food staff accounts only.' : 'Sign in to your Kitcha\'s Food account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setEmployeeMode((v) => !v)}
            className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {employeeMode ? 'Not staff? Customer login' : 'Kitcha\'s Food employee? Staff login'}
          </button>

          {!employeeMode && (
            <p className="text-center text-sm text-muted-foreground">
              New here?{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
