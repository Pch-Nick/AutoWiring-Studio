import type { Edge, Node } from '@xyflow/react'
import type { CompData } from './types'
export interface Issue { level: 'error' | 'warning' | 'info'; title: string; text: string; ids: string[] }
export function validate(nodes: Node[], edges: Edge[]): Issue[] {
  const out: Issue[] = []; const used = new Set<string>(); const seen = new Set<string>()
  const pinOf = (n?: Node, h?: string | null) => (n?.data as CompData | undefined)?.pins.find(p => p.id === h)
  const byId = new Map(nodes.map(n => [n.id, n]))
  for (const e of edges) {
    used.add(`${e.source}:${e.sourceHandle}`); used.add(`${e.target}:${e.targetHandle}`)
    const key = [`${e.source}:${e.sourceHandle}`, `${e.target}:${e.targetHandle}`].sort().join('|')
    if (seen.has(key)) out.push({ level: 'warning', title: 'Дублирующееся соединение', text: 'Два провода соединяют одни и те же контакты.', ids: [e.id] }); seen.add(key)
    const a = pinOf(byId.get(e.source), e.sourceHandle), b = pinOf(byId.get(e.target), e.targetHandle)
    if (e.source === e.target && e.sourceHandle === e.targetHandle) out.push({ level: 'error', title: 'Контакт соединён сам с собой', text: 'Провод начинается и заканчивается на одном контакте.', ids: [e.id] })
    if (a && b && ((a.fn === 'pwr' && b.fn === 'gnd') || (a.fn === 'gnd' && b.fn === 'pwr')))
      out.push({ level: 'error', title: 'Возможное короткое замыкание', text: `Контакт питания напрямую соединён с массой (${a.name} ↔ ${b.name}). Проверьте, нет ли нагрузки между ними.`, ids: [e.id, e.source, e.target] })
  }
  for (const n of nodes) { const d = n.data as CompData
    const free = d.pins.filter(p => !used.has(`${n.id}:${p.id}`))
    if (free.length) out.push({ level: free.length === d.pins.length ? 'info' : 'warning', title: 'Незадействованные контакты', text: `${d.name}: ${free.map(p => p.number).join(', ')}`, ids: [n.id] }) }
  const hasPwr = nodes.some(n => (n.data as CompData).pins.some(p => p.fn === 'pwr'))
  if (hasPwr && !nodes.some(n => ['fuse', 'fusebox'].includes((n.data as CompData).libId)))
    out.push({ level: 'warning', title: 'Нет предохранителя', text: 'В схеме есть цепи питания, но нет предохранителя или блока предохранителей.', ids: [] })
  return out
}
