import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

export default function NavBar({ user, onLogout }){
  const navigate = useNavigate()
  return (
    <div className="header">
      <div className="container">
        <div className="row" style={{justifyContent:'space-between'}}>
          <strong>WMK Calc</strong>
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/drawing2d">2D Drawing</NavLink>
            <NavLink to="/review">All Review</NavLink>
            {user ? (
              <button className="btn" onClick={async ()=>{ await onLogout?.(); navigate('/login', { replace:true }) }}>Logout</button>
            ) : (
              <NavLink to="/login">Login</NavLink>
            )}
          </nav>
        </div>
      </div>
    </div>
  )
}
```jsx
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
