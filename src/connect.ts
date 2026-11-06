import type { Edge, Node } from '@xyflow/react'
import type { CompData } from './types'
import { PASS } from './sim'
export type Conn = { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }
export type CheckResult = { ok: true } | { ok: false; reason: string }
const no = (reason: string): CheckResult => ({ ok: false, reason })

/** Правила подключения. Проверяются при наведении на контакт, при создании провода и в тестах. */
export function checkConnection(nodes: Node[], edges: Edge[], c: Conn): CheckResult {
  if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) return no('Провод нужно подключать к контактам.')
  if (c.source === c.target && c.sourceHandle === c.targetHandle) return no('Нельзя соединить контакт с самим собой.')
  const byId = new Map(nodes.map(n => [n.id, n]))
  const pin = (id: string, h: string) => (byId.get(id)?.data as CompData | undefined)?.pins.find(p => p.id === h)
  const a = pin(c.source, c.sourceHandle), b = pin(c.target, c.targetHandle)
  if (!a || !b) return no('Контакт не существует.')
  const ka = `${c.source}:${c.sourceHandle}`, kb = `${c.target}:${c.targetHandle}`
  if (edges.some(e => { const x = `${e.source}:${e.sourceHandle}`, y = `${e.target}:${e.targetHandle}`; return (x === ka && y === kb) || (x === kb && y === ka) }))
    return no('Эти контакты уже соединены проводом.')
  // цепи (сети) с учётом шин, разветвителей, точек соединения и массы
  const par = new Map<string, string>()
  const find = (x: string): string => { const p = par.get(x) ?? x; if (p === x) return x; const r = find(p); par.set(x, r); return r }
  const union = (x: string, y: string) => par.set(find(x), find(y))
  for (const e of edges) union(`${e.source}:${e.sourceHandle}`, `${e.target}:${e.targetHandle}`)
  for (const n of nodes) { const d = n.data as CompData
    if (PASS.has(d.libId)) for (const p of d.pins.slice(1)) union(`${n.id}:${d.pins[0].id}`, `${n.id}:${p.id}`)
    if (d.libId === 'ground') union('GND', `${n.id}:p0`) }
  const ra = find(ka), rb = find(kb)
  if (ra === rb) return no('Контакты уже соединены в одну цепь — провод ничего не добавит.')
  const fns = (root: string) => { const s = new Set<string>(); for (const n of nodes) for (const p of (n.data as CompData).pins) if (find(`${n.id}:${p.id}`) === root) s.add(p.fn); return s }
  const fa = fns(ra), fb = fns(rb)
  if ((fa.has('pwr') && fb.has('gnd')) || (fa.has('gnd') && fb.has('pwr')))
    return no('Это замкнёт питание на массу (короткое замыкание). Между «+» и массой должна быть нагрузка.')
  return { ok: true }
}
