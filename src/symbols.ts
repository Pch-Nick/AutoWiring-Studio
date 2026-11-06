import type { CompData } from './types'
import { SELECTORS } from './sim'
export interface Ctx { d: CompData; on: boolean; lit: number; run: boolean; state?: string }
type Pos = 'left' | 'right' | 'top' | 'bottom'
export interface PinLay { x: number; y: number; pos: Pos; lx: number; ly: number; anchor: 'start' | 'end' }
export interface Layout { w: number; h: number; body: (c: Ctx) => string; pins: Map<string, PinLay>; outside: boolean }
interface Sym { w: number; h: number; pts: [number, number][]; body: (c: Ctx) => string }
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const L = (a: number, b: number, c: number, d: number, x = '') => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" ${x}/>`
const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/>`
const T = (x: number, y: number, t: string, s = 13) => `<text x="${x}" y="${y}" font-size="${s}" fill="currentColor" stroke="none" text-anchor="middle" font-family="system-ui">${t}</text>`
const glow = (x: number, y: number, r: number, lit: number) => lit > 0.05 ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#fdd835" fill-opacity="${Math.min(lit, 1) * 0.85}" stroke="none"/>` : ''
const lampAt = (x: number, y: number, r: number, lit: number) => glow(x, y, r, lit) + `<circle cx="${x}" cy="${y}" r="${r}"/>` + L(x - r * .7, y - r * .7, x + r * .7, y + r * .7) + L(x + r * .7, y - r * .7, x - r * .7, y + r * .7)
const LAMP2 = new Set(['lamplow', 'lamphigh', 'brakelamp', 'turnfl', 'turnfr', 'turnrl', 'turnrr', 'position', 'platelight', 'ledstrip'])
const MOTOR = new Set(['starter', 'motor', 'fuelpump'])
const PUSH = new Set(['startbtn', 'hazard', 'hornbtn', 'brakelever', 'brakepedal', 'clutchbtn'])
const HYD = new Set(['hydfront', 'hydrear']), MECH = new Set(['mechfront', 'mechrear', 'sidestand', 'clutchsw'])
const PLAIN = new Set(['killswitch', 'mainswitch'])

function specific(d: CompData): Sym | null {
  const id = d.libId
  if (id === 'battery') return { w: 80, h: 100, pts: [[40, 0], [40, 100]], body: () => L(40, 0, 40, 24) + L(14, 24, 66, 24) + L(26, 34, 54, 34, 'stroke-width="5"') + L(14, 46, 66, 46) + L(26, 56, 54, 56, 'stroke-width="5"') + L(40, 56, 40, 100) + T(70, 22, '+') + T(66, 66, '−') }
  if (id === 'ground') return { w: 60, h: 50, pts: [[30, 0]], body: () => L(30, 0, 30, 20) + L(8, 20, 52, 20) + L(16, 30, 44, 30) + L(24, 40, 36, 40) }
  if (id === 'fuse') return { w: 90, h: 40, pts: [[0, 20], [90, 20]], body: c => L(0, 20, 22, 20) + `<rect x="22" y="11" width="46" height="18" rx="2" ${c.state === 'перегорел' ? 'stroke="#e53935"' : ''}/>` + (c.state === 'перегорел' ? L(22, 20, 36, 20) + L(54, 20, 68, 20) + L(40, 14, 50, 26, 'stroke="#e53935"') : L(22, 20, 68, 20)) + L(68, 20, 90, 20) }
  if (id === 'fusebox') return { w: 110, h: 100, pts: [[0, 22], [110, 22], [110, 50], [110, 78]], body: c => `<rect x="14" y="6" width="82" height="88" rx="3"/>` + [22, 50, 78].map(y => `<rect x="40" y="${y - 7}" width="30" height="14" rx="2" ${c.state === 'перегорел' ? 'stroke="#e53935"' : ''}/>` + L(14, 22, 40, 22) + L(70, y, 96, y)).join('') + L(0, 22, 14, 22) + L(96, 22, 110, 22) + L(96, 50, 110, 50) + L(96, 78, 110, 78) + T(30, 62, 'F', 10) }
  if (LAMP2.has(id)) return { w: 70, h: 70, pts: [[35, 0], [35, 70]], body: c => L(35, 0, 35, 19) + lampAt(35, 35, 16, c.lit) + L(35, 51, 35, 70) }
  if (id === 'headlight' || id === 'taillight') return { w: 110, h: 80, pts: [[28, 0], [82, 0], [55, 80]], body: c => L(28, 0, 28, 16) + L(82, 0, 82, 16) + lampAt(28, 30, 14, c.lit) + lampAt(82, 30, 14, c.lit) + L(28, 44, 28, 62) + L(82, 44, 82, 62) + L(28, 62, 82, 62) + L(55, 62, 55, 80) }
  if (HYD.has(id) || MECH.has(id) || PUSH.has(id) || PLAIN.has(id)) return { w: 96, h: 64, pts: [[0, 34], [96, 34]], body: c => {
    const on = c.on, act = PUSH.has(id) ? (on ? L(45, 8, 45, 30) + L(34, 8, 56, 8) : L(45, 0, 45, 20) + L(34, 0, 56, 0))
      : HYD.has(id) ? L(45, 24, 45, 44, 'stroke-dasharray="3 3"') + `<circle cx="45" cy="52" r="8"/>` + T(45, 56, 'P', 10)
      : MECH.has(id) ? L(45, 24, 45, 40, 'stroke-dasharray="3 3"') + `<path d="M37 52h16l-8-12z"/>` : ''
    return L(0, 34, 22, 34) + dot(22, 34) + dot(74, 34) + L(74, 34, 96, 34) + (on ? L(22, 34, 74, 34, 'stroke-width="3"') : L(22, 34, 68, 12, 'stroke-width="3"')) + act } }
  if (id === 'relay' || id === 'starterrelay') return { w: 130, h: 110, pts: [[100, 0], [100, 110], [35, 0], [35, 110]], body: c => L(35, 0, 35, 28) + `<rect x="15" y="28" width="40" height="54"/>` + L(15, 82, 55, 28) + L(35, 82, 35, 110) + L(100, 0, 100, 34) + dot(100, 34) + dot(100, 80) + L(100, 80, 100, 110) + (c.on ? L(100, 34, 100, 80, 'stroke-width="3"') : L(100, 34, 88, 72, 'stroke-width="3"')) + L(55, 55, 88, 55, 'stroke-dasharray="4 3"') }
  if (id === 'relay5') return { w: 140, h: 110, pts: [[105, 0], [125, 110], [85, 110], [35, 0], [35, 110]], body: c => L(35, 0, 35, 28) + `<rect x="15" y="28" width="40" height="54"/>` + L(15, 82, 55, 28) + L(35, 82, 35, 110) + L(105, 0, 105, 34) + dot(105, 34) + dot(125, 80) + dot(85, 80) + L(125, 80, 125, 110) + L(85, 80, 85, 110) + L(105, 34, c.on ? 125 : 85, 80, 'stroke-width="3"') + L(55, 55, 95, 55, 'stroke-dasharray="4 3"') }
  if (MOTOR.has(id)) return { w: 84, h: 92, pts: [[42, 0], [42, 92]], body: c => L(42, 0, 42, 20) + (c.run ? `<circle cx="42" cy="46" r="26" fill="#43a047" fill-opacity=".45" stroke="none"/>` : '') + `<circle cx="42" cy="46" r="26"/>` + T(42, 52, id === 'starter' ? 'ST' : 'M', 16) + L(42, 72, 42, 92) }
  if (id === 'alternator') return { w: 90, h: 92, pts: [[42, 0], [42, 92], [90, 46]], body: () => L(42, 0, 42, 20) + `<circle cx="42" cy="46" r="26"/>` + T(42, 52, 'G', 16) + L(42, 72, 42, 92) + L(68, 46, 90, 46) }
  if (id === 'coil') return { w: 100, h: 90, pts: [[28, 0], [28, 90], [72, 0]], body: () => L(28, 0, 28, 14) + [0, 1, 2, 3].map(i => `<path d="M28 ${14 + i * 15} a7 7 0 0 1 0 15"/>`).join('') + L(28, 74, 28, 90) + L(72, 0, 72, 14) + [0, 1, 2, 3, 4].map(i => `<path d="M72 ${14 + i * 12} a6 6 0 0 1 0 12"/>`).join('') + L(50, 10, 50, 78, 'stroke-dasharray="3 3"') }
  if (id === 'diode') return { w: 80, h: 50, pts: [[0, 25], [80, 25]], body: () => L(0, 25, 25, 25) + '<path d="M25 8L25 42L55 25Z"/>' + L(55, 8, 55, 42) + L(55, 25, 80, 25) }
  if (id === 'resistor') return { w: 90, h: 40, pts: [[0, 20], [90, 20]], body: () => L(0, 20, 22, 20) + '<rect x="22" y="12" width="46" height="16"/>' + L(68, 20, 90, 20) }
  if (id === 'capacitor') return { w: 80, h: 50, pts: [[0, 25], [80, 25]], body: () => L(0, 25, 34, 25) + L(34, 8, 34, 42) + L(46, 8, 46, 42) + L(46, 25, 80, 25) }
  if (id === 'junction') return { w: 30, h: 30, pts: [[15, 0], [30, 15], [15, 30], [0, 15]], body: () => `<circle cx="15" cy="15" r="5.5" fill="currentColor"/>` }
  const sel = SELECTORS[id]
  if (sel) { const n = d.pins.length - 1, h = Math.max(70, n * 30 + 20), ys = Array.from({ length: n }, (_, i) => n === 1 ? h / 2 : 20 + i * (h - 40) / (n - 1))
    return { w: 120, h, pts: [[0, h / 2], ...ys.map(y => [120, y] as [number, number])], body: () => {
      const pos = sel[String(d.position)] ?? Object.values(sel)[0]; const used = pos.pins.map(p => +p.slice(1) - 1)
      return L(0, h / 2, 24, h / 2) + dot(24, h / 2) + ys.map(y => L(96, y, 120, y) + dot(96, y)).join('') +
        (used.length ? used.map(i => L(24, h / 2, 96, ys[i], 'stroke-width="3"')).join('') : L(24, h / 2, 80, h / 2 - 24, 'stroke-width="3"')) } } }
  return null
}
function generic(d: CompData): Sym & { names: boolean } {
  const lp = d.pins.filter(p => p.side === 'left'), rp = d.pins.filter(p => p.side === 'right'), rows = Math.max(lp.length, rp.length, 1)
  const w = 160, h = Math.max(64, 28 + rows * 22); const pts: [number, number][] = d.pins.map(p => { const list = p.side === 'left' ? lp : rp; return [p.side === 'left' ? 0 : w, 24 + list.indexOf(p) * 22] })
  const body = () => `<rect x="0" y="0" width="${w}" height="${h}" rx="4"/>` + d.pins.map((p, i) => { const [x, y] = pts[i], nm = esc(p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name)
    return `<text x="${x === 0 ? 9 : w - 9}" y="${y + 3}" font-size="9" fill="currentColor" stroke="none" text-anchor="${x === 0 ? 'start' : 'end'}" opacity=".75" font-family="system-ui">${nm}</text>` }).join('')
  return { w, h, pts, body, names: true }
}
const side = (x: number, y: number, w: number, h: number): Pos => { const d = { left: x, right: w - x, top: y, bottom: h - y }; return (Object.entries(d).sort((a, b) => a[1] - b[1])[0][0]) as Pos }
export function resolve(d: CompData): Layout {
  const sp = specific(d); const g = sp ? null : generic(d); const s = (sp ?? g)!; const pins = new Map<string, PinLay>(); let extra = 0
  d.pins.forEach((p, i) => {
    let pt: [number, number]
    if (typeof p.x === 'number' && typeof p.y === 'number') pt = [p.x, p.y]
    else if (g) pt = s.pts[i]
    else { const m = /^p(\d+)$/.exec(p.id); pt = m && +m[1] < s.pts.length ? s.pts[+m[1]] : [s.w, 12 + 18 * extra++] }
    const [x, y] = pt, pos = side(x, y, s.w, s.h)
    const lab = g ? (x === 0 ? { lx: -8, ly: y + 4, anchor: 'end' as const } : { lx: s.w + 8, ly: y + 4, anchor: 'start' as const })
      : pos === 'left' ? { lx: x + 8, ly: y - 6, anchor: 'start' as const } : pos === 'right' ? { lx: x - 8, ly: y - 6, anchor: 'end' as const }
      : pos === 'top' ? { lx: x + 6, ly: y + 13, anchor: 'start' as const } : { lx: x + 6, ly: y - 5, anchor: 'start' as const }
    pins.set(p.id, { x, y, pos, ...lab })
  })
  return { w: s.w, h: s.h, body: s.body, pins, outside: !!g }
}
