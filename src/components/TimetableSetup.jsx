import { useState } from 'react'
import { DAYS, DEFAULT_ROWS, DEFAULT_PLAN_SUBJECTS, SUBJECT_DOT_COLOR, DEFAULT_SPECIALIST_BLOCKS } from '../lib/timetableDefaults'
import { withNewWeek, withNextWeek, getMonday } from '../lib/plannerHelpers'

// Full custom timetable builder, ported from the HTML version's manual
// editor (image-upload/AI-reading step intentionally left out for now).
// A blank planner sees this as its first screen (no onDone needed — the
// planner naturally stops being "blank" once weeks exist). An existing
// planner can reopen this from Settings to edit its structure, in which
// case onDone switches back to the Weekly Planner view.
//
// Specialist sessions (PE, Art, Music…) are configured here as a recurring,
// per-day declaration — "on Tuesday, the whole Morning Block is PE / Art" —
// rather than per-row toggles, since a specialist always takes over a whole
// session block at once. See computeSpecialistSpans in plannerHelpers.js for
// how this merges rows and computeMergedSpans's prior notesKey approach it replaced.

// Case-blank planners previously only ever got ONE week to start with, even
// though the term-length setting already said 10 — meaning the week count
// and the setting disagreed until the teacher happened to change that
// setting to a different number. This builds out the full term upfront,
// matching whatever appSettings.termWeeks already says (default 10), so the
// two stay in sync from the very first save.
function withInitialTermWeeks(data, planSubjects) {
  const targetWeeks = data.appSettings?.termWeeks || 10
  let result = withNewWeek(data, planSubjects, getMonday(new Date()))
  for (let i = 1; i < targetWeeks; i++) {
    result = withNextWeek(result, planSubjects)
  }
  return result
}

export default function TimetableSetup({ data, onSave, onDone, snapshotForUndo }) {
  const [draftRows, setDraftRows] = useState(null) // null = showing the initial choice screen
  const [specialistDraft, setSpecialistDraft] = useState(null)
  const [busy, setBusy] = useState(false)

  async function useDefaultTimetable() {
    setBusy(true)
    // Only worth snapshotting if this planner already has real content —
    // resetting a genuinely blank planner to defaults has nothing to undo.
    if (data.weeks.length > 0) snapshotForUndo?.('reset to default timetable')
    const withTimetable = { ...data, rows: null, planSubjects: null, specialistBlocks: null }
    const finalData = data.weeks.length === 0
      ? withInitialTermWeeks(withTimetable, DEFAULT_PLAN_SUBJECTS)
      : withTimetable
    await onSave(finalData)
    setBusy(false)
    onDone?.()
  }

  function startManualEdit() {
    setDraftRows(rowsToDraft(data.rows || DEFAULT_ROWS, data.planSubjects || DEFAULT_PLAN_SUBJECTS))
    setSpecialistDraft({ ...(data.specialistBlocks || DEFAULT_SPECIALIST_BLOCKS) })
  }

  function cancelEdit() {
    if (data.weeks.length > 0 && !window.confirm('Discard this draft and return?')) return
    setDraftRows(null)
    setSpecialistDraft(null)
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
    if (typeof field === 'object') {
      next[idx] = { ...next[idx], ...field }
    } else {
      next[idx] = { ...next[idx], [field]: value }
    }
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

  function setSpecialistBlockForDay(day, blockCls) {
    const next = { ...specialistDraft }
    if (!blockCls) {
      delete next[day]
    } else {
      next[day] = { blockCls, name: next[day]?.name || '', color: next[day]?.color || '#D6ECE6' }
    }
    setSpecialistDraft(next)
  }

  function setSpecialistNameForDay(day, name) {
    if (!specialistDraft[day]) return
    setSpecialistDraft({ ...specialistDraft, [day]: { ...specialistDraft[day], name } })
  }

  function setSpecialistColorForDay(day, color) {
    if (!specialistDraft[day]) return
    setSpecialistDraft({ ...specialistDraft, [day]: { ...specialistDraft[day], color } })
  }

  async function saveDraftTimetable() {
    if (!window.confirm('Save this timetable? Weekly Planner and Term Views will rebuild around it. Existing session data is kept wherever subjects/days still match.')) return

    const newRows = []
    const newPlanSubjects = {}

    draftRows.forEach((row) => {
      if (row.type === 'block-header') {
        newRows.push({ type: 'block-header', label: row.label, cls: row.cls || 'block-morning' })
        return
      }
      if (row.type === 'break') {
        newRows.push({ type: 'break', label: row.label })
        return
      }

      const activeDays = row.activeDays && row.activeDays.length ? row.activeDays : [...DAYS]
      const days = {}

      if (row.sgKey) {
        DAYS.forEach(d => {
          days[d] = activeDays.includes(d) ? { sg: true, sgKey: row.sgKey } : null
        })
        newRows.push({ type: 'slot', time: convert24ToLabel(row.time24), name: row.name, sgKey: row.sgKey, days })
        return
      }

      const subjKey = (row.name || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('session_' + newRows.length)

      DAYS.forEach(d => {
        if (!activeDays.includes(d)) { days[d] = null; return }
        if (row.plannable) {
          days[d] = { plannable: true, subject: subjKey }
        } else {
          days[d] = { fixed: row.name, cls: row.cls || 's-custom' }
        }
      })

      newRows.push({ type: 'slot', time: convert24ToLabel(row.time24), name: row.name, days })

      if (row.plannable) {
        newPlanSubjects[subjKey] = { label: row.name, days: activeDays, color: row.accColor || '#3A86D4' }
      }
    })

    // Only keep specialist declarations that have a name set
    const newSpecialistBlocks = {}
    Object.entries(specialistDraft).forEach(([day, spec]) => {
      if (spec?.blockCls && spec.name?.trim()) {
        newSpecialistBlocks[day] = { blockCls: spec.blockCls, name: spec.name.trim(), color: spec.color || '#D6ECE6' }
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

    let finalData = { ...data, rows: newRows, planSubjects: newPlanSubjects, specialistBlocks: newSpecialistBlocks, weeks }
    if (finalData.weeks.length === 0) {
      finalData = withInitialTermWeeks(finalData, newPlanSubjects)
    }

    // This can meaningfully reshape existing session data (new subject
    // keys, dropped days, etc.) — worth a snapshot before committing,
    // same as any other structural change elsewhere in the app.
    if (data.weeks.length > 0) snapshotForUndo?.('edit timetable')

    await onSave(finalData)
    setDraftRows(null)
    setSpecialistDraft(null)
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
            set which days each applies to, mark sessions as plannable or fixed, and declare
            any specialist sessions (PE, Art, Music…).
          </div>
          <button style={styles.buttonOutline} onClick={startManualEdit}>✏️ Edit current timetable manually</button>
        </div>

        {data.weeks.length > 0 && onDone && (
          <button style={styles.buttonOutline} onClick={onDone}>← Back to planner</button>
        )}
      </div>
    )
  }

  // Block options for the specialist picker, sourced from the draft's own
  // block-header rows (de-duplicated by cls).
  const blockOptions = []
  const seen = new Set()
  draftRows.filter(r => r.type === 'block-header').forEach(r => {
    if (!seen.has(r.cls)) { blockOptions.push({ cls: r.cls, label: r.label }); seen.add(r.cls) }
  })

  // ── Draft row editor screen ──
  return (
    <div style={styles.wrap}>
      <div style={styles.banner}>
        ⚠️ Review each row below before saving. Fix any times, labels, or day toggles. Nothing changes in your planner until you click <strong>Save Timetable</strong>.
      </div>

      <div style={styles.sectionTitle}>Specialist sessions</div>
      <p style={styles.starHint}>A specialist always takes over a whole session block for the day (e.g. the entire Morning Block becomes PE / Art on Tuesday). Pick "None" for a normal day.</p>
      <div style={styles.specialistGrid}>
        {DAYS.map(day => {
          const spec = specialistDraft?.[day]
          return (
            <div key={day} style={styles.specialistCard}>
              <div style={styles.specialistDay}>{day}</div>
              <select
                value={spec?.blockCls || ''}
                onChange={(e) => setSpecialistBlockForDay(day, e.target.value || null)}
                style={styles.rowSelect}
              >
                <option value="">None</option>
                {blockOptions.map(b => <option key={b.cls} value={b.cls}>{b.label}</option>)}
              </select>
              {spec?.blockCls && (
                <>
                  <input
                    type="text"
                    value={spec.name || ''}
                    placeholder="e.g. PE / Art"
                    onChange={(e) => setSpecialistNameForDay(day, e.target.value)}
                    style={styles.rowInputWide}
                  />
                  <input
                    type="color"
                    value={spec.color || '#D6ECE6'}
                    onChange={(e) => setSpecialistColorForDay(day, e.target.value)}
                    title="Colour for this specialist block"
                    style={styles.colorSwatch}
                  />
                </>
              )}
            </div>
          )
        })}
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
  if (row.type === 'block-header') {
    return (
      <div style={{ ...styles.rowCard, background: '#EAF1FB' }}>
        <input
          type="text" value={row.label || ''}
          placeholder="e.g. MORNING BLOCK 8:45–11:00"
          onChange={(e) => onUpdate(idx, 'label', e.target.value)}
          style={styles.rowInputWide}
        />
        <select value={row.cls || 'block-morning'} onChange={(e) => onUpdate(idx, 'cls', e.target.value)} style={styles.rowSelect}>
          <option value="block-morning">Blue (morning)</option>
          <option value="block-middle">Green (middle)</option>
          <option value="block-afternoon">Orange (afternoon)</option>
        </select>
        <RowActions idx={idx} onMove={onMove} onDelete={onDelete} />
      </div>
    )
  }
  if (row.type === 'break') {
    return (
      <div style={{ ...styles.rowCard, background: '#F0F2F7' }}>
        <input
          type="text" value={row.label || ''}
          placeholder="e.g. EATING TIME 11:00–11:10"
          onChange={(e) => onUpdate(idx, 'label', e.target.value)}
          style={styles.rowInputWide}
        />
        <RowActions idx={idx} onMove={onMove} onDelete={onDelete} />
      </div>
    )
  }

  const rowType = row.sgKey ? 'sg' : row.plannable ? 'plannable' : 'fixed'

  return (
    <div style={styles.rowCard}>
      <input type="time" value={row.time24 || ''} onChange={(e) => onUpdate(idx, 'time24', e.target.value)} style={styles.rowInputTime} />
      <input
        type="text" value={row.name || ''} placeholder="Session name (e.g. Maths)"
        onChange={(e) => onUpdate(idx, 'name', e.target.value)}
        style={styles.rowInputName}
      />
      <select
        value={rowType}
        onChange={(e) => {
          const v = e.target.value
          onUpdate(idx, { plannable: v === 'plannable', sgKey: v === 'sg' ? (row.sgKey || 'mts') : null })
        }}
        style={styles.rowSelect}
      >
        <option value="fixed">Fixed</option>
        <option value="plannable">Plannable</option>
        <option value="sg">Small group grid</option>
      </select>
      <div style={styles.typeExtra}>
        {rowType === 'sg' && (
          <select value={row.sgKey || 'mts'} onChange={(e) => onUpdate(idx, 'sgKey', e.target.value)} style={styles.rowSelect}>
            <option value="mts">Maths to Self</option>
            <option value="rts">Read to Self</option>
          </select>
        )}
        {rowType === 'plannable' && (
          <input
            type="color"
            value={row.accColor || '#3A86D4'}
            onChange={(e) => onUpdate(idx, 'accColor', e.target.value)}
            title="Colour for this subject's session cards"
            style={styles.colorSwatch}
          />
        )}
      </div>
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

// Converts the live rows structure into a simplified draft shape for
// editing. Specialist sessions are no longer part of any row's cells at
// all — they're handled separately via the specialistDraft state above.
function rowsToDraft(liveRows, planSubjectsData) {
  return liveRows.map(row => {
    if (row.type === 'block-header') {
      return { type: row.type, label: row.label, cls: row.cls || 'block-morning' }
    }
    if (row.type === 'break') {
      return { type: row.type, label: row.label }
    }

    const activeDays = []
    let plannable = false
    let cls = null
    let sgKey = null
    let subjKey = null
    DAYS.forEach(d => {
      const cell = row.days[d]
      if (cell) {
        activeDays.push(d)
        if (cell.sg) {
          sgKey = cell.sgKey
        } else {
          if (cell.plannable) { plannable = true; subjKey = cell.subject }
          if (cell.cls) cls = cell.cls
        }
      }
    })
    const accColor = subjKey ? (planSubjectsData?.[subjKey]?.color || SUBJECT_DOT_COLOR[subjKey] || '#3A86D4') : null
    return {
      type: 'slot',
      time24: convertTimeLabelTo24(row.time),
      name: row.name,
      plannable,
      sgKey,
      activeDays,
      cls, // preserved so a Fixed row keeps its original color
      accColor, // preserved so a Plannable subject keeps its chosen color
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
  sectionTitle: { fontSize: 11, fontWeight: 800, color: '#7A849E', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  starHint: { fontSize: 11, color: '#7A849E', marginTop: -4, marginBottom: 10 },
  specialistGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 },
  specialistCard: { background: '#F0F8F5', border: '1px solid #D4D9E5', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 },
  specialistDay: { fontSize: 11, fontWeight: 800 },
  rowList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  rowCard: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #D4D9E5', borderRadius: 8, padding: '8px 10px', flexWrap: 'wrap' },
  rowInputTime: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 6px', fontSize: 12, width: 90 },
  rowInputName: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 8px', fontSize: 12, flex: 1, minWidth: 140 },
  rowInputWide: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 8px', fontSize: 12, flex: 1 },
  typeExtra: { width: 115, display: 'flex', justifyContent: 'flex-start' },
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
