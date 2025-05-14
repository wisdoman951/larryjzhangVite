// src/components/Dashboard.jsx
import React, { useState, useCallback, useEffect } from 'react'; // 從 react 引入
import { useHistory, Link } from 'react-router-dom';    // 從 react-router-dom 引入
import axios from 'axios';                              // 從 axios 引入
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Dashboard = () => {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([{ sender: "AI", message: "你好！我是你的 AI 助理，問我任何問題吧！" }]);
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory();

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const currentChatMessages = [...chatMessages, { sender: "User", message: chatInput }];
    setChatMessages(currentChatMessages);
    const currentInput = chatInput;
    setChatInput("");

    setIsLoading(true);
    try {
      // 使用全域 axios
      const response = await axios.post( 
        "https://dm2nkd04w0.execute-api.ap-northeast-1.amazonaws.com/prod/chat",
        { input: currentInput },
        { timeout: 15000 }
      );
      let responseBody;
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
    history.push("/report");
  };

   return (
    // 這個 Fragment <>...</> 替換了之前 Dashboard 最外層的佈局 div
    // 因為 MainLayout 已經提供了 flex flex-col h-screen 等
    <> 
      <header className="bg-blue-700/80 text-white p-4 shadow-lg backdrop-blur-md sticky top-0 z-20">
        {/* sticky top-0 z-20 讓 header 在頁面滾動時固定在頂部，並確保它在 "Larry's Probation Demo" 文字之上 */}
        <h1 className="text-3xl font-bold text-center">AI 平台 Dashboard</h1>
      </header>
      
      {/* 主體內容區域 */}
      <div className="flex flex-1 overflow-hidden"> {/* 這個 flex 用於 main 和 aside 的左右佈局 */}
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto"> {/* 允許 main 區域獨立滾動 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              { title: "報告撰寫", desc: "自動讀取客戶文件並生成評估報告", action: handleReportGeneration, linkTo: null },
              { title: "合規性評估", desc: "分析訪談紀錄並評估法規合規性", action: null, linkTo: "/compliance" },
              { title: "專案管理", desc: "追蹤專案進度與任務狀態", action: () => alert("專案管理功能開發中！"), linkTo: null }
            ].map((card, index) => (
              <div 
                key={index} 
                className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-lg p-6 rounded-xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 border border-white/30"
              >
                <h2 className="text-2xl font-bold mb-3 text-white dark:text-sky-300 text-shadow-md"> 
                  {card.title}
                </h2>
                <p className="text-gray-100 dark:text-gray-200 mb-5 min-h-[40px] text-shadow-sm">
                  {card.desc}
                </p>
                {card.action ? (
                  <button 
                      onClick={card.action} 
                      className="bg-sky-500/80 hover:bg-sky-600/90 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-sky-400/60 transition-all duration-300 transform hover:scale-105 border border-sky-400/50 backdrop-blur-sm"
                  >
                    開始
                  </button>
                ) : card.linkTo ? (
                  <Link to={card.linkTo}> 
                    <button 
                      className="bg-sky-500/80 hover:bg-sky-600/90 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-sky-400/60 transition-all duration-300 transform hover:scale-105 border border-sky-400/50 backdrop-blur-sm"
                    >
                      開始
                    </button>
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </main>

        <aside className="w-full md:w-96 bg-slate-800/60 dark:bg-slate-900/70 backdrop-blur-xl border-l border-gray-500/30 p-4 flex flex-col shadow-2xl">
          {/* ... AI 助理聊天區的 JSX，與您之前提供的版本類似，確保文字顏色在深色背景上可讀 ... */}
          <h2 className="text-xl font-semibold mb-4 text-sky-200 dark:text-sky-300 text-shadow-sm">AI 助理</h2>
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 p-3 bg-slate-700/50 dark:bg-slate-800/60 rounded-lg shadow-inner">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === "User" ? "justify-end" : "justify-start"}`}>
                  <span className={`inline-block py-2 px-3 rounded-xl shadow-md max-w-xs break-words ${
                    msg.sender === "User" 
                    ? "bg-blue-500 text-white" 
                    : "bg-slate-600 text-gray-100 dark:bg-slate-500 dark:text-gray-50"
                  }`}>
                    {/* Markdown 渲染 (如果聊天訊息也需要) */}
                    { typeof ReactMarkdown === 'function' && typeof remarkGfm === 'function' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.message}</ReactMarkdown>
                      ) : (
                        msg.message
                      )
                    }
                  </span>
                </div>
              ))}
              {isLoading && ( Loading中你等等感恩 )}
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
export default Dashboard; // 加上 ES6 模組導出
