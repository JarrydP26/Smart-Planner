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

    // Step 1: insert only, no immediate select-back
    const insertResult = await supabase
      .from('planners')
      .insert({ name: name || 'My Class Planner', owner_id: user.id })
    console.log('[DEBUG] insert-only result:', insertResult)

    if (insertResult.error) throw insertResult.error

    // Step 2: separately fetch the newly created planner
    const { data, error } = await supabase
      .from('planners')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    console.log('[DEBUG] select-back result:', { data, error })
    if (error) throw error

    await refresh()
    return data
  }

  return { planners, loading, error, refresh, createPlanner }
}
