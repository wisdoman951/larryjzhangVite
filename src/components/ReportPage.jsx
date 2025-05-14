import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom'; // 直接從 'react-router-dom' 引入 useHistory
import axios from 'axios';
import ReactMarkdown from 'react-markdown'; // 透過 import 引入
import remarkGfm from 'remark-gfm'; // 透過 import 引入

const ReportPage = () => {
  // React Hooks (useState, useCallback, useEffect) 已經從頂部的 import 引入，無需再次從 React 物件解構
  const history = useHistory(); // 直接使用從 'react-router-dom' 引入的 useHistory

  const [docUrl, setDocUrl] = useState("");
  const [aiMessages, setAiMessages] = useState([{ id: 'initial-ai-msg', sender: "AI", message: "您好！我是 AI 資料分析專家。請上傳主文件與輔助文件，我會幫您提供建議！" }]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [helperFiles, setHelperFiles] = useState([]);
  const [mainFileName, setMainFileName] = useState("");
  const [chatInput, setChatInput] = useState(""); // 新增聊天輸入框的 state

  const API_START_ANALYSIS_URL = "https://obo4249fxa.execute-api.ap-northeast-1.amazonaws.com/prod/start-analysis";
  const API_GET_STATUS_URL = "https://obo4249fxa.execute-api.ap-northeast-1.amazonaws.com/prod/get-analysis-status";
  const API_CHAT_URL = "https://obo4249fxa.execute-api.ap-northeast-1.amazonaws.com/prod/chat";

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    setErrorMessage("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      // 假設 /api/upload-to-drive 是你的後端上傳接口
      const response = await axios.post("/api/upload-to-drive", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.status !== 200 || !response.data.docUrl) {
        throw new Error(response.data.message || "主文件上傳或獲取 URL 失敗");
      }
      setDocUrl(response.data.docUrl);
      setMainFileName(file.name);
      setAiMessages(prev => [...prev, { id: `ai-msg-${Date.now()}`, sender: "AI", message: `主文件「${file.name}」已載入。您可以繼續上傳輔助文件，或開始分析。` }]);
    } catch (error) {
      console.error("主文件上傳錯誤:", error);
      const errorMsg = `主文件上傳失敗：${error.message || '未知錯誤'}`;
      setErrorMessage(errorMsg);
      setAiMessages(prev => [...prev, { id: `ai-err-${Date.now()}`, sender: "AI", message: errorMsg }]);
    } finally {
      setIsLoading(false);
      e.target.value = null; // 清空 file input
    }
  };

  const handleHelperUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    setErrorMessage("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await axios.post("/api/upload-to-drive", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.status !== 200 || !response.data.docUrl) {
        throw new Error(response.data.message || "輔助文件上傳或獲取 URL 失敗");
      }
      const newHelperFile = { url: response.data.docUrl, name: file.name };
      setHelperFiles(prev => [...prev, newHelperFile]);
      setAiMessages(prev => [...prev, { id: `ai-msg-${Date.now()}`, sender: "AI", message: `輔助文件「${file.name}」已載入。` }]);
    } catch (error) {
      console.error("輔助文件上傳錯誤:", error);
      const errorMsg = `輔助文件上傳失敗：${error.message || '未知錯誤'}`;
      setErrorMessage(errorMsg);
      setAiMessages(prev => [...prev, { id: `ai-err-${Date.now()}`, sender: "AI", message: errorMsg }]);
    } finally {
      setIsLoading(false);
      e.target.value = null; // 清空 file input
    }
  };

  const pollForResult = useCallback(async (jobId, attempts = 0, lastStatusMessageId = null) => {
    const maxAttempts = 120;
    const interval = 5000;

    console.log(`Polling for jobId: ${jobId}, attempt: ${attempts + 1}`);

    if (attempts >= maxAttempts) {
      setErrorMessage(`查詢分析結果超時 (任務 ID: ${jobId})。處理時間可能過長，請檢查後端日誌或稍後再試。`);
      if (lastStatusMessageId) {
        setAiMessages(prev => prev.map(m =>
          m.id === lastStatusMessageId ? { ...m, message: `查詢結果超時 (任務 ID: ${jobId})。` } : m
        ));
      } else {
        setAiMessages(prev => [...prev, { id: `ai-timeout-${jobId}`, sender: "AI", message: `查詢結果超時 (任務 ID: ${jobId})。` }]);
      }
      setIsLoading(false);
      return;
    }

    let currentLastStatusMessageId = lastStatusMessageId;

    try {
      const statusResponse = await axios.get(`${API_GET_STATUS_URL}?jobId=${jobId}`);

      if (statusResponse.status === 200 && statusResponse.data) {
        const jobData = statusResponse.data;
        console.log("Job status data:", jobData);

        if (jobData.status === 'COMPLETED') {
          if (currentLastStatusMessageId) {
            setAiMessages(prev => prev.filter(m => m.id !== currentLastStatusMessageId));
          }
          setAiMessages(prev => [...prev, { id: `ai-complete-${jobId}`, sender: "AI", message: `任務 (ID: ${jobId}) 分析完成！` }]);

          const aiResult = jobData.result;
          let aiResponseMessage = "分析完成，但未獲取到具體建議內容。";

          if (aiResult && aiResult.suggestions && Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0) {
            aiResponseMessage = aiResult.suggestions[0];
          } else if (aiResult && aiResult.aiResponse) {
            aiResponseMessage = aiResult.aiResponse;
          } else if (aiResult && aiResult.error) {
            aiResponseMessage = `AI 分析時遇到問題：${aiResult.error} ${aiResult.raw_ai_response ? `(原始回覆片段: ${aiResult.raw_ai_response.substring(0, 100)}...)` : ''}`;
          }

          setAiMessages(prev => [...prev, {
            id: `ai-result-${jobId}`,
            sender: "AI",
            message: aiResponseMessage,
            messageType: 'analysis_result'
          }]);
          setIsLoading(false);
        } else if (jobData.status === 'FAILED') {
          if (currentLastStatusMessageId) {
            setAiMessages(prev => prev.filter(m => m.id !== currentLastStatusMessageId));
          }
          const errorDetail = jobData.errorDetails || "未知錯誤，詳情請查看 Lambda B 日誌。";
          setErrorMessage(`分析任務 (ID: ${jobId}) 失敗：${errorDetail.substring(0, 300)}...`);
          setAiMessages(prev => [...prev, { id: `ai-failed-${jobId}`, sender: "AI", message: `任務 (ID: ${jobId}) 處理失敗。詳情：${errorDetail.substring(0, 300)}...` }]);
          setIsLoading(false);
        } else {
          let pendingMessage = `分析仍在進行中 (ID: ${jobId})，請稍候... (進度 ${attempts + 1}/${maxAttempts})`;
          if (attempts > 3 && attempts <= 10) {
            pendingMessage = `正在讀取與理解文件內容 (ID: ${jobId})... (進度 ${attempts + 1}/${maxAttempts})`;
          } else if (attempts > 10 && attempts <= 25) {
            pendingMessage = `AI 引擎正在深度分析並生成建議 (ID: ${jobId})... (進度 ${attempts + 1}/${maxAttempts})`;
          } else if (attempts > 25) {
            pendingMessage = `即將完成分析，正在整理結果 (ID: ${jobId})... (進度 ${attempts + 1}/${maxAttempts})`;
          }

          if (currentLastStatusMessageId) {
            setAiMessages(prev => prev.map(m =>
              m.id === currentLastStatusMessageId ? { ...m, message: pendingMessage } : m
            ));
          } else {
            const newStatusMsg = { id: `status-${jobId}-${Date.now()}`, sender: "AI_STATUS_UPDATE", message: pendingMessage };
            setAiMessages(prev => [...prev, newStatusMsg]);
            currentLastStatusMessageId = newStatusMsg.id;
          }
          setTimeout(() => pollForResult(jobId, attempts + 1, currentLastStatusMessageId), interval);
        }
      } else {
        console.error("查詢任務狀態時 API 回應非 200:", statusResponse);
        if (attempts < maxAttempts - 1) {
          setTimeout(() => pollForResult(jobId, attempts + 1, currentLastStatusMessageId), interval * 2);
        } else {
          throw new Error(`查詢任務狀態時 API 回應錯誤多次，狀態碼：${statusResponse.status}`);
        }
      }
    } catch (err) {
      console.error("輪詢錯誤:", err);
      if (attempts < maxAttempts - 1) {
        const retryErrorMessage = `查詢結果時遇到問題 (嘗試 ${attempts + 1}/${maxAttempts})，將於 ${interval * 2 / 1000} 秒後重試...`;
        if (currentLastStatusMessageId) {
          setAiMessages(prev => prev.map(m =>
            m.id === currentLastStatusMessageId ? { ...m, message: retryErrorMessage } : m
          ));
        } else {
          const newErrorMsg = { id: `status-err-${jobId}-${Date.now()}`, sender: "AI_STATUS_UPDATE", message: retryErrorMessage };
          setAiMessages(prev => [...prev, newErrorMsg]);
          currentLastStatusMessageId = newErrorMsg.id;
        }
        setTimeout(() => pollForResult(jobId, attempts + 1, currentLastStatusMessageId), interval * 2);
      } else {
        setErrorMessage(`多次輪詢分析結果失敗 (任務 ID: ${jobId})。網路可能不穩定或後端處理發生嚴重錯誤。詳細資訊: ${err.message}`);
        if (currentLastStatusMessageId) {
          setAiMessages(prev => prev.map(m =>
            m.id === currentLastStatusMessageId ? { ...m, message: `無法獲取任務 (ID: ${jobId}) 的最終結果。` } : m
          ));
        } else {
          setAiMessages(prev => [...prev, { id: `ai-final-err-${jobId}`, sender: "AI", message: `無法獲取任務 (ID: ${jobId}) 的最終結果。` }]);
        }
        setIsLoading(false);
      }
    }
  }, [API_GET_STATUS_URL]); // 移除 setAiMessages, setErrorMessage, setIsLoading，因為它們是 setState 函數，其身份是穩定的

  const handleAnalyze = async () => {
    if (!docUrl) {
      setErrorMessage("請先上傳主文件");
      setAiMessages(prev => [...prev, { id: `ai-err-${Date.now()}`, sender: "AI", message: "請先上傳主文件，我才能進行分析。" }]);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setAiMessages(prev => [...prev, { id: `ai-msg-${Date.now()}`, sender: "AI", message: "正在準備分析請求..." }]);

    const requestBody = {
      docUrl: docUrl,
      helperUrls: helperFiles.map(file => file.url),
      interactionType: "analysis"
    };

    try {
      console.log("Sending to start_analysis:", requestBody);
      const response = await axios.post(API_START_ANALYSIS_URL, requestBody, {
        timeout: 20000
      });

      if (response.status === 202 && response.data.jobId) {
        const jobId = response.data.jobId;
        setAiMessages(prev => [
          ...prev,
          { id: `ai-job-${jobId}`, sender: "AI", message: `分析任務已成功提交 (任務 ID: ${jobId})。正在處理中，請耐心等候...` }
        ]);
        pollForResult(jobId);
      } else {
        console.error("啟動分析任務 API 回應非 202:", response);
        throw new Error(`啟動分析任務失敗，狀態碼：${response.status}, 回應：${JSON.stringify(response.data)}`);
      }
    } catch (err) {
      console.error("啟動分析任務時發生錯誤:", err);
      let detailedErrorMessage = err.message;
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        detailedErrorMessage = `${err.message} (後端錯誤: ${err.response.data.error || err.response.data.message})`;
      } else if (err.response) {
        detailedErrorMessage = `${err.message} (狀態碼: ${err.response.status})`;
      }
      setErrorMessage(`啟動分析任務失敗：${detailedErrorMessage}`);
      setAiMessages(prev => [...prev, { id: `ai-start-err-${Date.now()}`, sender: "AI", message: `啟動分析任務時發生錯誤：${detailedErrorMessage}` }]);
      setIsLoading(false);
    }
  };

  const handleAiChatSubmit = async () => { // Renamed from handleAiChat to avoid conflict with onKeyPress event. And removed 'e' parameter as it's called directly.
    if (!chatInput.trim()) return;

    const userInput = chatInput.trim();
    const currentUserMessage = { id: `user-msg-${Date.now()}`, sender: "User", message: userInput };

    setAiMessages(prev => [...prev, currentUserMessage]);
    setChatInput(""); // Clear input after sending

    const isRelevant = userInput.toLowerCase().includes("文件") ||
      userInput.toLowerCase().includes("報告") ||
      userInput.toLowerCase().includes("分析") ||
      userInput.toLowerCase().includes("王小華") ||
      userInput.toLowerCase().includes("是做什麼的");

    if (!docUrl && !isRelevant) {
      setAiMessages(prev => [...prev, { id: `ai-warn-${Date.now()}`, sender: "AI", message: "請先上傳主文件，我才能根據文件內容回答您的問題。" }]);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const requestBody = {
      docUrl: docUrl,
      helperUrls: helperFiles.map(file => file.url),
      userInput: userInput,
    };

    try {
      console.log("Sending CHAT request to NEW chat endpoint:", requestBody);
      const response = await axios.post(API_CHAT_URL, requestBody, {
        timeout: 28000
      });

      if (response.status === 200 && response.data && response.data.aiResponse) {
        setAiMessages(prev => [...prev, { id: `ai-chat-resp-${Date.now()}`, sender: "AI", message: response.data.aiResponse }]);
      } else {
        console.error("AI 聊天 API 回應格式錯誤:", response);
        throw new Error(`AI 聊天回應格式錯誤，狀態碼：${response.status}, 回應：${JSON.stringify(response.data)}`);
      }
    } catch (err) {
      console.error("AI 聊天錯誤:", err);
      let detailedErrorMessage = err.message;
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        detailedErrorMessage = `${err.message} (後端錯誤: ${err.response.data.error || err.response.data.message})`;
      } else if (err.response) {
        detailedErrorMessage = `${err.message} (狀態碼: ${err.response.status})`;
      }
      setErrorMessage(`AI 聊天失敗：${detailedErrorMessage}`);
      setAiMessages(prev => [...prev, { id: `ai-chat-err-${Date.now()}`, sender: "AI", message: `抱歉，回答您的問題時發生錯誤：${detailedErrorMessage.substring(0, 150)}...` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <header
        className="bg-sky-700/70 text-white p-3 shadow-lg backdrop-blur-md sticky top-0 z-30 flex items-center"
      >
        <button
          onClick={() => history.push("/")}
          className="text-white mr-4 hover:bg-sky-600/50 p-2 rounded-md transition-colors text-sm"
        >
          ← 返回 Dashboard
        </button>
        <h1 className="text-xl font-semibold">報告撰寫</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/3 p-4 md:p-6 flex flex-col overflow-hidden bg-slate-800/40 backdrop-blur-lg border-r border-sky-700/30">
          <h2 className="text-lg font-semibold mb-3 text-sky-100 text-shadow-sm shrink-0">文件編輯區</h2>
          <div className="mb-3 shrink-0">
            <input
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-300
                                 file:mr-4 file:py-2 file:px-4
                                 file:rounded-md file:border-0
                                 file:text-sm file:font-semibold
                                 file:bg-sky-500/90 file:text-sky-50
                                 hover:file:bg-sky-600/90 disabled:opacity-50
                                 mb-1"
              disabled={isLoading}
            />
            <div className="text-xs text-sky-200/80">上傳主文件（.docx）{mainFileName && `- 目前: ${mainFileName}`}</div>
          </div>
          <div className="mb-4 shrink-0">
            <input
              type="file"
              accept=".docx,.pdf,.txt"
              onChange={handleHelperUpload}
              className="block w-full text-sm text-slate-300
                                 file:mr-4 file:py-2 file:px-4
                                 file:rounded-md file:border-0
                                 file:text-sm file:font-semibold
                                 file:bg-teal-500/90 file:text-teal-50
                                 hover:file:bg-teal-600/90 disabled:opacity-50
                                 mb-1"
              disabled={isLoading}
            />
            <div className="text-xs text-sky-200/80">
                上傳輔助文件
                {helperFiles.length > 0 && (
                    <span> - 目前: {helperFiles.map(f => f.name).join(', ')}</span>
                )}
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            className="mb-3 shrink-0 w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:from-sky-500"
            disabled={isLoading || !docUrl}
          >
            {isLoading && aiMessages.some(m => m.message && m.message.includes("分析任務已成功提交")) ? '分析處理中...' : '讓 AI 幫我分析與建議'}
          </button>
          {errorMessage && (<div className="mb-3 shrink-0 p-3 text-red-100 bg-red-500/60 border border-red-400/80 rounded-lg shadow-md text-sm">{errorMessage}</div>)}

          <div className="flex-1 mt-2 overflow-hidden rounded-lg shadow-inner bg-black/10">
            {docUrl ? (
              <iframe src={docUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Google Docs Editor" />
            ) : (
              <div className="text-slate-400 flex items-center justify-center h-full border-2 border-dashed border-slate-600/70 rounded-lg bg-slate-800/30">
                <p className="text-center">請上傳主文件以在此處預覽和編輯 Google Doc。</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-1/3 p-4 md:p-6 flex flex-col bg-slate-900/50 backdrop-blur-xl shadow-lg">
          <h2 className="text-lg font-semibold mb-3 text-sky-100 text-shadow-sm shrink-0">AI 互動區</h2>
          <div
            className="flex-1 overflow-y-auto mb-3 space-y-3 p-3 bg-slate-800/60 rounded-lg shadow-inner"
            style={{ minHeight: '200px' }}
          >
            {aiMessages.map((msg) => ( // Removed index as key if msg.id is present
              <div key={msg.id || `msg-${Math.random()}`} className={`flex ${msg.sender === "User" ? "justify-end" : "justify-start"}`}> {/* Ensure unique key, added Math.random() as fallback */}
                <div className={`py-2 px-3 rounded-lg shadow-md max-w-[90%] break-words text-sm ${msg.sender === "User"
                    ? "bg-blue-600 text-white"
                    : (msg.messageType === 'analysis_result' ? "bg-green-700/80 text-white" : (msg.sender === "AI_STATUS_UPDATE" ? "bg-yellow-600/80 text-white" : "bg-slate-600 text-gray-100"))
                  }`}>
                  {/* 使用 import 的 ReactMarkdown 和 remarkGfm */}
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.message}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && aiMessages.every(m => !m.message.includes("分析任務已成功提交") && !m.message.includes("處理中")) && ( // Conditional loading text
                <div className="flex justify-start">
                    <div className="py-2 px-3 rounded-lg shadow-md max-w-[90%] break-words text-sm bg-slate-600 text-gray-100">
                        Loading中請稍後...
                    </div>
                </div>
            )}
          </div>
          <div className="flex items-center mt-auto pt-3 border-t border-slate-700/80">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleAiChatSubmit()}
              className="flex-1 p-3 border border-slate-500/70 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm bg-slate-700/60 text-white placeholder-slate-400 dark:bg-slate-800/70 dark:text-gray-100 dark:placeholder-gray-500"
              placeholder="與 AI 針對文件內容對話..."
              disabled={isLoading}
            />
            <button
              onClick={handleAiChatSubmit}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold p-3 rounded-r-lg shadow-md disabled:opacity-60 disabled:hover:bg-sky-600"
              disabled={isLoading || !chatInput.trim()}
            >
              發送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;