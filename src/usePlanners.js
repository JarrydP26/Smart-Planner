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

    // Temporary diagnostic logging — compare what the app thinks the user ID is
    // versus what Supabase's actual current session reports.
    const { data: sessionData } = await supabase.auth.getSession()
    console.log('[DEBUG] user.id from context:', user.id)
    console.log('[DEBUG] session user id:', sessionData?.session?.user?.id)
    console.log('[DEBUG] session access_token present:', !!sessionData?.session?.access_token)
    console.log('[DEBUG] full session object:', sessionData?.session)

    const { data, error } = await supabase
      .from('planners')
      .insert({ name: name || 'My Class Planner', owner_id: user.id })
      .select()
      .single()
    if (error) {
      console.log('[DEBUG] insert error full object:', error)
      throw error
    }
    await refresh()
    return data
  }

  return { planners, loading, error, refresh, createPlanner }
}
