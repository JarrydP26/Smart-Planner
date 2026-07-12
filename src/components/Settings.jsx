import { useState } from 'react'
import { DEFAULT_PLAN_SUBJECTS } from '../lib/timetableDefaults'
import { withNewWeek, withNextWeek, withRelabeledTerm, getMonday } from '../lib/plannerHelpers'

const TOGGLE_DEFINITIONS = [
  { key: 'mathsToSelf', label: 'Maths to Self — small groups', hint: 'On: editable small-group grid. Off: plain fixed box.' },
  { key: 'readToSelf', label: 'Read to Self — small groups', hint: 'On: editable small-group grid. Off: plain fixed box.' },
  { key: 'learningPowers', label: 'Learning Powers — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
  { key: 'spelling', label: 'Spelling — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
  { key: 'checkIn', label: 'Check-in Chats — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
  { key: 'brainBreak', label: 'Brain Break — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
]

export default function Settings({ data, onSave, snapshotForUndo }) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const [className, setClassName] = useState(data.appSettings.className)
  const [schoolName, setSchoolName] = useState(data.appSettings.schoolName)
  const [termWeeks, setTermWeeks] = useState(data.appSettings.termWeeks)
  const [currentTerm, setCurrentTerm] = useState(data.appSettings.currentTerm || 1)
  const [savedMsg, setSavedMsg] = useState(false)

  function adjustWeekCount(target) {
    let newData = data
    if (data.weeks.length > target) {
      newData = { ...data, weeks: data.weeks.slice(0, target) }
      if (!newData.weeks.find(w => w.id === newData.activeWeekId)) {
        newData.activeWeekId = newData.weeks.length ? newData.weeks[newData.weeks.length - 1].id : null
      }
    } else if (data.weeks.length < target) {
      const toAdd = target - data.weeks.length
      for (let i = 0; i < toAdd; i++) {
        newData = data.weeks.length === 0 && i === 0
          ? withNewWeek(newData, data.planSubjects || DEFAULT_PLAN_SUBJECTS, getMonday(new Date()))
          : withNextWeek(newData, data.planSubjects || DEFAULT_PLAN_SUBJECTS)
      }
    }
    return newData
  }

  function saveDetails() {
    const newTermWeeks = Math.max(1, Math.min(15, parseInt(termWeeks) || data.appSettings.termWeeks))
    const newTerm = Math.max(1, Math.min(4, parseInt(currentTerm) || data.appSettings.currentTerm || 1))
    const weeksChanged = newTermWeeks !== data.appSettings.termWeeks
    const termChanged = newTerm !== (data.appSettings.currentTerm || 1)

    let newData = data
    if (weeksChanged) {
      const willDelete = newTermWeeks < data.weeks.length
      if (willDelete) {
        const removedCount = data.weeks.length - newTermWeeks
        const hasContent = data.weeks.slice(newTermWeeks).some(w =>
          Object.values(w.sessions || {}).some(subjDays => Object.values(subjDays).some(s => s))
        )
        const msg = hasContent
          ? `Reducing to ${newTermWeeks} weeks will DELETE the last ${removedCount} week(s), which contain planned content. Continue?`
          : `Reduce to ${newTermWeeks} weeks? The last ${removedCount} empty week(s) will be removed.`
        if (!window.confirm(msg)) return
        snapshotForUndo?.('reduce term weeks')
      }
      newData = adjustWeekCount(newTermWeeks)
    }

    if (termChanged) {
      newData = withRelabeledTerm(newData, newTerm)
    }

    newData = {
      ...newData,
      appSettings: {
        ...newData.appSettings,
        className: className.trim() || 'Room 3',
        schoolName: schoolName.trim(),
        termWeeks: newTermWeeks,
        currentTerm: newTerm,
      },
    }
    onSave(newData)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  function toggleSetting(key, value) {
    onSave({
      ...data,
      appSettings: {
        ...data.appSettings,
        toggles: { ...data.appSettings.toggles, [key]: value },
      },
    })
  }

  function toggleAbilityGroups(subj, enabled) {
    const existing = data.appSettings.abilityGroups?.[subj] || { enabled: false, groups: [] }
    const cfg = { ...existing, enabled }
    if (enabled && cfg.groups.length === 0) {
      // Seed with two sensible starting groups so it's not empty
      cfg.groups = [
        { id: 'g' + Date.now(), name: 'Group A' },
        { id: 'g' + (Date.now() + 1), name: 'Group B' },
      ]
    }
    onSave({
      ...data,
      appSettings: {
        ...data.appSettings,
        abilityGroups: { ...data.appSettings.abilityGroups, [subj]: cfg },
      },
    })
  }

  function addAbilityGroup(subj) {
    const name = window.prompt('Name this group (e.g. "Level 3/4", "Extension"):')
    if (!name || !name.trim()) return
    const cfg = data.appSettings.abilityGroups[subj]
    const newCfg = { ...cfg, groups: [...cfg.groups, { id: 'g' + Date.now(), name: name.trim() }] }
    onSave({
      ...data,
      appSettings: {
        ...data.appSettings,
        abilityGroups: { ...data.appSettings.abilityGroups, [subj]: newCfg },
      },
    })
  }

  function renameAbilityGroup(subj, groupId, newName) {
    if (!newName.trim()) return
    const cfg = data.appSettings.abilityGroups[subj]
    const newCfg = { ...cfg, groups: cfg.groups.map(g => g.id === groupId ? { ...g, name: newName.trim() } : g) }
    onSave({
      ...data,
      appSettings: {
        ...data.appSettings,
        abilityGroups: { ...data.appSettings.abilityGroups, [subj]: newCfg },
      },
    })
  }

  function deleteAbilityGroup(subj, groupId) {
    if (!window.confirm('Delete this group? Planning saved under it will be hidden (not deleted) unless you re-add a group with matching data.')) return
    snapshotForUndo?.('delete ability group')
    const cfg = data.appSettings.abilityGroups[subj]
    const groups = cfg.groups.filter(g => g.id !== groupId)
    const newCfg = { ...cfg, groups, enabled: groups.length ? cfg.enabled : false }
    onSave({
      ...data,
      appSettings: {
        ...data.appSettings,
        abilityGroups: { ...data.appSettings.abilityGroups, [subj]: newCfg },
      },
    })
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Class details</div>
        <div style={styles.sectionDesc}>Shown throughout the planner.</div>

        <div style={styles.field}>
          <label style={styles.label}>Class name</label>
          <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>School name</label>
          <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Term</label>
          <select value={currentTerm} onChange={(e) => setCurrentTerm(e.target.value)} style={{ ...styles.input, maxWidth: 100 }}>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
            <option value={4}>Term 4</option>
          </select>
          <p style={styles.hint}>Updates the term number on all week labels (e.g. "Term 2 Week 1").</p>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Term length (weeks)</label>
          <input type="number" min={1} max={15} value={termWeeks} onChange={(e) => setTermWeeks(e.target.value)} style={{ ...styles.input, maxWidth: 100 }} />
          <p style={styles.hint}>Changing this adds or removes week tabs. You'll be asked to confirm if it would delete planned weeks.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={styles.primaryBtn} onClick={saveDetails}>Save details</button>
          {savedMsg && <span style={styles.savedMsg}>Saved ✓</span>}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Session behaviour</div>
        <div style={styles.sectionDesc}>Turn planning fields on or off for routine sessions.</div>
        {TOGGLE_DEFINITIONS.map(t => (
          <div key={t.key} style={styles.toggleRow}>
            <div>
              <div style={styles.toggleLabel}>{t.label}</div>
              <div style={styles.toggleHint}>{t.hint}</div>
            </div>
            <label style={styles.switch}>
              <input
                type="checkbox"
                checked={!!data.appSettings.toggles[t.key]}
                onChange={(e) => toggleSetting(t.key, e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                ...styles.slider,
                background: data.appSettings.toggles[t.key] ? '#3A86D4' : '#D4D9E5',
              }}>
                <span style={{
                  ...styles.sliderKnob,
                  transform: data.appSettings.toggles[t.key] ? 'translateX(18px)' : 'translateX(0)',
                }} />
              </span>
            </label>
          </div>
        ))}
      </div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Ability groups</div>
        <div style={styles.sectionDesc}>Useful if multiple teachers plan the same subject for different ability groups sharing this planner (e.g. 3 maths groups).</div>
        {Object.entries(planSubjects).map(([subj, meta]) => {
          const cfg = data.appSettings.abilityGroups?.[subj] || { enabled: false, groups: [] }
          return (
            <div key={subj} style={styles.groupSubjBlock}>
              <div style={styles.toggleRow}>
                <div>
                  <div style={styles.toggleLabel}>{meta.label}</div>
                  <div style={styles.toggleHint}>{cfg.enabled ? `${cfg.groups.length} group${cfg.groups.length === 1 ? '' : 's'}` : 'Off — one shared plan for everyone'}</div>
                </div>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={!!cfg.enabled}
                    onChange={(e) => toggleAbilityGroups(subj, e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ ...styles.slider, background: cfg.enabled ? '#3A86D4' : '#D4D9E5' }}>
                    <span style={{ ...styles.sliderKnob, transform: cfg.enabled ? 'translateX(18px)' : 'translateX(0)' }} />
                  </span>
                </label>
              </div>
              {cfg.enabled && (
                <div style={styles.groupList}>
                  {cfg.groups.map(g => (
                    <div key={g.id} style={styles.groupChip}>
                      <input
                        type="text"
                        defaultValue={g.name}
                        onBlur={(e) => renameAbilityGroup(subj, g.id, e.target.value)}
                        style={styles.groupChipInput}
                      />
                      <button style={styles.groupChipDelete} title="Delete group" onClick={() => deleteAbilityGroup(subj, g.id)}>✕</button>
                    </div>
                  ))}
                  <button style={styles.addGroupBtn} onClick={() => addAbilityGroup(subj)}>+ Add group</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  wrap: { maxWidth: 720, margin: '0 auto', padding: '20px 20px' },
  section: { background: '#fff', border: '1.5px solid #D4D9E5', borderRadius: 10, padding: '18px 20px', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  sectionDesc: { fontSize: 11, color: '#7A849E', marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#7A849E', textTransform: 'uppercase', marginBottom: 5 },
  input: { width: '100%', maxWidth: 280, padding: '8px 11px', border: '1.5px solid #D4D9E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  hint: { fontSize: 10, color: '#7A849E', marginTop: 4 },
  primaryBtn: { padding: '9px 16px', background: '#3A86D4', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  savedMsg: { fontSize: 11, color: '#2EAF6E' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #D4D9E5' },
  toggleLabel: { fontSize: 12, fontWeight: 600 },
  toggleHint: { fontSize: 10, color: '#7A849E', marginTop: 1 },
  switch: { position: 'relative', width: 40, height: 22, flexShrink: 0, display: 'inline-block', cursor: 'pointer' },
  slider: { position: 'absolute', inset: 0, borderRadius: 22, transition: 'background 0.15s' },
  sliderKnob: { position: 'absolute', width: 18, height: 18, left: 2, top: 2, background: '#fff', borderRadius: '50%', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'block' },
  groupSubjBlock: { padding: '10px 0', borderBottom: '1px solid #D4D9E5' },
  groupList: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  groupChip: { display: 'flex', alignItems: 'center', gap: 4, background: '#F0F2F7', border: '1px solid #D4D9E5', borderRadius: 6, padding: '3px 4px 3px 8px' },
  groupChipInput: { border: 'none', background: 'none', fontSize: 11, fontFamily: 'inherit', width: 90, fontWeight: 600 },
  groupChipDelete: { border: 'none', background: 'none', color: '#C0392B', fontSize: 11, cursor: 'pointer', padding: '2px 4px' },
  addGroupBtn: { border: '1.5px dashed #D4D9E5', background: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#3A86D4', cursor: 'pointer' },
}
