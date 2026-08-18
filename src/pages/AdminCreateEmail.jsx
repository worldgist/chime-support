import { Navigate, useSearchParams } from 'react-router-dom'

export default function AdminCreateEmail() {
  const [params] = useSearchParams()
  const next = params.toString()
  return <Navigate to={next ? `/admin/notifications?${next}` : '/admin/notifications'} replace />
}
