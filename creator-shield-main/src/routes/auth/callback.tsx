import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // Get the session from the URL hash (handled automatically by supabase-js)
        const { data, error: sessionError } = await supabase!.auth.getSession()

        if (sessionError) throw sessionError
        
        if (!data.session) {
          throw new Error("No session found in callback")
        }

        // Exchange Supabase token for our custom JWT
        await useAuth.getState().loginWithGoogle(data.session.access_token)
        
        // Redirect to dashboard on success
        navigate({ to: '/dashboard', replace: true })
      } catch (err: any) {
        console.error("Auth callback error:", err)
        setError(err.message || "Failed to complete authentication")
      }
    }

    handleAuthCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex max-w-md flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 p-8 text-center backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-bold text-destructive">Authentication Failed</h2>
          <p className="mb-6 text-sm text-foreground/80">{error}</p>
          <button 
            onClick={() => navigate({ to: '/login', replace: true })}
            className="rounded-md bg-background px-4 py-2 text-sm font-medium border border-border/40 hover:bg-muted"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-sm font-medium text-foreground/80 animate-pulse">
          Completing sign in...
        </p>
      </div>
    </div>
  )
}
