import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthChange, getSession } from '../features/auth/session'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      navigate('/', { replace: true })
    }

    void getSession().then((s) => {
      if (s) finish()
    })

    const unsubscribe = onAuthChange((session) => {
      if (session) finish()
    })

    const timer = window.setTimeout(finish, 10_000)
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [navigate])

  return (
    <div className="flex min-h-full items-center justify-center text-neutral-400">
      Signing you in…
    </div>
  )
}
