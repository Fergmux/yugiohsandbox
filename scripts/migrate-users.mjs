const PROJECT_ID = 'yugioh-sandbox'
const API_KEY = process.env.VITE_FIREBASE_API_KEY
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

if (!API_KEY) {
  console.error('Missing VITE_FIREBASE_API_KEY environment variable')
  process.exit(1)
}

function capitaliseFirst(str) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function firestoreFetch(path, options = {}) {
  const separator = path.includes('?') ? '&' : '?'
  const url = `${BASE_URL}${path}${separator}key=${API_KEY}`
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Firestore request failed (${res.status}): ${err}`)
  }
  return res.json()
}

async function migrate() {
  console.log('Fetching all users...')
  const data = await firestoreFetch('/users')
  const documents = data.documents ?? []

  console.log(`Found ${documents.length} users to process.\n`)

  let updated = 0
  let skipped = 0

  for (const userDoc of documents) {
    const docId = userDoc.name.split('/').pop()
    const fields = userDoc.fields ?? {}

    const currentUsername = fields.username?.stringValue
    const currentUserKey = fields.userKey?.stringValue

    const updates = {}

    const capitalisedUsername = capitaliseFirst(currentUsername)
    if (currentUsername && capitalisedUsername !== currentUsername) {
      updates.username = { stringValue: capitalisedUsername }
    }

    const expectedUserKey = (capitalisedUsername ?? currentUsername ?? '').toLowerCase()
    if (!currentUserKey || currentUserKey !== expectedUserKey) {
      updates.userKey = { stringValue: expectedUserKey }
    }

    if (Object.keys(updates).length === 0) {
      skipped++
      continue
    }

    // Build updateMask query params so only changed fields are touched
    const fieldMask = Object.keys(updates)
      .map((f) => `updateMask.fieldPaths=${f}`)
      .join('&')

    await firestoreFetch(`/users/${docId}?${fieldMask}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: updates }),
    })

    const summary = Object.entries(updates)
      .map(([k, v]) => `${k}: "${v.stringValue}"`)
      .join(', ')
    console.log(`Updated [${docId}]: ${summary}`)
    updated++
  }

  console.log(`\nMigration complete. Updated: ${updated}, Skipped (already correct): ${skipped}`)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
