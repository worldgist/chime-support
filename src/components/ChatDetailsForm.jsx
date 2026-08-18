import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useChat } from '../context/ChatContext'

const TOPICS = [
  'Account access',
  'Transactions',
  'Payment refund',
  'Card issue',
  'Direct deposit',
  'Other account issue',
]

export default function ChatDetailsForm() {
  const { startLiveChat, visitor } = useChat()
  const [name, setName] = useState(visitor?.name || '')
  const [email, setEmail] = useState(visitor?.email || '')
  const [phone, setPhone] = useState(visitor?.phone || '')
  const [topic, setTopic] = useState(visitor?.topic || TOPICS[0])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7) {
      setError('Enter a valid phone number.')
      return
    }
    setPending(true)
    const started = await startLiveChat({ name, email, phone, topic })
    setPending(false)
    if (!started.ok) {
      setError(started.error || 'Please fill in your full name, email, and phone number.')
    }
  }

  return (
    <div className="login-page chat-start">
      <div className="login-card">
        <img className="login-logo" src="/logo.png" alt="Chime" />
        <p className="login-kicker">Chime Support</p>
        <h1>Account help</h1>
        <p className="login-copy">
          Tell us how to reach you and what is going on with your account. A specialist will chat with you next.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Phone number
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 123-4567"
              autoComplete="tel"
              required
            />
          </label>
          <label>
            What do you need help with?
            <select value={topic} onChange={(event) => setTopic(event.target.value)} required>
              {TOPICS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="login-submit" type="submit" disabled={pending}>
            {pending ? 'Starting chat...' : 'Continue to chat'}
          </button>
        </form>

        <Link className="login-back" to="/">
          Back to home
        </Link>
      </div>
    </div>
  )
}
