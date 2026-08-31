const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3')
const axios = require('axios')

const s3 = new S3Client({
  region: 'eu-west-2',
  credentials: {
    accessKeyId: process.env.S3_UPLOAD_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_UPLOAD_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.S3_UPLOAD_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN
      ? { sessionToken: process.env.S3_UPLOAD_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN }
      : {}),
  },
})

const BUCKET_NAME = 'yugioh-simulator'
const CARD_IMAGE_PREFIX = 'yugioh_cards'
const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php'

async function downloadImage(url) {
  const response = await axios({
    url,
    responseType: 'arraybuffer',
  })

  return response.data
}

async function objectExistsInS3(filename) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: `${CARD_IMAGE_PREFIX}/${filename}`,
  }

  try {
    const command = new HeadObjectCommand(params)
    await s3.send(command)
    return true // Object exists
  } catch (error) {
    if (error.name === 'NotFound') {
      return false // Object does not exist
    }
    throw error // Other errors
  }
}

async function uploadToS3(imageBuffer, filename) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: `${CARD_IMAGE_PREFIX}/${filename}`,
    Body: imageBuffer,
    ContentType: 'image/jpeg',
  }

  const command = new PutObjectCommand(params)
  await s3.send(command)
}

async function main() {
  console.log('Fetching Yu-Gi-Oh! card data...')

  try {
    const { data } = await axios.get(API_URL)
    const cards = data.data

    console.log(`Total cards found: ${cards.length}`)

    let uploadedCount = 0
    let skippedCount = 0
    let currentIndex = 1

    for (const card of cards) {
      if (!card.card_images || card.card_images.length === 0) {
        currentIndex++
        continue
      }

      console.log(`\n[${currentIndex} / ${cards.length}] Processing card: ${card.name} (ID: ${card.id})`)

      for (let i = 0; i < card.card_images.length; i++) {
        const imageData = card.card_images[i]
        const imageUrl = imageData.image_url
        const filename = `${imageData.id}.jpg`

        try {
          const exists = await objectExistsInS3(filename)
          if (exists) {
            console.log(`➡️ Skipping (already exists): ${filename} ❌`)
            skippedCount++
            continue
          }

          console.log(`⬇️ Downloading: ${filename}`)
          const imageBuffer = await downloadImage(imageUrl)

          console.log(`⬆️ Uploading: ${filename} to S3...`)
          await uploadToS3(imageBuffer, filename)

          uploadedCount++
          console.log(`✅ Uploaded: ${filename}`)
        } catch (error) {
          console.error(`❌ Failed to process ${filename}:`, error.message)
        }
      }

      currentIndex++
    }

    console.log(`Upload complete! Uploaded: ${uploadedCount}, Skipped: ${skippedCount}`)
  } catch (error) {
    console.error('Error fetching card data:', error.message)
  }
}

main()
