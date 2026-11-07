import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { LIBRARY, makeData } from './library'
import { validate } from './validation'
import { simulate } from './sim'
import type { CompData } from './types'
const mk = (id: string, lib: string, o: Partial<CompData> = {}): Node => ({ id, position: { x: 0, y: 0 }, data: { ...makeData(LIBRARY.find(l => l.id === lib)!), ...o } })
const w = (s: string, sh: string, t: string, th: string): Edge => ({ id: s + sh + t + th, source: s, sourceHandle: sh, target: t, targetHandle: th })
const lamp = (c: { nodes: Node[]; edges: Edge[] }) => simulate(c.nodes, c.edges).comp.get('l')!
describe('brake circuit', () => {
  const build = (f: 'open' | 'closed', r: 'open' | 'closed') => ({
    nodes: [mk('b', 'battery'), mk('g', 'ground'), mk('f', 'hydfront', { switchState: f }), mk('r', 'hydrear', { switchState: r }), mk('j', 'junction'), mk('l', 'brakelamp')],
    edges: [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'f', 'p0'), w('b', 'p0', 'r', 'p0'), w('f', 'p1', 'j', 'p0'), w('r', 'p1', 'j', 'p1'), w('j', 'p2', 'l', 'p0'), w('l', 'p1', 'g', 'p0')] })
  it('off when both open', () => expect(lamp(build('open', 'open')).lit).toBeLessThan(0.001))
  it('on when front closed', () => expect(lamp(build('closed', 'open')).lit).toBeGreaterThan(0.9))
  it('on when rear closed', () => expect(lamp(build('open', 'closed')).lit).toBeGreaterThan(0.9))
  it('off without ground return', () => { const c = build('closed', 'closed'); c.edges.pop(); expect(lamp(c).lit).toBeLessThan(0.001) })
})
describe('simulation', () => {
  it('battery 12V / 6.9 ohm lamp ≈ 1.7 A', () => { const r = simulate([mk('b', 'battery'), mk('l', 'brakelamp')], [w('b', 'p0', 'l', 'p0'), w('b', 'p1', 'l', 'p1')]); expect(r.comp.get('l')!.i).toBeCloseTo(1.73, 1) })
  it('relay closes from coil and powers the load', () => {
    const n = [mk('b', 'battery'), mk('btn', 'startbtn', { switchState: 'closed' }), mk('rl', 'starterrelay'), mk('s', 'starter'), mk('g', 'ground')]
    const e = [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'btn', 'p0'), w('btn', 'p1', 'rl', 'p2'), w('rl', 'p3', 'g', 'p0'), w('b', 'p0', 'rl', 'p0'), w('rl', 'p1', 's', 'p0'), w('s', 'p1', 'g', 'p0')]
    const r = simulate(n, e); expect(r.closed.has('rl')).toBe(true); expect(r.comp.get('s')!.i).toBeGreaterThan(50)
    n[1] = mk('btn', 'startbtn', { switchState: 'open' }); expect(simulate(n, e).comp.get('s')!.i).toBeLessThan(0.01) })
  it('fuse blows on short and is reported', () => {
    const n = [mk('b', 'battery'), mk('f', 'fuse'), mk('g', 'ground')]
    const r = simulate(n, [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'f', 'p0'), w('f', 'p1', 'g', 'p0')])
    expect(r.blown.has('f')).toBe(true); expect(r.issues.some(i => i.title.includes('перегорел'))).toBe(true) })
  it('short without fuse is an error', () => { const r = simulate([mk('b', 'battery'), mk('sw', 'mainswitch')], [w('b', 'p0', 'sw', 'p0'), w('sw', 'p1', 'b', 'p1')]); expect(r.issues.some(i => i.level === 'error')).toBe(true) })
})
describe('validation', () => {
  it('flags + to GND short', () => expect(validate([mk('b', 'battery')], [w('b', 'p0', 'b', 'p1')]).some(x => x.level === 'error')).toBe(true))
})
import { checkConnection } from './connect'
describe('connection rules', () => {
  const n = () => [mk('b', 'battery'), mk('g', 'ground'), mk('l', 'brakelamp'), mk('f', 'fuse'), mk('j', 'junction')]
  const c = (s: string, sh: string, t: string, th: string) => ({ source: s, sourceHandle: sh, target: t, targetHandle: th })
  it('allows + to fuse', () => expect(checkConnection(n(), [], c('b', 'p0', 'f', 'p0')).ok).toBe(true))
  it('blocks battery + to −', () => expect(checkConnection(n(), [], c('b', 'p0', 'b', 'p1')).ok).toBe(false))
  it('blocks + to ground symbol', () => expect(checkConnection(n(), [], c('b', 'p0', 'g', 'p0')).ok).toBe(false))
  it('blocks self pin and duplicates', () => {
    expect(checkConnection(n(), [], c('f', 'p0', 'f', 'p0')).ok).toBe(false)
    expect(checkConnection(n(), [w('b', 'p0', 'f', 'p0')], c('f', 'p0', 'b', 'p0')).ok).toBe(false) })
  it('blocks net-level short through junction', () => {
    const e = [w('b', 'p1', 'j', 'p0'), w('g', 'p0', 'j', 'p1')]
    expect(checkConnection(n(), e, c('b', 'p0', 'j', 'p2')).ok).toBe(false) })
  it('blocks redundant wire inside one net', () => expect(checkConnection(n(), [w('b', 'p0', 'f', 'p0'), w('f', 'p0', 'l', 'p0')], c('b', 'p0', 'l', 'p0')).ok).toBe(false))
})
import { resolve } from './symbols'
describe('symbols', () => {
  it('every library item has a layout with finite pin coordinates on its SVG', () => {
    for (const it of LIBRARY) { const d = makeData(it), l = resolve(d)
      expect(l.pins.size, it.id).toBe(d.pins.length)
      for (const p of l.pins.values()) { expect(Number.isFinite(p.x) && Number.isFinite(p.y), it.id).toBe(true); expect(p.x >= 0 && p.x <= l.w && p.y >= 0 && p.y <= l.h, it.id).toBe(true) } } })
  it('pins of one symbol do not overlap (except junction)', () => {
    for (const it of LIBRARY.filter(i => i.id !== 'junction')) { const l = resolve(makeData(it)), seen = new Set<string>()
      for (const p of l.pins.values()) { const k = `${p.x},${p.y}`; expect(seen.has(k), it.id).toBe(false); seen.add(k) } } })
  it('5-pin relay: NC contact conducts when coil is off, NO when on', () => {
    const n = [mk('b', 'battery'), mk('g', 'ground'), mk('r', 'relay5'), mk('l', 'brakelamp'), mk('l2', 'lamplow'), mk('s', 'startbtn', { switchState: 'closed' })]
    const e = [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'r', 'p0'), w('r', 'p2', 'l2', 'p0'), w('l2', 'p1', 'g', 'p0'), w('r', 'p1', 'l', 'p0'), w('l', 'p1', 'g', 'p0'), w('b', 'p0', 's', 'p0'), w('s', 'p1', 'r', 'p3'), w('r', 'p4', 'g', 'p0')]
    const on = simulate(n, e); expect(on.comp.get('l')!.lit).toBeGreaterThan(0.9); expect(on.comp.get('l2')!.lit).toBeLessThan(0.01)
    n[5] = mk('s', 'startbtn', { switchState: 'open' }); const off = simulate(n, e); expect(off.comp.get('l2')!.lit).toBeGreaterThan(0.9); expect(off.comp.get('l')!.lit).toBeLessThan(0.01) })
})
import { roundedPath, insertIndex, snap } from './wirepath'
import { MOMENTARY } from './sim'
describe('wire points', () => {
  const S = { x: 0, y: 0 }, E = { x: 100, y: 100 }
  it('inserts a point into the nearest segment', () => {
    expect(insertIndex(S, [], E, { x: 50, y: 50 })).toBe(0)
    expect(insertIndex(S, [{ x: 100, y: 0 }], E, { x: 100, y: 60 })).toBe(1)
    expect(insertIndex(S, [{ x: 100, y: 0 }], E, { x: 40, y: 0 })).toBe(0) })
  it('builds a path through all points and snaps to grid', () => {
    const d = roundedPath([S, { x: 100, y: 0 }, E]); expect(d.startsWith('M0 0')).toBe(true); expect(d.endsWith('L100 100')).toBe(true); expect(d).toContain('Q100 0')
    expect(snap(22)).toBe(15); expect(snap(23)).toBe(30) })
  it('brake switches and buttons are momentary, kill switch latches', () => {
    for (const id of ['startbtn', 'hydfront', 'hydrear', 'brakepedal', 'brakelever']) expect(MOMENTARY.has(id)).toBe(true)
    expect(MOMENTARY.has('killswitch')).toBe(false) })
})
describe('polarity and flasher', () => {
  const base = () => [mk('b', 'battery'), mk('g', 'ground')]
  it('ECU wired correctly works, reversed does not and is reported', () => {
    const ok = simulate([...base(), mk('e', 'ecu')], [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'e', 'p0'), w('b', 'p1', 'e', 'p1')])
    expect(ok.comp.get('e')!.i).toBeGreaterThan(0.1)
    const bad = simulate([...base(), mk('e', 'ecu')], [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'e', 'p1'), w('b', 'p1', 'e', 'p0')])
    expect(bad.comp.get('e')!.i).toBeLessThan(0.001); expect(bad.issues.some(i => i.title === 'Обратная полярность' && i.level === 'error')).toBe(true) })
  it('polarity follows the pin types the user set', () => {
    const n = [...base(), mk('e', 'ecu')]; const d = n[2].data as CompData; d.pins[0].fn = 'gnd'; d.pins[1].fn = 'pwr' // поменяли плюс/минус местами
    const r = simulate(n, [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'e', 'p1'), w('b', 'p1', 'e', 'p0')]); expect(r.comp.get('e')!.i).toBeGreaterThan(0.1) })
  it('reversed starter motor is flagged', () => {
    const r = simulate([...base(), mk('s', 'starter')], [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 's', 'p1'), w('b', 'p1', 's', 'p0')])
    expect(r.issues.some(i => i.title === 'Обратная полярность')).toBe(true) })
  it('lamp with + but no ground is reported', () => {
    const r = simulate([...base(), mk('l', 'lamplow')], [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'l', 'p0')]); expect(r.comp.get('l')!.state).toBe('нет массы') })
  const fl = (lib: string, withGnd = true) => { const n = [...base(), mk('f', lib), mk('l', 'turnfl')]
    const e = [w('b', 'p1', 'g', 'p0'), w('b', 'p0', 'f', 'p0'), w('f', 'p1', 'l', 'p0'), w('l', 'p1', 'g', 'p0')]; if (lib === 'flasher' && withGnd) e.push(w('f', 'p2', 'g', 'p0')); return { n, e } }
  it('3-pin flasher blinks the turn lamp', () => { const { n, e } = fl('flasher')
    expect(simulate(n, e, { t: 0.1 }).comp.get('l')!.lit).toBeGreaterThan(0.9); expect(simulate(n, e, { t: 0.45 }).comp.get('l')!.lit).toBeLessThan(0.01); expect(simulate(n, e, { t: 0.8 }).comp.get('l')!.lit).toBeGreaterThan(0.9) })
  it('2-pin flasher blinks; 3-pin without ground does not work', () => {
    const a = fl('flasher2'); expect(simulate(a.n, a.e, { t: 0.1 }).comp.get('l')!.lit).toBeGreaterThan(0.9); expect(simulate(a.n, a.e, { t: 0.45 }).comp.get('l')!.lit).toBeLessThan(0.01)
    const b = fl('flasher', false); expect(simulate(b.n, b.e, { t: 0.1 }).comp.get('l')!.lit).toBeLessThan(0.01) })
})
