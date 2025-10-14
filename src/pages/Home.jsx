// src/pages/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import SingaporeWeatherFloating from "../components/SingaporeWeatherFloating";

export default function Home() {
const navigate = useNavigate();

const Btn = ({ icon, label, desc, to }) => (
<button
className="btn"
onClick={() => navigate(to)}
style={{
display: "block",
width: "100%",
marginBottom: 12,
textAlign: "left",
borderRadius: 9999,
padding: "12px 16px",
background: "#0ea5e9",
color: "#fff",
}}
>
<div style={{ fontWeight: 700, fontSize: 16 }}>
{icon} {label}
</div>
{desc && <div className="small" style={{ color: "#e0f2fe" }}>{desc}</div>}
</button>
);

return (
<div className="container" style={{ marginTop: 16 }}>
{/* quick style for rainbow text */}
<style>{  rainbowText{   font-weight: 800;   font-size: clamp(20px, 5vw, 32px);   line-height: 1.2;   text-align: center;   background: linear-gradient(   90deg,   #ff004c, #ff7a00, #ffd400, #4cd964, #32a6ff, #7a5cff, #ff00e6, #ff004c   );   background-size: 200% auto;   -webkit-background-clip: text;   background-clip: text;   color: transparent;   animation: rainbowMove 4s linear infinite;   letter-spacing: .3px;   margin-top: 10px;   }   @keyframes rainbowMove {   0% { background-position: 0% 50%; }   100% { background-position: 200% 50%; }   }   .photoCard{   background:#fff;   border:1px solid #e5e7eb;   border-radius:16px;   padding:10px;   margin-top:18px;   box-shadow: 0 6px 20px rgba(15,23,42,.06);   }   .heroImg{   width:100%;   height:auto;   display:block;   border-radius:12px;   object-fit:cover;   }  }</style>

<Btn icon="🧭" label="2D Drawing (E,N)" desc="Points • Lines (length) • Angle" to="/drawing2d" />  
  <Btn icon="📂" label="2D Review" desc="Saved drawings • dates • auto cleanup" to="/review" />  
  <Btn icon="📐" label="Right Triangle" desc="Hypotenuse, legs, angles…" to="/righttriangle" />  
  <Btn icon="⭕" label="Circle Center" desc="Center/Radius from points" to="/circlecenter" />  
  <Btn icon="📏" label="Levelling" desc="Rise/Fall, RL, misclosure…" to="/levelling" />  
  <Btn icon="📝" label="Levelling Review" desc="Saved levelling results" to="/levelling-review" />  
  <Btn icon="🧮" label="Simple Calculator" desc="Big keys • one decimal • clean UI" to="/simple-calc" />  

  {/* --- Photo + rainbow message footer --- */}  
  <div className="photoCard">  
    {/* put the image file at /public/couple.jpg (or change the src path) */}  
    <img src="/couple.jpg" alt="Two people smiling outdoors" className="heroImg" />  
     <SingaporeWeatherFloating />  
    <div className="rainbowText">  
       Someone who loves you is waiting for you. So work safely.  
      <h4>Created by Win Min Ko(Seatrium DC Team).</h4>  
    </div>  
  </div>  
  </div>

);
}
