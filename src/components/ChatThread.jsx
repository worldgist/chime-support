import { useState } from 'react'
import { CloseIcon, DoubleCheckIcon, DownloadIcon, FileIcon } from './icons'
import { formatSize } from '../utils/attachments'
import { initials } from '../context/ChatContext'

function Attachments({ items, onOpen }) {
  if (!items?.length) return null

  return (
    <div className="attachments">
      {items.map((item) =>
        item.type === 'image' ? (
          <button
            key={item.id}
            type="button"
            className="chat-image-btn"
            onClick={() => onOpen(item)}
          >
            <img className="chat-image" src={item.url} alt={item.name} />
          </button>
        ) : (
          <a
            key={item.id}
            className="file-card"
            href={item.url}
            download={item.url?.startsWith('data:') ? item.name : undefined}
            target={item.url?.startsWith('http') ? '_blank' : undefined}
            rel={item.url?.startsWith('http') ? 'noreferrer' : undefined}
          >
            <span className="file-icon">
              <FileIcon />
            </span>
            <span className="file-meta">
              <strong>{item.name}</strong>
              <small>{formatSize(item.size)}</small>
            </span>
            <DownloadIcon />
          </a>
        ),
      )}
    </div>
  )
}

function MessageBody({ message, onOpen }) {
  return (
    <>
      <Attachments items={message.attachments} onOpen={onOpen} />
      {message.text ? <p>{message.text}</p> : null}
    </>
  )
}

function Avatar({ inboundFrom, customerName }) {
  if (inboundFrom === 'support') {
    return <img className="avatar sm" src="/logo.png" alt="" />
  }
  return <span className="avatar sm initials">{initials(customerName)}</span>
}

export default function ChatThread({
  messages,
  typing,
  threadRef,
  perspective = 'customer',
  customerName = 'Customer',
}) {
  const [preview, setPreview] = useState(null)

  return (
    <>
      <section className="thread" ref={threadRef}>
        <div className="date-chip">Today</div>

        {messages.map((message) => {
          const inbound =
            perspective === 'admin' ? message.from === 'user' : message.from === 'support'

          return inbound ? (
            <div className="row support" key={message.id}>
              <Avatar inboundFrom={message.from} customerName={customerName} />
              <div>
                <div className="bubble support-bubble">
                  <MessageBody message={message} onOpen={setPreview} />
                </div>
                <time>{message.time}</time>
              </div>
            </div>
          ) : (
            <div className="row user" key={message.id}>
              <div className="bubble user-bubble">
                <MessageBody message={message} onOpen={setPreview} />
                <div className="user-meta">
                  <time>{message.time}</time>
                  <DoubleCheckIcon />
                </div>
              </div>
            </div>
          )
        })}

        {typing && (
          <div className="row support">
            <Avatar
              inboundFrom={perspective === 'admin' ? 'user' : 'support'}
              customerName={customerName}
            />
            <div className="bubble support-bubble typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </section>

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)} role="presentation">
          <button className="lightbox-close" type="button" aria-label="Close preview">
            <CloseIcon />
          </button>
          <img src={preview.url} alt={preview.name} onClick={(event) => event.stopPropagation()} />
          <a
            className="lightbox-download"
            href={preview.url}
            download={preview.url?.startsWith('data:') ? preview.name : undefined}
            target={preview.url?.startsWith('http') ? '_blank' : undefined}
            rel={preview.url?.startsWith('http') ? 'noreferrer' : undefined}
          >
            <DownloadIcon /> {preview.name}
          </a>
        </div>
      )}
    </>
  )
}
