import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_PLAN_SUBJECTS, SG_CELLS } from '../lib/timetableDefaults'
import { withNewWeek, withNextWeek, withRelabeledTerm, getMonday } from '../lib/plannerHelpers'
import { buildFullTermDocument, downloadWordDoc } from '../lib/wordExport'

const TOGGLE_DEFINITIONS = [
  { key: 'mathsToSelf', label: 'Maths to Self — small groups', hint: 'On: editable small-group grid. Off: plain fixed box.' },
  { key: 'readToSelf', label: 'Read to Self — small groups', hint: 'On: editable small-group grid. Off: plain fixed box.' },
  { key: 'learningPowers', label: 'Learning Powers — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
  { key: 'spelling', label: 'Spelling — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
  { key: 'checkIn', label: 'Check-in Chats — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
  { key: 'brainBreak', label: 'Brain Break — topic field', hint: 'On: simple editable topic text. Off: plain fixed name box.' },
]

export default function Settings({ data, onSave, snapshotForUndo, plannerId, isOwner }) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const [className, setClassName] = useState(data.appSettings.className)
  const [schoolName, setSchoolName] = useState(data.appSettings.schoolName)
  const [termWeeks, setTermWeeks] = useState(data.appSettings.termWeeks)
  const [currentTerm, setCurrentTerm] = useState(data.appSettings.currentTerm || 1)
  const [savedMsg, setSavedMsg] = useState(false)
  const [sgLabels, setSgLabels] = useState(() => {
    const overrides = data.appSettings.sgCellLabels || {}
    const initial = {}
    SG_CELLS.forEach(c => { initial[c.id] = overrides[c.id] || c.label })
    return initial
  })
  const [sgSavedMsg, setSgSavedMsg] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteStatus, setInviteStatus] = useState(null) // { type: 'success' | 'error', msg }

  const [restoreStatus, setRestoreStatus] = useState(null) // { type: 'success' | 'error', msg }
  const [exportingFullTerm, setExportingFullTerm] = useState(false)

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleDownloadBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const dateStamp = new Date().toISOString().slice(0, 10)
    const namePart = (data.appSettings.className || 'planner').trim().replace(/\s+/g, '_')
    downloadBlob(blob, `${namePart}_backup_${dateStamp}.json`)
  }

  function handleRestoreFile(e) {
    const file = e.target.files[0]
    e.target.value = '' // allow re-selecting the same file again later
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      let parsed
      try {
        parsed = JSON.parse(ev.target.result)
      } catch {
        setRestoreStatus({ type: 'error', msg: "That file couldn't be read — is it a valid .json backup?" })
        return
      }
      if (!parsed || !Array.isArray(parsed.weeks) || !parsed.appSettings) {
        setRestoreStatus({ type: 'error', msg: "That file doesn't look like a valid planner backup." })
        return
      }
      if (!window.confirm(
        'This will REPLACE all current planning data in this planner with the contents of this backup file. This cannot be undone. Continue?'
      )) return
      onSave(parsed)
      setRestoreStatus({ type: 'success', msg: 'Backup restored ✓' })
    }
    reader.onerror = () => setRestoreStatus({ type: 'error', msg: "Couldn't read that file." })
    reader.readAsText(file)
  }

  async function handleExportFullTerm() {
    setExportingFullTerm(true)
    try {
      const doc = buildFullTermDocument(data)
      const namePart = (data.appSettings.className || 'planner').trim().replace(/\s+/g, '_')
      await downloadWordDoc(doc, `${namePart}_Full_Term_Plan.docx`)
    } finally {
      setExportingFullTerm(false)
    }
  }

  function saveSgLabels() {
    onSave({
      ...data,
      appSettings: { ...data.appSettings, sgCellLabels: sgLabels },
    })
    setSgSavedMsg(true)
    setTimeout(() => setSgSavedMsg(false), 2000)
  }

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
    // Term and term-length are owner-only — if a non-owner somehow triggers
    // this (shouldn't be possible via the disabled UI below), fall back to
    // the existing saved values rather than trusting local state.
    const newTermWeeks = isOwner
      ? Math.max(1, Math.min(15, parseInt(termWeeks) || data.appSettings.termWeeks))
      : data.appSettings.termWeeks
    const newTerm = isOwner
      ? Math.max(1, Math.min(4, parseInt(currentTerm) || data.appSettings.currentTerm || 1))
      : (data.appSettings.currentTerm || 1)
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

  async function inviteTeacher() {
    const email = inviteEmail.trim()
    if (!email) return
    setInviteLoading(true)
    setInviteStatus(null)
    const { error } = await supabase.rpc('invite_member_by_email', {
      p_planner_id: plannerId,
      p_email: email,
    })
    setInviteLoading(false)
    if (error) {
      setInviteStatus({ type: 'error', msg: error.message })
    } else {
      setInviteStatus({ type: 'success', msg: `Invited ${email} — they now have full editing access to this planner.` })
      setInviteEmail('')
    }
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
          <select
            value={currentTerm}
            onChange={(e) => setCurrentTerm(e.target.value)}
            disabled={!isOwner}
            style={{ ...styles.input, maxWidth: 100, opacity: isOwner ? 1 : 0.6 }}
          >
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
            <option value={4}>Term 4</option>
          </select>
          <p style={styles.hint}>
            {isOwner
              ? 'Updates the term number on all week labels (e.g. "Term 2 Week 1").'
              : 'Only the planner owner can change the term.'}
          </p>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Term length (weeks)</label>
          <input
            type="number"
            min={1}
            max={15}
            value={termWeeks}
            onChange={(e) => setTermWeeks(e.target.value)}
            disabled={!isOwner}
            style={{ ...styles.input, maxWidth: 100, opacity: isOwner ? 1 : 0.6 }}
          />
          <p style={styles.hint}>
            {isOwner
              ? "Changing this adds or removes week tabs. You'll be asked to confirm if it would delete planned weeks."
              : 'Only the planner owner can change term length.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={styles.primaryBtn} onClick={saveDetails}>Save details</button>
          {savedMsg && <span style={styles.savedMsg}>Saved ✓</span>}
        </div>
      </div>

      {isOwner && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Invite a teacher</div>
          <div style={styles.sectionDesc}>
            Give another teacher full editing access to this planner, instead of sharing your login.
            They need to have already signed up with the email below — if not, ask them to sign up first, then invite them again.
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Teacher's email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teacher@school.edu.au"
              style={styles.input}
              onKeyDown={(e) => { if (e.key === 'Enter') inviteTeacher() }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={{ ...styles.primaryBtn, opacity: inviteLoading || !inviteEmail.trim() ? 0.6 : 1 }}
              onClick={inviteTeacher}
              disabled={inviteLoading || !inviteEmail.trim()}
            >
              {inviteLoading ? 'Inviting…' : 'Invite teacher'}
            </button>
          </div>
          {inviteStatus && (
            <p style={inviteStatus.type === 'success' ? styles.savedMsg : styles.errorMsg}>
              {inviteStatus.msg}
            </p>
          )}
        </div>
      )}

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
        <div style={styles.sectionDesc}>
          Useful if multiple teachers plan the same subject for different ability groups sharing this planner (e.g. 3 maths groups).
          {!isOwner && ' Only the planner owner can change these.'}
        </div>
        {Object.entries(planSubjects).map(([subj, meta]) => {
          const cfg = data.appSettings.abilityGroups?.[subj] || { enabled: false, groups: [] }
          return (
            <div key={subj} style={styles.groupSubjBlock}>
              <div style={styles.toggleRow}>
                <div>
                  <div style={styles.toggleLabel}>{meta.label}</div>
                  <div style={styles.toggleHint}>{cfg.enabled ? `${cfg.groups.length} group${cfg.groups.length === 1 ? '' : 's'}` : 'Off — one shared plan for everyone'}</div>
                </div>
                <label style={{ ...styles.switch, cursor: isOwner ? 'pointer' : 'not-allowed' }}>
                  <input
                    type="checkbox"
                    checked={!!cfg.enabled}
                    disabled={!isOwner}
                    onChange={(e) => isOwner && toggleAbilityGroups(subj, e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ ...styles.slider, background: cfg.enabled ? '#3A86D4' : '#D4D9E5', opacity: isOwner ? 1 : 0.6 }}>
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
                        disabled={!isOwner}
                        onBlur={(e) => isOwner && renameAbilityGroup(subj, g.id, e.target.value)}
                        style={{ ...styles.groupChipInput, opacity: isOwner ? 1 : 0.6 }}
                      />
                      {isOwner && (
                        <button style={styles.groupChipDelete} title="Delete group" onClick={() => deleteAbilityGroup(subj, g.id)}>✕</button>
                      )}
                    </div>
                  ))}
                  {isOwner && (
                    <button style={styles.addGroupBtn} onClick={() => addAbilityGroup(subj)}>+ Add group</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Backup, restore & export</div>
        <div style={styles.sectionDesc}>Download a full backup, export a printable Word document of the whole term, or restore from a previous backup.</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button style={styles.outlineBtn} onClick={handleDownloadBackup}>💾 Download backup (.json)</button>
          <button style={styles.outlineBtn} onClick={handleExportFullTerm} disabled={exportingFullTerm}>
            {exportingFullTerm ? 'Exporting…' : '📄 Export full term (.docx)'}
          </button>
        </div>

        {isOwner ? (
          <div style={styles.field}>
            <label style={styles.label}>Restore from backup</label>
            <input type="file" accept="application/json" onChange={handleRestoreFile} style={{ fontSize: 12 }} />
            <p style={styles.hint}>Replaces ALL current planning data in this planner with the backup file's contents. This cannot be undone — download a fresh backup first if you're unsure.</p>
          </div>
        ) : (
          <p style={styles.hint}>Only the planner owner can restore from a backup (since it replaces everyone's current data).</p>
        )}

        {restoreStatus && (
          <p style={restoreStatus.type === 'success' ? styles.savedMsg : styles.errorMsg}>{restoreStatus.msg}</p>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Small group grid labels</div>
        <div style={styles.sectionDesc}>Rename the six group cells used in the Maths to Self / Read to Self grids to match your actual class groupings.</div>
        <div style={styles.groupList}>
          {SG_CELLS.map(c => (
            <div key={c.id} style={styles.sgLabelRow}>
              <span style={styles.sgLabelDefault}>{c.label}</span>
              <input
                type="text"
                value={sgLabels[c.id] ?? c.label}
                onChange={(e) => setSgLabels({ ...sgLabels, [c.id]: e.target.value })}
                style={styles.sgLabelInput}
              />
            </div>
          ))}
        </div>
        <div style={styles.saveRow}>
          <button style={styles.primaryBtn} onClick={saveSgLabels}>Save labels</button>
          {sgSavedMsg && <span style={styles.savedMsg}>Saved ✓</span>}
        </div>
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
  outlineBtn: { padding: '9px 16px', background: '#fff', color: '#1C2333', border: '1.5px solid #D4D9E5', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  savedMsg: { fontSize: 11, color: '#2EAF6E' },
  errorMsg: { fontSize: 11, color: '#C0392B' },
  saveRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #D4D9E5' },
  toggleLabel: { fontSize: 12, fontWeight: 600 },
  toggleHint: { fontSize: 10, color: '#7A849E', marginTop: 1 },
  switch: { position: 'relative', width: 40, height: 22, flexShrink: 0, display: 'inline-block', cursor: 'pointer' },
  slider: { position: 'absolute', inset: 0, borderRadius: 22, transition: 'background 0.15s' },
  sliderKnob: { position: 'absolute', width: 18, height: 18, left: 2, top: 2, background: '#fff', borderRadius: '50%', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'block' },
  groupSubjBlock: { padding: '10px 0', borderBottom: '1px solid #D4D9E5' },
  groupList: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  sgLabelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid #F0F2F7' },
  sgLabelDefault: { fontSize: 11, color: '#7A849E', flex: 1 },
  sgLabelInput: { border: '1px solid #D4D9E5', borderRadius: 5, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', width: 160 },
  groupChip: { display: 'flex', alignItems: 'center', gap: 4, background: '#F0F2F7', border: '1px solid #D4D9E5', borderRadius: 6, padding: '3px 4px 3px 8px' },
  groupChipInput: { border: 'none', background: 'none', fontSize: 11, fontFamily: 'inherit', width: 90, fontWeight: 600 },
  groupChipDelete: { border: 'none', background: 'none', color: '#C0392B', fontSize: 11, cursor: 'pointer', padding: '2px 4px' },
  addGroupBtn: { border: '1.5px dashed #D4D9E5', background: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#3A86D4', cursor: 'pointer' },
}
