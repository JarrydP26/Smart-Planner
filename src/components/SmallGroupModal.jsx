import { useState, useEffect } from 'react'
import { SG_CELLS } from '../lib/timetableDefaults'

export default function SmallGroupModal({ open, title, initial, onSave, onClear, onClose }) {
  const [desc, setDesc] = useState('')
  const [cells, setCells] = useState({})

  useEffect(() => {
    if (open) {
      setDesc(initial?.desc || '')
      const next = {}
      SG_CELLS.forEach(c => { next[c.id] = initial?.[c.id] || '' })
      setCells(next)
    }
  }, [open, initial])

  if (!open) return null

  function handleSave() {
    const obj = { desc: desc.trim() }
    SG_CELLS.forEach(c => { obj[c.id] = (cells[c.id] || '').trim() })
    onSave(obj)
  }

  return (
    <div style={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <h2 style={styles.title}>{title}</h2>

        <div style={styles.field}>
          <label style={styles.label}>Rotation / focus for this session</label>
          <input
            type="text" value={desc} placeholder="e.g. Number rotation, guided reading focus…"
            onChange={(e) => setDesc(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.grid}>
          {SG_CELLS.map(c => (
            <div key={c.id} style={styles.field}>
              <label style={styles.label}>{c.label}</label>
              <input
                type="text" value={cells[c.id] || ''}
                onChange={(e) => setCells({ ...cells, [c.id]: e.target.value })}
                style={styles.input}
              />
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.dangerBtn} onClick={onClear}>Clear</button>
          <button style={styles.outlineBtn} onClick={onClose}>Cancel</button>
          <button style={styles.primaryBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', position: 'relative', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' },
  closeBtn: { position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A849E' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#7A849E', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  input: { width: '100%', padding: '8px 10px', border: '1.5px solid #D4D9E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' },
  actions: { display: 'flex', gap: 7, justifyContent: 'flex-end', marginTop: 12 },
  dangerBtn: { padding: '7px 13px', borderRadius: 7, border: 'none', background: '#FFE8E8', color: '#C0392B', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginRight: 'auto' },
  outlineBtn: { padding: '7px 13px', borderRadius: 7, border: '1.5px solid #D4D9E5', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  primaryBtn: { padding: '7px 13px', borderRadius: 7, border: 'none', background: '#3A86D4', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
}
