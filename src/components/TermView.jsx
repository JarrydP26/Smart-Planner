import { DAYS, DEFAULT_PLAN_SUBJECTS, SUBJECT_DOT_COLOR } from '../lib/timetableDefaults'
import { getSessionFor, withSessionSet, withWeekUpdated, groupsEnabledFor, getEffectiveGroupId, getBlockLabel } from '../lib/plannerHelpers'
import { loadMyGroupPrefs, saveMyGroupPrefs } from '../lib/myGroupPrefs'
import { linkify } from '../lib/linkify'
import { useState } from 'react'
import SessionModal from './SessionModal'

export default function TermView({ data, onSave, subj }) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const subjMeta = planSubjects[subj]
  const days = subjMeta?.days || []
  const acc = SUBJECT_DOT_COLOR[subj] || '#888'

  const [myGroupPrefs, setMyGroupPrefs] = useState(loadMyGroupPrefs)
  const [viewMode, setViewMode] = useState('single') // 'single' | 'all' — session-only, not persisted
  const [modalCtx, setModalCtx] = useState(null) // { weekId, day, groupId, existing } | null

  if (!subjMeta) return <div style={{ padding: 30 }}>Unknown subject.</div>

  const hasGroups = groupsEnabledFor(data, subj)
  const groupCfg = data.appSettings.abilityGroups?.[subj]
  const activeGroupId = hasGroups ? getEffectiveGroupId(data, subj, myGroupPrefs) : null

  function setActiveGroupId(groupId) {
    const next = { ...myGroupPrefs, [subj]: groupId }
    setMyGroupPrefs(next)
    saveMyGroupPrefs(next)
  }

  function openAdd(weekId, day, groupId) {
    setModalCtx({ weekId, day, groupId, existing: null })
  }
  function openEdit(weekId, day, groupId, existing) {
    setModalCtx({ weekId, day, groupId, existing })
  }
  function closeModal() {
    setModalCtx(null)
  }

  function handleSaveSession(sessionObj) {
    const { weekId, day, groupId } = modalCtx
    const week = data.weeks.find(w => w.id === weekId)
    const newWeek = withSessionSet(week, subj, day, groupId, {
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
    const { weekId, day, groupId } = modalCtx
    const week = data.weeks.find(w => w.id === weekId)
    const newWeek = withSessionSet(week, subj, day, groupId, null)
    onSave(withWeekUpdated(data, weekId, newWeek))
    closeModal()
  }

  function deleteWeekContent(weekId) {
    const week = data.weeks.find(w => w.id === weekId)
    let newWeek = week
    let cleared = 0
    const groupIds = hasGroups ? groupCfg.groups.map(g => g.id) : [null]
    days.forEach(d => {
      groupIds.forEach(gid => {
        if (getSessionFor(newWeek, subj, d, gid)) {
          newWeek = withSessionSet(newWeek, subj, d, gid, null)
          cleared++
        }
      })
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
      <div className="no-print" style={styles.header}>
        <div style={styles.title}>
          <span style={{ ...styles.dot, background: acc }}></span>
          {subjMeta.label} — Term Overview
        </div>
        <div style={styles.groupControls}>
          {hasGroups && (
            <>
              <select
                value={activeGroupId || ''}
                disabled={viewMode === 'all'}
                onChange={(e) => setActiveGroupId(e.target.value)}
                style={styles.groupSelect}
              >
                {groupCfg.groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <div style={styles.modeToggle}>
                <button
                  style={{ ...styles.modeBtn, ...(viewMode === 'single' ? styles.modeBtnActive : {}) }}
                  onClick={() => setViewMode('single')}
                >My group</button>
                <button
                  style={{ ...styles.modeBtn, ...(viewMode === 'all' ? styles.modeBtnActive : {}) }}
                  onClick={() => setViewMode('all')}
                >All groups</button>
              </div>
            </>
          )}
          <button style={styles.printBtn} onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>

      <textarea
        defaultValue={data.termSummaries?.[subj] || ''}
        onBlur={(e) => setTermSummary(e.target.value)}
        placeholder="Term overview — key units, big ideas, assessment plans, anything worth noting at a glance…"
        style={styles.summaryBox}
      />

      {hasGroups && viewMode === 'all' ? (
        <AllGroupsTable
          data={data}
          subj={subj}
          subjMeta={subjMeta}
          days={days}
          groupCfg={groupCfg}
          onEdit={openEdit}
          onAdd={openAdd}
        />
      ) : (
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
                    const blockLabel = getBlockLabel(week, subjMeta.label, day)
                    const session = getSessionFor(week, subj, day, activeGroupId)
                    return (
                      <td key={day} style={styles.cell}>
                        {blockLabel ? (
                          <div style={styles.blockBanner} title={`${blockLabel} — manage via Block Out`}>
                            <div style={styles.blockIcon}>🚫</div>
                            <div>{blockLabel}</div>
                          </div>
                        ) : session ? (
                          <div style={styles.sessionCard} onClick={() => openEdit(week.id, day, activeGroupId, session)}>
                            <div style={{ ...styles.cardTitle, color: acc }}>{session.title}</div>
                            <div style={styles.cardPreview}>{linkify(session.detail)}</div>
                            {session.resources && <div style={styles.cardResource}>🔗 {linkify(session.resources)}</div>}
                          </div>
                        ) : (
                          <div style={styles.emptyCell} onClick={() => openAdd(week.id, day, activeGroupId)}>+</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SessionModal
        open={!!modalCtx}
        initial={modalCtx?.existing}
        title={modalCtx ? `${subjMeta.label} — ${modalCtx.day}${modalCtx.groupId ? ` (${groupCfg?.groups.find(g => g.id === modalCtx.groupId)?.name || ''})` : ''}` : ''}
        onSave={handleSaveSession}
        onDelete={modalCtx?.existing ? handleDeleteSession : null}
        onClose={closeModal}
      />
    </div>
  )
}

// "All groups" view — one compact card per group per day, so a teacher can
// see everyone's plan for the subject at a glance. Deliberately light-weight
// (title only) since this is a glance view, not for printing.
function AllGroupsTable({ data, subj, subjMeta, days, groupCfg, onEdit, onAdd }) {
  return (
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
                {week.weekLabel || week.label}
                <span style={styles.weekDates}>{week.label}</span>
              </td>
              {days.map(day => (
                <td key={day} style={{ ...styles.cell, padding: 4 }}>
                  <div style={styles.allGroupsStack}>
                    {groupCfg.groups.map(g => {
                      const session = getSessionFor(week, subj, day, g.id)
                      return session ? (
                        <div key={g.id} style={styles.miniCard} onClick={() => onEdit(week.id, day, g.id, session)}>
                          <div style={styles.miniCardGroup}>{g.name}</div>
                          <div style={styles.miniCardTitle}>{session.title}</div>
                        </div>
                      ) : (
                        <div key={g.id} style={styles.miniEmptyCard} onClick={() => onAdd(week.id, day, g.id)}>
                          <span style={styles.miniCardGroup}>{g.name}</span> +
                        </div>
                      )
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const styles = {
  wrap: { padding: '16px 20px', maxWidth: 1100 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  groupControls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  groupSelect: { padding: '6px 9px', border: '1.5px solid #D4D9E5', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', background: '#fff' },
  modeToggle: { display: 'flex', border: '1.5px solid #D4D9E5', borderRadius: 6, overflow: 'hidden' },
  modeBtn: { padding: '6px 10px', fontSize: 11, border: 'none', cursor: 'pointer', background: '#fff', color: '#1C2333' },
  modeBtnActive: { background: '#3A86D4', color: '#fff' },
  printBtn: { padding: '6px 12px', borderRadius: 6, border: '1.5px solid #D4D9E5', background: '#fff', color: '#1C2333', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
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
  allGroupsStack: { display: 'flex', flexDirection: 'column', gap: 3 },
  miniCard: { border: '1px solid #D4D9E5', borderLeft: '3px solid #3A86D4', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', background: '#F5FAFF' },
  miniEmptyCard: { border: '1px dashed #D4D9E5', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', fontSize: 9, color: '#B0B6C4', display: 'flex', justifyContent: 'space-between' },
  miniCardGroup: { fontSize: 8, fontWeight: 800, textTransform: 'uppercase', color: '#7A849E' },
  miniCardTitle: { fontSize: 10, fontWeight: 700 },
  blockBanner: { borderRadius: 4, minHeight: 64, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF0F0', border: '1px dashed #E8B0B0', color: '#C0392B', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '6px 4px' },
  blockIcon: { fontSize: 14, marginBottom: 2 },
}
