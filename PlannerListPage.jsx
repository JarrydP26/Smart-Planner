import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlanners } from '../lib/usePlanners'
import { useAuth } from '../lib/AuthContext'

export default function PlannerListPage() {
  const { planners, loading, error, createPlanner } = usePlanners()
  const { user, signOut } = useAuth()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const planner = await createPlanner(newName.trim() || 'My Class Planner')
      navigate(`/planner/${planner.id}`)
    } catch (err) {
      alert('Could not create planner: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <span style={styles.userEmail}>{user?.email}</span>
        <button style={styles.logoutBtn} onClick={signOut}>Log out</button>
      </div>

      <div style={styles.content}>
        <h1 style={styles.title}>📋 Your Class Planners</h1>

        {loading && <p style={styles.muted}>Loading…</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && planners.length === 0 && (
          <p style={styles.muted}>
            You don't have any planners yet. Create one below to get started —
            it'll start completely blank until you set up your timetable.
          </p>
        )}

        <div style={styles.plannerList}>
          {planners.map((p) => (
            <button
              key={p.id}
              style={styles.plannerCard}
              onClick={() => navigate(`/planner/${p.id}`)}
            >
              <div style={styles.plannerName}>{p.name}</div>
              <div style={styles.plannerMeta}>
                {p.school_name || 'No school name set'} · {p.myRole === 'owner' ? 'Owner' : 'Shared with you'}
              </div>
            </button>
          ))}
        </div>

        <form onSubmit={handleCreate} style={styles.createForm}>
          <input
            type="text"
            placeholder="e.g. Room 3 Planner"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={styles.input}
          />
          <button type="submit" disabled={creating} style={styles.createBtn}>
            {creating ? 'Creating…' : '+ Create new planner'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#F0F2F7', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 24px', background: '#fff', borderBottom: '1px solid #D4D9E5',
  },
  userEmail: { fontSize: 12, color: '#7A849E' },
  logoutBtn: {
    fontSize: 12, padding: '6px 12px', border: '1.5px solid #D4D9E5',
    borderRadius: 6, background: 'transparent', cursor: 'pointer',
  },
  content: { maxWidth: 560, margin: '0 auto', padding: '40px 20px' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 18 },
  muted: { fontSize: 13, color: '#7A849E', marginBottom: 20, lineHeight: 1.5 },
  error: { fontSize: 13, color: '#C0392B', marginBottom: 20 },
  plannerList: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 },
  plannerCard: {
    textAlign: 'left', background: '#fff', border: '1.5px solid #D4D9E5',
    borderRadius: 10, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit',
  },
  plannerName: { fontSize: 15, fontWeight: 700, marginBottom: 3 },
  plannerMeta: { fontSize: 12, color: '#7A849E' },
  createForm: {
    display: 'flex', gap: 8, padding: '18px', background: '#fff',
    border: '1.5px dashed #D4D9E5', borderRadius: 10,
  },
  input: {
    flex: 1, padding: '9px 11px', border: '1.5px solid #D4D9E5',
    borderRadius: 7, fontSize: 13, fontFamily: 'inherit',
  },
  createBtn: {
    padding: '9px 16px', background: '#3A86D4', color: '#fff', border: 'none',
    borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
}
