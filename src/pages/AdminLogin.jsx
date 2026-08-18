import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EyeIcon, EyeOffIcon } from '../components/icons'

export default function AdminLogin() {
  const { login, isAuthenticated, ready, usingSupabase } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!ready) return null

  if (isAuthenticated) {
    return <Navigate to="/admin/tickets" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/admin/tickets', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/logo.png" alt="Chime" />
        <p className="login-kicker">Chime Support</p>
        <h1>Admin login</h1>
        <p className="login-copy">
          {usingSupabase
            ? 'Sign in with an admin account from the admin_users table.'
            : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to use Supabase Auth. Until then, any email and password will work.'}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>
          {error && <p className="login-error">{error}</p>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <Link className="login-back" to="/">
          Back to home
        </Link>
      </div>
    </div>
  )
}
