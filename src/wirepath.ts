export interface Pt { x: number; y: number }
export const GRID = 15
export const snap = (v: number) => Math.round(v / GRID) * GRID
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
/** Ломаная с закруглёнными углами через точки P. */
export function roundedPath(P: Pt[], r = 8): string {
  let d = `M${P[0].x} ${P[0].y}`
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1], ab = dist(a, b), bc = dist(b, c)
    if (!ab || !bc) continue
    const r1 = Math.min(r, ab / 2), r2 = Math.min(r, bc / 2)
    d += `L${b.x + (a.x - b.x) / ab * r1} ${b.y + (a.y - b.y) / ab * r1}Q${b.x} ${b.y} ${b.x + (c.x - b.x) / bc * r2} ${b.y + (c.y - b.y) / bc * r2}`
  }
  const l = P[P.length - 1]; return d + `L${l.x} ${l.y}`
}
function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}
/** Индекс в массиве точек излома, куда вставить новую точку p (сегменты: start → points → end). */
export function insertIndex(start: Pt, pts: Pt[], end: Pt, p: Pt): number {
  const P = [start, ...pts, end]; let best = 0, bd = Infinity
  for (let i = 0; i < P.length - 1; i++) { const d = segDist(p, P[i], P[i + 1]); if (d < bd) { bd = d; best = i } }
  return best
}
