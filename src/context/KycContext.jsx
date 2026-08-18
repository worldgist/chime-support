import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNotifications } from './NotificationContext'
import { hydrateCaseDocuments, resizeImage, saveKycImage, stripDocumentSrc } from '../utils/kycMedia'
import {
  createKycCase,
  fetchAdminKycCases,
  fetchKycLink,
  rotateKycLink,
  submitKycVerification as submitKycVerificationRemote,
  updateKycStatus,
} from '../utils/kycCases'

const KycContext = createContext(null)
const STORAGE_KEY = 'chime-kyc-cases'

const seedCases = [
  {
    id: 'kyc-ava',
    name: 'Ava Chen',
    email: 'ava.chen@email.com',
    phone: '(415) 555-0142',
    dob: 'Mar 12, 1994',
    address: '184 Market St, San Francisco, CA 94103',
    ssnLast4: '4482',
    submittedAt: 'Today, 8:14 AM',
    status: 'pending',
    risk: 'low',
    country: 'United States',
    documents: [
      { id: 'd1', type: 'id-front', label: 'Driver license — front', quality: 'clear' },
      { id: 'd2', type: 'id-back', label: 'Driver license — back', quality: 'clear' },
      { id: 'd3', type: 'selfie', label: 'Live selfie', quality: 'clear' },
      { id: 'd4', type: 'address', label: 'Proof of address', quality: 'clear' },
    ],
    notes: [],
    history: [{ id: 1, at: 'Today, 8:14 AM', text: 'Application submitted', by: 'System' }],
  },
  {
    id: 'kyc-marcus',
    name: 'Marcus Hale',
    email: 'marcus.hale@email.com',
    phone: '(312) 555-0198',
    dob: 'Jul 2, 1988',
    address: '920 N Wells St, Chicago, IL 60610',
    ssnLast4: '7719',
    submittedAt: 'Today, 7:41 AM',
    status: 'review',
    risk: 'medium',
    country: 'United States',
    documents: [
      { id: 'd5', type: 'id-front', label: 'State ID — front', quality: 'glare' },
      { id: 'd6', type: 'id-back', label: 'State ID — back', quality: 'clear' },
      { id: 'd7', type: 'selfie', label: 'Live selfie', quality: 'mismatch' },
      { id: 'd8', type: 'address', label: 'Utility bill', quality: 'expired' },
    ],
    notes: [{ id: 1, at: 'Today, 7:50 AM', text: 'Selfie does not clearly match ID photo.', by: 'Queue' }],
    history: [
      { id: 1, at: 'Today, 7:41 AM', text: 'Application submitted', by: 'System' },
      { id: 2, at: 'Today, 7:48 AM', text: 'Moved to manual review', by: 'System' },
    ],
  },
  {
    id: 'kyc-priya',
    name: 'Priya Nair',
    email: 'priya.nair@email.com',
    phone: '(206) 555-0114',
    dob: 'Nov 19, 1999',
    address: '4412 Rainier Ave, Seattle, WA 98118',
    ssnLast4: '3301',
    submittedAt: 'Yesterday',
    status: 'approved',
    risk: 'low',
    country: 'United States',
    documents: [
      { id: 'd9', type: 'id-front', label: 'Passport — photo page', quality: 'clear' },
      { id: 'd10', type: 'selfie', label: 'Live selfie', quality: 'clear' },
      { id: 'd11', type: 'address', label: 'Bank statement', quality: 'clear' },
    ],
    notes: [],
    history: [
      { id: 1, at: 'Yesterday, 4:12 PM', text: 'Application submitted', by: 'System' },
      { id: 2, at: 'Yesterday, 5:03 PM', text: 'KYC approved', by: 'Support Admin' },
    ],
  },
  {
    id: 'kyc-diego',
    name: 'Diego Morales',
    email: 'diego.morales@email.com',
    phone: '(305) 555-0177',
    dob: 'Jan 8, 1991',
    address: '88 Biscayne Blvd, Miami, FL 33132',
    ssnLast4: '9044',
    submittedAt: 'Yesterday',
    status: 'rejected',
    risk: 'high',
    country: 'United States',
    documents: [
      { id: 'd12', type: 'id-front', label: 'Driver license — front', quality: 'blurry' },
      { id: 'd13', type: 'id-back', label: 'Driver license — back', quality: 'blurry' },
      { id: 'd14', type: 'selfie', label: 'Live selfie', quality: 'mismatch' },
    ],
    notes: [{ id: 1, at: 'Yesterday, 6:20 PM', text: 'Unreadable ID and selfie mismatch.', by: 'Support Admin' }],
    history: [
      { id: 1, at: 'Yesterday, 3:40 PM', text: 'Application submitted', by: 'System' },
      { id: 2, at: 'Yesterday, 6:20 PM', text: 'KYC rejected', by: 'Support Admin' },
    ],
  },
  {
    id: 'kyc-nina',
    name: 'Nina Brooks',
    email: 'nina.brooks@email.com',
    phone: '(512) 555-0160',
    dob: 'May 27, 1996',
    address: '210 Congress Ave, Austin, TX 78701',
    ssnLast4: '1188',
    submittedAt: '2 days ago',
    status: 'more_info',
    risk: 'medium',
    country: 'United States',
    documents: [
      { id: 'd15', type: 'id-front', label: 'Driver license — front', quality: 'clear' },
      { id: 'd16', type: 'selfie', label: 'Live selfie', quality: 'clear' },
      { id: 'd17', type: 'address', label: 'Proof of address', quality: 'missing' },
    ],
    notes: [{ id: 1, at: '2 days ago', text: 'Need a utility bill dated within 90 days.', by: 'Support Admin' }],
    history: [
      { id: 1, at: '2 days ago', text: 'Application submitted', by: 'System' },
      { id: 2, at: '2 days ago', text: 'Requested more information', by: 'Support Admin' },
    ],
  },
]

function loadCases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {
    // ignore
  }
  return seedCases
}

function stamp() {
  return new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function verificationUrl(token) {
  return `${window.location.origin}/verify/${token}`
}

function last4(ssn) {
  return String(ssn || '').replace(/\D/g, '').slice(-4)
}

export function KycProvider({ children }) {
  const { pushEmail, sendToUsers } = useNotifications()
  const usingSupabase = Boolean(supabase)
  const [cases, setCases] = useState(() => (usingSupabase ? [] : loadCases()))
  const [activeId, setActiveId] = useState(() => (usingSupabase ? null : loadCases()[0]?.id))
  const skipSave = useRef(true)
  const casesRef = useRef(cases)
  casesRef.current = cases

  async function refreshAdminCases() {
    if (!supabase) return []
    const { data } = await supabase.auth.getSession()
    if (!data.session) return []
    const next = await fetchAdminKycCases()
    setCases(next)
    setActiveId((id) => {
      if (id && next.some((item) => item.id === id)) return id
      return next[0]?.id || null
    })
    return next
  }

  useEffect(() => {
    if (!supabase) return undefined
    let cancelled = false

    async function load() {
      try {
        if (!cancelled) await refreshAdminCases()
      } catch {
        // Table or session may not be ready yet.
      }
    }

    load()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) load()
    })
    const realtime = supabase
      .channel('kyc-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_cases' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_documents' }, load)
      .subscribe()
    const poll = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      supabase.removeChannel(realtime)
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (usingSupabase) return undefined
    let cancelled = false
    hydrateCaseDocuments(loadCases()).then((next) => {
      if (cancelled) return
      skipSave.current = true
      setCases((current) => {
        const incoming = new Map(next.map((item) => [item.id, item]))
        const merged = current.map((item) => {
          const hydrated = incoming.get(item.id)
          if (!hydrated) return item
          const hasLocalPhotos = item.documents?.some((doc) => doc.src)
          return hasLocalPhotos ? item : hydrated
        })
        const extras = next.filter((item) => !current.some((entry) => entry.id === item.id))
        return [...merged, ...extras]
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (usingSupabase) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripDocumentSrc(cases)))
    } catch {
      // Images live in IndexedDB; skip oversized localStorage writes.
    }
  }, [cases, usingSupabase])

  useEffect(() => {
    if (usingSupabase) return undefined
    async function applyStored(raw) {
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return
        const next = await hydrateCaseDocuments(parsed)
        skipSave.current = true
        setCases(next)
      } catch {
        // ignore malformed storage
      }
    }

    function onStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      applyStored(event.newValue)
    }

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('chime-kyc-sync')
    channel?.addEventListener('message', (event) => {
      if (event.data?.type === 'kyc-updated') applyStored(localStorage.getItem(STORAGE_KEY) || '[]')
    })

    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      channel?.close()
    }
  }, [])

  function selectCase(id) {
    setActiveId(id)
  }

  function addHistory(list, text, by) {
    return [...list, { id: Date.now(), at: stamp(), text, by }]
  }

  async function setCaseStatus(id, status, note, by = 'Support Admin') {
    const currentCase = cases.find((item) => item.id === id)

    if (supabase && currentCase) {
      try {
        await updateKycStatus(currentCase, status, note, by)
        await refreshAdminCases()
      } catch {
        return
      }
    } else {
      setCases((current) =>
        current.map((item) => {
          if (item.id !== id) return item
          const notes = note
            ? [...item.notes, { id: Date.now(), at: stamp(), text: note, by }]
            : item.notes
          const label =
            status === 'approved'
              ? 'KYC approved'
              : status === 'rejected'
                ? 'KYC rejected'
                : status === 'more_info'
                  ? 'Requested more information'
                  : 'Moved to review'
          return {
            ...item,
            status,
            notes,
            history: addHistory(item.history, note ? `${label}: ${note}` : label, by),
          }
        }),
      )
    }

    if (currentCase) {
      const isDecision = status === 'approved' || status === 'rejected'
      const label =
        status === 'approved'
          ? 'approved'
          : status === 'rejected'
            ? 'rejected'
            : status === 'more_info'
              ? 'needs more information'
              : 'needs review'
      pushEmail({
        type: 'kyc',
        event: isDecision ? 'decision' : 'queue',
        from: 'Chime KYC <kyc@chimesupport.local>',
        subject: `KYC ${label} — ${currentCase.name}`,
        preview: note || `${currentCase.name} is now ${label}.`,
        body: `KYC status update.\n\nCustomer: ${currentCase.name}\nEmail: ${currentCase.email}\nStatus: ${label}${note ? `\nNote: ${note}` : ''}\n\nOpen KYC Management to continue.`,
        href: '/admin/kyc',
      })
    }
  }

  function notifyUserLink(item, url) {
    sendToUsers({
      recipients: [{ name: item.name, email: item.email }],
      subject: 'Verify your Chime account',
      body: `Hi ${item.name},\n\nUse this secure link to verify your identity:\n${url}\n\nYou will need:\n• ID card, front and back\n• Your Social Security number\n• A live selfie from your camera\n\nThis link expires in 7 days.\n\nThank you,\nChime Support`,
      fromName: 'Chime KYC',
    })
  }

  async function createVerificationLink({ name, email, phone }, by = 'Support Admin') {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedName || !trimmedEmail) return null

    if (supabase) {
      const item = await createKycCase({ name: trimmedName, email: trimmedEmail, phone }, by)
      await refreshAdminCases()
      setActiveId(item.id)
      const url = verificationUrl(item.token)
      notifyUserLink(item, url)
      return { ...item, url }
    }

    const token = crypto.randomUUID()
    const item = {
      id: `kyc-${Date.now()}`,
      token,
      linkStatus: 'open',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim() || '—',
      dob: '—',
      address: '—',
      ssnLast4: '',
      submittedAt: 'Not submitted',
      status: 'awaiting',
      risk: 'low',
      country: 'United States',
      source: 'link',
      documents: [],
      notes: [],
      history: [{ id: Date.now(), at: stamp(), text: 'Verification link created', by }],
    }

    setCases((current) => [item, ...current])
    setActiveId(item.id)
    const url = verificationUrl(token)
    notifyUserLink(item, url)
    return { ...item, url }
  }

  async function createLinkForCase(id, by = 'Support Admin') {
    const currentCase = casesRef.current.find((item) => item.id === id)
    if (!currentCase) return null

    if (supabase) {
      const next = await rotateKycLink(currentCase, by)
      await refreshAdminCases()
      const url = verificationUrl(next.token)
      notifyUserLink({ ...currentCase, token: next.token }, url)
      return url
    }

    const token = crypto.randomUUID()
    setCases((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              token,
              linkStatus: 'open',
              expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
              history: addHistory(item.history, 'New verification link created', by),
            }
          : item,
      ),
    )
    const url = verificationUrl(token)
    notifyUserLink({ ...currentCase, token }, url)
    return url
  }

  async function getVerification(token) {
    if (supabase) {
      try {
        return await fetchKycLink(token)
      } catch {
        return null
      }
    }
    return casesRef.current.find((entry) => entry.token === token) || null
  }

  async function submitVerification(token, payload) {
    const digits = String(payload.ssn || '').replace(/\D/g, '')
    if (!payload.idFront || !payload.idBack || !payload.selfie || digits.length !== 9) {
      return { ok: false, error: 'Add ID front, ID back, SSN, and a selfie to continue.' }
    }

    const [idFront, idBack, selfie] = await Promise.all([
      resizeImage(payload.idFront),
      resizeImage(payload.idBack),
      resizeImage(payload.selfie),
    ])

    if (supabase) {
      try {
        const link = await fetchKycLink(token)
        if (!link) return { ok: false, error: 'This verification link is not valid.' }
        if (link.status === 'approved' || link.status === 'rejected') {
          return { ok: false, error: 'This verification has already been decided.' }
        }
        await submitKycVerificationRemote(token, { ssn: payload.ssn, idFront, idBack, selfie })
        pushEmail({
          type: 'kyc',
          event: 'queue',
          from: 'Chime KYC <kyc@chimesupport.local>',
          subject: `KYC submitted — ${link.name}`,
          preview: `${link.name} uploaded ID photos, SSN, and a selfie.`,
          body: `A customer completed verification from a link.\n\nCustomer: ${link.name}\nEmail: ${link.email}\n\nReview ID front, ID back, SSN, and selfie in KYC Management.`,
          href: '/admin/kyc',
        })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error.message || 'Could not submit verification.' }
      }
    }

    const currentCase = casesRef.current.find((item) => item.token === token)
    if (!currentCase) return { ok: false, error: 'This verification link is not valid.' }
    if (currentCase.status === 'approved' || currentCase.status === 'rejected') {
      return { ok: false, error: 'This verification has already been decided.' }
    }
    if (currentCase.expiresAt && currentCase.expiresAt < Date.now() && currentCase.status === 'awaiting') {
      return { ok: false, error: 'This verification link has expired.' }
    }

    const stampId = Date.now()
    const documents = [
      { id: `front-${stampId}`, type: 'id-front', label: 'ID card — front', quality: 'clear', mediaKey: `front-${token}`, src: idFront },
      { id: `back-${stampId}`, type: 'id-back', label: 'ID card — back', quality: 'clear', mediaKey: `back-${token}`, src: idBack },
      { id: `selfie-${stampId}`, type: 'selfie', label: 'Live selfie', quality: 'clear', mediaKey: `selfie-${token}`, src: selfie },
    ]
    await Promise.all(documents.map((doc) => saveKycImage(doc.mediaKey, doc.src)))

    setCases((current) =>
      current.map((item) =>
        item.token === token
          ? {
              ...item,
              status: 'pending',
              linkStatus: 'used',
              submittedAt: stamp(),
              ssnLast4: last4(payload.ssn),
              dob: payload.dob || item.dob,
              address: payload.address || item.address,
              documents,
              history: addHistory(item.history, 'Customer completed ID, SSN, and selfie verification', item.name),
            }
          : item,
      ),
    )
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('chime-kyc-sync')
    channel?.postMessage({ type: 'kyc-updated' })
    channel?.close()

    pushEmail({
      type: 'kyc',
      event: 'queue',
      from: 'Chime KYC <kyc@chimesupport.local>',
      subject: `KYC submitted — ${currentCase.name}`,
      preview: `${currentCase.name} uploaded ID photos, SSN, and a selfie.`,
      body: `A customer completed verification from a link.\n\nCustomer: ${currentCase.name}\nEmail: ${currentCase.email}\n\nReview ID front, ID back, SSN, and selfie in KYC Management.`,
      href: '/admin/kyc',
    })

    return { ok: true }
  }

  const activeCase = cases.find((item) => item.id === activeId) || cases[0] || null
  const counts = useMemo(
    () => ({
      awaiting: cases.filter((item) => item.status === 'awaiting').length,
      pending: cases.filter((item) => item.status === 'pending').length,
      review: cases.filter((item) => item.status === 'review').length,
      approved: cases.filter((item) => item.status === 'approved').length,
      rejected: cases.filter((item) => item.status === 'rejected').length,
      more_info: cases.filter((item) => item.status === 'more_info').length,
    }),
    [cases],
  )

  const value = useMemo(
    () => ({
      cases,
      activeId,
      activeCase,
      selectCase,
      setCaseStatus,
      createVerificationLink,
      createLinkForCase,
      getVerification,
      submitVerification,
      counts,
      usingSupabase,
    }),
    [cases, activeId, activeCase, counts, usingSupabase],
  )

  return <KycContext.Provider value={value}>{children}</KycContext.Provider>
}

export function useKyc() {
  const context = useContext(KycContext)
  if (!context) throw new Error('useKyc must be used within KycProvider')
  return context
}
