import React, { useEffect, useState } from 'react'
import { db, storage } from '../firebase'
import { ref as dbRef, onValue, remove, update } from 'firebase/database'
import { ref as stRef, deleteObject } from 'firebase/storage'

function fmt(ts){
  try{ return new Date(ts).toLocaleString('en-SG', { hour12:false }) }catch{ return String(ts) }
}

export default function AllReview(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const r = dbRef(db, 'drawings')
    const unsub = onValue(r, async (snap)=>{
      const now = Date.now()
      const list = []
      const expired = []
      snap.forEach(child=>{
        const v = child.val() || {}
        const key = child.key
        const leftMs = (v.expiresAt ?? 0) - now
        const daysLeft = Math.max(0, Math.ceil(leftMs/86400000))
        const row = { key, ...v, daysLeft }
        if((v.expiresAt ?? 0) <= now){ expired.push(row) } else { list.push(row) }
      })
      // auto cleanup expired
      for(const ex of expired){
        try{ if(ex.storagePath){ await deleteObject(stRef(storage, ex.storagePath)) } }catch(e){ }
        await remove(dbRef(db, `drawings/${ex.key}`))
      }
      list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0))
      setItems(list)
      setLoading(false)
    })
    return ()=>unsub()
  },[])

  const handleDelete = async (row) => {
    if(row.storagePath){ try{ await deleteObject(stRef(storage, row.storagePath)) }catch(e){} }
    await remove(dbRef(db, `drawings/${row.key}`))
    alert('Deleted ✅')
  }

  const extend90Days = async (row) => {
    const now = Date.now()
    await update(dbRef(db, `drawings/${row.key}`), { expiresAt: now + 90*24*60*60*1000 })
    alert('Extended +90 days ✅')
  }

  if(loading) return <div className="card">Loading…</div>

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">All Saved Drawings</div>
        {items.length===0 && <div className="small">No drawings yet.</div>}
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))'}}>
          {items.map(row=> (
            <div key={row.key} className="card" style={{padding:12}}>
              <div className="small">ID: {row.id}</div>
              <a href={row.url} target="_blank" rel="noreferrer">
                <img src={row.url} alt="drawing" style={{width:'100%', borderRadius:8, border:'1px solid #e5e7eb'}}/>
              </a>
              <div style={{marginTop:8}}>
                <div className="small">Created: {fmt(row.createdAt)}</div>
                <div className="small">Expires in: {row.daysLeft} day(s)</div>
                <div className="small">Pts: {row?.meta?.points || 0} • Lines: {row?.meta?.lines || 0} • ∠: {row?.meta?.triples || 0}</div>
              </div>
              <div className="row" style={{marginTop:8}}>
                <button className="btn" onClick={()=>extend90Days(row)}>⏱️ Extend +90d</button>
                <button className="btn" onClick={()=>handleDelete(row)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
        }
