import { useState, useEffect } from 'react'

export default function SessionModal({ open, initial, title, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ title: '', detail: '', li: '', resources: '' })

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title || '',
        detail: initial?.detail || '',
        li: initial?.li || '',
        resources: initial?.resources || '',
      })
    }
  }, [open, initial])

  if (!open) return null

  function handleKeyDown(e, isTextarea) {
    if (e.key === 'Enter' && (!isTextarea || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  function handleSave() {
    if (!form.title.trim()) { alert('Please enter a session title.'); return }
    onSave({ ...initial, ...form, title: form.title.trim() })
  }

  return (
    <div style={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.hint}>Press Enter to save · Ctrl+Enter inside notes</p>

        <div style={styles.field}>
          <label style={styles.label}>Session title</label>
          <input
            type="text" autoFocus value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, false)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Detail / notes</label>
          <textarea
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, true)}
            style={{ ...styles.input, minHeight: 140, fontFamily: 'inherit' }}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Learning intention</label>
          <input
            type="text" value={form.li} placeholder="Students will be able to…"
            onChange={(e) => setForm({ ...form, li: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, false)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Resources / links</label>
          <input
            type="text" value={form.resources}
            onChange={(e) => setForm({ ...form, resources: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, false)}
            style={styles.input}
          />
        </div>

        <div style={styles.actions}>
          {onDelete && <button style={styles.dangerBtn} onClick={onDelete}>Delete</button>}
          <button style={styles.outlineBtn} onClick={onClose}>Cancel</button>
          <button style={styles.primaryBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto', position: 'relative', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' },
  closeBtn: { position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A849E' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  hint: { fontSize: 10, color: '#7A849E', marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#7A849E', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  input: { width: '100%', padding: '8px 10px', border: '1.5px solid #D4D9E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: 7, justifyContent: 'flex-end', marginTop: 12 },
  dangerBtn: { padding: '7px 13px', borderRadius: 7, border: 'none', background: '#FFE8E8', color: '#C0392B', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginRight: 'auto' },
  outlineBtn: { padding: '7px 13px', borderRadius: 7, border: '1.5px solid #D4D9E5', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  primaryBtn: { padding: '7px 13px', borderRadius: 7, border: 'none', background: '#3A86D4', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
}
