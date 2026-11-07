import type { Edge, Node } from '@xyflow/react'
import type { CompData } from './types'
import { SWITCHES } from './library'
import type { Issue } from './validation'

export interface CompRes { v: number; i: number; p: number; lit: number; state?: string }
export interface SimResult { pinV: Map<string, number>; comp: Map<string, CompRes>; blown: Set<string>; closed: Set<string>; issues: Issue[]; hasPower: boolean }
type R = { id: string; node: string; a: string; b: string; r: number; fuse?: number }
type V = { node: string; a: string; b: string; v: number }
type St = { blown: Set<string>; closed: Set<string>; diodes: Set<string>; polOff: Set<string>; flash: Set<string> }
type Pol = { id: string; node: string; plus: string; minus: string }
export interface SimOpts { t?: number }
// Электронные потребители, работающие только при правильной полярности (плюс/минус берутся из типа контактов pwr/gnd)
export const POLAR = new Set(['ecu', 'cluster', 'speedo', 'tacho', 'display', 'controller', 'immo', 'gps', 'cdi', 'absEcu', 'absMod', 'usb', 'ledstrip'])
export const FLASH_HALF = 0.35 // с; полупериод мигания ≈ 85 вспышек/мин

// Нагрузки: [контакт A, контакт B, сопротивление, Ом] (≈ при 12 В)
export const LOADS: Record<string, [string, string, number][]> = {
  lamplow: [['p0', 'p1', 2.6]], lamphigh: [['p0', 'p1', 2.6]], brakelamp: [['p0', 'p1', 6.9]],
  turnfl: [['p0', 'p1', 6.9]], turnfr: [['p0', 'p1', 6.9]], turnrl: [['p0', 'p1', 6.9]], turnrr: [['p0', 'p1', 6.9]],
  position: [['p0', 'p1', 29]], platelight: [['p0', 'p1', 29]], ledstrip: [['p0', 'p1', 60]],
  headlight: [['p0', 'p2', 2.6], ['p1', 'p2', 2.6]], taillight: [['p0', 'p2', 29], ['p1', 'p2', 6.9]],
  horn: [['p0', 'p1', 3]], fuelpump: [['p0', 'p1', 3]], motor: [['p0', 'p1', 4]], injector: [['p0', 'p1', 12]],
  starter: [['p0', 'p1', 0.1]], coil: [['p0', 'p1', 4]], usb: [['p0', 'p1', 10]],
  ecu: [['p0', 'p1', 100]], cluster: [['p0', 'p1', 120]], speedo: [['p0', 'p1', 100]], tacho: [['p0', 'p1', 100]],
  display: [['p0', 'p1', 100]], controller: [['p0', 'p1', 100]], immo: [['p0', 'p1', 100]], gps: [['p0', 'p1', 100]],
  cdi: [['p0', 'p1', 100]], absEcu: [['p0', 'p1', 20]], absMod: [['p0', 'p1', 10]],
}
export const RELAYS: Record<string, { coil: [string, string]; no: [string, string]; nc?: [string, string] }> = {
  relay: { coil: ['p2', 'p3'], no: ['p0', 'p1'] }, starterrelay: { coil: ['p2', 'p3'], no: ['p0', 'p1'] },
  relay5: { coil: ['p3', 'p4'], no: ['p0', 'p1'], nc: ['p0', 'p2'] },
}
export const LAMPS = new Set(['lamplow', 'lamphigh', 'brakelamp', 'turnfl', 'turnfr', 'turnrl', 'turnrr', 'position', 'platelight', 'ledstrip', 'headlight', 'taillight'])
export const MOTORS = new Set(['starter', 'motor', 'fuelpump'])
// Кнопки и выключатели без фиксации: замкнуты, пока их держат (в симуляции)
export const MOMENTARY = new Set(['startbtn', 'hornbtn', 'brakelever', 'brakepedal', 'clutchbtn', 'hydfront', 'hydrear', 'mechfront', 'mechrear', 'clutchsw'])
export const PASS = new Set(['junction', 'bus12', 'splitter'])
// Многопозиционные переключатели: положение → контакты, соединяемые с p0
export const SELECTORS: Record<string, Record<string, { label: string; pins: string[] }>> = {
  ignswitch: { off: { label: 'Выкл', pins: [] }, on: { label: 'Зажигание', pins: ['p1', 'p2'] }, start: { label: 'Старт', pins: ['p1', 'p2', 'p3'] } },
  lightsw: { off: { label: 'Выкл', pins: [] }, a: { label: 'Положение 1', pins: ['p1'] }, b: { label: 'Положение 2', pins: ['p2'] } },
  hilosw: { a: { label: 'Ближний', pins: ['p1'] }, b: { label: 'Дальний', pins: ['p2'] } },
  turnsw: { off: { label: 'Выкл', pins: [] }, left: { label: 'Левый', pins: ['p1'] }, right: { label: 'Правый', pins: ['p2'] } },
}
const k = (n: Node, p: string) => `${n.id}:${p}`

function build(nodes: Node[], st: St) {
  const rs: R[] = []; const vs: V[] = []; const pol: Pol[] = []
  for (const n of nodes) {
    const d = n.data as CompData; const id = d.libId
    const add = (a: string, b: string, r: number, rid = n.id, fuse?: number) => rs.push({ id: rid, node: n.id, a: k(n, a), b: k(n, b), r, fuse })
    if (id === 'battery') { vs.push({ node: n.id, a: k(n, 'int'), b: k(n, 'p1'), v: Number(d.value ?? 12) }); rs.push({ id: n.id + '#int', node: n.id, a: k(n, 'p0'), b: k(n, 'int'), r: 0.02 }) }
    for (const [a, b, r] of LOADS[id] ?? []) {
      const pa = d.pins.find(p => p.id === a), pb = d.pins.find(p => p.id === b), eid = n.id + a + b
      const plus = pa?.fn === 'pwr' && pb?.fn === 'gnd' ? a : pa?.fn === 'gnd' && pb?.fn === 'pwr' ? b : null
      if (POLAR.has(id) && plus) { const minus = plus === a ? b : a; pol.push({ id: eid, node: n.id, plus: k(n, plus), minus: k(n, minus) }); if (!st.polOff.has(eid)) add(plus, minus, r, eid) }
      else add(a, b, r, eid)
    }
    if (id === 'flasher' || id === 'flasher2') { if (id === 'flasher') add('p0', 'p2', 600, n.id + '#el'); if (st.flash.has(n.id)) add('p0', 'p1', 0.05, n.id + '#c') }
    if (id === 'resistor') add('p0', 'p1', Math.max(Number(d.value ?? 100), 0.001))
    if (id === 'fuse' && !st.blown.has(n.id)) add('p0', 'p1', 0.005, n.id, Number(d.value ?? 15))
    if (id === 'fusebox') for (const i of [1, 2, 3]) if (!st.blown.has(`${n.id}:${i}`)) add('p0', 'p' + i, 0.005, `${n.id}:${i}`, Number(d.value ?? 15))
    if (SWITCHES.has(id) && d.switchState === 'closed') add('p0', 'p1', 0.005, n.id + '#sw')
    const rl = RELAYS[id]; if (rl) { add(rl.coil[0], rl.coil[1], 80, n.id + '#coil'); if (st.closed.has(n.id)) add(rl.no[0], rl.no[1], 0.005, n.id + '#c'); else if (rl.nc) add(rl.nc[0], rl.nc[1], 0.005, n.id + '#nc') }
    const sel = SELECTORS[id]; if (sel) { const pos = sel[String(d.position)] ?? Object.values(sel)[0]; for (const p of pos.pins) add('p0', p, 0.01, n.id + p) }
    if (id === 'diode' && st.diodes.has(n.id)) add('p0', 'p1', 0.05)
  }
  return { rs, vs, pol }
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-15) continue
    ;[A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let j = c; j < n; j++) A[r][j] -= f * A[c][j]; b[r] -= f * b[c] }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j]; x[r] = Math.abs(A[r][r]) < 1e-15 ? 0 : s / A[r][r] }
  return x
}

function run(nodes: Node[], edges: Edge[], st: St) {
  const par = new Map<string, string>()
  const find = (x: string): string => { let p = par.get(x) ?? x; if (p === x) return x; p = find(p); par.set(x, p); return p }
  const union = (a: string, b: string) => par.set(find(a), find(b))
  for (const e of edges) union(`${e.source}:${e.sourceHandle}`, `${e.target}:${e.targetHandle}`)
  for (const n of nodes) { const d = n.data as CompData
    if (PASS.has(d.libId)) for (const p of d.pins.slice(1)) union(k(n, d.pins[0].id), k(n, p.id))
    if (d.libId === 'ground') union('REF', k(n, 'p0')) }
  const bat = nodes.find(n => (n.data as CompData).libId === 'battery'); if (bat) union('REF', k(bat, 'p1'))
  const { rs, vs, pol } = build(nodes, st)
  const ref = find('REF'); const idx = new Map<string, number>()
  const ix = (key: string) => { const r = find(key); if (r === ref) return -1; if (!idx.has(r)) idx.set(r, idx.size); return idx.get(r)! }
  const rI = rs.map(e => [ix(e.a), ix(e.b)]); const vI = vs.map(e => [ix(e.a), ix(e.b)])
  const n = idx.size, m = vs.length, N = n + m
  const A = Array.from({ length: N }, () => new Array(N).fill(0)); const rhs = new Array(N).fill(0)
  for (let i = 0; i < n; i++) A[i][i] += 1e-9
  rs.forEach((e, j) => { const g = 1 / e.r, [a, b] = rI[j]; if (a >= 0) A[a][a] += g; if (b >= 0) A[b][b] += g; if (a >= 0 && b >= 0) { A[a][b] -= g; A[b][a] -= g } })
  vs.forEach((e, j) => { const [a, b] = vI[j], c = n + j; if (a >= 0) { A[a][c] += 1; A[c][a] += 1 } if (b >= 0) { A[b][c] -= 1; A[c][b] -= 1 } rhs[c] = e.v })
  const x = N ? solveLinear(A, rhs) : []
  const volt = (key: string) => { const r = find(key); if (r === ref) return 0; const i = idx.get(r); return i === undefined ? 0 : x[i] }
  const cur = rs.map((e, j) => { const [a, b] = rI[j]; return ((a >= 0 ? x[a] : 0) - (b >= 0 ? x[b] : 0)) / e.r })
  return { rs, vs, pol, volt, cur, batI: vs.map((_, j) => Math.abs(x[n + j])) }
}

export function simulate(nodes: Node[], edges: Edge[], opts: SimOpts = {}): SimResult {
  const st: St = { blown: new Set(), closed: new Set(), diodes: new Set(), polOff: new Set(), flash: new Set() }
  const phaseOn = Math.floor((opts.t ?? 0) / FLASH_HALF) % 2 === 0
  let out = run(nodes, edges, st)
  for (let it = 0; it < 30; it++) {
    let ch = false
    out.rs.forEach((e, j) => { if (e.fuse && Math.abs(out.cur[j]) > e.fuse && !st.blown.has(e.id)) { st.blown.add(e.id); ch = true } })
    for (const n of nodes) { const d = n.data as CompData
      const rl = RELAYS[d.libId]; if (rl) { const ci = Math.abs(out.volt(k(n, rl.coil[0])) - out.volt(k(n, rl.coil[1]))) / 80
        const want = ci > (st.closed.has(n.id) ? 0.03 : 0.05); if (want !== st.closed.has(n.id)) { want ? st.closed.add(n.id) : st.closed.delete(n.id); ch = true } }
      if (d.libId === 'flasher' || d.libId === 'flasher2') { const pw = d.libId === 'flasher' ? out.volt(k(n, 'p0')) - out.volt(k(n, 'p2')) : out.volt(k(n, 'p0'))
        const want = pw > 6 && phaseOn; if (want !== st.flash.has(n.id)) { want ? st.flash.add(n.id) : st.flash.delete(n.id); ch = true } }
      if (d.libId === 'diode') { const vd = out.volt(k(n, 'p0')) - out.volt(k(n, 'p1')); const want = vd > (st.diodes.has(n.id) ? -0.001 : 0.3)
        if (want !== st.diodes.has(n.id)) { want ? st.diodes.add(n.id) : st.diodes.delete(n.id); ch = true } } }
    for (const q of out.pol) { const dv = out.volt(q.plus) - out.volt(q.minus), off = st.polOff.has(q.id)
      if (!off && dv < -0.05) { st.polOff.add(q.id); ch = true } else if (off && dv > 0.3) { st.polOff.delete(q.id); ch = true } }
    if (!ch) break
    out = run(nodes, edges, st)
  }
  const pinV = new Map<string, number>(); const comp = new Map<string, CompRes>(); const issues: Issue[] = []
  for (const n of nodes) { for (const p of (n.data as CompData).pins) pinV.set(k(n, p.id), out.volt(k(n, p.id))); comp.set(n.id, { v: 0, i: 0, p: 0, lit: 0 }) }
  out.rs.forEach((e, j) => { const c = comp.get(e.node)!; const dv = Math.abs(out.volt(e.a) - out.volt(e.b)), i = Math.abs(out.cur[j])
    c.i = Math.max(c.i, i); c.p += dv * i; if (e.r >= 0.05 && !e.id.endsWith('#int')) c.v = Math.max(c.v, dv) })
  out.vs.forEach((e, j) => { const c = comp.get(e.node)!; c.i = out.batI[j]; c.v = Math.abs(out.volt(k({ id: e.node } as Node, 'p0')) - out.volt(k({ id: e.node } as Node, 'p1')))
    if (out.batI[j] > 150) issues.push({ level: 'error', title: 'Короткое замыкание', text: `Ток аккумулятора ≈ ${out.batI[j].toFixed(0)} А. Проверьте цепь питания и предохранители.`, ids: [e.node] }) })
  for (const n of nodes) { const d = n.data as CompData, c = comp.get(n.id)!
    if (LAMPS.has(d.libId)) c.lit = Math.min(1.3, (c.v / 12) ** 2)
    if (RELAYS[d.libId]) c.state = st.closed.has(n.id) ? 'контакты замкнуты' : 'контакты разомкнуты'
    const bl = [...st.blown].filter(b => b === n.id || b.startsWith(n.id + ':')); if (bl.length) { c.state = 'перегорел'
      issues.push({ level: 'warning', title: 'Предохранитель перегорел', text: `${d.name}: ток превысил ${d.value ?? 15} А. Найдите причину перегрузки до замены.`, ids: [n.id] }) } }
  // Диагностика по полярности и подключению: плюс/минус определяются по типу контактов (pwr/gnd)
  for (const n of nodes) { const d = n.data as CompData, pair = LOADS[d.libId]?.[0]; if (!pair) continue
    const pa = d.pins.find(p => p.id === pair[0]), pb = d.pins.find(p => p.id === pair[1]); if (!pa || !pb) continue
    const [pp, pm] = pa.fn === 'pwr' && pb.fn === 'gnd' ? [pa, pb] : pa.fn === 'gnd' && pb.fn === 'pwr' ? [pb, pa] : [null, null]; if (!pp || !pm) continue
    const vp = pinV.get(k(n, pp.id)) ?? 0, vm = pinV.get(k(n, pm.id)) ?? 0, c = comp.get(n.id)!
    if ((POLAR.has(d.libId) || MOTORS.has(d.libId)) && vm - vp > 3) { c.state = 'обратная полярность'
      issues.push({ level: POLAR.has(d.libId) ? 'error' : 'warning', title: 'Обратная полярность', text: POLAR.has(d.libId) ? `${d.name}: «${pp.number}» (плюс) на минусе, «${pm.number}» (минус) на плюсе. Электроника не работает и может выйти из строя.` : `${d.name}: полярность перепутана — мотор вращается в обратную сторону.`, ids: [n.id] }) }
    else if (vp >= 6 && vm >= 6 && Math.abs(vp - vm) < 0.5) { c.state = 'нет массы'
      issues.push({ level: 'warning', title: 'Нет массы', text: `${d.name}: на контакте «${pp.number}» есть напряжение, но «${pm.number}» (минус) не соединён с массой.`, ids: [n.id] }) } }
  for (const n of nodes) { const d = n.data as CompData; if (d.libId === 'flasher' || d.libId === 'flasher2') comp.get(n.id)!.state = st.flash.has(n.id) ? 'контакты замкнуты' : 'контакты разомкнуты' }
  const hasPower = nodes.some(n => (n.data as CompData).libId === 'battery')
  if (!hasPower) issues.push({ level: 'info', title: 'Нет источника питания', text: 'Добавьте аккумулятор, чтобы запустить симуляцию.', ids: [] })
  return { pinV, comp, blown: st.blown, closed: st.closed, issues, hasPower }
}
