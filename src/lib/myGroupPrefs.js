// Personal, per-browser preference — which ability group THIS teacher views
// by default for each subject. Deliberately NOT synced to Supabase — if two
// teachers share a planner (e.g. 3 maths groups), each should be able to sit
// on their own group without affecting what the other sees.

const STORAGE_KEY = 'myGroupPrefs'

export function loadMyGroupPrefs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch (e) {
    return {}
  }
}

export function saveMyGroupPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch (e) {
    // localStorage unavailable — silently ignore, preference just won't persist
  }
}
