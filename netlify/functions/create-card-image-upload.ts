import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { verifyAuth } from '../lib/auth.js'
import { requireAdmin } from '../lib/require-admin.js'

const BUCKET_NAME = 'yugioh-simulator'
const CARD_IMAGE_PREFIX = 'cards'
const DEFAULT_REGION = 'eu-west-2'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const allowedContentTypes: Record<string, string> = {
  'image/jpeg': 'JPG, PNG, and WebP',
  'image/png': 'JPG, PNG, and WebP',
  'image/webp': 'JPG, PNG, and WebP',
}

interface UploadRequestBody {
  fileName?: string
  contentType?: string
  size?: number
}

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const encodeS3Key = (key: string) => key.split('/').map(encodeURIComponent).join('/')

const getAwsCredentials = () => {
  const uploadAccessKeyId = process.env.S3_UPLOAD_ACCESS_KEY_ID
  const uploadSecretAccessKey = process.env.S3_UPLOAD_SECRET_ACCESS_KEY

  if (!uploadAccessKeyId || !uploadSecretAccessKey) return null

  return {
    accessKeyId: uploadAccessKeyId,
    secretAccessKey: uploadSecretAccessKey,
    ...(process.env.S3_UPLOAD_SESSION_TOKEN ? { sessionToken: process.env.S3_UPLOAD_SESSION_TOKEN } : {}),
  }
}

const normalizeFileName = (fileName: string | undefined) => {
  const normalized = fileName?.trim()
  if (!normalized || /[/\\\u0000-\u001f\u007f]/.test(normalized) || normalized === '.' || normalized === '..') return ''
  return normalized
}

const buildPublicUrl = (fileName: string, key: string) => {
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL ?? process.env.VITE_S3_BUCKET_URL
  if (publicBaseUrl) return `${publicBaseUrl.replace(/\/?$/, '/')}${encodeURIComponent(fileName)}`

  const region = process.env.S3_UPLOAD_REGION ?? DEFAULT_REGION
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${encodeS3Key(key)}`
}

const handler = async (event: { body: string | null; headers: Record<string, string>; httpMethod: string }) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed' })

  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const adminResult = await requireAdmin(authResult.auth.uid)
    if (adminResult.error) return adminResult.error

    const body = JSON.parse(event.body ?? '{}') as UploadRequestBody
    const fileName = normalizeFileName(body.fileName)
    const contentType = body.contentType?.trim().toLowerCase()

    if (!fileName) {
      return json(400, { message: 'Image filename is required' })
    }

    if (!contentType || !allowedContentTypes[contentType]) {
      return json(400, { message: 'Only JPG, PNG, and WebP images are supported' })
    }

    if (!body.size || body.size > MAX_IMAGE_SIZE_BYTES) {
      return json(400, { message: 'Image must be 5 MB or smaller' })
    }

    const region = process.env.S3_UPLOAD_REGION ?? DEFAULT_REGION
    const key = `${CARD_IMAGE_PREFIX}/${fileName}`
    const credentials = getAwsCredentials()

    if (!credentials) {
      return json(500, {
        message:
          'Missing AWS credentials. Set S3_UPLOAD_ACCESS_KEY_ID and S3_UPLOAD_SECRET_ACCESS_KEY in the Netlify environment.',
      })
    }

    const s3Client = new S3Client({
      region,
      credentials,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    })

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 })

    return json(200, {
      uploadUrl,
      key,
      publicUrl: buildPublicUrl(fileName, key),
    })
  } catch (err) {
    console.error(err)
    return json(500, { message: err instanceof Error ? err.message : 'Unable to create upload URL' })
  }
}

export { handler }
