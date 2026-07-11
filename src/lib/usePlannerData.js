import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'

// Default shape for a brand new, blank planner — mirrors the HTML version's
// initial state so porting logic across is mostly mechanical.
const DEFAULT_DATA = {
  weeks: [],
  activeWeekId: null,
  classLists: { room3: '', class2: '', class3: '' },
  termSummaries: {},
  appSettings: {
    className: 'Room 3',
    schoolName: '',
    termWeeks: 10,
    toggles: {
      mathsToSelf: true,
      readToSelf: true,
      learningPowers: false,
      spelling: true,
      checkIn: false,
      brainBreak: false,
    },
    abilityGroups: {},
  },
  rows: null, // null = use the default built-in timetable; otherwise a custom Timetable Setup result
  planSubjects: null, // null = use the default built-in subjects
}

export function usePlannerData(plannerId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimeoutRef = useRef(null)

  // Load the planner's data blob once on mount / when plannerId changes
  useEffect(() => {
    if (!plannerId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const { data: row, error } = await supabase
        .from('planner_data')
        .select('data')
        .eq('planner_id', plannerId)
        .single()

      if (cancelled) return

      if (error) {
        setError(error.message)
        setData(DEFAULT_DATA)
      } else {
        // Merge with defaults so older/partial saved data doesn't break on missing fields
        const loaded = row?.data && Object.keys(row.data).length > 0 ? row.data : {}
        setData({
          ...DEFAULT_DATA,
          ...loaded,
          appSettings: { ...DEFAULT_DATA.appSettings, ...(loaded.appSettings || {}) },
        })
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [plannerId])

  // Debounced save — call this after any change. Waits briefly so rapid edits
  // (e.g. typing) don't fire a network request on every keystroke.
  const save = useCallback((newData) => {
    setData(newData)
    setSaving(true)

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('planner_data')
        .update({ data: newData, updated_at: new Date().toISOString() })
        .eq('planner_id', plannerId)

      if (error) {
        console.error('Failed to save planner data:', error)
        setError('Could not save — your last change may not have been stored. ' + error.message)
      }
      setSaving(false)
    }, 600)
  }, [plannerId])

  // Save immediately, skipping the debounce — use for important actions
  // where you want to be sure it's written before continuing (e.g. before navigating away)
  const saveNow = useCallback(async (newData) => {
    setData(newData)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaving(true)
    const { error } = await supabase
      .from('planner_data')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('planner_id', plannerId)
    setSaving(false)
    if (error) {
      setError('Could not save: ' + error.message)
      throw error
    }
  }, [plannerId])

  return { data, loading, error, saving, save, saveNow }
}
