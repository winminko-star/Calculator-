import React, { useEffect, useRef, useState } from "react";
import { ref, push } from "firebase/database";
import { db } from "../firebase";

export default function CanvasENH() {
  const [count, setCount] = useState(4);
  const [values, setValues] = useState(["", "", "", ""]);
  const [specialJoins, setSpecialJoins] = useState([]);
  const [sjInput, setSjInput] = useState("");
  const [closeShape, setCloseShape] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const canvasRef = useRef(null);

  // Load review
  useEffect(() => {
    const raw = localStorage.getItem("ENH_REVIEW_LOAD");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setCount(data.count);
        setValues(data.values);
        setSpecialJoins(data.specialJoins || []);
        setCloseShape(!!data.closeShape);
      } catch {}
      localStorage.removeItem("ENH_REVIEW_LOAD");
      setTimeout(() => draw(), 200);
    }
  }, []);
  // parse points
  const parsePoints = () => {
    const pts = [];
    for (let i = 0; i < values.length; i++) {
      const t = (values[i] || "").trim();
      if (!t) continue;
      const a = t.split(",").map((s) => Number(s.trim()));
      if (a.length < 2 || a.some((x) => Number.isNaN(x))) continue;
      const [E, N, H = 0] = a;
      pts.push({ id: i + 1, E, N, H });
    }
    return pts;
  };
  const dist = (A,B)=>Math.hypot(B.E-A.E,B.N-A.N);
  const vec = (A,B)=>({x:B.E-A.E,y:B.N-A.N});
  function angleDeg(prev,center,next){
    const v1=vec(center,prev), v2=vec(center,next);
    const d=Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y);
    if(d===0) return null;
    let c=(v1.x*v2.x+v1.y*v2.y)/d;
    c=Math.max(-1,Math.min(1,c));
    return Math.acos(c)*180/Math.PI;
  }

  function draw(){/* … draw() ကို အရင်ပေးထားသလို ထည့်ပါ */} 
  useEffect(()=>{draw();},[values,specialJoins,closeShape]);

  const saveReview=()=>{
    const snap={ts:Date.now(),count,values,specialJoins,closeShape};
    push(ref(db,"enh_reviews"),snap).then(()=>alert("✅ Saved"));
  };

  const handleKeyboardInput=(key)=>{
    if(activeIndex===null) return;
    if(key==="DEL"){
      setValues(vals=>vals.map((v,i)=>i===activeIndex?v.slice(0,-1):v));
    }else if(key==="OK"){
      setShowKeyboard(false); setActiveIndex(null);
    }else{
      setValues(vals=>vals.map((v,i)=>i===activeIndex?v+key:v));
    }
  };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:16, padding:12, fontFamily:"sans-serif" }}>
      {/* LEFT */}
      <div style={{ background:"#f9fafb", padding:16, borderRadius:12, boxShadow:"0 2px 6px rgba(0,0,0,0.1)" }}>
        <h3 style={{marginTop:0,color:"#0f172a"}}>Input</h3>
        <div style={{ marginBottom:12 }}>
          <input type="number" value={count} min={3}
            onChange={(e)=>setCount(Number(e.target.value)||3)}
            style={{ width:60, marginRight:8, padding:"4px 6px", borderRadius:6, border:"1px solid #ccc" }}
          />
          <button onClick={()=>{
            setValues((prev)=>{const next=prev.slice(0,count); while(next.length<count) next.push(""); return next;});
          }} style={{padding:"4px 10px",borderRadius:6,background:"#0ea5e9",color:"#fff",border:0}}>Apply</button>
        </div>

        {values.map((v,i)=>(
          <div key={i} style={{ marginBottom:6 }}>
            No.{i+1}:
            <input
              type="text"
              placeholder="E,N,H"
              value={v}
              onFocus={()=>{setActiveIndex(i);setShowKeyboard(true);}}
              readOnly
              style={{ marginLeft:6, width:"220px", padding:"6px 8px", border:"1px solid #ccc", borderRadius:6 }}
            />
          </div>
        ))}

        <div style={{ marginTop:10 }}>
          Special Join:{" "}
          <input value={sjInput} placeholder="e.g. 3,6"
            onChange={(e)=>setSjInput(e.target.value)}
            style={{padding:"6px 8px",border:"1px solid #ccc",borderRadius:6}}
          />
          <button onClick={()=>{
            const arr=sjInput.split(",").map(s=>Number(s.trim()));
            if(arr.length===2) setSpecialJoins([...specialJoins,{a:arr[0],b:arr[1]}]);
            setSjInput("");
          }} style={{marginLeft:6,padding:"6px 10px",background:"#22c55e",color:"#fff",border:0,borderRadius:6}}>Add</button>
        </div>

        <div style={{ marginTop:10, color:"#334155" }}>
          {specialJoins.map((sj,i)=>(<span key={i} style={{marginRight:8}}>[{sj.a}↔{sj.b}]</span>))}
        </div>

        <div style={{ marginTop:10 }}>
          <label>
            <input type="checkbox" checked={closeShape} onChange={e=>setCloseShape(e.target.checked)} /> Close shape
          </label>
        </div>

        <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={draw} style={{padding:"6px 12px",borderRadius:6,background:"#3b82f6",color:"#fff",border:0}}>Draw</button>
          <button onClick={()=>{setValues(Array(count).fill(""));setSpecialJoins([]);}} style={{padding:"6px 12px",borderRadius:6,background:"#f97316",color:"#fff",border:0}}>Clear</button>
          <button onClick={saveReview} style={{padding:"6px 12px",borderRadius:6,background:"#10b981",color:"#fff",border:0}}>Save Review</button>
          <button onClick={()=>{
            const url=canvasRef.current.toDataURL("image/png");
            const a=document.createElement("a");a.href=url;a.download="enh-canvas.png";a.click();
          }} style={{padding:"6px 12px",borderRadius:6,background:"#6b7280",color:"#fff",border:0}}>Save PNG</button>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ background:"#fff", padding:16, borderRadius:12, boxShadow:"0 2px 6px rgba(0,0,0,0.1)" }}>
        <h3 style={{marginTop:0}}>Canvas</h3>
        <canvas ref={canvasRef} width={1000} height={680} style={{border:"1px dashed #999",width:"100%",maxWidth:"100%"}}/>
      </div>

      {/* Custom Keyboard */}
      {showKeyboard && (
        <div style={{
          position:"fixed",bottom:0,left:0,right:0,
          background:"#1f2937",padding:12,display:"grid",
          gridTemplateColumns:"repeat(3,1fr)",gap:8
        }}>
          {["1","2","3","4","5","6","7","8","9","0",",","DEL"].map(k=>(
            <button key={k}
              onClick={()=>handleKeyboardInput(k)}
              style={{padding:"16px 0",background:"#0ea5e9",color:"#fff",fontSize:18,border:0,borderRadius:8}}
            >{k}</button>
          ))}
          <button onClick={()=>handleKeyboardInput("OK")}
            style={{gridColumn:"span 3",padding:"16px 0",background:"#22c55e",color:"#fff",fontSize:18,border:0,borderRadius:8}}
          >OK</button>
        </div>
      )}
    </div>
  );
      }
