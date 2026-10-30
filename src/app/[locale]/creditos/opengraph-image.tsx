import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Venezuela Inmuebles - Créditos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#B08542', backgroundImage: 'radial-gradient(circle at 25% 25%, #16294B 0%, transparent 40%), radial-gradient(circle at 75% 75%, #E8D6AE 0%, transparent 40%)', padding: '40px', color: '#16294B', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: '120px', marginBottom: '20px' }}>⭐</div>
        <h1 style={{ fontSize: '60px', fontWeight: 'bold', textAlign: 'center', textShadow: '2px 2px 4px rgba(255,255,255,0.5)', lineHeight: 1.2 }}>Destaca tus Productos</h1>
        <p style={{ fontSize: '36px', marginTop: '20px', textAlign: 'center', opacity: 0.9 }}>Desde $1 USD - Marketplace Venezuela</p>
        <div style={{ position: 'absolute', bottom: '20px', fontSize: '24px', fontWeight: 'bold', color: '#16294B', textShadow: '2px 2px 4px rgba(255,255,255,0.5)' }}>Venezuela Inmuebles</div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}