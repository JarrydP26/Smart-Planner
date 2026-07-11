import { DAYS, DEFAULT_PLAN_SUBJECTS, SUBJECT_DOT_COLOR } from '../lib/timetableDefaults'
import { getSessionFor, withSessionSet, withWeekUpdated } from '../lib/plannerHelpers'
import { linkify } from '../lib/linkify'
import { useState } from 'react'
import SessionModal from './SessionModal'

export default function TermView({ data, onSave, subj }) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const subjMeta = planSubjects[subj]
  const days = subjMeta?.days || []
  const acc = SUBJECT_DOT_COLOR[subj] || '#888'

  const [modalCtx, setModalCtx] = useState(null) // { weekId, day, existing } | null

  if (!subjMeta) return <div style={{ padding: 30 }}>Unknown subject.</div>

  function openAdd(weekId, day) {
    setModalCtx({ weekId, day, existing: null })
  }
  function openEdit(weekId, day, existing) {
    setModalCtx({ weekId, day, existing })
  }
  function closeModal() {
    setModalCtx(null)
  }

  function handleSaveSession(sessionObj) {
    const { weekId, day } = modalCtx
    const week = data.weeks.find(w => w.id === weekId)
    const newWeek = withSessionSet(week, subj, day, null, {
      title: sessionObj.title,
      detail: sessionObj.detail,
      li: sessionObj.li,
      resources: sessionObj.resources,
      bumped: sessionObj.bumped || false,
    })
    onSave(withWeekUpdated(data, weekId, newWeek))
    closeModal()
  }

  function handleDeleteSession() {
    const { weekId, day } = modalCtx
    const week = data.weeks.find(w => w.id === weekId)
    const newWeek = withSessionSet(week, subj, day, null, null)
    onSave(withWeekUpdated(data, weekId, newWeek))
    closeModal()
  }

  function deleteWeekContent(weekId) {
    const week = data.weeks.find(w => w.id === weekId)
    let newWeek = week
    let cleared = 0
    days.forEach(d => {
      if (getSessionFor(newWeek, subj, d, null)) {
        newWeek = withSessionSet(newWeek, subj, d, null, null)
        cleared++
      }
    })
    if (cleared > 0) {
      onSave(withWeekUpdated(data, weekId, newWeek))
    }
  }

  function setTopic(weekId, value) {
    const week = data.weeks.find(w => w.id === weekId)
    const newWeek = { ...week, topics: { ...week.topics, [subj]: value } }
    onSave(withWeekUpdated(data, weekId, newWeek))
  }

  function setTermSummary(value) {
    onSave({ ...data, termSummaries: { ...data.termSummaries, [subj]: value } })
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span style={{ ...styles.dot, background: acc }}></span>
          {subjMeta.label} — Term Overview
        </div>
      </div>

      <textarea
        defaultValue={data.termSummaries?.[subj] || ''}
        onBlur={(e) => setTermSummary(e.target.value)}
        placeholder="Term overview — key units, big ideas, assessment plans, anything worth noting at a glance…"
        style={styles.summaryBox}
      />

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thWeek}>Week</th>
              {days.map(d => <th key={d} style={styles.th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((week) => (
              <tr key={week.id}>
                <td style={styles.weekLabel}>
                  <button
                    style={styles.deleteWeekBtn}
                    title={`Clear ${subjMeta.label} planning for this week`}
                    onClick={() => deleteWeekContent(week.id)}
                  >🗑</button>
                  {week.weekLabel || week.label}
                  <span style={styles.weekDates}>{week.label}</span>
                  <input
                    type="text"
                    defaultValue={week.topics?.[subj] || ''}
                    placeholder="+ topic"
                    onBlur={(e) => setTopic(week.id, e.target.value)}
                    style={styles.topicInput}
                  />
                </td>
                {days.map(day => {
                  const session = getSessionFor(week, subj, day, null)
                  return (
                    <td key={day} style={styles.cell}>
                      {session ? (
                        <div style={styles.sessionCard} onClick={() => openEdit(week.id, day, session)}>
                          <div style={{ ...styles.cardTitle, color: acc }}>{session.title}</div>
                          <div style={styles.cardPreview}>{linkify(session.detail)}</div>
                          {session.resources && <div style={styles.cardResource}>🔗 {linkify(session.resources)}</div>}
                        </div>
                      ) : (
                        <div style={styles.emptyCell} onClick={() => openAdd(week.id, day)}>+</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SessionModal
        open={!!modalCtx}
        initial={modalCtx?.existing}
        title={modalCtx ? `${subjMeta.label} — ${modalCtx.day}` : ''}
        onSave={handleSaveSession}
        onDelete={modalCtx?.existing ? handleDeleteSession : null}
        onClose={closeModal}
      />
    </div>
  )
}

const styles = {
  wrap: { padding: '16px 20px', maxWidth: 1100 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  summaryBox: { width: '100%', minHeight: 64, padding: '10px 12px', border: '1.5px solid #D4D9E5', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', marginBottom: 14, boxSizing: 'border-box' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1.5px solid #D4D9E5' },
  th: { padding: '9px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#7A849E', background: '#F0F2F7', borderBottom: '2px solid #D4D9E5', textAlign: 'center' },
  thWeek: { padding: '9px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#7A849E', background: '#F0F2F7', borderBottom: '2px solid #D4D9E5', textAlign: 'left', width: 170 },
  weekLabel: { padding: '8px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', borderRight: '2px solid #D4D9E5', borderBottom: '1px solid #D4D9E5', background: '#F8F9FB', verticalAlign: 'top', position: 'relative' },
  weekDates: { display: 'block', fontSize: 10, fontWeight: 400, color: '#7A849E', marginTop: 1 },
  deleteWeekBtn: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, border: 'none', borderRadius: 4, background: '#FFE8E8', color: '#C0392B', fontSize: 10, cursor: 'pointer' },
  topicInput: { marginTop: 4, display: 'block', width: '100%', border: '1px solid #D4D9E5', borderRadius: 4, fontSize: 11, fontStyle: 'italic', color: '#3A86D4', padding: '2px 4px', fontFamily: 'inherit', boxSizing: 'border-box' },
  cell: { padding: 5, verticalAlign: 'top', borderRight: '1px solid #D4D9E5', borderBottom: '1px solid #D4D9E5', minWidth: 150 },
  sessionCard: { padding: '8px 10px', minHeight: 64, cursor: 'pointer', borderLeft: '3px solid #3A86D4' },
  cardTitle: { fontSize: 11.5, fontWeight: 700, marginBottom: 3 },
  cardPreview: { fontSize: 10, color: '#7A849E', whiteSpace: 'pre-line' },
  cardResource: { fontSize: 9, marginTop: 3 },
  emptyCell: { minHeight: 64, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4D9E5', fontSize: 16, cursor: 'pointer' },
}
