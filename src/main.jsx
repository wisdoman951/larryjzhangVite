// src/main.jsx (或 .js)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 或 App.js
import './index.css' // <--- 確保引入了包含 Tailwind 指令的 CSS 檔案

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)