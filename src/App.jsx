import React from 'react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Drawing2D from './pages/Drawing2D'
import AllReview from './pages/AllReview'

function Home(){
  return (
    <div className="card">
      <div className="page-title">Welcome 👋</div>
      <p>Use <strong>2D Drawing</strong> to add E,N points, connect lines (length), make 3-point angles, and save the canvas.
      Check <strong>All Review</strong> to view or clean old drawings.</p>
    </div>
  )
}

export default function App(){
  return (
    <>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/drawing2d" element={<Drawing2D/>} />
          <Route path="/review" element={<AllReview/>} />
        </Routes>
      </div>
    </>
  )
}
