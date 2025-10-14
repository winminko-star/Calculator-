// src/pages/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import SingaporeWeatherFloating from "../components/SingaporeWeatherFloating";
import CircleFit from "../components/CircleFit";

export default function Home() {
  const navigate = useNavigate();

  const Btn = ({ icon, label, desc, to }) => (
    <button
      onClick={() => navigate(to)}
      className="block w-full mb-3 text-left rounded-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white"
    >
      <div className="font-bold text-lg">{icon} {label}</div>
      {desc && <div className="text-sm text-blue-200">{desc}</div>}
    </button>
  );

  return (
    <div className="container mx-auto mt-4 p-2 space-y-4">
      {/* Buttons */}
      <Btn icon="🧭" label="2D Drawing (E,N)" desc="Points • Lines (length) • Angle" to="/drawing2d" />
      <Btn icon="📂" label="2D Review" desc="Saved drawings • dates • auto cleanup" to="/review" />
      <Btn icon="📐" label="Right Triangle" desc="Hypotenuse, legs, angles…" to="/righttriangle" />
      <Btn icon="⭕" label="Circle Center" desc="Center/Radius from points" to="/circlecenter" />
      <Btn icon="📏" label="Levelling" desc="Rise/Fall, RL, misclosure…" to="/levelling" />
      <Btn icon="📝" label="Levelling Review" desc="Saved levelling results" to="/levelling-review" />
      <Btn icon="🧮" label="Simple Calculator" desc="Big keys • one decimal • clean UI" to="/simple-calc" />

      {/* --- Photo + floating weather + rainbow text --- */}
      <div className="bg-white border rounded-xl p-4 shadow space-y-4">
        <img src="/couple.jpg" alt="Two people smiling outdoors" className="w-full h-auto rounded-lg object-cover" />
        <SingaporeWeatherFloating />

        <div className="text-center font-extrabold text-2xl bg-clip-text text-transparent animate-[rainbowMove_4s_linear_infinite] bg-gradient-to-r from-red-500 via-orange-400 via-yellow-300 via-green-400 via-blue-400 via-purple-500 to-pink-500">
          Someone who loves you is waiting for you. So work safely.
          <h4 className="text-lg mt-2">Created by Win Min Ko (Seatrium DC Team)</h4>
        </div>

        {/* --- Floating draggable CircleFit --- */}
        <div className="mt-4 p-2 border rounded-lg shadow-lg bg-gray-50">
          <CircleFit />
        </div>
      </div>

      {/* --- Tailwind animation keyframes --- */}
      <style>{`
        @keyframes rainbowMove {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
                                                              }
