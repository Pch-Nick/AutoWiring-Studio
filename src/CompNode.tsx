import { useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CompData } from './types'
import { SimCtx } from './simctx'
import { LAMPS, MOTORS, MOMENTARY, SELECTORS } from './sim'
import { resolve } from './symbols'
import { useStore } from './store'
export const fmtI = (i: number) => (i < 1 ? `${(i * 1000).toFixed(0)} мА` : `${i.toFixed(1)} А`)
const POS = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom }
export default function CompNode({ id, data, selected }: NodeProps) {
  const d = data as CompData; const sim = useContext(SimCtx); const patch = useStore(s => s.patchNode); const ctl = useStore(s => s.ctl)
  const r = sim?.comp.get(id); const lay = resolve(d)
  const lit = r && LAMPS.has(d.libId) ? r.lit : 0; const run = !!r && MOTORS.has(d.libId) && r.i > 0.5
  const on = d.switchState === 'closed' || r?.state === 'контакты замкнуты'
  const sel = SELECTORS[d.libId]; const interactive = !!sim && (!!d.switchState || !!sel)
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
    if (d.switchState) ctl(id, { switchState: MOMENTARY.has(d.libId) ? 'closed' : d.switchState === 'closed' ? 'open' : 'closed' })
    else if (sel) { const keys = Object.keys(sel); ctl(id, { position: keys[(keys.indexOf(d.position ?? keys[0]) + 1) % keys.length] }) }
  }
  const up = () => { if (d.switchState && MOMENTARY.has(d.libId)) ctl(id, { switchState: 'open' }); if (d.libId === 'ignswitch' && d.position === 'start') ctl(id, { position: 'on' }) }
  return (
    <div className={'gnode' + (selected ? ' sel' : '')}>
      <div className="gbox" style={{ width: lay.w, height: lay.h }}>
        <svg width={lay.w} height={lay.h} viewBox={`0 0 ${lay.w} ${lay.h}`} style={{ overflow: 'visible' }}>
          <g className="sym" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: lay.body({ d, on, lit, run, state: r?.state }) }} />
          {interactive && <rect x={-4} y={-4} width={lay.w + 8} height={lay.h + 8} fill="transparent" className="ctl nodrag" onPointerDown={down} onPointerUp={up} onPointerCancel={up}><title>{MOMENTARY.has(d.libId) ? 'Нажмите и держите' : sel ? 'Клик — следующее положение' : 'Клик — переключить'}</title></rect>}
          {d.pins.map(p => { const l = lay.pins.get(p.id)!; const v = sim?.pinV.get(`${id}:${p.id}`)
            return <text key={p.id} x={l.lx} y={l.ly} textAnchor={l.anchor} className="pn"><tspan className={'pnum fn-' + p.fn}>{p.number}</tspan>{sim && <tspan className="pvt" dx={4}>{(v ?? 0).toFixed(1)}В</tspan>}</text> })}
        </svg>
        {d.pins.map(p => { const l = lay.pins.get(p.id)!
          return <Handle key={p.id} id={p.id} type="source" position={POS[l.pos]} title={`${p.number} — ${p.name} (${p.fn === 'pwr' ? 'питание' : p.fn === 'gnd' ? 'масса' : 'сигнал'})`}
            className={'h-' + p.fn} style={{ left: l.x, top: l.y, right: 'auto', bottom: 'auto', transform: 'translate(-50%,-50%)' }} /> })}
      </div>
      <div className="gcap">
        <b>{d.name}</b>
        {d.switchState && <button className="sw nodrag" title="Переключить" onClick={e => { e.stopPropagation(); patch(id, { switchState: d.switchState === 'closed' ? 'open' : 'closed' }) }}>{d.switchState === 'closed' ? 'замкнут' : 'разомкнут'}</button>}
        {sim && r && (r.i > 0.001 || r.state) && <div className="simline">{r.v > 0.05 && `${r.v.toFixed(1)} В · `}{fmtI(r.i)}{r.p > 0.5 && ` · ${r.p.toFixed(0)} Вт`}{lit > 0.05 && ` · свет ${Math.round(Math.min(lit, 1) * 100)}%`}{r.state && ` · ${r.state}`}</div>}
      </div>
    </div>)
}
