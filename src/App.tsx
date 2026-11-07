import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ReactFlow, Background, Controls, MiniMap, ConnectionMode, useReactFlow, type Node } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'
import { Undo2, Redo2, Save, FilePlus, Download, Upload, Sun, Moon, Search, Star, Plus, AlertTriangle, XCircle, Info, Zap, Image as Img } from 'lucide-react'
import { useStore, toWire } from './store'
import { LIBRARY, CATEGORIES, makeData, domainOf, type LibItem, type Domain } from './library'
import { resolve } from './symbols'
import { ProjectSchema, type CompData, type WireData } from './types'
import { validate } from './validation'
import { simulate, SELECTORS, type SimResult } from './sim'
import { SimCtx } from './simctx'
import { fmtI } from './CompNode'
import { checkConnection } from './connect'
import CompNode from './CompNode'
import WireEdge from './WireEdge'
const nodeTypes = { comp: CompNode }
const edgeTypes = { wire: WireEdge }
const COLORS: [string, string][] = [['Красный', '#e53935'], ['Чёрный', '#212121'], ['Белый', '#f5f5f5'], ['Синий', '#1e88e5'], ['Зелёный', '#43a047'], ['Жёлтый', '#fdd835'], ['Коричневый', '#6d4c41'], ['Оранжевый', '#fb8c00'], ['Серый', '#9e9e9e'], ['Фиолетовый', '#8e24aa'], ['Розовый', '#ec407a'], ['Голубой', '#29b6f6']]
const LABELS = ['+12V', '+5V', 'GND', 'IGN', 'START', 'BRAKE', 'TURN', 'LIGHT', 'SENSOR', 'ECU']
const download = (name: string, href: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

function Thumb({ item }: { item: LibItem }) {
  const d = makeData(item); const l = resolve(d)
  return <svg className="thumb" viewBox={`-14 -14 ${l.w + 28} ${l.h + 28}`} preserveAspectRatio="xMidYMid meet"><g className="sym" fill="none" stroke="currentColor" strokeWidth={Math.max(2, l.w / 45)} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: l.body({ d, on: false, lit: 0, run: false }) }} />
    {[...l.pins.values()].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={Math.max(3.5, l.w / 28)} fill="var(--accent)" />)}</svg>
}
function Library() {
  const { custom, favs, toggleFav, addCustom, addComp } = useStore(); const { screenToFlowPosition } = useReactFlow()
  const [q, setQ] = useState(''); const [cat, setCat] = useState('Все'); const [dom, setDom] = useState<'all' | Domain>('all')
  const all = useMemo(() => [...LIBRARY, ...custom], [custom])
  const cats = ['Все', '★ Избранное', ...new Set([...CATEGORIES, ...custom.map(c => c.category)])]
  const list = all.filter(i => (dom === 'all' || domainOf(i.id) === 'both' || domainOf(i.id) === dom) && (cat === 'Все' || (cat === '★ Избранное' ? favs.includes(i.id) : i.category === cat)) &&
    (!q || (i.name + i.category + i.pins.split('|').map(p => p.split(':')[1]).join(' ') + (i.pins.split('|').length + ' конт')).toLowerCase().includes(q.toLowerCase())))
  const create = () => {
    const name = prompt('Название компонента'); if (!name) return
    const n = Math.max(1, Math.min(40, +(prompt('Количество контактов', '2') || 2)))
    addCustom({ id: 'u' + Date.now(), name, category: 'Пользовательские', pins: Array.from({ length: n }, (_, i) => `${i + 1}:Контакт ${i + 1}:sig`).join('|') })
  }
  return (<aside className="panel left">
    <div className="search"><Search size={14} /><input placeholder="Поиск: название, контакт, число контактов" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="chips">{([['all', 'Все'], ['auto', 'Авто'], ['moto', 'Мото']] as const).map(([k, t]) => <button key={k} className={'chip' + (dom === k ? ' on' : '')} onClick={() => setDom(k)}>{t}</button>)}</div>
    <select value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select>
    <button className="btn wide" onClick={create}><Plus size={14} /> Свой компонент</button>
    <div className="list">{list.map((i: LibItem) => (
      <div key={i.id} className="item" draggable onDragStart={(e: DragEvent) => e.dataTransfer.setData('application/x-lib', i.id)}
        onDoubleClick={() => addComp(i, screenToFlowPosition({ x: 500, y: 300 }))}>
        <Thumb item={i} /><div className="grow"><b>{i.name}</b><small>{i.category} · {i.pins.split('|').length} конт.</small></div>
        <button className="ico" onClick={() => toggleFav(i.id)}><Star size={14} fill={favs.includes(i.id) ? 'currentColor' : 'none'} /></button>
      </div>))}
      {!list.length && <p className="muted">Ничего не найдено. Измените запрос или категорию.</p>}</div>
  </aside>)
}

function Props({ issues, sim }: { issues: ReturnType<typeof validate>; sim: SimResult | null }) {
  const { nodes, edges, patchNode, patchEdge, removePin } = useStore()
  const n = nodes.find(x => x.selected) as Node | undefined; const e = !n ? edges.find(x => x.selected) : undefined
  const Icon = { error: XCircle, warning: AlertTriangle, info: Info }
  return (<aside className="panel right">
    {n && (() => { const d = n.data as CompData; return (<section><h3>Компонент</h3>
      <label>Название<input value={d.name} onChange={ev => patchNode(n.id, { name: ev.target.value })} /></label>
      <p className="muted">{d.category}</p>
      {d.switchState && <label>Состояние<select value={d.switchState} onChange={ev => patchNode(n.id, { switchState: ev.target.value as 'open' | 'closed' })}><option value="open">Разомкнут (тормоз не нажат)</option><option value="closed">Замкнут (тормоз нажат)</option></select></label>}
      {SELECTORS[d.libId] && <label>Положение<select value={d.position ?? Object.keys(SELECTORS[d.libId])[0]} onChange={ev => patchNode(n.id, { position: ev.target.value })}>{Object.entries(SELECTORS[d.libId]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>}
      {['resistor', 'fuse', 'fusebox', 'battery'].includes(d.libId) && <label>{{ resistor: 'Сопротивление, Ом', fuse: 'Номинал, А', fusebox: 'Номинал каждого, А', battery: 'ЭДС, В' }[d.libId]}<input type="number" min={0.001} step="any" value={d.value ?? { resistor: 100, fuse: 15, fusebox: 15, battery: 12 }[d.libId]} onChange={ev => patchNode(n.id, { value: Math.max(0.001, +ev.target.value || 0.001) })} /></label>}
      <h4>Контакты ({d.pins.length})</h4>
      {d.pins.map((p, i) => (<div key={p.id} className="pinrow">
        <input className="num" value={p.number} onChange={ev => patchNode(n.id, { pins: d.pins.map((x, j) => j === i ? { ...x, number: ev.target.value } : x) })} />
        <input value={p.name} onChange={ev => patchNode(n.id, { pins: d.pins.map((x, j) => j === i ? { ...x, name: ev.target.value } : x) })} />
        <select value={p.fn} onChange={ev => patchNode(n.id, { pins: d.pins.map((x, j) => j === i ? { ...x, fn: ev.target.value as 'pwr' } : x) })}><option value="pwr">+</option><option value="gnd">GND</option><option value="sig">сигн.</option></select>
        <button className="ico" title="Удалить контакт" onClick={() => removePin(n.id, p.id)}>×</button></div>))}
      <button className="btn" onClick={() => patchNode(n.id, { pins: [...d.pins, { id: 'p' + Date.now() % 1e6, number: String(d.pins.length + 1), name: 'Контакт', fn: 'sig', side: d.pins.length % 2 ? 'right' : 'left' }] })}>+ Контакт</button>
      <label>Заметки<textarea value={d.notes ?? ''} onChange={ev => patchNode(n.id, { notes: ev.target.value })} /></label></section>) })()}
    {e && (() => { const d = e.data as WireData; return (<section><h3>Провод</h3>
      <div className="swatches">{COLORS.map(([nm, c]) => <button key={c} title={nm} className={'sw-c' + (d.color === c ? ' on' : '')} style={{ background: c }} onClick={() => patchEdge(e.id, { color: c })} />)}</div>
      <label>HEX<input value={d.color} onChange={ev => /^#[0-9a-fA-F]{6}$/.test(ev.target.value) && patchEdge(e.id, { color: ev.target.value })} placeholder="#rrggbb" /></label>
      <label>Маркировка<input list="labels" value={d.label ?? ''} onChange={ev => patchEdge(e.id, { label: ev.target.value })} /></label>
      <datalist id="labels">{LABELS.map(l => <option key={l} value={l} />)}</datalist>
      <label>Сечение<input value={d.crossSection ?? ''} placeholder="0.75 мм²" onChange={ev => patchEdge(e.id, { crossSection: ev.target.value })} /></label>
      <label>Толщина<input type="range" min={1} max={8} value={d.width ?? 2} onChange={ev => patchEdge(e.id, { width: +ev.target.value })} /></label>
      <p className="muted">Изломы: двойной клик по проводу — добавить точку; у выбранного провода точки можно тянуть, двойной клик по точке — удалить.</p>
      {!!d.points?.length && <button className="btn" onClick={() => patchEdge(e.id, { points: [] })}>Убрать изломы ({d.points.length})</button>}
      <label className="row"><input type="checkbox" checked={!!d.dashed} onChange={ev => patchEdge(e.id, { dashed: ev.target.checked })} /> Пунктир</label></section>) })()}
    {!n && !e && <p className="muted">Выберите компонент или провод. Соединение: потяните от контакта к контакту. Двойной клик по детали в библиотеке добавляет её в центр.</p>}
    {sim && <section><h3>Симуляция (постоянный ток)</h3>
      {sim.issues.map((i, k) => <div key={k} className={'issue ' + i.level}><div><b>{i.title}</b><br />{i.text}</div></div>)}
      {nodes.filter(x => (sim.comp.get(x.id)?.i ?? 0) > 0.001).map(x => { const c = sim.comp.get(x.id)!; return <div key={x.id} className="simrow"><span>{(x.data as CompData).name}</span><b>{c.v > 0.05 ? c.v.toFixed(1) + ' В · ' : ''}{fmtI(c.i)}</b></div> })}
      {sim.hasPower && !nodes.some(x => (sim.comp.get(x.id)?.i ?? 0) > 0.001 && (x.data as CompData).libId !== 'battery') && <p className="muted">Ток не течёт: цепь разомкнута или нет возврата на минус. Замкните выключатели (клик по бейджу на детали).</p>}
    </section>}
    <section><h3>Проверка схемы ({issues.length})</h3>
      {issues.length === 0 && <p className="muted">Замечаний нет. Это не гарантия безопасности схемы.</p>}
      {issues.map((i, k) => { const I = Icon[i.level]; return <div key={k} className={'issue ' + i.level}><I size={14} /><div><b>{i.title}</b><br />{i.text}</div></div> })}</section>
  </aside>)
}

export default function App() {
  const s = useStore(); const rf = useReactFlow(); const wrap = useRef<HTMLDivElement>(null); const file = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState(''); const tt = useRef(0)
  const say = (m: string) => { setToast(m); clearTimeout(tt.current); tt.current = window.setTimeout(() => setToast(''), 4000) }
  const issues = useMemo(() => validate(s.nodes, s.edges), [s.nodes, s.edges])
  const hasFl = useMemo(() => s.nodes.some(n => /^flasher/.test((n.data as CompData).libId)), [s.nodes])
  const [tick, setTick] = useState(0)
  useEffect(() => { if (!s.simOn || !hasFl) return; const i = setInterval(() => setTick(Date.now()), 100); return () => clearInterval(i) }, [s.simOn, hasFl])
  const sim = useMemo(() => (s.simOn ? simulate(s.nodes, s.edges, { t: hasFl ? tick / 1000 : 0 }) : null), [s.simOn, s.nodes, s.edges, tick, hasFl])
  const edges = useMemo(() => !sim ? s.edges : s.edges.map(e => { const v = sim.pinV.get(`${e.source}:${e.sourceHandle}`) ?? 0
    return { ...e, animated: v > 1, label: [(e.data as WireData).label, v.toFixed(1) + ' В'].filter(Boolean).join(' · ') } }), [sim, s.edges])
  useEffect(() => { document.documentElement.dataset.theme = s.theme }, [s.theme])
  useEffect(() => { s.restore().then(() => setTimeout(() => rf.fitView(), 50)) }, [])
  useEffect(() => { if (s.saved) return; const t = setTimeout(() => s.save(), 1500); return () => clearTimeout(t) }, [s.nodes, s.edges, s.name, s.saved])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || !(e.ctrlKey || e.metaKey)) return
      const m: Record<string, () => void> = { z: s.undo, y: s.redo, c: s.copy, v: s.paste, s: () => s.save() }
      if (m[e.key.toLowerCase()]) { e.preventDefault(); m[e.key.toLowerCase()]() } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) })
  const onDrop = (e: DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData('application/x-lib')
    const it = [...LIBRARY, ...s.custom].find(i => i.id === id); if (it) s.addComp(it, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })) }
  const exportJson = () => download(`${s.name}.json`, URL.createObjectURL(new Blob([JSON.stringify(s.toFile(), null, 2)], { type: 'application/json' })))
  const exportImg = async (svg: boolean) => { const el = wrap.current?.querySelector('.react-flow__viewport') as HTMLElement; if (!el) return
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() || '#111'
    const url = await (svg ? toSvg : toPng)(el, { backgroundColor: bg }); download(`${s.name}.${svg ? 'svg' : 'png'}`, url) }
  const importJson = async (f?: File) => { if (!f) return
    try { const r = ProjectSchema.safeParse(JSON.parse(await f.text())); if (!r.success) throw new Error(r.error.issues[0]?.path.join('.') + ': ' + r.error.issues[0]?.message); const pins = new Map(r.data.components.map(c => [c.id, new Set(((c.data?.pins ?? []) as { id: string }[]).map(p => p.id))]))
      const bad = r.data.wires.find(w => !pins.get(w.source)?.has(w.sourceHandle ?? '') || !pins.get(w.target)?.has(w.targetHandle ?? ''))
      if (bad) throw new Error(`провод ${bad.id} ведёт к несуществующему контакту`)
      s.load(r.data); setTimeout(() => rf.fitView(), 50) }
    catch (err) { alert('Не удалось импортировать файл. Текущий проект не изменён.\n' + (err as Error).message) } }
  const B = ({ i, t, f, d }: { i: React.ReactNode; t: string; f: () => void; d?: boolean }) => <button className="btn" title={t} onClick={f} disabled={d}>{i}<span className="lbl">{t}</span></button>
  return (<div className="app">
    <header>
      <b className="logo">⚡ AutoWiring Studio</b>
      <input className="pname" value={s.name} onChange={e => s.rename(e.target.value)} />
      <span className="muted">{s.saved ? 'сохранено' : 'не сохранено…'}</span>
      <div className="grow" />
      <B i={<FilePlus size={15} />} t="Новый" f={() => confirm('Начать новый проект? Текущий сохранён автоматически.') && (s.save().then(s.newProject))} />
      <B i={<Undo2 size={15} />} t="Отменить" f={s.undo} d={!s.past.length} /><B i={<Redo2 size={15} />} t="Повторить" f={s.redo} d={!s.future.length} />
      <B i={<Save size={15} />} t="Сохранить" f={() => s.save()} />
      <B i={<Upload size={15} />} t="Импорт" f={() => file.current?.click()} />
      <B i={<Download size={15} />} t="JSON" f={exportJson} /><B i={<Img size={15} />} t="PNG" f={() => exportImg(false)} /><B i={<Img size={15} />} t="SVG" f={() => exportImg(true)} />
      <button className={'btn' + (s.simOn ? ' active' : '')} title="Симуляция цепи" onClick={s.toggleSim}><Zap size={15} /><span className="lbl">Симуляция</span></button>
      <button className="btn" title="Тема" onClick={s.toggleTheme}>{s.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
      <input ref={file} type="file" accept="application/json" hidden onChange={e => { importJson(e.target.files?.[0]); e.target.value = '' }} />
    </header>
    <main>
      <Library />
      <div className="canvas" ref={wrap} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <SimCtx.Provider value={sim}><ReactFlow nodes={s.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={s.onNodesChange} onEdgesChange={s.onEdgesChange}
          onConnect={c => { const r = s.connect(c); if (r) say(r) }} isValidConnection={c => checkConnection(s.nodes, s.edges, c).ok}
          onConnectEnd={(_, st) => { if (st.toNode && st.toHandle && st.fromNode && st.fromHandle && st.isValid === false) { const r = checkConnection(s.nodes, s.edges, { source: st.fromNode.id, sourceHandle: st.fromHandle.id, target: st.toNode.id, targetHandle: st.toHandle.id }); if (!r.ok) say(r.reason) } }} onNodeDragStart={s.commit} onBeforeDelete={async () => { s.commit(); return true }}
          connectionMode={ConnectionMode.Loose} snapToGrid snapGrid={[15, 15]} minZoom={0.1} maxZoom={3}
          defaultEdgeOptions={{ type: 'wire' }} deleteKeyCode={['Delete', 'Backspace']} multiSelectionKeyCode="Shift" selectionKeyCode="Shift" fitView>
          <Background gap={15} /><Controls /><MiniMap pannable zoomable />
        </ReactFlow></SimCtx.Provider>
        {toast && <div className="toast" onClick={() => setToast('')}>⛔ {toast}</div>}
      </div>
      <Props issues={issues} sim={sim} />
    </main>
  </div>)
}
