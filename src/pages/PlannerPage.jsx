import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function PlannerPage() {
  const { plannerId } = useParams()
  const navigate = useNavigate()
  const [planner, setPlanner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('planners')
        .select('*')
        .eq('id', plannerId)
        .single()

      if (error) setError(error.message)
      else setPlanner(data)
      setLoading(false)
    }
    load()
  }, [plannerId])

  if (loading) return <div style={styles.center}>Loading planner…</div>
  if (error) return <div style={styles.center}>Could not load this planner: {error}</div>

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate('/')}>← All planners</button>
        <span style={styles.plannerName}>{planner.name}</span>
      </div>

      <div style={styles.placeholder}>
        <div style={styles.placeholderIcon}>🗓️</div>
        <h2 style={styles.placeholderTitle}>This planner is blank and ready to go</h2>
        <p style={styles.placeholderText}>
          The full Weekly Planner, Timetable Setup, Term View, and AI planning tools
          will appear here once Phase 2 is built. For now, this confirms the planner
          was created successfully and only you (and anyone you invite) can see it.
        </p>
        <div style={styles.debugBox}>
          <strong>Planner ID:</strong> {planner.id}<br />
          <strong>Owner ID:</strong> {planner.owner_id}<br />
          <strong>Created:</strong> {new Date(planner.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#F0F2F7', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px',
    background: '#fff', borderBottom: '1px solid #D4D9E5',
  },
  backBtn: {
    fontSize: 12, padding: '6px 12px', border: '1.5px solid #D4D9E5',
    borderRadius: 6, background: 'transparent', cursor: 'pointer',
  },
  plannerName: { fontSize: 14, fontWeight: 700 },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  placeholder: { maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: '0 20px' },
  placeholderIcon: { fontSize: 48, marginBottom: 12 },
  placeholderTitle: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
  placeholderText: { fontSize: 13, color: '#7A849E', lineHeight: 1.6, marginBottom: 24 },
  debugBox: {
    fontSize: 11, color: '#7A849E', background: '#fff', border: '1px solid #D4D9E5',
    borderRadius: 8, padding: '12px 14px', textAlign: 'left', lineHeight: 1.6,
  },
}
