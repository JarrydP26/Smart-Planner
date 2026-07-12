import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
export function usePlanners() {
  const { user } = useAuth()
  const [planners, setPlanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!user) { setPlanners([]); setLoading(false); return }
    setLoading(true)
    setError('')
    // A user can belong to multiple planners (their own + shared ones like
    // a Maths group). planner_members links users to planners.
    const { data, error } = await supabase
      .from('planner_members')
      .select('role, planners(id, name, school_name, class_name, owner_id, created_at)')
      .eq('user_id', user.id)
    if (error) {
      setError(error.message)
      setPlanners([])
    } else {
      setPlanners(data.map(row => ({ ...row.planners, myRole: row.role })))
    }
    setLoading(false)
  }, [user])
  useEffect(() => { refresh() }, [refresh])
  async function createPlanner(name) {
    if (!user) throw new Error('Not logged in')
    // Insert and select-back are done as two separate calls rather than
    // chaining .insert().select().single() — the combined form was
    // unreliable with this Supabase project's RLS setup.
    const { error: insertError } = await supabase
      .from('planners')
      .insert({ name: name || 'My Class Planner', owner_id: user.id })
    if (insertError) throw insertError
    const { data, error } = await supabase
      .from('planners')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    await refresh()
    return data
  }

  // Owner-only — permanently deletes the planner for EVERYONE it's shared
  // with. Child rows are removed explicitly first (rather than relying on
  // a DB cascade that may or may not be configured), then the planner row.
  async function deletePlanner(plannerId) {
    if (!user) throw new Error('Not logged in')
    const { error: dataErr } = await supabase.from('planner_data').delete().eq('planner_id', plannerId)
    if (dataErr) throw dataErr
    const { error: membersErr } = await supabase.from('planner_members').delete().eq('planner_id', plannerId)
    if (membersErr) throw membersErr
    const { error } = await supabase.from('planners').delete().eq('id', plannerId)
    if (error) throw error
    await refresh()
  }

  // Non-owner — removes just this user from a shared planner. The planner
  // itself, and everyone else's access to it, is untouched.
  async function leavePlanner(plannerId) {
    if (!user) throw new Error('Not logged in')
    const { error } = await supabase
      .from('planner_members')
      .delete()
      .eq('planner_id', plannerId)
      .eq('user_id', user.id)
    if (error) throw error
    await refresh()
  }

  return { planners, loading, error, refresh, createPlanner, deletePlanner, leavePlanner }
}
