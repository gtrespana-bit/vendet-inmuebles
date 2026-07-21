/**
 * Cloudflare R2 Client — S3-compatible
 * 
 * Usado para subir fotos de productos a R2 en lugar de Supabase Storage.
 * Las fotos de perfil, comprobantes y cédulas siguen en Supabase.
 * 
 * Para funcionar en browser, usamos presigned URLs desde API routes.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ENDPOINT = process.env.R2_ENDPOINT || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET = process.env.R2_BUCKET || 'vendet-fotos'

let r2Client: S3Client | null = null

function getClient(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return r2Client
}

/** Genera un presigned URL para subir un archivo a R2 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string = 'image/jpeg',
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient()
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return await getSignedUrl(client, command, { expiresIn })
}

/** Genera un presigned URL para eliminar un archivo de R2 */
export async function getDeletePresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient()
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })
  return await getSignedUrl(client, command, { expiresIn })
}

/** Construye la URL pública de un archivo en R2 */
export function getR2PublicUrl(key: string): string {
  const baseUrl = process.env.R2_PUBLIC_URL || ''
  // Sanitize the key to avoid path traversal
  const sanitized = key.replace(/^\/+/, '')
  return `${baseUrl}/${sanitized}`
}

/** Genera un presigned URL para obtener (descargar) un archivo de R2 */
export async function getObjectPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient()
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })
  return await getSignedUrl(client, command, { expiresIn })
}
