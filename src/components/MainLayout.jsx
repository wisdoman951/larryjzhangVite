// src/components/MainLayout.js
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
            repulse: { distance: 100 } // 可以保留 repulse，如果想用
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
			draft: 0.21
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
  // 這樣方便我們為多個文字實例調整相似的樣式
  const getDemoTextStyle = (topPosition, leftPosition, fontSizeClamp, rotation = -2) => ({
      position: 'fixed',
      top: topPosition,
      left: leftPosition,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      color: '#FFFFFF',
      fontSize: fontSizeClamp, 
      fontWeight: 'bold',
      textShadow: '0 0 6px #fff, 0 0 10px #fff, 0 0 18px #00A1DE, 0 0 28px #00A1DE, 0 0 38px #86BC25, 0 0 48px #86BC25', // 調整陰影使其更柔和或更突出
      zIndex: 5, // 確保在粒子背景之上，但在主要互動內容之下或同級
      pointerEvents: 'none',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      fontFamily: "'Orbitron', 'Cutive Mono', 'Courier New', monospace", // 加入更多備選字體
      letterSpacing: '0.05em',
      opacity: 0.9 // 可以略微透明，更好地融入背景
  });
  
 return (
    <div className="relative min-h-screen w-full bg-slate-900">
      <div id="tsparticles-background" className="fixed inset-0 z-0 opacity-90"></div>
      
      {/* --- 第一個 "Larry's Probation Demo" (上方) --- */}
      <div 
        style={getDemoTextStyle(
            '15%', // 調整垂直位置 (例如：距離頂部 15%)
            '25%', // 調整水平位置 (例如：距離左側 25%)
            'clamp(1.8rem, 4vw, 3rem)', // 調整字體大小
            2 // 輕微旋轉角度
        )}
        className="select-none animate-pulse" // 可以保留或移除 animate-pulse
      >
        Larry's Probation Demo
      </div>

      {/* --- 第二個 "Larry's Probation Demo" (中間，您之前的版本) --- */}
      {/* 我會稍微調整它的位置和大小，使其與新增的兩個有所區別或協調 */}
      <div 
        style={getDemoTextStyle(
            '50%', // 垂直居中
            '50%', // 水平居中
            'clamp(2.5rem, 6vw, 4.5rem)', // 主要的、較大的文字
            -3 // 旋轉角度
        )}
        className="select-none" 
      >
        Larry's Probation Demo
      </div>

      {/* --- 第三個 "Larry's Probation Demo" (下方) --- */}
      <div 
        style={getDemoTextStyle(
            '85%', // 調整垂直位置 (例如：距離底部 15%，即頂部 85%)
            '75%', // 調整水平位置 (例如：距離左側 75%)
            'clamp(1.8rem, 4vw, 3rem)', // 與上方文字大小一致
            1 // 輕微旋轉角度 (不同方向)
        )}
        className="select-none animate-pulse"
      >
        Larry's Probation Demo
      </div>
      
      {/* 主要內容容器 (z-index 需要高於裝飾文字，但低於可能的彈出模態框等) */}
      <div className="relative z-10 flex flex-col min-h-screen"> 
        <div className="flex flex-col flex-1"> {/* 移除 pt-[var(--header-height,0px)]，讓頁面元件自己處理 header 的 sticky */}
          {children}
        </div>
      </div>
    </div>
  );
};
export default MainLayout;
