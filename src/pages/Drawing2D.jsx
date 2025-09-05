import React, { useEffect, useRef, useState } from 'react'
import { db, storage } from '../firebase'
import { ref as dbRef, push, set } from 'firebase/database'
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage'

function dist(a,b){
  const dx = b.x - a.x, dy = b.y - a.y
  return Math.hypot(dx, dy)
}
function angleDeg(a,b,c){ // angle at b formed by a-b-c
  const v1 = {x:a.x-b.x, y:a.y-b.y}
  const v2 = {x:c.x-b.x, y:c.y-b.y}
  const dot = v1.x*v2.x + v1.y*v2.y
  const m1 = Math.hypot(v1.x, v1.y) || 1
  const m2 = Math.hypot(v2.x, v2.y) || 1
  const cos = Math.min(1, Math.max(-1, dot/(m1*m2)))
  return (Math.acos(cos) * 180/Math.PI).toFixed(2)
}

export default function Drawing2D(){
  const [points, setPoints] = useState([]) // {id,label,x,y}
  const [lines, setLines] = useState([])   // {id,p1,p2,len}
  const [triples, setTriples] = useState([]) // {id,a,b,c,deg}
  const [sel, setSel] = useState([])
  const [scale, setScale] = useState(2)
  const [inE, setInE] = useState('')
  const [inN, setInN] = useState('')
  const [label, setLabel] = useState('')
  const [deleteLineId, setDeleteLineId] = useState('')

  const canvasRef = useRef(null)

  const addPoint = () => {
    if(inE === '' || inN === '') return
    const x = Number(inE), y = Number(inN)
    if(Number.isNaN(x) || Number.isNaN(y)) return
    const id = crypto.randomUUID().slice(0,8)
    setPoints(p => [...p, {id, label: label || id, x, y}])
    setInE(''); setInN(''); setLabel('')
  }

  const pickPointAt = (mx,my, origin) => {
    const w = { x: (mx - origin.x)/scale, y: (origin.y - my)/scale }
    let nearest = null, best = 99999
    for(const p of points){
      const d = Math.hypot(p.x - w.x, p.y - w.y)
      if(d < best && d < 6/scale) { best = d; nearest = p }
    }
    return nearest
  }

  const onCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const origin = { x: rect.width/2, y: rect.height/2 }
    const p = pickPointAt(mx,my, origin)
    if(!p) return
    setSel(s => {
      const ns = [...s, p.id]
      if(ns.length === 2){
        const p1 = points.find(x=>x.id===ns[0])
        const p2 = points.find(x=>x.id===ns[1])
        if(p1 && p2 && p1.id !== p2.id){
          const id = crypto.randomUUID().slice(0,8)
          setLines(ls => [...ls, {id, p1: p1.id, p2: p2.id, len: dist(p1,p2).toFixed(3)}])
        }
        return []
      }
      if(ns.length === 3){
        const [aId,bId,cId] = ns
        const a = points.find(x=>x.id===aId)
        const b = points.find(x=>x.id===bId)
        const c = points.find(x=>x.id===cId)
        if(a && b && c){
          const id = crypto.randomUUID().slice(0,8)
          setTriples(tr => [...tr, {id,a:a.id,b:b.id,c:c.id,deg: angleDeg(a,b,c)}])
        }
        return []
      }
      return ns
    })
  }

  const removeLine = () => {
    if(!deleteLineId) return
    setLines(ls => ls.filter(l => l.id !== deleteLineId))
    setDeleteLineId('')
  }

  useEffect(() => {
    const cvs = canvasRef.current
    if(!cvs) return
    const ctx = cvs.getContext('2d')
    const w = cvs.width, h = cvs.height
    ctx.clearRect(0,0,w,h)

    const origin = { x: w/2, y: h/2 }

    // grid
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1
    for(let gx = origin.x % (scale*10); gx < w; gx += scale*10){
      ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,h); ctx.stroke()
    }
    for(let gy = origin.y % (scale*10); gy < h; gy += scale*10){
      ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(w,gy); ctx.stroke()
    }

    // axes
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(w, origin.y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, h); ctx.stroke()

    const toScreen = (p) => ({ x: origin.x + p.x*scale, y: origin.y - p.y*scale })

    // lines + lengths
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2
    ctx.fillStyle = '#0f172a'; ctx.font = '12px system-ui'
    lines.forEach(l => {
      const p1 = points.find(p=>p.id===l.p1)
      const p2 = points.find(p=>p.id===l.p2)
      if(!p1 || !p2) return
      const s1 = toScreen(p1), s2 = toScreen(p2)
      ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke()
      const midx = (s1.x+s2.x)/2, midy=(s1.y+s2.y)/2
      ctx.fillText(`${l.len}`, midx+6, midy-6)
    })

    // angle triples
    triples.forEach(t => {
      const a = points.find(p=>p.id===t.a)
      const b = points.find(p=>p.id===t.b)
      const c = points.find(p=>p.id===t.c)
      if(!a||!b||!c) return
      const sb = toScreen(b)
      ctx.fillText(`${t.deg}°`, sb.x+8, sb.y-8)
      const a1 = Math.atan2(a.y-b.y, a.x-b.x)
      const a2 = Math.atan2(c.y-b.y, c.x-b.x)
      let start=a1, end=a2
      while(end-start>Math.PI) start+=2*Math.PI
      while(start-end>Math.PI) end+=2*Math.PI
      ctx.beginPath();
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2
      ctx.arc(sb.x, sb.y, 18, -end, -start, true)
      ctx.stroke()
    })

    // points
    points.forEach(p=>{
      const s = toScreen(p)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath(); ctx.arc(s.x,s.y,3.5,0,Math.PI*2); ctx.fill()
      ctx.fillStyle = '#0f172a'
      ctx.fillText(p.label ?? p.id, s.x+6, s.y-6)
    })
  }, [points, lines, triples, scale])

  const saveToFirebase = async () => {
    const cvs = canvasRef.current
    if(!cvs) return
    const tmp = document.createElement('canvas')
    tmp.width = cvs.width*2; tmp.height = cvs.height*2
    const tctx = tmp.getContext('2d')
    tctx.scale(2,2)
    tctx.drawImage(cvs,0,0)

    const blob = await new Promise(res=> tmp.toBlob(res, 'image/png', 0.92))
    const now = Date.now()
    const expiresAt = now + 90*24*60*60*1000 // ~3 months
    const id = crypto.randomUUID()
    const path = `drawings/${id}.png`

    const sref = stRef(storage, path)
    await uploadBytes(sref, blob)
    const url = await getDownloadURL(sref)

    await set(push(dbRef(db, 'drawings')), {
      id,
      storagePath: path,
      url,
      createdAt: now,
      expiresAt,
      meta: { points: points.length, lines: lines.length, triples: triples.length }
    })
    alert('Saved to Firebase ✅')
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <div>
            <div className="page-title">2D Drawing (E,N)</div>
            <div className="row">
              <input className="input" type="number" step="any" placeholder="E (x)" value={inE} onChange={e=>setInE(e.target.value)} style={{width:120}}/>
              <input className="input" type="number" step="any" placeholder="N (y)" value={inN} onChange={e=>setInN(e.target.value)} style={{width:120}}/>
              <input className="input" placeholder="Label (optional)" value={label} onChange={e=>setLabel(e.target.value)} style={{width:160}}/>
              <button className="btn" onClick={addPoint}>➕ Add Point</button>
            </div>
          </div>
          <div className="row" style={{marginLeft:'auto'}}>
            <label className="small">Scale: {scale}px/unit</label>
            <input type="range" min="1" max="10" value={scale} onChange={e=>setScale(Number(e.target.value))}/>
            <button className="btn" onClick={()=>{setPoints([]); setLines([]); setTriples([])}}>🧹 Clear</button>
            <button className="btn" onClick={saveToFirebase}>💾 Save PNG</button>
          </div>
        </div>
        <p className="small">Tip: Canvas ကို point ပေါ်ကို click လုပ်ပြီး 2 ခါ ရွေးရင် line ထည့်မယ် • 3 ခါ ရွေးရင် angle(°) ပြမယ်</p>
        <canvas ref={canvasRef} width={900} height={520} onClick={onCanvasClick}
          style={{width:'100%', maxWidth:900, background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', cursor:'crosshair'}} />
      </div>

      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines yet. Select 2 points on canvas.</div>}
        {lines.map(l=> (
          <div key={l.id} className="row" style={{justifyContent:'space-between'}}>
            <div>#{l.id} — {l.p1} ↔ {l.p2} — <strong>{l.len}</strong></div>
            <button className="btn" onClick={()=>setDeleteLineId(l.id)}>Select</button>
          </div>
        ))}
        <div className="row">
          <input className="input" placeholder="Line ID to delete" value={deleteLineId} onChange={e=>setDeleteLineId(e.target.value)} style={{width:220}}/>
          <button className="btn" onClick={removeLine}>🗑️ Delete Line</button>
        </div>
      </div>
    </div>
  )
    }
