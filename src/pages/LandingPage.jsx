import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DoubleCheckIcon, SendIcon, VerifiedIcon } from '../components/icons'
import {
  CardIcon,
  ChatBubbleIcon,
  ClockIcon,
  DollarIcon,
  HeadsetIcon,
  LockIcon,
  MinimizeIcon,
  PeopleIcon,
  PlantGraphic,
  QuestionIcon,
  SearchIcon,
  ShieldIcon,
} from '../components/landingIcons'

const TOPICS = [
  {
    id: 'account',
    title: 'Account & Banking',
    text: 'Balances, statements, and everyday account questions.',
    icon: <CardIcon />,
  },
  {
    id: 'payments',
    title: 'Payments & Transfers',
    text: 'Send money, direct deposit, and transfer help.',
    icon: <DollarIcon />,
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    text: 'Keep your account safe and your data private.',
    icon: <ShieldIcon />,
  },
  {
    id: 'features',
    title: 'Features & Services',
    text: 'SpotMe, Credit Builder, and other Chime tools.',
    icon: <QuestionIcon />,
  },
]

const SEARCH_ITEMS = [
  { title: 'Account & Banking', icon: <CardIcon /> },
  { title: 'Payments & Transfers', icon: <PeopleIcon /> },
  { title: 'Security & Privacy', icon: <ShieldIcon /> },
]

export default function LandingPage() {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return SEARCH_ITEMS
    return SEARCH_ITEMS.filter((item) => item.title.toLowerCase().includes(value))
  }, [query])

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <img src="/logo.png" alt="" />
          <span>chime</span>
        </Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>
            <span>Chime Support</span>
            We’re here to help
          </h1>
          <p>Get the answers you need, 24/7. Real support from real people.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/chat">
              <ChatBubbleIcon /> Chat with us
            </Link>
            <a className="text-link" href="#topics">
              Browse help topics &gt;
            </a>
          </div>
          <ul className="trust">
            <li>
              <ClockIcon /> 24/7 Support
            </li>
            <li>
              <ShieldIcon /> Secure &amp; Private
            </li>
            <li>
              <PeopleIcon /> Real People Real Help
            </li>
          </ul>
        </div>

        <Link className="chat-preview" to="/chat" aria-label="Open live chat">
          <div className="preview-bar">
            <span>chime</span>
            <span className="preview-controls">
              <MinimizeIcon />
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <div className="preview-agent">
            <img src="/logo.png" alt="" />
            <div>
              <strong>
                Chime Support <VerifiedIcon />
              </strong>
              <small>Support Specialist</small>
              <em>
                <span className="dot" /> Online
              </em>
            </div>
          </div>
          <div className="preview-thread">
            <div className="preview-in">
              Hi there! 👋 Thanks for reaching out to Chime Support. How can we help you today?
              <time>9:41 AM</time>
            </div>
            <div className="preview-out">
              I have a question about a recent transaction.
              <span>
                <time>9:42 AM</time>
                <DoubleCheckIcon />
              </span>
            </div>
          </div>
          <div className="preview-input">
            <span>Type a message...</span>
            <span className="send">
              <SendIcon />
            </span>
          </div>
        </Link>
      </section>

      <section className="topics" id="topics">
        <h2>How we can help</h2>
        <div className="topic-grid">
          {TOPICS.map((topic) => (
            <article key={topic.id}>
              <span className="topic-icon">{topic.icon}</span>
              <h3>{topic.title}</h3>
              <p>{topic.text}</p>
              <Link to="/chat">Learn more &gt;</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="answers" id="help-center">
        <div>
          <h2>Find answers fast</h2>
          <p>Search the Help Center for step-by-step guides on accounts, payments, and security.</p>
          <a className="outline-btn" href="#help-center">
            Visit the Help Center
          </a>
        </div>
        <div className="search-card">
          <label className="search-bar">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help articles"
              aria-label="Search help articles"
            />
          </label>
          <ul>
            {results.map((item) => (
              <li key={item.title}>
                <span>{item.icon}</span>
                {item.title}
              </li>
            ))}
            {results.length === 0 && <li className="empty">No matching topics</li>}
          </ul>
          <PlantGraphic />
        </div>
      </section>

      <section className="cta-bar">
        <div className="cta-copy">
          <span className="cta-icon">
            <HeadsetIcon />
          </span>
          <p>Still need help with your account? Our support team is available 24/7.</p>
        </div>
        <Link className="primary-btn" to="/chat">
          <ChatBubbleIcon /> Chat with us
        </Link>
      </section>

      <footer className="landing-foot">
        <p>
          <LockIcon /> Your information is secure with Chime
        </p>
        <Link to="/admin/login">Admin chat support</Link>
      </footer>
    </div>
  )
}
