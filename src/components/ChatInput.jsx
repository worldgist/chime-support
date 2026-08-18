import { useEffect, useRef, useState } from 'react'
import {
  AttachIcon,
  CameraIcon,
  CloseIcon,
  EmojiIcon,
  FileIcon,
  PhotoIcon,
  SendIcon,
} from './icons'
import { addFiles } from '../utils/attachments'

const EMOJIS = ['😀', '😊', '👍', '🙏', '😂', '❤️', '🎉', '👋', '✅', '📷', '📄', '💳']

export default function ChatInput({
  onSend,
  onQuickReply,
  onTyping,
  quickReplies = [
    'I have a screenshot',
    'Here is my statement',
    'Can you review this file?',
  ],
  placeholder = 'Type your message...',
}) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const photoRef = useRef(null)
  const cameraRef = useRef(null)
  const fileRef = useRef(null)
  const wrapRef = useRef(null)
  const dragCount = useRef(0)

  useEffect(() => {
    function handleClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setMenuOpen(false)
        setEmojiOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!error) return undefined
    const timer = window.setTimeout(() => setError(''), 3200)
    return () => window.clearTimeout(timer)
  }, [error])

  async function ingest(fileList) {
    if (!fileList?.length) return
    const { attachments: next, errors } = await addFiles(attachments, fileList)
    setAttachments(next)
    if (errors[0]) setError(errors[0])
  }

  async function submit(event) {
    event.preventDefault()
    const text = value.trim()
    if (!text && attachments.length === 0) return
    setSending(true)
    setError('')
    try {
      const result = await onSend({ text, attachments })
      if (result && result.ok === false) {
        setError(result.error || 'Could not send that message.')
        return
      }
      attachments.forEach((item) => {
        if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
      })
      setValue('')
      setAttachments([])
      setMenuOpen(false)
      setEmojiOpen(false)
      onTyping?.(false)
    } finally {
      setSending(false)
    }
  }

  function removeAttachment(id) {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id)
      if (target?.url?.startsWith('blob:')) URL.revokeObjectURL(target.url)
      return current.filter((item) => item.id !== id)
    })
  }

  function onDragEnter(event) {
    event.preventDefault()
    dragCount.current += 1
    setDragging(true)
  }

  function onDragLeave(event) {
    event.preventDefault()
    dragCount.current -= 1
    if (dragCount.current <= 0) {
      dragCount.current = 0
      setDragging(false)
    }
  }

  function onDrop(event) {
    event.preventDefault()
    dragCount.current = 0
    setDragging(false)
    ingest(event.dataTransfer.files)
  }

  function onPaste(event) {
    const files = [...event.clipboardData.files]
    if (files.length) {
      event.preventDefault()
      ingest(files)
    }
  }

  return (
    <div
      className={`composer-wrap${dragging ? ' dragging' : ''}`}
      ref={wrapRef}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {sending && <p className="composer-error">Saving photos and files…</p>}
      {error && <p className="composer-error">{error}</p>}

      {quickReplies.length > 0 && (
        <div className="quick-replies">
          {quickReplies.map((reply) => (
            <button key={reply} type="button" className="chip" onClick={() => onQuickReply(reply)}>
              {reply}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="pending">
          {attachments.map((item) => (
            <li key={item.id} className="pending-item">
              {item.type === 'image' ? (
                <img src={item.url} alt={item.name} />
              ) : (
                <div className="pending-file">
                  <FileIcon />
                  <span>{item.name}</span>
                </div>
              )}
              <button
                type="button"
                className="remove"
                aria-label={`Remove ${item.name}`}
                onClick={() => removeAttachment(item.id)}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {menuOpen && (
        <div className="attach-menu" role="menu">
          <button type="button" onClick={() => photoRef.current?.click()}>
            <PhotoIcon /> Photo
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()}>
            <CameraIcon /> Camera
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            <FileIcon /> File
          </button>
        </div>
      )}

      {emojiOpen && (
        <div className="emoji-picker">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setValue((current) => current + emoji)
                setEmojiOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <button
          className="tool-btn"
          type="button"
          aria-label="Attach photo or file"
          disabled={sending}
          onClick={() => {
            setMenuOpen((open) => !open)
            setEmojiOpen(false)
          }}
        >
          <AttachIcon />
        </button>
        <button
          className="tool-btn"
          type="button"
          aria-label="Add emoji"
          onClick={() => {
            setEmojiOpen((open) => !open)
            setMenuOpen(false)
          }}
        >
          <EmojiIcon />
        </button>
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            onTyping?.(event.target.value.length > 0)
          }}
          onBlur={() => onTyping?.(false)}
          onPaste={onPaste}
          placeholder={sending ? 'Saving photos and files…' : placeholder}
          aria-label="Message"
          autoComplete="off"
          disabled={sending}
        />
        <button className="send" type="submit" aria-label="Send message" disabled={sending}>
          <SendIcon />
        </button>
      </form>

      {dragging && <div className="drop-hint">Drop photos or files to attach</div>}

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          ingest(event.target.files)
          event.target.value = ''
          setMenuOpen(false)
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          ingest(event.target.files)
          event.target.value = ''
          setMenuOpen(false)
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp"
        multiple
        hidden
        onChange={(event) => {
          ingest(event.target.files)
          event.target.value = ''
          setMenuOpen(false)
        }}
      />
    </div>
  )
}
