import LoginPageClient from "./_login-client"

// Force server-side rendering so process.env.AUTH_GOOGLE_ID is read at request
// time (from Cloud Run env vars), not baked in as empty at Docker build time.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
    return <LoginPageClient googleClientId={process.env.AUTH_GOOGLE_ID ?? ""} />
}
