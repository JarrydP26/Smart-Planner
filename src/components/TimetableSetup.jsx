import { useState } from 'react'
import { DAYS, DEFAULT_ROWS, DEFAULT_PLAN_SUBJECTS } from '../lib/timetableDefaults'
import { withNewWeek, getMonday } from '../lib/plannerHelpers'

// Full custom timetable builder, ported from the HTML version's manual
// editor (image-upload/AI-reading step intentionally left out for now).
// A blank planner sees this as its first screen (no onDone needed — the
// planner naturally stops being "blank" once weeks exist). An existing
// planner can reopen this from Settings to edit its structure, in which
// case onDone switches back to the Weekly Planner view.

export default function TimetableSetup({ data, onSave, onDone }) {
  const [draftRows, setDraftRows] = useState(null) // null = showing the initial choice screen
  const [busy, setBusy] = useState(false)

  async function useDefaultTimetable() {
    setBusy(true)
    const withTimetable = { ...data, rows: null, planSubjects: null }
    const finalData = data.weeks.length === 0
      ? withNewWeek(withTimetable, DEFAULT_PLAN_SUBJECTS, getMonday(new Date()))
      : withTimetable
    await onSave(finalData)
    setBusy(false)
    onDone?.()
  }

  function startManualEdit() {
    setDraftRows(rowsToDraft(data.rows || DEFAULT_ROWS))
  }

  function cancelEdit() {
    if (data.weeks.length > 0 && !window.confirm('Discard this draft and return?')) return
    setDraftRows(null)
    onDone?.()
  }

  function addDraftRow(type) {
    if (type === 'slot') {
      setDraftRows([...draftRows, { type: 'slot', time24: '', name: '', plannable: true, activeDays: [...DAYS], accColor: '#3A86D4' }])
    } else if (type === 'break') {
      setDraftRows([...draftRows, { type: 'break', label: 'EATING TIME' }])
    } else {
      setDraftRows([...draftRows, { type: 'block-header', label: 'BLOCK LABEL' }])
    }
  }

  function updateDraftRow(idx, field, value) {
    const next = [...draftRows]
    next[idx] = { ...next[idx], [field]: value }
    setDraftRows(next)
  }

  function toggleDraftRowDay(idx, day) {
    const next = [...draftRows]
    const row = { ...next[idx] }
    const activeDays = row.activeDays ? [...row.activeDays] : [...DAYS]
    row.activeDays = activeDays.includes(day) ? activeDays.filter(d => d !== day) : [...activeDays, day]
    next[idx] = row
    setDraftRows(next)
  }

  function moveDraftRow(idx, dir) {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= draftRows.length) return
    const next = [...draftRows]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    setDraftRows(next)
  }

  function deleteDraftRow(idx) {
    if (!window.confirm('Remove this row from the draft?')) return
    setDraftRows(draftRows.filter((_, i) => i !== idx))
  }

  async function saveDraftTimetable() {
    if (!window.confirm('Save this timetable? Weekly Planner and Term Views will rebuild around it. Existing session data is kept wherever subjects/days still match.')) return

    const newRows = []
    const newPlanSubjects = {}

    draftRows.forEach((row) => {
      if (row.type === 'block-header') {
        newRows.push({ type: 'block-header', label: row.label, cls: 'block-morning' })
        return
      }
      if (row.type === 'break') {
        newRows.push({ type: 'break', label: row.label })
        return
      }

      const subjKey = (row.name || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('session_' + newRows.length)
      const activeDays = row.activeDays && row.activeDays.length ? row.activeDays : [...DAYS]
      const days = {}

      DAYS.forEach(d => {
        if (!activeDays.includes(d)) { days[d] = null; return }
        if (row.plannable) {
          days[d] = { plannable: true, subject: subjKey, accColor: row.accColor }
        } else {
          days[d] = { fixed: row.name, cls: 's-custom', accColor: row.accColor }
        }
      })

      newRows.push({ type: 'slot', time: convert24ToLabel(row.time24), name: row.name, days })

      if (row.plannable) {
        newPlanSubjects[subjKey] = { label: row.name, days: activeDays, accColor: row.accColor }
      }
    })

    // Preserve existing week data — add empty entries for any new subjects,
    // keep everything else as-is (matching subjects/days keep their content).
    const weeks = data.weeks.map(week => {
      const sessions = { ...week.sessions }
      Object.keys(newPlanSubjects).forEach(subj => {
        if (!sessions[subj]) {
          sessions[subj] = {}
          DAYS.forEach(d => { sessions[subj][d] = null })
        }
      })
      return { ...week, sessions }
    })

    let finalData = { ...data, rows: newRows, planSubjects: newPlanSubjects, weeks }
    if (finalData.weeks.length === 0) {
      finalData = withNewWeek(finalData, newPlanSubjects, getMonday(new Date()))
    }

    await onSave(finalData)
    setDraftRows(null)
    onDone?.()
  }

  // ── Initial choice screen ──
  if (!draftRows) {
    return (
      <div style={styles.wrap}>
        <h2 style={styles.title}>⚙️ Timetable Setup</h2>
        <p style={styles.desc}>
          {data.weeks.length === 0
            ? 'This planner needs a timetable before you can start planning sessions.'
            : 'Editing the timetable rebuilds Weekly Planner and Term Views around the new structure. Existing session data is kept wherever subjects and days still match.'}
        </p>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Standard Grade 3 Timetable</div>
          <div style={styles.cardDesc}>
            Circle, Learning Powers, Maths, Spelling, Maths to Self, Read to Self,
            Writing, Reading, Afternoon — Monday to Friday.
          </div>
          <button style={styles.button} onClick={useDefaultTimetable} disabled={busy}>
            {busy ? 'Setting up…' : 'Use this timetable'}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Edit manually</div>
          <div style={styles.cardDesc}>
            Build or adjust the timetable row by row — add sessions, breaks, and block headers,
            set which days each applies to, and mark sessions as plannable or fixed.
          </div>
          <button style={styles.buttonOutline} onClick={startManualEdit}>✏️ Edit current timetable manually</button>
        </div>

        {data.weeks.length > 0 && onDone && (
          <button style={styles.buttonOutline} onClick={onDone}>← Back to planner</button>
        )}
      </div>
    )
  }

  // ── Draft row editor screen ──
  return (
    <div style={styles.wrap}>
      <div style={styles.banner}>
        ⚠️ Review each row below before saving. Fix any times, labels, or day toggles. Nothing changes in your planner until you click <strong>Save Timetable</strong>.
      </div>

      <div style={styles.sectionTitle}>Timetable rows (in order)</div>
      <div style={styles.rowList}>
        {draftRows.map((row, idx) => (
          <DraftRowCard
            key={idx}
            row={row}
            idx={idx}
            onUpdate={updateDraftRow}
            onToggleDay={toggleDraftRowDay}
            onMove={moveDraftRow}
            onDelete={deleteDraftRow}
          />
        ))}
      </div>

      <div style={styles.addRowBar}>
        <button style={styles.buttonOutline} onClick={() => addDraftRow('slot')}>+ Add session row</button>
        <button style={styles.buttonOutline} onClick={() => addDraftRow('break')}>+ Add break</button>
        <button style={styles.buttonOutline} onClick={() => addDraftRow('block-header')}>+ Add block header</button>
      </div>

      <div style={styles.footerBar}>
        <button style={styles.buttonOutline} onClick={cancelEdit}>Cancel</button>
        <button style={styles.button} onClick={saveDraftTimetable}>💾 Save Timetable</button>
      </div>
    </div>
  )
}

function DraftRowCard({ row, idx, onUpdate, onToggleDay, onMove, onDelete }) {
  if (row.type === 'block-header' || row.type === 'break') {
    return (
      <div style={{ ...styles.rowCard, background: row.type === 'block-header' ? '#EAF1FB' : '#F0F2F7' }}>
        <input
          type="text" value={row.label || ''}
          placeholder={row.type === 'block-header' ? 'e.g. MORNING BLOCK 8:45–11:00' : 'e.g. EATING TIME 11:00–11:10'}
          onChange={(e) => onUpdate(idx, 'label', e.target.value)}
          style={styles.rowInputWide}
        />
        <RowActions idx={idx} onMove={onMove} onDelete={onDelete} />
      </div>
    )
  }

  const isPlannable = !!row.plannable

  return (
    <div style={styles.rowCard}>
      <input type="time" value={row.time24 || ''} onChange={(e) => onUpdate(idx, 'time24', e.target.value)} style={styles.rowInputTime} />
      <input
        type="text" value={row.name || ''} placeholder="Session name (e.g. Maths)"
        onChange={(e) => onUpdate(idx, 'name', e.target.value)}
        style={styles.rowInputName}
      />
      <div style={styles.dayToggles}>
        {DAYS.map(d => {
          const on = row.activeDays ? row.activeDays.includes(d) : true
          return (
            <button
              key={d}
              type="button"
              onClick={() => onToggleDay(idx, d)}
              title={d}
              style={{ ...styles.dayToggle, ...(on ? styles.dayToggleActive : {}) }}
            >{d[0]}</button>
          )
        })}
      </div>
      <select
        value={isPlannable ? 'plannable' : 'fixed'}
        onChange={(e) => onUpdate(idx, 'plannable', e.target.value === 'plannable')}
        style={styles.rowSelect}
      >
        <option value="fixed">Fixed</option>
        <option value="plannable">Plannable</option>
      </select>
      <input
        type="color" value={row.accColor || '#3A86D4'}
        onChange={(e) => onUpdate(idx, 'accColor', e.target.value)}
        style={styles.colorSwatch}
      />
      <RowActions idx={idx} onMove={onMove} onDelete={onDelete} />
    </div>
  )
}

function RowActions({ idx, onMove, onDelete }) {
  return (
    <div style={styles.rowActions}>
      <button style={styles.iconBtn} onClick={() => onMove(idx, -1)} title="Move up">↑</button>
      <button style={styles.iconBtn} onClick={() => onMove(idx, 1)} title="Move down">↓</button>
      <button style={styles.iconBtn} onClick={() => onDelete(idx)} title="Delete">🗑</button>
    </div>
  )
}

// ── Time helpers, ported from the HTML version ──
function convert24ToLabel(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  let displayH = h
  if (h === 0) displayH = 12
  else if (h > 12) displayH = h - 12
  return `${displayH}:${String(m).padStart(2, '0')}`
}

function convertTimeLabelTo24(label) {
  if (!label) return ''
  const m = label.match(/(\d{1,2}):(\d{2})/)
  if (!m) return ''
  let h = parseInt(m[1])
  const min = m[2]
  if (h < 8) h += 12
  return `${String(h).padStart(2, '0')}:${min}`
}

// Converts the live rows structure (per-day cell objects) into a simplified
// draft shape for editing.
function rowsToDraft(liveRows) {
  return liveRows.map(row => {
    if (row.type === 'block-header' || row.type === 'break') {
      return { type: row.type, label: row.label }
    }
    const activeDays = []
    let plannable = false
    let accColor = null
    DAYS.forEach(d => {
      const cell = row.days[d]
      if (cell && !cell.rowspanned && !cell.span) {
        activeDays.push(d)
        if (cell.plannable) plannable = true
        if (cell.accColor) accColor = cell.accColor
      }
    })
    return {
      type: 'slot',
      time24: convertTimeLabelTo24(row.time),
      name: row.name,
      plannable,
      activeDays,
      accColor: accColor || '#3A86D4',
    }
  })
}

const styles = {
  wrap: { maxWidth: 900, margin: '0 auto', padding: '30px 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  desc: { fontSize: 13, color: '#7A849E', lineHeight: 1.6, marginBottom: 20 },
  card: { background: '#fff', border: '1.5px solid #D4D9E5', borderRadius: 10, padding: '18px 20px', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#7A849E', lineHeight: 1.5, marginBottom: 14 },
  button: { padding: '9px 16px', background: '#3A86D4', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  buttonOutline: { padding: '9px 16px', background: '#fff', color: '#1C2333', border: '1.5px solid #D4D9E5', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  banner: { background: '#FFF6E0', border: '1px solid #F0D89A', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16, lineHeight: 1.5 },
  sectionTitle: { fontSize: 11, fontWeight: 800, color: '#7A849E', textTransform: 'uppercase', marginBottom: 8 },
  rowList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  rowCard: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #D4D9E5', borderRadius: 8, padding: '8px 10px', flexWrap: 'wrap' },
  rowInputTime: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 6px', fontSize: 12, width: 90 },
  rowInputName: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 8px', fontSize: 12, flex: 1, minWidth: 140 },
  rowInputWide: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 8px', fontSize: 12, flex: 1 },
  dayToggles: { display: 'flex', gap: 3 },
  dayToggle: { width: 22, height: 22, borderRadius: 4, border: '1px solid #D4D9E5', background: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#B0B6C4' },
  dayToggleActive: { background: '#3A86D4', color: '#fff', borderColor: '#3A86D4' },
  rowSelect: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 6px', fontSize: 11, fontFamily: 'inherit' },
  colorSwatch: { width: 30, height: 28, border: '1px solid #D4D9E5', borderRadius: 5, padding: 0, cursor: 'pointer' },
  rowActions: { display: 'flex', gap: 3, marginLeft: 'auto' },
  iconBtn: { width: 24, height: 24, border: '1px solid #D4D9E5', background: '#fff', borderRadius: 5, fontSize: 11, cursor: 'pointer' },
  addRowBar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  footerBar: { display: 'flex', gap: 8, borderTop: '1px solid #D4D9E5', paddingTop: 16 },
}
