// src/components/Dashboard.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useHistory, Link } from 'react-router-dom'; // 從 react-router-dom 引入
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// 引入圖示 (假設您使用 lucide-react 或類似套件)
// npm install lucide-react
// 或者您可以選擇其他圖示庫或 SVG
import { FileText, ShieldCheck, BrainCircuit, Briefcase } from 'lucide-react'; // 範例圖示

const Dashboard = () => {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([{ sender: "AI", message: "你好！我是你的 AI 助理，問我任何問題吧！" }]);
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory(); // react-router-dom v5 使用 useHistory

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const currentChatMessages = [...chatMessages, { sender: "User", message: chatInput }];
    setChatMessages(currentChatMessages);
    const currentInput = chatInput;
    setChatInput("");

    setIsLoading(true);
    try {
      const response = await axios.post(
        "https://dm2nkd04w0.execute-api.ap-northeast-1.amazonaws.com/prod/chat",
        { input: currentInput },
        { timeout: 15000 }
      );
      let responseBody;
      // ... (您現有的 chat submit 邏輯保持不變) ...
      if (response.data.statusCode !== undefined) {
        if (response.data.statusCode !== 200) {
          let errorBody;
          try {
            errorBody = response.data.body ? JSON.parse(response.data.body) : { error: "未知錯誤" };
          } catch (parseError) {
            errorBody = { error: `無法解析回應：${parseError.message}` };
          }
          throw new Error(`伺服器返回錯誤：${errorBody.error || JSON.stringify(response.data)}`);
        }
        try {
          responseBody = response.data.body ? JSON.parse(response.data.body) : { reply: "後端未返回有效回應" };
        } catch (parseError) {
          throw new Error(`回應格式錯誤：${parseError.message}`);
        }
      } else {
        responseBody = response.data;
      }
      const reply = responseBody.reply || "後端未提供回應";
      setChatMessages([...currentChatMessages, { sender: "AI", message: reply }]);
    } catch (error) {
      console.error("Chatbot 錯誤:", error);
      let errorMessageText = "抱歉，出了點問題！";
      if (error.code === "ECONNABORTED") {
        errorMessageText += " 請求超時，請檢查網絡或稍後重試。";
      } else if (error.response) {
        errorMessageText += ` 伺服器錯誤：${error.response.status} - ${error.response.data.error || JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessageText += " 無法連接到伺服器，請檢查網絡。";
      } else {
        errorMessageText += ` ${error.message}`;
      }
      setChatMessages([...currentChatMessages, { sender: "AI", message: errorMessageText }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportGeneration = () => {
    history.push("/report"); // 使用 history.push 進行導覽
  };

  // 定義卡片數據，包含圖示和新的 Nessus AI 分析卡片
  const serviceCards = [
    { 
      title: "報告撰寫", 
      desc: "自動讀取客戶文件並生成評估報告", 
      actionType: "push", // 'push' for history.push, 'link' for <Link>
      target: "/report", // For history.push or Link to
      icon: <FileText size={40} className="mb-3 text-sky-400" /> 
    },
    { 
      title: "Nessus AI 分析", // 新增的卡片
      desc: "自動化 Nessus 報告處理與 AI 問答", 
      actionType: "link",
      target: "/nessus-ai", // 指向 Nessus AI 頁面的路由
      icon: <BrainCircuit size={40} className="mb-3 text-purple-400" /> // 範例圖示
    },
	{ 
      title: "LLM 安全評估", 
      desc: "開發服務線整理流程Demo", 
      actionType: "link", 
      target: "/llm-security/survey",
      icon: <Briefcase size={40} className="mb-3 text-yellow-400" />
    },
    { 
      title: "合規性評估", 
      desc: "分析訪談紀錄並評估法規合規性", 
      actionType: "alert",
      target: "/compliance",
      icon: <ShieldCheck size={40} className="mb-3 text-green-400" />
    },
    { 
      title: "專案管理", 
      desc: "追蹤專案進度與任務狀態", 
      actionType: "alert", 
      message: "專案管理功能開發中！",
      icon: <Briefcase size={40} className="mb-3 text-yellow-400" />
    }
  ];

  return (
    <>
      <header className="bg-sky-700/70 text-white p-3 shadow-lg backdrop-blur-md sticky top-0 z-30 flex justify-center items-center">
        <h1 className="text-3xl font-bold text-center">AI 平台 Dashboard</h1>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            {serviceCards.map((card, index) => (
              <div 
                key={index} 
                className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-lg p-6 rounded-xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 border border-white/30 flex flex-col items-center text-center" // 使內容居中
              >
                {card.icon} {/* 顯示圖示 */}
                <h2 className="text-2xl font-bold mb-3 text-white dark:text-sky-300 text-shadow-md"> 
                  {card.title}
                </h2>
                <p className="text-gray-100 dark:text-gray-200 mb-5 min-h-[40px] text-shadow-sm">
                  {card.desc}
                </p>
                <div className="mt-auto"> {/* 將按鈕推到底部 */}
                  {card.actionType === "push" && (
                    <button 
                        onClick={() => history.push(card.target)} 
                        className="bg-sky-500/80 hover:bg-sky-600/90 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-sky-400/60 transition-all duration-300 transform hover:scale-105 border border-sky-400/50 backdrop-blur-sm"
                    >
                      開始
                    </button>
                  )}
                  {card.actionType === "link" && (
                    <Link to={card.target}> 
                      <button 
                        className="bg-sky-500/80 hover:bg-sky-600/90 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-sky-400/60 transition-all duration-300 transform hover:scale-105 border border-sky-400/50 backdrop-blur-sm"
                      >
                        開始
                      </button>
                    </Link>
                  )}
                   {card.actionType === "alert" && (
                    <button 
                        onClick={() => alert(card.message)} 
                        className="bg-gray-500/80 hover:bg-gray-600/90 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-gray-400/60 transition-all duration-300 transform hover:scale-105 border border-gray-400/50 backdrop-blur-sm"
                    >
                      查看詳情
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="w-full md:w-96 bg-slate-800/60 dark:bg-slate-900/70 backdrop-blur-xl border-l border-gray-500/30 p-4 flex flex-col shadow-2xl">
          <h2 className="text-xl font-semibold mb-4 text-sky-200 dark:text-sky-300 text-shadow-sm">AI 助理</h2>
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 p-3 bg-slate-700/50 dark:bg-slate-800/60 rounded-lg shadow-inner">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === "User" ? "justify-end" : "justify-start"}`}>
                  <span className={`inline-block py-2 px-3 rounded-xl shadow-md max-w-xs break-words ${
                    msg.sender === "User" 
                    ? "bg-blue-500 text-white" 
                    : "bg-slate-600 text-gray-100 dark:bg-slate-500 dark:text-gray-50"
                  }`}>
                    {/* 確保 ReactMarkdown 和 remarkGfm 已正確引入並可用 */}
                    {typeof ReactMarkdown === 'function' && typeof remarkGfm === 'function' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.message}</ReactMarkdown>
                      ) : (
                        msg.message // Fallback to plain text if Markdown components are not available
                      )
                    }
                  </span>
                </div>
              ))}
              {isLoading && ( 
                <div className="flex justify-start">
                  <span className="inline-block py-2 px-3 rounded-xl shadow-md max-w-xs break-words bg-slate-600 text-gray-100 dark:bg-slate-500 dark:text-gray-50">
                    AI 思考中...
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center mt-auto pt-3 border-t border-slate-600/50 dark:border-slate-700/50">
              <input
                type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !isLoading && handleChatSubmit()}
                className="flex-1 p-3 border border-slate-500/70 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm bg-slate-700/60 text-white placeholder-slate-400 dark:bg-slate-800/70 dark:text-gray-100 dark:placeholder-gray-500"
                placeholder="問點什麼..." disabled={isLoading}
              />
              <button onClick={handleChatSubmit} 
                      className="bg-sky-600 hover:bg-sky-700 text-white font-semibold p-3 rounded-r-lg shadow-md disabled:opacity-60 disabled:hover:bg-sky-600"
                      disabled={isLoading}
              >
                發送
              </button>
            </div>
        </aside>
      </div>
    </>
  );
};
export default Dashboard;
