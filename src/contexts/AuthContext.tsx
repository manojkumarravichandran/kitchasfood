import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '@/integrations/supabase/client'

// Mirrors the `customer_type` and `app_role` enums from supabase/migrations.
// KITCHAS_CUSTOMER = regular retail customer (veg only).
// KBR_CUSTOMER / YUBI_CUSTOMER = corporate catering clients (veg + non-veg).
export type CustomerType = 'KITCHAS_CUSTOMER' | 'KBR_CUSTOMER' | 'YUBI_CUSTOMER'
export type AppRole =
  | 'admin'
  | 'chef'
  | 'kitchen_staff'
  | 'cash_counter'
  | 'accountant'
  | 'inventory_manager'
  | 'delivery_driver'

export interface Profile {
  id: string
  full_name: string | null
  customer_type: CustomerType | null
  phone: string | null
  preferred_language: 'en' | 'ta' | 'hi' | null
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  roles: AppRole[]
  loading: boolean
  isStaff: boolean
  isAdmin: boolean
  isKbrOrYubi: boolean
  signUp: (
    email: string,
    password: string,
    details: { fullName: string; customerType: CustomerType; phone: string }
  ) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)

  // Fetches profile + roles for a user id. Called deferred (setTimeout 0) from
  // onAuthStateChange below so we never run async Supabase calls synchronously
  // inside the auth callback — doing that can deadlock the client.
  async function loadProfileAndRoles(userId: string) {
    const [{ data: profileData, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])

    if (profileError) {
      // Expected until the schema migrations have been run against this project.
      console.error('Failed to load profile:', profileError.message)
    }
    if (roleError) {
      console.error('Failed to load roles:', roleError.message)
    }

    setProfile((profileData as Profile) ?? null)
    setRoles(((roleRows as { role: AppRole }[] | null) ?? []).map((r) => r.role))
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        // Deferred so this callback itself returns immediately.
        setTimeout(() => {
          loadProfileAndRoles(newSession.user.id)
        }, 0)
      } else {
        setProfile(null)
        setRoles([])
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession)
      setUser(existingSession?.user ?? null)
      if (existingSession?.user) {
        loadProfileAndRoles(existingSession.user.id)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(
    email: string,
    password: string,
    details: { fullName: string; customerType: CustomerType; phone: string }
  ) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: details.fullName,
        customer_type: details.customerType,
        phone: details.phone,
      })
      if (profileError) return { error: profileError }
    }

    return { error: null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('Not signed in') }
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (!error) setProfile((prev) => (prev ? { ...prev, ...updates } : prev))
    return { error }
  }

  const isStaff = roles.length > 0
  const isAdmin = roles.includes('admin')
  const isKbrOrYubi = profile?.customer_type === 'KBR_CUSTOMER' || profile?.customer_type === 'YUBI_CUSTOMER'

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, loading, isStaff, isAdmin, isKbrOrYubi, signUp, signIn, signOut, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
