import React from 'react'
import { NavLink } from 'react-router-dom'

export default function NavBar(){
  return (
    <div className="header">
      <div className="container">
        <div className="row" style={{justifyContent:'space-between'}}>
          <strong>WMK Calc</strong>
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/drawing2d">2D Drawing</NavLink>
            <NavLink to="/review">All Review</NavLink>
          </nav>
        </div>
      </div>
    </div>
  )
}
