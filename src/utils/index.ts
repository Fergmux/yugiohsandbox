export const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`
