import 'server-only'
import { createWorker, OEM, type Worker } from 'tesseract.js'
import sharp from 'sharp'
import path from 'node:path'

/** All models/WASM are installed via npm. No CDN, paid API or external upload. */
export async function readReceipt(input: Buffer) {
  let worker: Worker | undefined
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const work = async () => {
    const image = await sharp(input, { limitInputPixels: 16_000_000, animated: false })
      .rotate().resize({ width: 1800, withoutEnlargement: true }).grayscale().normalize().png().toBuffer()
    worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js'),
      corePath: path.join(process.cwd(), 'node_modules/tesseract.js-core'),
      langPath: path.join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0'),
      cacheMethod: 'none', gzip: true,
      errorHandler: () => { /* Caller fails closed to review. */ },
    })
    if (timedOut) { await worker.terminate(); throw new Error('OCR timeout') }
    const { data } = await worker.recognize(image)
    return { text: data.text.slice(0,16000), confidence: data.confidence }
  }
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error('OCR timeout')) }, 25000) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
    if (worker) await worker.terminate()
  }
}
