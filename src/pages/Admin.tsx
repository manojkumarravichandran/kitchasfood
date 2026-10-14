import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth, type AppRole } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface ProfileRow {
  id: string
  full_name: string | null
  phone: string | null
  customer_type: string | null
}

interface RoleRow {
  id: string
  user_id: string
  role: AppRole
}

// Every role the schema's public.app_role enum defines.
const ALL_ROLES: AppRole[] = ['admin', 'chef', 'kitchen_staff', 'cash_counter', 'accountant', 'inventory_manager', 'delivery_driver']

function roleLabel(role: AppRole) {
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function useStaffData() {
  return useQuery({
    queryKey: ['admin-staff-data'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone, customer_type').order('full_name', { ascending: true }),
        supabase.from('user_roles').select('id, user_id, role'),
      ])
      if (profilesRes.error) throw profilesRes.error
      if (rolesRes.error) throw rolesRes.error
      return {
        profiles: (profilesRes.data ?? []) as unknown as ProfileRow[],
        roles: (rolesRes.data ?? []) as unknown as RoleRow[],
      }
    },
  })
}

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { data, isLoading, isError } = useStaffData()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-staff-data'] }),
    onError: (error: Error) => toast({ title: 'Could not assign role', description: error.message, variant: 'destructive' }),
  })

  const removeRole = useMutation({
    mutationFn: async (roleRowId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', roleRowId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-staff-data'] }),
    onError: (error: Error) => toast({ title: 'Could not remove role', description: error.message, variant: 'destructive' }),
  })

  const rolesByUser = useMemo(() => {
    const map = new Map<string, RoleRow[]>()
    for (const r of data?.roles ?? []) {
      const list = map.get(r.user_id) ?? []
      list.push(r)
      map.set(r.user_id, list)
    }
    return map
  }, [data])

  const filteredProfiles = useMemo(() => {
    const profiles = data?.profiles ?? []
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => (p.full_name ?? '').toLowerCase().includes(q) || (p.phone ?? '').includes(q))
  }, [data, search])

  if (authLoading) {
    return (
      <div className="container flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold text-foreground">Admins only</h1>
        <p className="text-muted-foreground">You don&apos;t have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-foreground">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Staff management
        </h1>
        <p className="text-sm text-muted-foreground">
          New staff create an account the normal way (the <strong>Sign Up</strong> page — any customer type is fine, it
          doesn&apos;t affect staff access), then show up in the list below. Assign them a role here to grant access;
          someone with no role here is treated as an ordinary customer.
        </p>
      </div>

      <Input
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading staff...
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load staff data.</p>
      ) : filteredProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching accounts.</p>
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((profile) => {
            const roles = rolesByUser.get(profile.id) ?? []
            const heldRoles = new Set(roles.map((r) => r.role))
            const availableRoles = ALL_ROLES.filter((r) => !heldRoles.has(r))

            return (
              <Card key={profile.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{profile.full_name || 'Unnamed account'}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.phone || 'No phone on file'} &middot; {profile.customer_type ?? 'unknown'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No roles — ordinary customer</span>
                    ) : (
                      roles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="flex items-center gap-1 pr-1">
                          {roleLabel(r.role)}
                          <button
                            type="button"
                            onClick={() => removeRole.mutate(r.id)}
                            disabled={removeRole.isPending}
                            className="rounded-full p-0.5 hover:bg-background/50"
                            aria-label={`Remove ${roleLabel(r.role)} role`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>

                  {availableRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                      <span className="mr-1 self-center text-xs text-muted-foreground">Add role:</span>
                      {availableRoles.map((role) => (
                        <Button
                          key={role}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={addRole.isPending}
                          onClick={() => addRole.mutate({ userId: profile.id, role })}
                        >
                          + {roleLabel(role)}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}