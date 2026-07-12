import { useState } from 'react'
import { DAYS, DEFAULT_ROWS } from '../lib/timetableDefaults'
import { getBlockableRowNames, withDayBlockSet, withRowBlockSet, withBlockRemoved, withWeekUpdated } from '../lib/plannerHelpers'

export default function BlockOutModal({ open, data, activeWeekId, onSave, onClose }) {
  const rows = data?.rows || DEFAULT_ROWS
  const rowNames = getBlockableRowNames(rows)

  const [weekId, setWeekId] = useState(activeWeekId)
  const [day, setDay] = useState('Monday')
  const [scope, setScope] = useState('day') // 'day' | 'row'
  const [rowName, setRowName] = useState(rowNames[0] || '')
  const [eventName, setEventName] = useState('')

  if (!open) return null

  const week = data.weeks.find(w => w.id === weekId) || data.weeks[0]

  function confirmBlockOut() {
    if (!eventName.trim()) { window.alert('Please enter an event name.'); return }
    const newWeek = scope === 'day'
      ? withDayBlockSet(week, day, eventName.trim())
      : withRowBlockSet(week, rowName, day, eventName.trim())
    onSave(withWeekUpdated(data, week.id, newWeek))
    setEventName('')
  }

  function removeBlock(type, key) {
    const newWeek = withBlockRemoved(week, type, key)
    onSave(withWeekUpdated(data, week.id, newWeek))
  }

  const existingItems = []
  Object.entries(week?.dayBlocks || {}).forEach(([d, label]) => {
    existingItems.push({ key: d, type: 'day', label: `${d} — ${label} (whole day)` })
  })
  Object.entries(week?.rowBlocks || {}).forEach(([key, label]) => {
    const parts = key.split('_')
    const d = parts.pop()
    const rName = parts.join('_')
    existingItems.push({ key, type: 'row', label: `${rName} on ${d} — ${label}` })
  })

  return (
    <div style={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <h2 style={styles.title}>🚫 Block out</h2>
        <p style={styles.hint}>Mark a whole day, or one subject/row on one day, as unavailable — e.g. an excursion or assembly change.</p>

        <div style={styles.field}>
          <label style={styles.label}>Week</label>
          <select value={weekId} onChange={(e) => setWeekId(e.target.value)} style={styles.input}>
            {data.weeks.map((w, i) => (
              <option key={w.id} value={w.id}>{w.weekLabel || `Week ${i + 1}`} ({w.label})</option>
            ))}
          </select>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Day</label>
            <select value={day} onChange={(e) => setDay(e.target.value)} style={styles.input}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} style={styles.input}>
              <option value="day">Whole day</option>
              <option value="row">One subject only</option>
            </select>
          </div>
        </div>

        {scope === 'row' && (
          <div style={styles.field}>
            <label style={styles.label}>Subject / row</label>
            <select value={rowName} onChange={(e) => setRowName(e.target.value)} style={styles.input}>
              {rowNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Event name</label>
          <input
            type="text" value={eventName} placeholder="e.g. Excursion, Assembly, Public holiday…"
            onChange={(e) => setEventName(e.target.value)}
            style={styles.input}
          />
        </div>

        <button style={styles.primaryBtn} onClick={confirmBlockOut}>Block out</button>

        {existingItems.length > 0 && (
          <div style={styles.existingWrap}>
            <div style={styles.existingLabel}>Current blocks this week:</div>
            {existingItems.map(item => (
              <div key={item.type + item.key} style={styles.existingItem}>
                <span>{item.label}</span>
                <button style={styles.removeBtn} onClick={() => removeBlock(item.type, item.key)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', position: 'relative', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' },
  closeBtn: { position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A849E' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  hint: { fontSize: 11, color: '#7A849E', marginBottom: 14 },
  row: { display: 'flex', gap: 10 },
  field: { marginBottom: 12, flex: 1 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#7A849E', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  input: { width: '100%', padding: '8px 10px', border: '1.5px solid #D4D9E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  primaryBtn: { width: '100%', padding: '9px 13px', borderRadius: 7, border: 'none', background: '#3A86D4', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  existingWrap: { marginTop: 18, borderTop: '1px solid #D4D9E5', paddingTop: 12 },
  existingLabel: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#1C2333' },
  existingItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF0F0', border: '1px solid #E8B0B0', borderRadius: 5, padding: '4px 8px', marginBottom: 4, fontSize: 11 },
  removeBtn: { border: 'none', background: '#fff', borderRadius: 4, fontSize: 10, cursor: 'pointer', padding: '2px 6px' },
}
