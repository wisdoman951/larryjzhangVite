// src/components/MainLayout.jsx (假設檔案名稱為 .jsx)
import React, { useEffect, useCallback } from 'react';
import Particles from "react-tsparticles"; // 從 npm 引入
import { loadSlim } from "tsparticles-slim"; // 從 npm 引入

// --- 一個通用且美觀的星空粒子背景選項 ---
const spaceParticlesOptions = {
    autoPlay: true,
    background: {
        color: { value: "#030a1c" } // 深邃的星空藍
    },
    fullScreen: { enable: true, zIndex: 0 }, // 作為最底層背景
    fpsLimit: 60,
    interactivity: {
        events: {
            onHover: { enable: true, mode: "bubble" }, // 滑鼠懸停時有氣泡效果
            onClick: { enable: true, mode: "push"} // 點擊時推開粒子
        },
        modes: {
            bubble: { distance: 100, duration: 2, opacity: 0.8, size: 3, color: "#50C8FF" },
            push: { quantity: 4 },
            repulse: { distance: 100 }
        }
    },
    particles: {
        color: { value: ["#FFFFFF", "#FFFFAA", "#BBDDFF", "#FFCCDD"] }, // 星星顏色多樣
        links: { enable: false }, // 星星之間不連接
        move: {
            direction: "none",
            enable: true,
            outModes: { default: "out" },
            random: true,
            speed: 0.2, // 非常緩慢的飄浮
            straight: false,
            // draft: 0.21 // 'draft' 不是一個標準的 tsparticles move 選項，通常是 'attract', 'trail' 等，此處移除或確認其用途
        },
        number: {
            density: { enable: true, area: 900 }, // 調整密度
            value: 160 // 星星數量
        },
        opacity: {
            value: { min: 0.1, max: 0.7 },
            animation: { enable: true, speed: 0.7, minimumValue: 0.05, sync: false }
        },
        shape: { type: "circle" },
        size: {
            value: { min: 0.3, max: 2.0 },
            animation: { enable: true, speed: 1.5, minimumValue: 0.2, sync: false }
        }
    },
    detectRetina: true
};

const MainLayout = ({ children }) => {
  const particlesInit = useCallback(async (engine) => {
    console.log("MainLayout: tsParticles engine initializing...");
    await loadSlim(engine); // 載入 slim 引擎
    console.log("MainLayout: Slim engine loaded.");
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log("MainLayout: Particles container loaded:", container);
  }, []);
  
  
  // --- "Larry's Probation Demo" 文字的通用樣式函數 ---
  const getDemoTextStyle = (topPosition, leftPosition, fontSizeClamp, rotation = -2) => ({
      position: 'fixed',
      top: topPosition,
      left: leftPosition,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      color: '#FFFFFF',
      fontSize: fontSizeClamp, 
      fontWeight: 'bold',
      textShadow: '0 0 6px #fff, 0 0 10px #fff, 0 0 18px #00A1DE, 0 0 28px #00A1DE, 0 0 38px #86BC25, 0 0 48px #86BC25',
      zIndex: 1, // 確保在粒子背景 (z-index: 0) 之上，但在主要內容 (z-index: 10) 之下
      pointerEvents: 'none',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      fontFamily: "'Orbitron', 'Cutive Mono', 'Courier New', monospace",
      letterSpacing: '0.05em',
      opacity: 0.9 
  });
  
  return (
    <div className="relative min-h-screen w-full bg-slate-900"> {/* 基礎背景色，粒子載入失敗時可見 */}
      
      {/* ***** 新增 Particles 元件 ***** */}
      <Particles
        id="tsparticles-background" // 可以與之前的 div id 相同，或者直接用這個元件
        init={particlesInit}
        loaded={particlesLoaded}
        options={spaceParticlesOptions}
        className="fixed inset-0 z-0 opacity-90" // 使用 className 來套用 fixed 和 z-index
      />
      
      {/* --- 第一個 "Larry's Probation Demo" (上方) --- */}
      <div 
        style={getDemoTextStyle('15%', '25%', 'clamp(1.8rem, 4vw, 3rem)', 2)}
        className="select-none animate-pulse"
      >
        Larry's Probation Demo
      </div>

      {/* --- 第二個 "Larry's Probation Demo" (中間) --- */}
      <div 
        style={getDemoTextStyle('50%', '50%', 'clamp(2.5rem, 6vw, 4.5rem)', -3)}
        className="select-none" 
      >
        Larry's Probation Demo
      </div>

      {/* --- 第三個 "Larry's Probation Demo" (下方) --- */}
      <div 
        style={getDemoTextStyle('85%', '75%', 'clamp(1.8rem, 4vw, 3rem)', 1)}
        className="select-none animate-pulse"
      >
        Larry's Probation Demo
      </div>
      
      {/* 主要內容容器 */}
      {/* z-index 設為 10，確保它在粒子背景和裝飾文字之上 */}
      <div className="relative z-10 flex flex-col min-h-screen"> 
        <div className="flex flex-col flex-1">
          {children} {/* 這裡會渲染 Dashboard, NessusAIPage 等 */}
        </div>
      </div>
    </div>
  );
};
export default MainLayout;