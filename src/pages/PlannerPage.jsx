import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { usePlannerData } from '../lib/usePlannerData'
import { DEFAULT_PLAN_SUBJECTS, SUBJECT_DOT_COLOR } from '../lib/timetableDefaults'
import TimetableSetup from '../components/TimetableSetup'
import WeeklyPlanner from '../components/WeeklyPlanner'
import TermView from '../components/TermView'
import Settings from '../components/Settings'

export default function PlannerPage() {
  const { plannerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [planner, setPlanner] = useState(null)
  const [plannerLoading, setPlannerLoading] = useState(true)
  const [plannerError, setPlannerError] = useState('')
  const [view, setView] = useState('weekly') // 'weekly' | 'settings' | a subject key

  const { data, loading: dataLoading, error: dataError, saving, save, saveNow, conflictWarning } = usePlannerData(plannerId)

  useEffect(() => {
    async function load() {
      setPlannerLoading(true)
      const { data, error } = await supabase
        .from('planners')
        .select('*')
        .eq('id', plannerId)
        .single()
      if (error) setPlannerError(error.message)
      else setPlanner(data)
      setPlannerLoading(false)
    }
    load()
  }, [plannerId])

  if (plannerLoading || dataLoading) return <div style={styles.center}>Loading planner…</div>
  if (plannerError) return <div style={styles.center}>Could not load this planner: {plannerError}</div>
  if (dataError) return <div style={styles.center}>Could not load planner data: {dataError}</div>
  if (!data) return <div style={styles.center}>No data.</div>

  const isBlank = !data.weeks || data.weeks.length === 0
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const isOwner = planner?.owner_id === user?.id

  return (
    <div style={styles.page}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>
          📋 {data.appSettings.className} Planner
          <div style={styles.sidebarSubtitle}>{data.appSettings.schoolName}</div>
        </div>

        <button style={view === 'weekly' ? { ...styles.navItem, ...styles.navItemActive } : styles.navItem} onClick={() => setView('weekly')}>
          🗓️ Weekly Planner
        </button>

        {!isBlank && (
          <>
            <div style={styles.sectionLabel}>Term View</div>
            {Object.entries(planSubjects).map(([key, meta]) => (
              <button
                key={key}
                style={view === key ? { ...styles.navItem, ...styles.navItemActive } : styles.navItem}
                onClick={() => setView(key)}
              >
                <span style={{ ...styles.dot, background: SUBJECT_DOT_COLOR[key] || '#888' }}></span> {meta.label}
              </button>
            ))}
          </>
        )}

        <div style={styles.sectionLabel}>Timetable</div>
        <button style={view === 'timetable' ? { ...styles.navItem, ...styles.navItemActive } : styles.navItem} onClick={() => setView('timetable')}>
          🗓️ Edit Timetable
        </button>

        <div style={styles.sectionLabel}>Settings</div>
        <button style={view === 'settings' ? { ...styles.navItem, ...styles.navItemActive } : styles.navItem} onClick={() => setView('settings')}>
          🔧 Settings
        </button>
      </nav>

      <div style={styles.main}>
        <div style={styles.topBar}>
          <button style={styles.backBtn} onClick={() => navigate('/')}>← All planners</button>
          <span style={styles.plannerName}>{planner.name}</span>
          <span style={styles.saveStatus}>{saving ? 'Saving…' : ''}</span>
        </div>

        {conflictWarning && (
          <div style={styles.conflictBanner}>⚠️ {conflictWarning}</div>
        )}

        {isBlank ? (
          <TimetableSetup data={data} onSave={saveNow} />
        ) : view === 'weekly' ? (
          <WeeklyPlanner data={data} onSave={save} />
        ) : view === 'timetable' ? (
          <TimetableSetup data={data} onSave={saveNow} />
        ) : view === 'settings' ? (
          <Settings data={data} onSave={save} plannerId={plannerId} isOwner={isOwner} />
        ) : planSubjects[view] ? (
          <TermView data={data} onSave={save} subj={view} />
        ) : (
          <div style={{ padding: 30 }}>Unknown view.</div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#F0F2F7', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex' },
  sidebar: { width: 180, background: '#fff', borderRight: '1px solid #D4D9E5', display: 'flex', flexDirection: 'column', padding: '14px 0', flexShrink: 0 },
  sidebarTitle: { fontSize: 13, fontWeight: 800, padding: '0 14px 12px', borderBottom: '1px solid #D4D9E5', marginBottom: 8 },
  sidebarSubtitle: { fontSize: 10, color: '#7A849E', fontWeight: 400, marginTop: 2 },
  sectionLabel: { fontSize: 9, fontWeight: 800, color: '#7A849E', textTransform: 'uppercase', letterSpacing: 0.6, padding: '10px 14px 4px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, color: '#7A849E', cursor: 'pointer', border: 'none', background: 'none', width: '100%', textAlign: 'left', borderLeft: '3px solid transparent' },
  navItemActive: { background: '#F0F2F7', color: '#1C2333', borderLeftColor: '#3A86D4', fontWeight: 700 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', background: '#fff', borderBottom: '1px solid #D4D9E5' },
  backBtn: { fontSize: 12, padding: '6px 12px', border: '1.5px solid #D4D9E5', borderRadius: 6, background: 'transparent', cursor: 'pointer' },
  plannerName: { fontSize: 14, fontWeight: 700 },
  saveStatus: { fontSize: 11, color: '#7A849E', marginLeft: 'auto' },
  conflictBanner: { fontSize: 11, color: '#8A6D00', background: '#FFF6DB', border: '1px solid #F0DE9A', padding: '8px 16px', margin: '10px 24px 0' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" },
}
