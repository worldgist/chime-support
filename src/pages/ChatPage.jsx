import { useEffect, useRef } from 'react'
import Header from '../components/Header'
import SupportBanner from '../components/SupportBanner'
import AgentCard from '../components/AgentCard'
import ChatThread from '../components/ChatThread'
import ChatInput from '../components/ChatInput'
import ChatDetailsForm from '../components/ChatDetailsForm'
import { useChat } from '../context/ChatContext'

const ACCOUNT_REPLIES = [
  'I cannot sign in to my account',
  'A transaction looks wrong',
  'My card is not working',
]

export default function ChatPage() {
  const { visitor, liveMessages, typing, sendUserMessage, setUserTyping, agentOnline, usingSupabase } = useChat()
  const threadRef = useRef(null)

  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [liveMessages, typing])

  if (!visitor || (usingSupabase && !visitor.ticketId)) {
    return <ChatDetailsForm />
  }

  return (
    <div className="page">
      <div className="app">
        <Header />
        <SupportBanner />
        <AgentCard agentOnline={agentOnline} />
        <ChatThread messages={liveMessages} typing={typing} threadRef={threadRef} />
        <ChatInput
          onSend={sendUserMessage}
          onTyping={setUserTyping}
          onQuickReply={(text) => sendUserMessage({ text, attachments: [] })}
          quickReplies={ACCOUNT_REPLIES}
        />
      </div>
    </div>
  )
}
