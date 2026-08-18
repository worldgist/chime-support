import { supabase } from '../lib/supabase'

export function formatKycStamp(value) {
  if (!value) return 'Not submitted'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function mapHistory(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    id: item.id,
    at: formatKycStamp(item.at),
    text: item.text,
    by: item.by,
  }))
}

export function mapDocument(row) {
  return {
    id: row.id,
    type: row.doc_type || row.type,
    label: row.label,
    quality: row.quality || 'clear',
    src: row.image_data || row.src || '',
  }
}

export function mapKycCase(row, documents = []) {
  const rawNotes = Array.isArray(row.notes) ? row.notes : []
  const rawHistory = Array.isArray(row.history) ? row.history : []
  const submittedValue = row.submitted_at || row.submittedAt
  const expiresValue = row.expires_at || row.expiresAt

  return {
    id: row.id,
    token: row.token,
    linkStatus: row.link_status || row.linkStatus || 'open',
    expiresAt: expiresValue ? new Date(expiresValue).getTime() : undefined,
    name: row.customer_name || row.name,
    email: row.customer_email || row.email,
    phone: row.customer_phone || row.phone || '—',
    dob: row.dob || '—',
    address: row.address || '—',
    ssnLast4: row.ssn_last4 || row.ssnLast4 || '',
    submittedAt: submittedValue ? formatKycStamp(submittedValue) : 'Not submitted',
    status: row.status || 'awaiting',
    risk: row.risk || 'low',
    country: row.country || 'United States',
    source: row.source || 'link',
    documents: documents.map(mapDocument),
    notes: mapHistory(rawNotes),
    history: mapHistory(rawHistory),
    rawNotes,
    rawHistory,
  }
}

function historyEvent(text, by) {
  return {
    id: Date.now(),
    at: new Date().toISOString(),
    text,
    by,
  }
}

export async function fetchAdminKycCases() {
  const { data: cases, error } = await supabase
    .from('kyc_cases')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error

  const ids = (cases || []).map((item) => item.id)
  if (ids.length === 0) return []

  const { data: documents, error: documentError } = await supabase
    .from('kyc_documents')
    .select('*')
    .in('case_id', ids)
    .order('created_at', { ascending: true })
  if (documentError) throw documentError

  const byCase = new Map()
  for (const document of documents || []) {
    const list = byCase.get(document.case_id) || []
    list.push(document)
    byCase.set(document.case_id, list)
  }

  return cases.map((item) => mapKycCase(item, byCase.get(item.id) || []))
}

export async function createKycCase({ name, email, phone }, by = 'Support Admin') {
  const { data, error } = await supabase
    .from('kyc_cases')
    .insert({
      customer_name: name.trim(),
      customer_email: email.trim().toLowerCase(),
      customer_phone: phone?.trim() || null,
      status: 'awaiting',
      source: 'link',
      history: [historyEvent('Verification link created', by)],
    })
    .select('*')
    .single()
  if (error) throw error
  return mapKycCase(data)
}

export async function rotateKycLink(item, by = 'Support Admin') {
  const { data, error } = await supabase
    .from('kyc_cases')
    .update({
      token: crypto.randomUUID(),
      link_status: 'open',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      history: [...(item.rawHistory || []), historyEvent('New verification link created', by)],
    })
    .eq('id', item.id)
    .select('*')
    .single()
  if (error) throw error
  return mapKycCase(data, item.documents)
}

export async function updateKycStatus(item, status, note, by = 'Support Admin') {
  const label =
    status === 'approved'
      ? 'KYC approved'
      : status === 'rejected'
        ? 'KYC rejected'
        : status === 'more_info'
          ? 'Requested more information'
          : 'Moved to review'

  const notes = note
    ? [...(item.rawNotes || []), historyEvent(note, by)]
    : item.rawNotes || []
  const history = [...(item.rawHistory || []), historyEvent(note ? `${label}: ${note}` : label, by)]

  const { error } = await supabase
    .from('kyc_cases')
    .update({ status, notes, history })
    .eq('id', item.id)
  if (error) throw error
}

export async function fetchKycLink(token) {
  const { data, error } = await supabase.rpc('get_kyc_link', { p_token: token })
  if (error) throw error
  if (!data) return null
  return mapKycCase(data)
}

export async function submitKycVerification(token, { ssn, idFront, idBack, selfie }) {
  const { data, error } = await supabase.rpc('submit_kyc_verification', {
    p_token: token,
    p_ssn: ssn,
    p_id_front: idFront,
    p_id_back: idBack,
    p_selfie: selfie,
  })
  if (error) throw error
  return data
}
