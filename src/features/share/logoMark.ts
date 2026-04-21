// Canonical app logo mark for PNG exports.
// Must stay visually aligned with public/icon-512.svg.

export function drawLogoTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius = Math.round(size * 0.26),
) {
  ctx.save()
  ctx.beginPath()
  const r = Math.min(radius, size / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + size, y, x + size, y + size, r)
  ctx.arcTo(x + size, y + size, x, y + size, r)
  ctx.arcTo(x, y + size, x, y, r)
  ctx.arcTo(x, y, x + size, y, r)
  ctx.closePath()
  ctx.clip()

  ctx.fillStyle = '#07070a'
  ctx.fillRect(x, y, size, size)

  const tl = ctx.createRadialGradient(
    x + size * 0.15,
    y + size * 0.1,
    0,
    x + size * 0.15,
    y + size * 0.1,
    size * 0.75,
  )
  tl.addColorStop(0, 'rgba(255,77,0,0.38)')
  tl.addColorStop(1, 'rgba(255,77,0,0)')
  ctx.fillStyle = tl
  ctx.fillRect(x, y, size, size)

  const br = ctx.createRadialGradient(
    x + size * 0.85,
    y + size * 0.9,
    0,
    x + size * 0.85,
    y + size * 0.9,
    size * 0.75,
  )
  br.addColorStop(0, 'rgba(124,58,237,0.36)')
  br.addColorStop(1, 'rgba(124,58,237,0)')
  ctx.fillStyle = br
  ctx.fillRect(x, y, size, size)
  ctx.restore()
}

export function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.save()
  ctx.translate(x, y)
  const s = size / 512
  ctx.scale(s, s)

  const brand = ctx.createLinearGradient(64, 64, 448, 448)
  brand.addColorStop(0, '#ff4d00')
  brand.addColorStop(0.55, '#ff2d87')
  brand.addColorStop(1, '#7c3aed')

  ctx.strokeStyle = brand
  ctx.lineWidth = 46
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(112, 340)
  ctx.lineTo(192, 172)
  ctx.lineTo(256, 292)
  ctx.lineTo(320, 172)
  ctx.lineTo(400, 340)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(256, 292, 22, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(256, 292, 11, 0, Math.PI * 2)
  ctx.fillStyle = '#ff2d87'
  ctx.fill()

  ctx.restore()
}
