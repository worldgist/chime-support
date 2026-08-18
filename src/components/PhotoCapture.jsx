import { useEffect, useRef, useState } from 'react'

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function PhotoCapture({ label, hint, facing = 'environment', value, onChange }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState('')

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setLive(false)
  }

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setLive(true)
    } catch {
      setError('Camera is not available. Upload a photo instead.')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 720
    canvas.height = video.videoHeight || 960
    canvas.getContext('2d').drawImage(video, 0, 0)
    onChange(canvas.toDataURL('image/jpeg', 0.86))
    stopCamera()
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10 MB.')
      return
    }
    setError('')
    onChange(await readFile(file))
  }

  return (
    <div className="photo-capture">
      <div className="photo-frame">
        {live ? (
          <video ref={videoRef} playsInline muted autoPlay />
        ) : value ? (
          <img src={value} alt={label} />
        ) : (
          <p>{hint}</p>
        )}
      </div>
      {error && <p className="login-error">{error}</p>}
      <div className="photo-actions">
        {live ? (
          <>
            <button type="button" className="dash-primary" onClick={capture}>
              Capture photo
            </button>
            <button type="button" className="ghost-btn" onClick={stopCamera}>
              Cancel camera
            </button>
          </>
        ) : (
          <>
            <button type="button" className="dash-primary" onClick={startCamera}>
              Open camera
            </button>
            <label className="ghost-btn">
              Upload photo
              <input type="file" accept="image/*" hidden onChange={onFile} />
            </label>
          </>
        )}
      </div>
    </div>
  )
}
