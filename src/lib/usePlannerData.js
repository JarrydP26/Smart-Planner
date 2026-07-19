import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'
import { mergeData } from './plannerHelpers'

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
    currentTerm: 1,
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
  specialistBlocks: null, // null = use the default (PE/Art Tuesday, Science/Drama Friday); otherwise a custom Timetable Setup result
}

export function usePlannerData(plannerId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [conflictWarning, setConflictWarning] = useState('')
  const saveTimeoutRef = useRef(null)

  // baselineRef holds the last data we know is actually in the database —
  // i.e. what we loaded, or what we last successfully merged and wrote.
  // Every save uses this as the "common ancestor" for a three-way merge
  // against whatever's in the database right now, so a colleague's changes
  // made elsewhere never get silently wiped out by an unrelated edit here.
  const baselineRef = useRef(null)

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
        baselineRef.current = DEFAULT_DATA
      } else {
        // Merge with defaults so older/partial saved data doesn't break on missing fields
        const loaded = row?.data && Object.keys(row.data).length > 0 ? row.data : {}
        const merged = {
          ...DEFAULT_DATA,
          ...loaded,
          appSettings: { ...DEFAULT_DATA.appSettings, ...(loaded.appSettings || {}) },
        }
        setData(merged)
        baselineRef.current = merged
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [plannerId])

  // Fetches the current database row, three-way merges it against the last
  // known-synced baseline and this tab's local edits, writes the merged
  // result back, then updates local state + baseline to match. This is what
  // makes it safe for two teachers to edit different parts of the planner
  // at the same time — a save only overwrites what THIS tab actually
  // changed, not the whole term's data.
  async function writeMerged(newData, { throwOnError } = {}) {
    setSaving(true)
    try {
      const { data: freshRow, error: fetchErr } = await supabase
        .from('planner_data')
        .select('data')
        .eq('planner_id', plannerId)
        .single()
      if (fetchErr) throw fetchErr

      const theirs = freshRow?.data && Object.keys(freshRow.data).length > 0 ? freshRow.data : baselineRef.current
      const { merged, conflicts } = mergeData(baselineRef.current, newData, theirs)

      const { error: updateErr } = await supabase
        .from('planner_data')
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('planner_id', plannerId)
      if (updateErr) throw updateErr

      baselineRef.current = merged
      // Reflect the merged result locally too — this is also how a
      // colleague's changes made elsewhere show up in this tab, without
      // needing a refresh (though it only happens at save time, not live).
      setData(merged)
      setError('')
      setConflictWarning(
        conflicts.length
          ? `${conflicts.length} change${conflicts.length > 1 ? 's' : ''} overlapped with an edit made elsewhere at the same moment (your version was kept). Worth a quick check: ${conflicts.slice(0, 3).map(p => p.split('.').pop()).join(', ')}${conflicts.length > 3 ? '…' : ''}`
          : ''
      )
    } catch (err) {
      console.error('Failed to save planner data:', err)
      setError('Could not save — your last change may not have been stored. ' + err.message)
      if (throwOnError) throw err
    } finally {
      setSaving(false)
    }
  }

  // Debounced save — call this after any change. Waits briefly so rapid edits
  // (e.g. typing) don't fire a network request on every keystroke.
  const save = useCallback((newData) => {
    setData(newData)
    setSaving(true)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      writeMerged(newData)
    }, 600)
  }, [plannerId])

  // Save immediately, skipping the debounce — use for important actions
  // where you want to be sure it's written before continuing (e.g. before navigating away)
  const saveNow = useCallback(async (newData) => {
    setData(newData)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    await writeMerged(newData, { throwOnError: true })
  }, [plannerId])

  return { data, loading, error, saving, save, saveNow, conflictWarning }
}
