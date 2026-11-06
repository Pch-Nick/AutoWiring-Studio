import { getSmoothStepPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import { useStore } from './store'
import type { WireData } from './types'
import { roundedPath, insertIndex, snap, type Pt } from './wirepath'

export default function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, style, label }: EdgeProps) {
  const rf = useReactFlow(); const commit = useStore(s => s.commit); const setPoints = useStore(s => s.setPoints)
  const pts = ((data as WireData | undefined)?.points ?? []) as Pt[]
  const S = { x: sourceX, y: sourceY }, E = { x: targetX, y: targetY }
  let path: string, lx: number, ly: number
  if (pts.length) { const P = [S, ...pts, E]; path = roundedPath(P); const i = Math.floor((P.length - 1) / 2); lx = (P[i].x + P[i + 1].x) / 2; ly = (P[i].y + P[i + 1].y) / 2 }
  else { [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 }) }
  const toFlow = (ev: { clientX: number; clientY: number }): Pt => { const p = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY }); return { x: snap(p.x), y: snap(p.y) } }
  const drag = (ev: React.PointerEvent, start: Pt[], idx: number) => {
    ev.stopPropagation(); ev.preventDefault(); commit(); let cur = start
    const move = (e: PointerEvent) => { const p = toFlow(e); cur = cur.map((q, i) => i === idx ? p : q); setPoints(id, cur) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const addAt = (p: Pt) => { const i = insertIndex(S, pts, E, p); const next = [...pts.slice(0, i), p, ...pts.slice(i)]; return { next, i } }
  const P = [S, ...pts, E]
  return (<>
    <path className="react-flow__edge-path" d={path} style={style} fill="none" />
    <path className="react-flow__edge-interaction" d={path} fill="none" onDoubleClick={ev => { ev.stopPropagation(); commit(); setPoints(id, addAt(toFlow(ev)).next) }}><title>Двойной клик — добавить точку излома</title></path>
    {label && <text x={lx} y={ly - 6} textAnchor="middle" className="wlabel">{label}</text>}
    {selected && <g className="nodrag nopan" style={{ pointerEvents: 'all' }}>
      {P.slice(0, -1).map((a, i) => { const b = P[i + 1], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        return <circle key={'m' + i} cx={m.x} cy={m.y} r={4} className="wmid" onPointerDown={ev => { const next = [...pts.slice(0, i), { x: snap(m.x), y: snap(m.y) }, ...pts.slice(i)]; setPoints(id, next); drag(ev, next, i) }}><title>Потяните, чтобы создать излом</title></circle> })}
      {pts.map((p, i) => <circle key={'p' + i} cx={p.x} cy={p.y} r={6} className="wpt" onPointerDown={ev => drag(ev, pts, i)}
        onDoubleClick={ev => { ev.stopPropagation(); commit(); setPoints(id, pts.filter((_, j) => j !== i)) }}><title>Потяните — переместить, двойной клик — удалить</title></circle>)}
    </g>}
  </>)
}
