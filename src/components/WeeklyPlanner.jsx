import { useState } from 'react'
import { DAYS, DEFAULT_ROWS, DEFAULT_PLAN_SUBJECTS, SG_SLOTS } from '../lib/timetableDefaults'
import { getSessionFor, withSessionSet, withWeekUpdated, withNewWeek, withNextWeek, getWeek } from '../lib/plannerHelpers'
import { linkify } from '../lib/linkify'
import SessionModal from './SessionModal'

export default function WeeklyPlanner({ data, onSave, myGroupPrefs }) {
  const rows = data.rows || DEFAULT_ROWS
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const weeks = data.weeks
  const activeWeekId = data.activeWeekId || (weeks[0] && weeks[0].id)
  const activeWeek = getWeek(data, activeWeekId)

  const [modalCtx, setModalCtx] = useState(null) // { subj, day, groupId, existing } | null

  function switchWeek(id) {
    onSave({ ...data, activeWeekId: id })
  }

  function addWeek() {
    onSave(withNextWeek(data, planSubjects))
  }

  function openAdd(subj, day) {
    setModalCtx({ subj, day, groupId: null, existing: null })
  }

  function openEdit(subj, day, existing) {
    setModalCtx({ subj, day, groupId: null, existing })
  }

  function closeModal() {
    setModalCtx(null)
  }

  function handleSaveSession(sessionObj) {
    const { subj, day, groupId } = modalCtx
    const newWeek = withSessionSet(activeWeek, subj, day, groupId, {
      title: sessionObj.title,
      detail: sessionObj.detail,
      li: sessionObj.li,
      resources: sessionObj.resources,
      bumped: sessionObj.bumped || false,
    })
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
    closeModal()
  }

  function handleDeleteSession() {
    const { subj, day, groupId } = modalCtx
    const newWeek = withSessionSet(activeWeek, subj, day, groupId, null)
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
    closeModal()
  }

  function quickDelete(subj, day) {
    if (!window.confirm('Remove this session?')) return
    const newWeek = withSessionSet(activeWeek, subj, day, null, null)
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
  }

  if (!activeWeek) {
    return (
      <div style={styles.empty}>
        <p>No weeks yet.</p>
        <button style={styles.addWeekBtn} onClick={addWeek}>+ Add first week</button>
      </div>
    )
  }

  return (
    <div>
      {/* Week tabs */}
      <div style={styles.tabBar}>
        {weeks.map((w) => (
          <button
            key={w.id}
            onClick={() => switchWeek(w.id)}
            style={{ ...styles.tab, ...(w.id === activeWeekId ? styles.tabActive : {}) }}
          >
            {w.weekLabel || w.label}
          </button>
        ))}
        {weeks.length < 12 && (
          <button style={styles.tabAdd} onClick={addWeek} title="Add next week">+</button>
        )}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thTime}>Time</th>
              {DAYS.map(d => <th key={d} style={styles.th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.type === 'block-header') {
                return (
                  <tr key={ri}>
                    <td colSpan={6} style={{ ...styles.blockHeader, background: blockColor(row.cls) }}>{row.label}</td>
                  </tr>
                )
              }
              if (row.type === 'break') {
                return (
                  <tr key={ri}>
                    <td colSpan={6} style={styles.breakRow}>☕ {row.label}</td>
                  </tr>
                )
              }

              return (
                <RowRenderer
                  key={ri}
                  row={row}
                  week={activeWeek}
                  onAdd={openAdd}
                  onEdit={openEdit}
                  onDelete={quickDelete}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      <SessionModal
        open={!!modalCtx}
        initial={modalCtx?.existing}
        title={modalCtx ? `${planSubjects[modalCtx.subj]?.label || modalCtx.subj} — ${modalCtx.day}` : ''}
        onSave={handleSaveSession}
        onDelete={modalCtx?.existing ? handleDeleteSession : null}
        onClose={closeModal}
      />
    </div>
  )
}

function blockColor(cls) {
  if (cls === 'block-morning') return '#5A94C8'
  if (cls === 'block-middle') return '#3A9E6A'
  if (cls === 'block-afternoon') return '#D4822A'
  return '#888'
}

function RowRenderer({ row, week, onAdd, onEdit, onDelete }) {
  const cells = []
  let skip = 0

  for (const day of DAYS) {
    if (skip > 0) { skip--; continue }
    const cell = row.days[day]
    if (!cell) { cells.push(<td key={day} style={styles.td}></td>); continue }
    if (cell.span || cell.rowspanned) continue

    const rowSpan = cell.rowspan || 1
    const colSpan = cell.colspan || 1
    if (colSpan > 1) skip = colSpan - 1

    if (cell.fixed) {
      cells.push(
        <td key={day} rowSpan={rowSpan} style={styles.td}>
          <div style={styles.fixedCard}>{cell.fixed.split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>
        </td>
      )
      continue
    }

    if (cell.spelling) {
      const topic = week.topics?.spelling || ''
      cells.push(
        <td key={day} style={styles.td}>
          <div style={{ ...styles.fixedCard, background: '#EAD6F9', cursor: 'pointer' }}>
            {topic || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>+ topic</span>}
          </div>
        </td>
      )
      continue
    }

    if (cell.sg) {
      const sgSlot = SG_SLOTS[cell.sgKey]
      cells.push(
        <td key={day} style={styles.td}>
          <div style={{ ...styles.fixedCard, background: '#FFE8CC', minHeight: 56, fontSize: 10 }}>
            {sgSlot?.label} groups
          </div>
        </td>
      )
      continue
    }

    if (cell.plannable) {
      const subj = cell.subject
      const session = getSessionFor(week, subj, day, null)
      cells.push(
        <td key={day} style={styles.td}>
          {session ? (
            <div style={styles.planCard} onClick={() => onEdit(subj, day, session)}>
              <div style={styles.cardTitle}>{session.title}</div>
              <div style={styles.cardPreview}>{linkify(session.detail)}</div>
              {session.resources && (
                <div style={styles.cardResource}>🔗 {linkify(session.resources)}</div>
              )}
              <button
                style={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); onDelete(subj, day) }}
              >🗑</button>
            </div>
          ) : (
            <div style={styles.emptyCell} onClick={() => onAdd(subj, day)}>+</div>
          )}
        </td>
      )
      continue
    }

    cells.push(<td key={day} style={styles.td}></td>)
  }

  return (
    <tr>
      <td style={styles.timeCell}>
        <div style={styles.slotName}>{row.name}</div>
        <div style={styles.time}>{row.time}</div>
      </td>
      {cells}
    </tr>
  )
}

const styles = {
  empty: { padding: 60, textAlign: 'center', color: '#7A849E' },
  addWeekBtn: { marginTop: 10, padding: '9px 16px', background: '#3A86D4', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabBar: { display: 'flex', gap: 4, padding: '10px 20px', flexWrap: 'wrap', borderBottom: '1px solid #D4D9E5', background: '#fff' },
  tab: { padding: '6px 10px', borderRadius: '6px 6px 0 0', border: '1.5px solid transparent', background: 'none', fontSize: 11, fontWeight: 600, color: '#7A849E', cursor: 'pointer' },
  tabActive: { background: '#F0F2F7', borderColor: '#D4D9E5', color: '#1C2333' },
  tabAdd: { padding: '6px 10px', borderRadius: '6px 6px 0 0', border: '1.5px dashed #D4D9E5', background: 'none', fontSize: 14, color: '#7A849E', cursor: 'pointer' },
  tableWrap: { padding: '16px 20px', overflowX: 'auto' },
  table: { minWidth: 820, width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1.5px solid #D4D9E5', borderRadius: 8, overflow: 'hidden' },
  th: { padding: '9px 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#7A849E', background: '#F0F2F7', borderBottom: '2px solid #D4D9E5', textAlign: 'center' },
  thTime: { padding: '9px 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#7A849E', background: '#F0F2F7', borderBottom: '2px solid #D4D9E5', textAlign: 'left', width: 100 },
  blockHeader: { padding: '5px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: '#fff', textAlign: 'center' },
  breakRow: { background: '#E8EAF0', padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#7A849E', textTransform: 'uppercase', textAlign: 'center', borderTop: '1px solid #D4D9E5', borderBottom: '1px solid #D4D9E5' },
  timeCell: { padding: '6px 8px', fontSize: 10, fontWeight: 700, color: '#7A849E', verticalAlign: 'top', borderRight: '2px solid #D4D9E5', borderBottom: '1px solid #D4D9E5', background: '#F8F9FB', width: 100 },
  slotName: { fontSize: 11, fontWeight: 800, color: '#1C2333' },
  time: { fontSize: 9 },
  td: { padding: 5, verticalAlign: 'top', borderRight: '1px solid #D4D9E5', borderBottom: '1px solid #D4D9E5', minWidth: 120 },
  fixedCard: { borderRadius: 6, padding: '6px 8px', fontSize: 11, fontWeight: 700, textAlign: 'center', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F7' },
  planCard: { borderRadius: 6, padding: '7px 9px', minHeight: 56, cursor: 'pointer', position: 'relative', border: '1.5px solid #CCE8FF', background: '#F5FAFF' },
  cardTitle: { fontSize: 12, fontWeight: 700, marginBottom: 3, color: '#2870D4' },
  cardPreview: { fontSize: 10, color: '#7A849E', whiteSpace: 'pre-line' },
  cardResource: { fontSize: 9, marginTop: 3 },
  emptyCell: { borderRadius: 6, minHeight: 56, border: '1.5px dashed #D4D9E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A849E', fontSize: 18, cursor: 'pointer' },
  deleteBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, border: 'none', borderRadius: 4, background: 'rgba(255,255,255,0.85)', fontSize: 10, cursor: 'pointer', display: 'none' },
}
