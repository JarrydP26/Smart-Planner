import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) throw error
        setInfo('Account created! Check your email to confirm, then log in.')
        setMode('login')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>📋 Smart Planner</h1>
        <p style={styles.subtitle}>
          {mode === 'login' ? 'Log in to your planner' : 'Create your account'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@school.edu.au"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="At least 6 characters"
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}
          {info && <div style={styles.info}>{info}</div>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button style={styles.linkBtn} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button style={styles.linkBtn} onClick={() => { setMode('login'); setError(''); setInfo('') }}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F0F2F7',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: '32px 36px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#7A849E', marginBottom: 22 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 12, fontWeight: 600, color: '#444', display: 'flex', flexDirection: 'column', gap: 5 },
  input: {
    padding: '9px 11px',
    border: '1.5px solid #D4D9E5',
    borderRadius: 7,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  button: {
    marginTop: 6,
    padding: '10px 14px',
    background: '#3A86D4',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: { fontSize: 12, color: '#C0392B', background: '#FFE8E8', padding: '8px 10px', borderRadius: 6 },
  info: { fontSize: 12, color: '#1E7A4C', background: '#E6F7EE', padding: '8px 10px', borderRadius: 6 },
  switchText: { fontSize: 12, color: '#7A849E', marginTop: 18, textAlign: 'center' },
  linkBtn: { background: 'none', border: 'none', color: '#3A86D4', fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 },
}
