import { VerifiedIcon } from './icons'

export default function AgentCard({ agentOnline = false, resolved = false }) {
  return (
    <article className="agent-card">
      <img className="avatar" src="/logo.png" alt="Chime Support" />
      <div className="agent-meta">
        <div className="agent-name">
          <span>Chime Support</span>
          <VerifiedIcon />
        </div>
        <p className="agent-role">Support Specialist</p>
        <div className="agent-status">
          <span className="dot" />
          {resolved ? 'Issue resolved' : agentOnline ? 'Specialist connected' : 'Online'}
        </div>
      </div>
    </article>
  )
}
