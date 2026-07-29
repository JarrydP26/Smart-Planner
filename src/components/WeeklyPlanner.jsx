import { useState, useMemo } from 'react'
import { DAYS, DEFAULT_ROWS, DEFAULT_PLAN_SUBJECTS, SG_SLOTS, SG_CELLS, SUBJECT_DOT_COLOR, DEFAULT_SPECIALIST_BLOCKS } from '../lib/timetableDefaults'
import { getSessionFor, withSessionSet, withWeekUpdated, withNewWeek, withNextWeek, getWeek, groupsEnabledFor, getEffectiveGroupId, getGroupName, getSgData, withSgDataSet, getBlockLabel, computeSpecialistSpans, getResolvedSgCells } from '../lib/plannerHelpers'
import { loadMyGroupPrefs, saveMyGroupPrefs } from '../lib/myGroupPrefs'
import { linkify } from '../lib/linkify'
import SessionModal from './SessionModal'
import SmallGroupModal from './SmallGroupModal'
import BlockOutModal from './BlockOutModal'

export default function WeeklyPlanner({ data, onSave, snapshotForUndo }) {
  const rows = data.rows || DEFAULT_ROWS
  const specialistBlocks = data.specialistBlocks || DEFAULT_SPECIALIST_BLOCKS
  const mergedSpans = useMemo(() => computeSpecialistSpans(rows, DAYS, specialistBlocks), [rows, specialistBlocks])
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const weeks = data.weeks
  const activeWeekId = data.activeWeekId || (weeks[0] && weeks[0].id)
  const activeWeek = getWeek(data, activeWeekId)

  const [myGroupPrefs, setMyGroupPrefs] = useState(loadMyGroupPrefs)
  const [modalCtx, setModalCtx] = useState(null) // { subj, day, groupId, existing } | null
  const [sgModalCtx, setSgModalCtx] = useState(null) // { sgKey, day } | null
  const [blockOutOpen, setBlockOutOpen] = useState(false)

  function openSgModal(sgKey, day) {
    setSgModalCtx({ sgKey, day })
  }

  function closeSgModal() {
    setSgModalCtx(null)
  }

  function handleSaveSgData(obj) {
    const { sgKey, day } = sgModalCtx
    const newWeek = withSgDataSet(activeWeek, sgKey, day, obj)
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
    closeSgModal()
  }

  function handleClearSgData() {
    snapshotForUndo?.('clear groups')
    const { sgKey, day } = sgModalCtx
    const newWeek = withSgDataSet(activeWeek, sgKey, day, {})
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
    closeSgModal()
  }

  function handleCopySgForward() {
    const { sgKey, day } = sgModalCtx
    const idx = weeks.findIndex(w => w.id === activeWeek.id)
    const nextWeek = weeks[idx + 1]
    if (!nextWeek) { window.alert('There is no next week to copy into.'); return }
    const label = SG_SLOTS[sgKey]?.label || 'these groups'
    const nextLabel = nextWeek.weekLabel || nextWeek.label
    if (!window.confirm(`Copy ${label} on ${day} into ${nextLabel}? This will overwrite that week's existing data there.`)) return
    snapshotForUndo?.('copy groups forward')
    const sourceData = getSgData(activeWeek, sgKey, day)
    const updatedNextWeek = withSgDataSet(nextWeek, sgKey, day, sourceData)
    onSave(withWeekUpdated(data, nextWeek.id, updatedNextWeek))
    closeSgModal()
  }

  function setActiveGroupId(subj, groupId) {
    const next = { ...myGroupPrefs, [subj]: groupId }
    setMyGroupPrefs(next)
    saveMyGroupPrefs(next)
  }

  function switchWeek(id) {
    onSave({ ...data, activeWeekId: id })
  }

  function addWeek() {
    onSave(withNextWeek(data, planSubjects))
  }

  function openAdd(subj, day) {
    const groupId = getEffectiveGroupId(data, subj, myGroupPrefs)
    setModalCtx({ subj, day, groupId, existing: null })
  }

  function openEdit(subj, day, existing) {
    const groupId = getEffectiveGroupId(data, subj, myGroupPrefs)
    setModalCtx({ subj, day, groupId, existing })
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
    snapshotForUndo?.('delete session')
    const { subj, day, groupId } = modalCtx
    const newWeek = withSessionSet(activeWeek, subj, day, groupId, null)
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
    closeModal()
  }

  function quickDelete(subj, day) {
    if (!window.confirm('Remove this session?')) return
    snapshotForUndo?.('delete session')
    const groupId = getEffectiveGroupId(data, subj, myGroupPrefs)
    const newWeek = withSessionSet(activeWeek, subj, day, groupId, null)
    onSave(withWeekUpdated(data, activeWeek.id, newWeek))
  }

  function handleSaveNotes(notesKey, value) {
    const newWeek = { ...activeWeek, notes: { ...activeWeek.notes, [notesKey]: value } }
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
      <div className="no-print" style={styles.tabBar}>
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
        <button style={styles.printBtn} onClick={() => window.print()}>🖨️ Print</button>
        <button style={styles.blockOutBtn} onClick={() => setBlockOutOpen(true)}>🚫 Block out</button>
      </div>

      <GroupBar planSubjects={planSubjects} data={data} myGroupPrefs={myGroupPrefs} onChangeGroup={setActiveGroupId} />

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
                  data={data}
                  myGroupPrefs={myGroupPrefs}
                  rowSpans={mergedSpans[ri]}
                  onAdd={openAdd}
                  onEdit={openEdit}
                  onDelete={quickDelete}
                  onSaveNotes={handleSaveNotes}
                  onOpenSgModal={openSgModal}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      <SessionModal
        open={!!modalCtx}
        initial={modalCtx?.existing}
        title={modalCtx ? `${planSubjects[modalCtx.subj]?.label || modalCtx.subj} — ${modalCtx.day}${modalCtx.groupId ? ` (${getGroupName(data, modalCtx.subj, modalCtx.groupId)})` : ''}` : ''}
        onSave={handleSaveSession}
        onDelete={modalCtx?.existing ? handleDeleteSession : null}
        onClose={closeModal}
      />

      <SmallGroupModal
        open={!!sgModalCtx}
        title={sgModalCtx ? `${SG_SLOTS[sgModalCtx.sgKey]?.label} — ${sgModalCtx.day} groups` : ''}
        initial={sgModalCtx ? getSgData(activeWeek, sgModalCtx.sgKey, sgModalCtx.day) : null}
        sgCells={getResolvedSgCells(data)}
        onSave={handleSaveSgData}
        onClear={handleClearSgData}
        onClose={closeSgModal}
        onCopyForward={handleCopySgForward}
      />

      <BlockOutModal
        open={blockOutOpen}
        data={data}
        activeWeekId={activeWeek.id}
        onSave={onSave}
        onClose={() => setBlockOutOpen(false)}
        snapshotForUndo={snapshotForUndo}
      />
    </div>
  )
}

// Small pill bar — one dropdown per subject with ability groups enabled,
// letting this teacher pick which group's plan they're viewing/editing.
function GroupBar({ planSubjects, data, myGroupPrefs, onChangeGroup }) {
  const groupedSubjects = Object.keys(planSubjects).filter(s => groupsEnabledFor(data, s))
  if (!groupedSubjects.length) return null

  return (
    <div style={styles.groupBar}>
      {groupedSubjects.map(subj => {
        const cfg = data.appSettings.abilityGroups[subj]
        const activeId = getEffectiveGroupId(data, subj, myGroupPrefs)
        return (
          <div key={subj} style={styles.groupPill}>
            <label style={styles.groupPillLabel}>{planSubjects[subj].label}</label>
            <select
              value={activeId || ''}
              onChange={(e) => onChangeGroup(subj, e.target.value)}
              style={styles.groupPillSelect}
            >
              {cfg.groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

function blockColor(cls) {
  if (cls === 'block-morning') return '#5A94C8'
  if (cls === 'block-middle') return '#3A9E6A'
  if (cls === 'block-afternoon') return '#D4822A'
  return '#888'
}

// Per-activity background colors for the fixed (non-plannable) blocks —
// Circle, Learning Powers, PE/Art, Brain Break, Check-in, Assembly, etc.
const FIXED_COLORS = {
  's-circle': '#F3D6EE',
  's-lp': '#CFE3F5',
  's-pe': '#D3F0DD',
  's-brain': '#F5E6C4',
  's-checkin': '#F5E6C4',
  's-assembly': '#DDCBF2',
  's-mts': '#FBE0C0',
  's-rts': '#D0F0DC',
  's-science': '#F5F0C8',
  's-specialist': '#D6ECE6',
}

function fixedColor(cls) {
  return FIXED_COLORS[cls] || '#F0F2F7'
}

function NotesCard({ cls, label, notesKey, week, onSaveNotes }) {
  const [editing, setEditing] = useState(false)
  const value = week.notes?.[notesKey] || ''

  return (
    <div style={styles.notesCard}>
      <div style={styles.notesLabel}>{label}</div>
      <div style={styles.notesSubLabel}>PLANNING NOTES</div>
      {editing ? (
        <textarea
          autoFocus
          defaultValue={value}
          onBlur={(e) => { onSaveNotes(notesKey, e.target.value); setEditing(false) }}
          style={styles.notesTextarea}
        />
      ) : (
        <div style={styles.notesText} onClick={() => setEditing(true)}>
          {value || '+ add notes'}
        </div>
      )}
    </div>
  )
}

function RowRenderer({ row, week, data, myGroupPrefs, rowSpans, onAdd, onEdit, onDelete, onSaveNotes, onOpenSgModal }) {
  const cells = []

  for (const day of DAYS) {
    const merge = rowSpans?.[day]
    if (merge?.skip) continue // merged into a specialist block's cell above

    // Specialist session anchor — driven by the recurring timetable-level
    // declaration (data.specialistBlocks), not by any cell content, since
    // the affected rows' actual cells are just null underneath this.
    if (merge?.label) {
      cells.push(
        <td key={day} rowSpan={merge.span || 1} style={{ ...styles.td, background: merge.color || fixedColor('s-specialist') }}>
          <NotesCard cls="s-specialist" label={merge.label} notesKey={merge.notesKey} week={week} onSaveNotes={onSaveNotes} />
        </td>
      )
      continue
    }

    const cell = row.days[day]
    if (!cell) { cells.push(<td key={day} style={styles.td}></td>); continue }

    const rowSpan = 1

    // Universal block check — whole day OR this specific row blocked.
    // Overrides everything else in the cell if present.
    const blockLabel = getBlockLabel(week, row.name, day)
    if (blockLabel) {
      cells.push(
        <td key={day} rowSpan={rowSpan} style={{ ...styles.td, background: '#FFF0F0' }}>
          <div style={styles.blockBanner} title={`${blockLabel} — manage via Block Out`}>
            <div style={styles.blockIcon}>🚫</div>
            <div>{blockLabel}</div>
          </div>
        </td>
      )
      continue
    }

    if (cell.fixed) {
      cells.push(
        <td key={day} rowSpan={rowSpan} style={styles.td}>
          <div style={{ ...styles.fixedCard, background: fixedColor(cell.cls) }}>
            {cell.fixed.split('\n').map((l, i) => <div key={i}>{l}</div>)}
          </div>
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
      const enabled = data.appSettings.toggles?.[sgSlot.toggleKey]

      if (!enabled) {
        cells.push(
          <td key={day} style={styles.td}>
            <div style={{ ...styles.fixedCard, background: fixedColor(sgSlot?.cls) }}>{sgSlot?.label}</div>
          </td>
        )
        continue
      }

      const sgData = getSgData(week, cell.sgKey, day)
      const resolvedSgCells = getResolvedSgCells(data)
      const hasData = sgData.desc || resolvedSgCells.some(c => sgData[c.id])

      cells.push(
        <td key={day} style={styles.td}>
          <div
            style={{ ...styles.sgCard, background: fixedColor(sgSlot?.cls) }}
            onClick={() => onOpenSgModal(cell.sgKey, day)}
          >
            {hasData ? (
              <>
                {sgData.desc && <div style={styles.sgDesc}>{sgData.desc}</div>}
                <div style={styles.sgGrid}>
                  {resolvedSgCells.map(c => (
                    <div key={c.id} style={styles.sgCell}>
                      <div style={styles.sgCellLabel}>{c.label}</div>
                      <div style={styles.sgNames}>{sgData[c.id] || '—'}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={styles.sgEmptyHint}>Click to add groups</div>
            )}
          </div>
        </td>
      )
      continue
    }

    if (cell.plannable) {
      const subj = cell.subject
      const groupId = getEffectiveGroupId(data, subj, myGroupPrefs)
      const session = getSessionFor(week, subj, day, groupId)
      const accent = (data.planSubjects || DEFAULT_PLAN_SUBJECTS)[subj]?.color || SUBJECT_DOT_COLOR[subj] || '#3A86D4'
      cells.push(
        <td key={day} style={styles.td}>
          {session ? (
            <div style={{ ...styles.planCard, borderLeftColor: accent }} onClick={() => onEdit(subj, day, session)}>
              <div style={{ ...styles.cardTitle, color: accent }}>{session.title}</div>
              {session.li && <div style={styles.cardLi}>🎯 {session.li}</div>}
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
  printBtn: { marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '1.5px solid #D4D9E5', background: '#fff', color: '#1C2333', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  blockOutBtn: { padding: '6px 12px', borderRadius: 6, border: '1.5px solid #E8B0B0', background: '#FFF0F0', color: '#C0392B', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  printBtn: { padding: '6px 12px', borderRadius: 6, border: '1.5px solid #D4D9E5', background: '#fff', color: '#1C2333', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
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
  planCard: { borderRadius: 6, padding: '7px 9px', minHeight: 56, cursor: 'pointer', position: 'relative', border: '1px solid #E4E7EE', borderLeft: '3px solid #3A86D4', background: '#FAFBFD' },
  cardTitle: { fontSize: 12, fontWeight: 700, marginBottom: 3, color: '#2870D4' },
  cardPreview: { fontSize: 10, color: '#7A849E', whiteSpace: 'pre-line' },
  cardLi: { fontSize: 9.5, color: '#3A6EA5', fontStyle: 'italic', marginBottom: 3 },
  cardResource: { fontSize: 9, marginTop: 3 },
  emptyCell: { borderRadius: 6, minHeight: 56, border: '1.5px dashed #D4D9E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A849E', fontSize: 18, cursor: 'pointer' },
  deleteBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, border: 'none', borderRadius: 4, background: 'rgba(255,255,255,0.85)', fontSize: 10, cursor: 'pointer', display: 'none' },
  notesCard: { padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' },
  notesLabel: { fontSize: 12, fontWeight: 800, marginBottom: 4 },
  notesSubLabel: { fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#5A6478', marginBottom: 6 },
  notesText: { fontSize: 10, color: '#5A6478', cursor: 'pointer', whiteSpace: 'pre-line', width: '100%' },
  notesTextarea: { width: '100%', minHeight: 70, fontSize: 10, fontFamily: 'inherit', border: '1px solid #D4D9E5', borderRadius: 4, padding: 4, resize: 'vertical', boxSizing: 'border-box' },
  groupBar: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 20px 0' },
  groupPill: { display: 'flex', alignItems: 'center', gap: 6, background: '#F0F2F7', border: '1px solid #D4D9E5', borderRadius: 20, padding: '4px 10px 4px 12px' },
  groupPillLabel: { fontSize: 10, fontWeight: 700, color: '#5A6478' },
  groupPillSelect: { border: 'none', background: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', color: '#1C2333' },
  sgCard: { borderRadius: 6, padding: '6px 7px', minHeight: 56, cursor: 'pointer', fontSize: 9 },
  sgDesc: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  sgGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 },
  sgCell: { background: 'rgba(255,255,255,0.55)', borderRadius: 4, padding: '3px 4px' },
  sgCellLabel: { fontSize: 7, fontWeight: 800, textTransform: 'uppercase', color: '#5A6478' },
  sgNames: { fontSize: 9, fontWeight: 600 },
  sgEmptyHint: { fontSize: 9, fontStyle: 'italic', color: '#5A6478', textAlign: 'center', padding: '10px 0' },
  blockBanner: { borderRadius: 6, minHeight: 40, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF0F0', border: '1px dashed #E8B0B0', color: '#C0392B', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '6px 4px' },
  blockIcon: { fontSize: 14, marginBottom: 2 },
}
