import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react'
import type { CompData, WireData, ProjectFile } from './types'
import { ProjectSchema } from './types'
import { makeData, type LibItem } from './library'
import { dbPut, dbGet } from './storage'
import { checkConnection } from './connect'
type Snap = { nodes: Node[]; edges: Edge[] }
const uid = () => crypto.randomUUID().slice(0, 8)
const clone = <T,>(x: T): T => structuredClone(x)
export const toWire = (e: Edge): Edge => ({ ...e, type: 'wire', style: { stroke: (e.data as WireData).color, strokeWidth: (e.data as WireData).width ?? 2, strokeDasharray: (e.data as WireData).dashed ? '6 4' : undefined }, label: (e.data as WireData).label })
interface S {
  id: string; name: string; createdAt: string; vehicleType: string
  nodes: Node[]; edges: Edge[]; past: Snap[]; future: Snap[]; clip: Snap | null; saved: boolean
  custom: LibItem[]; favs: string[]; theme: 'dark' | 'light'; simOn: boolean; toggleSim(): void
  commit(): void; ctl(id: string, p: Partial<CompData>): void; setPoints(id: string, pts: { x: number; y: number }[]): void; undo(): void; redo(): void
  onNodesChange(c: NodeChange[]): void; onEdgesChange(c: EdgeChange[]): void
  connect(c: Connection): string | null; removePin(nid: string, pid: string): void; addComp(item: LibItem, pos: { x: number; y: number }): void
  patchNode(id: string, p: Partial<CompData>): void; patchEdge(id: string, p: Partial<WireData>): void
  copy(): void; paste(): void; rename(n: string): void; newProject(): void
  toFile(): ProjectFile; load(f: ProjectFile): void; save(): Promise<void>; restore(): Promise<void>
  addCustom(i: LibItem): void; toggleFav(id: string): void; toggleTheme(): void
}
export const useStore = create<S>((set, get) => ({
  id: uid(), name: 'Новый проект', createdAt: new Date().toISOString(), vehicleType: 'Мотоцикл',
  nodes: [], edges: [], past: [], future: [], clip: null, saved: true,
  custom: JSON.parse(localStorage.getItem('aw-custom') || '[]'), favs: JSON.parse(localStorage.getItem('aw-favs') || '[]'),
  theme: (localStorage.getItem('aw-theme') as 'dark' | 'light') || 'dark',
  ctl: (id, p) => set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...p } } : n), saved: false })),
  setPoints: (id, pts) => set(s => ({ edges: s.edges.map(e => e.id === id ? toWire({ ...e, data: { ...e.data, points: pts } }) : e), saved: false })),
  commit: () => set(s => ({ past: [...s.past.slice(-99), clone({ nodes: s.nodes, edges: s.edges })], future: [], saved: false })),
  undo: () => set(s => { const p = s.past.at(-1); if (!p) return s
    return { nodes: p.nodes, edges: p.edges, past: s.past.slice(0, -1), future: [...s.future, clone({ nodes: s.nodes, edges: s.edges })], saved: false } }),
  redo: () => set(s => { const f = s.future.at(-1); if (!f) return s
    return { nodes: f.nodes, edges: f.edges, future: s.future.slice(0, -1), past: [...s.past, clone({ nodes: s.nodes, edges: s.edges })], saved: false } }),
  onNodesChange: c => set(s => ({ nodes: applyNodeChanges(c, s.nodes), saved: s.saved && c.every(x => x.type === 'select' || x.type === 'dimensions') })),
  onEdgesChange: c => set(s => ({ edges: applyEdgeChanges(c, s.edges) })),
  removePin: (nid, pid) => { get().commit(); set(s => ({
    nodes: s.nodes.map(n => n.id === nid ? { ...n, data: { ...n.data, pins: (n.data as CompData).pins.filter(p => p.id !== pid) } } : n),
    edges: s.edges.filter(e => !((e.source === nid && e.sourceHandle === pid) || (e.target === nid && e.targetHandle === pid))) })) },
  connect: c => { const r = checkConnection(get().nodes, get().edges, c); if (!r.ok) return r.reason
    get().commit(); set(s => ({ edges: [...s.edges, toWire({ id: 'w' + uid(), source: c.source!, target: c.target!, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle, data: { color: '#e53935' } as WireData })] })); return null },
  addComp: (item, pos) => { get().commit(); set(s => ({ nodes: [...s.nodes, { id: 'c' + uid(), type: 'comp', position: pos, data: makeData(item) }] })) },
  patchNode: (id, p) => { get().commit(); set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...p } } : n) })) },
  patchEdge: (id, p) => { get().commit(); set(s => ({ edges: s.edges.map(e => e.id === id ? toWire({ ...e, data: { ...e.data, ...p } }) : e) })) },
  copy: () => { const s = get(); const ns = s.nodes.filter(n => n.selected); const ids = new Set(ns.map(n => n.id))
    set({ clip: clone({ nodes: ns, edges: s.edges.filter(e => ids.has(e.source) && ids.has(e.target)) }) }) },
  paste: () => { const c = get().clip; if (!c || !c.nodes.length) return; get().commit()
    const m = new Map(c.nodes.map(n => [n.id, 'c' + uid()]))
    const nn = c.nodes.map(n => ({ ...clone(n), id: m.get(n.id)!, selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 } }))
    const ee = c.edges.map(e => ({ ...clone(e), id: 'w' + uid(), source: m.get(e.source)!, target: m.get(e.target)! }))
    set(s => ({ nodes: [...s.nodes.map(n => ({ ...n, selected: false })), ...nn], edges: [...s.edges, ...ee] })) },
  rename: name => set({ name, saved: false }),
  newProject: () => set({ id: uid(), name: 'Новый проект', createdAt: new Date().toISOString(), nodes: [], edges: [], past: [], future: [], saved: false }),
  toFile: () => { const s = get(); return { version: 1, id: s.id, name: s.name, vehicleType: s.vehicleType, createdAt: s.createdAt, updatedAt: new Date().toISOString(),
    components: s.nodes.map(n => ({ id: n.id, position: n.position, data: n.data })),
    wires: s.edges.map(e => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle, data: e.data })) } },
  load: f => set({ id: f.id, name: f.name, createdAt: f.createdAt, vehicleType: f.vehicleType ?? '', past: [], future: [], saved: true,
    nodes: f.components.map(c => ({ id: c.id, type: 'comp', position: c.position, data: c.data })),
    edges: f.wires.map(w => toWire({ id: w.id, source: w.source, target: w.target, sourceHandle: w.sourceHandle, targetHandle: w.targetHandle, data: w.data })) }),
  save: async () => { await dbPut('current', get().toFile()); set({ saved: true }) },
  restore: async () => { const f = await dbGet<unknown>('current'); const r = ProjectSchema.safeParse(f); if (r.success) get().load(r.data) },
  addCustom: i => { const c = [...get().custom, i]; localStorage.setItem('aw-custom', JSON.stringify(c)); set({ custom: c }) },
  toggleFav: id => { const f = get().favs.includes(id) ? get().favs.filter(x => x !== id) : [...get().favs, id]; localStorage.setItem('aw-favs', JSON.stringify(f)); set({ favs: f }) },
  simOn: false, toggleSim: () => set(s => ({ simOn: !s.simOn })),
  toggleTheme: () => { const t = get().theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('aw-theme', t); set({ theme: t }) },
}))
