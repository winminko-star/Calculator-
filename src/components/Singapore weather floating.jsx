.weather-floating {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
  cursor: pointer;
  transition: all 0.4s ease;
  font-family: "Poppins", system-ui, sans-serif;
}

/* ✳️ Small Floating Icon */
.weather-floating.small {
  width: 55px;
  height: 55px;
  background: linear-gradient(135deg, #007aff, #00b4ff);
  color: #fff;
  border-radius: 50%;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
  animation: floatPulse 3s infinite ease-in-out;
}

/* 🌤 Expanded Popup */
.weather-floating.expanded {
  width: 250px;
  height: 230px;
  border-radius: 18px;
  overflow: hidden;
  background: #000;
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
  animation: zoomIn 0.4s ease-out;
}

.weather-floating.expanded .close-btn {
  position: absolute;
  top: 6px;
  right: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  font-size: 1.3rem;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  cursor: pointer;
  z-index: 10;
  transition: 0.3s;
}
.weather-floating.expanded .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.weather-scene {
  position: relative;
  width: 100%;
  height: 100%;
}
.weather-scene .bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.7);
}
.weather-scene .overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}
.weather-scene .condition {
  font-size: 1.3rem;
  font-weight: 600;
}
.weather-scene .temp {
  font-size: 2rem;
  font-weight: bold;
  margin-top: 5px;
}
.weather-scene .desc {
  font-size: 0.8rem;
  opacity: 0.8;
  margin-top: 5px;
}

/* Animations */
@keyframes floatPulse {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
@keyframes zoomIn {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
