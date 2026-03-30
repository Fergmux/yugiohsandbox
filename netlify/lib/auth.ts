import { adminAuth } from './admin.js'

interface NetlifyEvent {
  headers: Record<string, string>
}

interface AuthResult {
  uid: string
}

interface AuthError {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export async function verifyAuth(
  event: NetlifyEvent,
): Promise<{ auth: AuthResult; error?: never } | { auth?: never; error: AuthError }> {
  const authHeader = event.headers?.authorization || event.headers?.Authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing or invalid authorization header' }),
      },
    }
  }

  try {
    const token = authHeader.split('Bearer ')[1]
    const decoded = await adminAuth.verifyIdToken(token)
    return { auth: { uid: decoded.uid } }
  } catch {
    return {
      error: {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      },
    }
  }
}
