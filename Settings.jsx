import { useState } from 'react'
import { DEFAULT_ROWS, DEFAULT_PLAN_SUBJECTS, DAYS } from '../lib/timetableDefaults'
import { withNewWeek, getMonday } from '../lib/plannerHelpers'

// Phase 2 first pass: lets a brand-new planner start from the same built-in
// timetable the HTML version shipped with. Building a full custom
// row-by-row editor (like the HTML version's drag/drop-free builder) is a
// later refinement — for now this unblocks every other feature by giving a
// blank planner a real timetable to work with.

export default function TimetableSetup({ data, onSave }) {
  const [busy, setBusy] = useState(false)

  async function useDefaultTimetable() {
    setBusy(true)
    const withTimetable = { ...data, rows: null, planSubjects: null }
    const withFirstWeek = withNewWeek(withTimetable, DEFAULT_PLAN_SUBJECTS, getMonday(new Date()))
    await onSave(withFirstWeek)
    setBusy(false)
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>⚙️ Timetable Setup</h2>
      <p style={styles.desc}>
        This planner needs a timetable before you can start planning sessions.
        For now, you can start from the standard Grade 3 timetable (the same
        one used in the original planner) — a full custom builder is coming soon.
      </p>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Standard Grade 3 Timetable</div>
        <div style={styles.cardDesc}>
          Circle, Learning Powers, Maths, Spelling, Maths to Self, Read to Self,
          Writing, Reading, Afternoon — Monday to Friday, matching the layout
          you're used to.
        </div>
        <button style={styles.button} onClick={useDefaultTimetable} disabled={busy}>
          {busy ? 'Setting up…' : 'Use this timetable'}
        </button>
      </div>

      <div style={styles.preview}>
        <div style={styles.previewTitle}>Preview — what this includes:</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              {DAYS.map(d => <th key={d} style={styles.th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {DEFAULT_ROWS.filter(r => r.type === 'slot').map((row, i) => (
              <tr key={i}>
                <td style={styles.td}><strong>{row.name}</strong><br/><span style={styles.time}>{row.time}</span></td>
                {DAYS.map(d => {
                  const cell = row.days[d]
                  let text = '—'
                  if (cell?.fixed) text = cell.fixed.replace('\n', ' ')
                  else if (cell?.plannable) text = DEFAULT_PLAN_SUBJECTS[cell.subject]?.label || cell.subject
                  else if (cell?.sg) text = '(small groups)'
                  else if (cell?.spelling) text = '(topic)'
                  else if (cell?.rowspanned) text = ''
                  return <td key={d} style={styles.td}>{text}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  wrap: { maxWidth: 760, margin: '0 auto', padding: '30px 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  desc: { fontSize: 13, color: '#7A849E', lineHeight: 1.6, marginBottom: 20 },
  card: { background: '#fff', border: '1.5px solid #D4D9E5', borderRadius: 10, padding: '18px 20px', marginBottom: 24 },
  cardTitle: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#7A849E', lineHeight: 1.5, marginBottom: 14 },
  button: { padding: '9px 16px', background: '#3A86D4', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  preview: { background: '#fff', border: '1px solid #D4D9E5', borderRadius: 10, padding: 16, overflowX: 'auto' },
  previewTitle: { fontSize: 11, fontWeight: 800, color: '#7A849E', textTransform: 'uppercase', marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: { textAlign: 'left', padding: '6px 8px', background: '#F0F2F7', fontWeight: 700, borderBottom: '1px solid #D4D9E5' },
  td: { padding: '6px 8px', borderBottom: '1px solid #F0F2F7' },
  time: { color: '#7A849E', fontSize: 10 },
}
