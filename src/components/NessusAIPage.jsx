import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, MessageSquare, Send, Download, AlertCircle, Loader2, CheckCircle, RefreshCw, FileText, BarChart2, ListChecks, HelpCircle, Activity } from 'lucide-react'; // Added more icons
import { v4 as uuidv4 } from 'uuid';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';



// --- API 端點 ---
const GENERATE_PRESIGNED_URL_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url';
const CHAT_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/chat';
const CHECK_REPORT_STATUS_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/get-process-report';

const NessusAIPage = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null); 
  const currentJobIdRef = useRef(currentJobId); 

  const [isUploading, setIsUploading] = useState(false); 
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filesUploadedCount, setFilesUploadedCount] = useState(0);

  const [isProcessingReport, setIsProcessingReport] = useState(false); 
  const [processingStatusMessage, setProcessingStatusMessage] = useState('');
  
  const [reportReady, setReportReady] = useState(false);
  const [reportDownloadUrl, setReportDownloadUrl] = useState('');
  const [reportS3KeyForChat, setReportS3KeyForChat] = useState(''); 
  const [reportS3BucketForChat, setReportS3BucketForChat] = useState('');
  const [reportFileNameForDisplay, setReportFileNameForDisplay] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [chatError, setChatError] = useState('');
  const [currentChartData, setCurrentChartData] = useState(null); // 新增：存儲圖表數據

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const pollingIntervalRef = useRef(null); 
  const PIE_CHART_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

  const logger = {
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  };

  useEffect(() => {
    setChatMessages([{ id: Date.now(), text: '您好！請上傳一個包含 Nessus CSV 報告的 ZIP 壓縮檔。', sender: 'system' }]);
    return () => { 
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // 使用 useEffect 來同步 currentJobId 狀態到 currentJobIdRef
  useEffect(() => {
    currentJobIdRef.current = currentJobId;
    logger.info(`useEffect: currentJobId state is now: ${currentJobId}, currentJobIdRef.current is: ${currentJobIdRef.current}`);
  }, [currentJobId]);

  useEffect(() => { 
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; 
  }, [chatMessages]);

  const triggerFileInput = () => {
    if (currentJobIdRef.current || isUploading || isProcessingReport) { // 使用 ref 進行判斷
        logger.warn("triggerFileInput: 操作被忽略，目前有任務正在進行中。");
        setUploadError("目前有任務正在處理中，請等待完成或點擊「處理新報告」。");
        return;
    }
    fileInputRef.current.click();
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const resetTaskStates = (initiatingNewJob = false, fromNewFileSelection = false) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      logger.info("resetTaskStates: 已清除輪詢 interval。");
    }
    
    setUploadError(''); 
    setUploadProgress(0); 
    setFilesUploadedCount(0);
    
    if (initiatingNewJob) {
        logger.info(`resetTaskStates: 準備為新任務重置 currentJobId (之前是: ${currentJobIdRef.current})。`);
        setCurrentJobId(null); // 這會觸發上面的 useEffect 來更新 currentJobIdRef.current
    }
    
    setReportReady(false); 
    setReportDownloadUrl(''); 
    setReportS3KeyForChat('');
    setReportS3BucketForChat(''); 
    setReportFileNameForDisplay('');
	setCurrentChartData(null);
    if (initiatingNewJob) { 
        setIsProcessingReport(false); 
        setProcessingStatusMessage('');
        if (fromNewFileSelection) {
             setChatMessages([{ id: Date.now(), text: '請選擇一個 ZIP 檔案以上傳。', sender: 'system' }]);
        } else {
             setChatMessages([{ id: Date.now(), text: '請上傳一個新的 ZIP 壓縮檔。', sender: 'system' }]);
        }
    }
  };
  const handleFilesValidation = (incomingFiles) => {
    setSelectedFiles([]); 
    setUploadError('');   

    if (!incomingFiles || incomingFiles.length === 0) return true;

    if (incomingFiles.length > 1) {
        setUploadError('請一次只上傳一個 ZIP 檔案。');
        return false;
    }
    const file = incomingFiles[0];
    if (!file.name.toLowerCase().endsWith('.zip')) {
        setUploadError(`檔案格式錯誤：${file.name} 不是 ZIP 檔案。`);
        return false;
    }
    setSelectedFiles([file]);
    return true;
  };

  const handleFileChange = (event) => {
    if (isUploading || isProcessingReport) { // 直接使用 state 判斷即可
        logger.warn("handleFileChange: 操作被忽略，目前有任務正在上傳或處理中。");
        setUploadError("目前有任務正在處理中，請先等待其完成。");
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        return;
    }
    resetTaskStates(true, true); 
    handleFilesValidation(event.target.files ? Array.from(event.target.files) : []);
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const handleDrop = (event) => {
    event.preventDefault(); setIsDragging(false); 
    if (isUploading || isProcessingReport) {
        logger.warn("handleDrop: 操作被忽略，目前有任務正在上傳或處理中。");
        setUploadError("目前有任務正在處理中，請先等待其完成。");
        return;
    }
    resetTaskStates(true, true); 
    handleFilesValidation(event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []);
  };

  const uploadSingleFileToS3 = async (file, jobIdToUse) => {
    // ... (此函數與之前版本相同) ...
    try {
      logger.info(`請求預簽名 URL，jobId: ${jobIdToUse}, fileName: ${file.name}`);
      const presignedUrlResponse = await fetch(GENERATE_PRESIGNED_URL_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/zip', jobId: jobIdToUse }),
      });
      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json().catch(() => ({error: "獲取上傳授權失敗，回應非JSON"}));
        throw new Error(errorData.error || `無法獲取 ${file.name} 的上傳授權 (狀態: ${presignedUrlResponse.status})。`);
      }
      const { presignedUrl, s3Key, s3Bucket, jobId: returnedJobId } = await presignedUrlResponse.json();
      if (jobIdToUse !== returnedJobId) { logger.warn(`JobId 不匹配！前端使用 ${jobIdToUse}, Lambda 回傳 ${returnedJobId}.`);}
      const s3PutHeaders = {
        'Content-Type': file.type || 'application/zip',
        'x-amz-meta-job-id': jobIdToUse, 
        'x-amz-meta-original-filename': file.name 
      };
      logger.info(`開始上傳 ${file.name} 到 S3 (Key: ${s3Key})，Headers:`, s3PutHeaders);
      const uploadToS3Response = await fetch(presignedUrl, {method: 'PUT', body: file, headers: s3PutHeaders});
      if (!uploadToS3Response.ok) {
        let s3ErrorText = `檔案 ${file.name} 上傳 S3 失敗 (狀態: ${uploadToS3Response.status})。`;
        try { const s3ErrorXml = await uploadToS3Response.text(); logger.error("S3 PUT Error XML:", s3ErrorXml); } 
        catch (xmlError) { logger.error("無法讀取 S3 錯誤回應 body:", xmlError); }
        throw new Error(s3ErrorText);
      }
      logger.info(`檔案 ${file.name} 已成功上傳到 s3://${s3Bucket}/${s3Key}`);
      return { success: true, s3Key, s3Bucket, originalFileName: file.name, jobId: jobIdToUse };
    } catch (error) {
      logger.error(`上傳檔案 ${file.name} 失敗:`, error);
      return { success: false, originalFileName: file.name, error: error.message, jobId: jobIdToUse };
    }
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFiles || selectedFiles.length === 0 || !selectedFiles[0]) {
        setUploadError('請先選擇一個 ZIP 檔案。'); return;
    }
    const fileToUpload = selectedFiles[0];
    if (!fileToUpload.name.toLowerCase().endsWith('.zip')) {
         setUploadError('檔案格式錯誤，請確保上傳的是 .zip 檔案。'); return;
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      logger.info("handleUploadAndProcess: 已清除舊的輪詢 interval。");
    }

    const newJobId = uuidv4();
    
    // 設定初始狀態，然後立即設定 currentJobId
    setUploadError(''); 
    setUploadProgress(0);
    setFilesUploadedCount(0);
    setReportReady(false); 
    setReportDownloadUrl(''); 
    setReportS3KeyForChat('');
    setReportS3BucketForChat(''); 
    setReportFileNameForDisplay('');
    setIsProcessingReport(true); 
    setProcessingStatusMessage('🚀 準備上傳檔案...');
    setChatMessages(prev => prev.filter(m => m.sender === 'system' && m.text.startsWith('您好！')).concat({id: Date.now(), text: `🚀 任務 ${newJobId} 開始，準備上傳檔案...`, sender: 'system'}));
    
    setCurrentJobId(newJobId); // 設定新的 Job ID
    // currentJobIdRef.current 會通過 useEffect 自動更新
    logger.info(`新任務開始，Job ID (React state 即將更新為): ${newJobId}`);
    
    setIsUploading(true); 
    
    const result = await uploadSingleFileToS3(fileToUpload, newJobId); 
    
    if (!result.success) {
        setIsUploading(false);
        setIsProcessingReport(false); 
        setUploadError(prev => `${prev}檔案 ${result.originalFileName} 上傳失敗: ${result.error}. `);
        setChatMessages(prevMsgs => [...prevMsgs, {id: Date.now(), text: `❌ 檔案 ${result.originalFileName} 上傳失敗。任務 ${newJobId} 中止。`, sender: 'system-error'}]);
        setCurrentJobId(null); 
        return; 
    }
    
    setFilesUploadedCount(1);
    setUploadProgress(100);   
    
    setIsUploading(false); 
    setProcessingStatusMessage('✅ ZIP 檔案已上傳到 S3。後端正在處理報告，請稍候...');
    setChatMessages(prev => [...prev, {id: Date.now()+1, text: `✅ ZIP 檔案上傳成功！任務 ${newJobId} 的報告正在後端生成中...`, sender: 'system'}]);
    
    startPollingForReport(newJobId); // 只傳遞 jobIdToPoll
  };
  
  const startPollingForReport = (jobIdToPoll) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    let attempts = 0;
    const maxAttempts = 36; 
    const pollIntervalMs = 10000;
    // 在啟動輪詢時，記錄當時的 currentJobId (從 ref 獲取最新值)
    const activeJobIdWhenPollingStarted = currentJobIdRef.current;
    logger.info(`輪詢啟動: 針對 jobId=${jobIdToPoll}, 啟動時的 activeJobId (ref)=${activeJobIdWhenPollingStarted}, API=${CHECK_REPORT_STATUS_API}`);
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      
      // 使用 currentJobIdRef.current 來獲取最新的 React state currentJobId
      const latestCurrentJobIdFromState = currentJobIdRef.current;

      if (latestCurrentJobIdFromState !== jobIdToPoll) {
          logger.warn(`全局 currentJobId (ref: ${latestCurrentJobIdFromState}) 與此輪詢的 jobId (${jobIdToPoll}) 不符，停止此輪詢。`);
          clearInterval(pollingIntervalRef.current);
          return;
      }

      if (attempts > maxAttempts) { 
        logger.warn(`輪詢 jobId ${jobIdToPoll} 已達到最大嘗試次數 ${maxAttempts}。`);
        clearInterval(pollingIntervalRef.current); 
        if (isProcessingReport && latestCurrentJobIdFromState === jobIdToPoll) { 
            setIsProcessingReport(false);
            setProcessingStatusMessage(`報告處理超時 (任務 ${jobIdToPoll})。`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 任務 ${jobIdToPoll} 報告處理超時。`, sender: 'system-error'}]);
        }
        return;
      }

      // 只有當輪詢的 jobId 仍然是當前活躍的 jobId 時，才更新 "正在檢查" 的訊息
      if (latestCurrentJobIdFromState === jobIdToPoll) {
        setProcessingStatusMessage(`正在檢查報告狀態 (任務 ${jobIdToPoll}, 嘗試 ${attempts}/${maxAttempts})...`);
      }
      
      try {
        const apiUrl = `${CHECK_REPORT_STATUS_API}?jobId=${encodeURIComponent(jobIdToPoll)}`;
        logger.info(`輪詢 API (為 jobId ${jobIdToPoll}, 當前 state.currentJobId 為 ${latestCurrentJobIdFromState}): ${apiUrl}`);
        const reportStatusResponse = await fetch(apiUrl);
        const data = await reportStatusResponse.json();

        // 再次檢查最新的 currentJobId (從 ref)
        if (currentJobIdRef.current !== jobIdToPoll) {
            logger.warn(`在 fetch 回應後，全局 currentJobId (ref: ${currentJobIdRef.current}) 與輪詢的 jobId (${jobIdToPoll}) 不符，停止。`);
            clearInterval(pollingIntervalRef.current);
            return;
        }

        if (data.jobId && data.jobId !== jobIdToPoll) {
            logger.warn(`API 返回的 jobId (${data.jobId}) 與輪詢的 jobId (${jobIdToPoll}) 不匹配，忽略。`);
            return; 
        }

        if (data.status === 'COMPLETED' && reportStatusResponse.ok) {
          logger.info(`輪詢成功 (為 jobId ${jobIdToPoll})，報告已完成!`, data);
          clearInterval(pollingIntervalRef.current); 

          setReportDownloadUrl(data.downloadUrl);
          setReportFileNameForDisplay(data.fileName);
          setReportS3KeyForChat(data.s3Key); 
          setReportS3BucketForChat(data.s3Bucket);
          // currentJobId 應該已經是 jobIdToPoll
          setIsProcessingReport(false); 
          setReportReady(true);       
          setProcessingStatusMessage(`🎉 報告 "${data.fileName}" (任務 ${jobIdToPoll}) 已成功產生！`);
          setChatMessages(prev => [...prev.filter(m=>m.sender !== 'system-error'), {id: Date.now(), text: `🎉 報告 "${data.fileName}" 已就緒！`, sender: 'system'}]);
		  setCurrentChartData(null); // 報告剛就緒時，清除舊的圖表數據
          return; 
        }
        
        if (data.status === 'PROCESSING' || data.status === 'UPLOADING' || reportStatusResponse.status === 202) {
            if (latestCurrentJobIdFromState === jobIdToPoll) { // 只更新當前任務的訊息
                logger.info(`輪詢嘗試 ${attempts}: 報告仍在處理中 (JobId: ${jobIdToPoll}, API狀態: ${data.status || 'N/A'})`);
            }
        } else if (data.status === 'FAILED') {
          logger.error(`輪詢嘗試 ${attempts}: 報告處理失敗 (JobId: ${jobIdToPoll})`, data.message);
          clearInterval(pollingIntervalRef.current); 
          if (latestCurrentJobIdFromState === jobIdToPoll) {
            setIsProcessingReport(false);
            setProcessingStatusMessage(`報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `❌ 報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`, sender: 'system-error'}]);
          }
        } else if (reportStatusResponse.status === 404) { 
            if (attempts < 6 && latestCurrentJobIdFromState === jobIdToPoll) { 
                logger.info(`輪詢嘗試 ${attempts}: 任務 ${jobIdToPoll} 尚未在追蹤系統中找到 (404)，繼續嘗試...`);
                setProcessingStatusMessage(`等待任務 ${jobIdToPoll} 註冊於追蹤系統... (嘗試 ${attempts})`);
            } else if (latestCurrentJobIdFromState === jobIdToPoll) { // 多次 404 後，且仍是當前任務
                logger.warn(`輪詢嘗試 ${attempts}: 多次嘗試後仍無法找到任務 ${jobIdToPoll} (404)。`);
                clearInterval(pollingIntervalRef.current); setIsProcessingReport(false);
                setProcessingStatusMessage(`無法找到任務 ${jobIdToPoll} 的追蹤記錄。`);
                setChatMessages(prev => [...prev, {id: Date.now(), text: `❌ 無法追蹤任務 ${jobIdToPoll}。`, sender: 'system-error'}]);
            }
        } else { 
          logger.warn(`輪詢嘗試 ${attempts}: 未預期的 API 回應 (JobId: ${jobIdToPoll}, HTTP狀態: ${reportStatusResponse.status})`, data);
        }
      } catch (error) { 
        logger.error(`輪詢嘗試 ${attempts}: 網路錯誤或 API 呼叫失敗 (JobId: ${jobIdToPoll})`, error);
        if (attempts > maxAttempts - 3 && currentJobIdRef.current === jobIdToPoll) { 
            clearInterval(pollingIntervalRef.current); setIsProcessingReport(false);
            setProcessingStatusMessage(`輪詢因網路問題多次失敗 (任務 ${jobIdToPoll})。`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 輪詢 API 失敗多次，請檢查網路。`, sender: 'system-error'}]);
        }
      }
    }, pollIntervalMs);
  };

	const suggestedChartQueries = [
		{ 
		  label: "風險等級分佈圖", 
		  query: "請生成弱點風險等級分佈圖", 
		  icon: <BarChart2 size={18} className="mr-2" /> 
		},
		{ 
		  label: "Critical 弱點總數", 
		  query: "報告中有多少個 Critical 等級的弱點？", 
		  icon: <AlertCircle size={18} className="mr-2 text-red-400" /> 
		},
		{ 
		  label: "High 弱點總數", 
		  query: "報告中有多少個 High 等級的弱點？", 
		  icon: <Activity size={18} className="mr-2 text-orange-400" /> 
		},
		{
		  label: "列出前3個Critical弱點",
		  query: "請列出報告中前3個 Critical 等級弱點的名稱和受影響的 IP 位址。",
		  icon: <ListChecks size={18} className="mr-2" />
		},{
		  label: "列出前3個Critical弱點",
		  query: "哪個 IP 位址的 Critical 和 High 弱點總數最多？",
		  icon: <ListChecks size={18} className="mr-2" />
		}
	  ];
  // 修改 sendChatMessage 以接受一個可選的 query 參數
  const sendChatMessage = async (predefinedQuery = null) => { 
    const queryToSend = predefinedQuery || chatInput.trim();
    if (!queryToSend || !reportReady || isChatProcessing) {
        if (!predefinedQuery && !chatInput.trim()) logger.warn("sendChatMessage: 輸入為空。");
        return;
    }

    const newUserMessage = { id: Date.now(), text: queryToSend, sender: 'user' };
    setChatMessages(prev => [...prev, newUserMessage]);
    
    if (!predefinedQuery) { // 如果不是預定義查詢，才清空輸入框
        setChatInput('');
    }
    setIsChatProcessing(true); setChatError('');
    setCurrentChartData(null); 

    try {
      const chatApiResponse = await fetch(CHAT_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            query: queryToSend, 
            s3Bucket: reportS3BucketForChat, 
            s3Key: reportS3KeyForChat, 
            jobId: currentJobIdRef.current 
        }),
      });
      if (!chatApiResponse.ok) {
        const errorData = await chatApiResponse.json().catch(()=>({error: "AI服務回應非JSON"}));
        throw new Error(errorData.error || 'AI 服務回應錯誤。');
      }
      const data = await chatApiResponse.json(); 
      
      const aiMessage = { 
        id: Date.now() + 1, 
        text: data.answer || "AI 未提供有效回答。", 
        sender: 'ai',
        chartData: data.chartData || null 
      };
      setChatMessages(prev => [...prev, aiMessage]);

      if (data.chartData) {
        logger.info("收到圖表數據:", data.chartData);
        setCurrentChartData(data.chartData); 
      }

    } catch (error) {
      logger.error("Chat API 錯誤:", error); setChatError(`與 AI 溝通錯誤: ${error.message}`);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, text: `🤖 AI 回應錯誤: ${error.message}`, sender: 'system-error' }]);
    } finally { setIsChatProcessing(false); }
  };
// 輔助函數：類似 Python os.path.basename，並可選擇移除副檔名
  const osPathBaseName = (path, removeExtension = false) => {
    let base = path.substring(path.lastIndexOf('/') + 1);
    if (removeExtension) {
      base = base.substring(0, base.lastIndexOf('.'));
    }
    return base;
  };  
  return ( /* ... (JSX 結構與之前版本基本相同) ... */ 
    <div className="flex flex-col items-center font-sans">
      <header className="w-full max-w-4xl mb-6 sm:mb-10 text-center">
        <div className="flex items-center justify-center mb-2">
          <FileText size={36} className="text-purple-400 mr-3" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Nessus 報告 AI 分析助手
          </h1>
        </div>
        <p className="text-gray-400 mt-2 text-sm sm:text-base">
          請上傳一個包含所有 Nessus CSV 報告的 ZIP 壓縮檔。
        </p>
      </header>

      <main className="w-full max-w-3xl bg-gray-800/80 backdrop-blur-md p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700/50">
        {/* 檔案上傳區 */}
        {(!currentJobIdRef.current || !isProcessingReport) && !reportReady && ( 
          <section id="upload-section" className="mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-300 mb-4 flex items-center">
              <UploadCloud className="w-6 h-6 mr-2" /> 步驟 1: 上傳 ZIP 報告檔案
            </h2>
            <div
              className={`border-2 border-dashed ${isDragging ? 'border-purple-500 bg-purple-900/30' : 'border-gray-600 hover:border-purple-400'} p-6 sm:p-8 rounded-lg text-center cursor-pointer transition-all duration-300 ease-in-out`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={triggerFileInput}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" 
                     accept=".zip,application/zip,application/x-zip-compressed" 
              />
              <UploadCloud className={`w-12 h-12 mx-auto mb-3 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
              {selectedFiles.length === 0 && ( <p className="text-gray-400 text-sm sm:text-base">將單一 ZIP 檔案拖曳至此，或 <span className="text-purple-400 font-semibold">點擊選擇</span>。</p> )}
              {selectedFiles.length > 0 && (
                <div>
                  <p className="text-purple-300 font-semibold mb-2">已選擇檔案:</p>
                  <p className="text-gray-300 truncate list-disc list-inside ml-2 text-xs sm:text-sm">{selectedFiles[0].name}</p>
                </div>
              )}
            </div>
            {selectedFiles.length > 0 && (
              <button 
                onClick={handleUploadAndProcess} 
                disabled={isUploading || isProcessingReport} 
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-purple-500/50">
                {(isUploading || (isProcessingReport && !reportReady) ) ? (<><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />處理中...</>) : (<><UploadCloud className="mr-2 h-5 w-5" />開始上傳並處理</>)}
              </button>
            )}
            {uploadError && (<p className="text-red-400 mt-3 text-sm flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-1" /> {uploadError}</p>)}
          </section>
        )}

         {(currentJobIdRef.current && isProcessingReport) && !reportReady && ( 
             <section id="processing-status-section" className="mb-6 text-center p-6 bg-blue-900/30 rounded-lg border border-blue-700">
                <Loader2 className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-spin" />
                <h2 className="text-xl sm:text-2xl font-semibold text-blue-400 mb-2">報告處理中</h2>
                <p className="text-gray-300 text-sm sm:text-base">{processingStatusMessage}</p>
                {currentJobIdRef.current && <p className="text-gray-400 text-xs mt-1">任務 ID: {currentJobIdRef.current}</p>}
                <p className="text-gray-400 text-xs mt-2">這可能需要幾分鐘，請耐心等候。</p>
             </section>
        )}
        {reportReady && reportDownloadUrl && (
          <section id="report-download-section" className="mb-6 text-center p-6 bg-green-900/30 rounded-lg border border-green-700">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl sm:text-2xl font-semibold text-green-400 mb-3">報告已就緒！</h2>
            {currentJobIdRef.current && <p className="text-gray-400 text-xs mt-1 mb-2">任務 ID: {currentJobIdRef.current}</p>}
            <p className="text-gray-300 mb-4 text-sm sm:text-base">檔案: <span className="font-semibold">{reportFileNameForDisplay}</span></p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                <a href={reportDownloadUrl} target="_blank" rel="noopener noreferrer" download={reportFileNameForDisplay}
                className="inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md hover:shadow-green-500/50 w-full sm:w-auto">
                <Download className="mr-2 h-5 w-5" /> 下載報告
                </a>
                <button 
                    onClick={() => { resetTaskStates(true, false); setSelectedFiles([]); /* initiatingNewJob=true, not fromNewFileSelection */ }} 
                    className="inline-flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md w-full sm:w-auto"
                >
                    <RefreshCw className="mr-2 h-5 w-5" /> 處理新報告
                </button>
            </div>
          </section>
        )}
        
        
		{/* 圖表顯示區 */}
        {reportReady && currentChartData && currentChartData.type === 'risk_distribution' && (
          <section id="chart-display-section" className="my-8 p-6 bg-slate-700/50 rounded-lg border border-slate-600">
            {/* ... (圖表 JSX 與之前版本相同) ... */}
          </section>
        )}
		<section id="chat-section" className="mt-8">
           <h2 className="text-xl sm:text-2xl font-semibold text-purple-300 mb-4 flex items-center">
            <MessageSquare className="w-6 h-6 mr-2" /> {reportReady ? "AI 報告問答" : "AI 報告問答 (等待報告就緒)"}
          </h2>
          <div ref={chatContainerRef} className="bg-gray-700/60 p-3 sm:p-4 rounded-lg h-72 sm:h-96 overflow-y-auto mb-4 shadow-inner border border-gray-600/50">
            {chatMessages.map((message) => (
              <div key={message.id} className={`mb-3 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs sm:max-w-md lg:max-w-lg p-2.5 sm:p-3 rounded-xl shadow break-words ${
                    message.sender === 'user' ? 'bg-purple-600 text-white rounded-br-none' :
                    message.sender === 'ai' ? 'bg-gray-600 text-gray-200 rounded-bl-none' :
                    message.sender === 'system-error' ? 'bg-red-800/80 text-red-100 text-center w-full py-2' : 
                    'bg-transparent text-gray-400 italic text-center w-full py-2'
                  }`}
                >
                  <p className="text-sm sm:text-base whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            {isChatProcessing && ( <div className="flex justify-start mb-3"> <div className="max-w-xs p-2.5 rounded-xl shadow bg-gray-600"><Loader2 className="animate-spin h-5 w-5 text-purple-300" /></div></div>)}
          </div>

          {reportReady && !isChatProcessing && (
            <div className="my-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600/40">
              <h4 className="text-sm font-semibold text-purple-200 mb-3">建議查詢：</h4>
              <div className="flex flex-wrap gap-2">
                {suggestedChartQueries.map((sq, index) => (
                  <button
                    key={index}
                    onClick={() => sendChatMessage(sq.query)}
                    disabled={isChatProcessing || !reportReady}
                    className="flex items-center bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sq.icon}
                    {sq.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} 
                   onKeyUp={(e) => e.key === 'Enter' && sendChatMessage()}
              disabled={!reportReady || isUploading || isProcessingReport || isChatProcessing}
              placeholder={reportReady ? "或在此輸入您的問題..." : "請等待報告處理完成"}
              className="flex-grow bg-gray-600/70 border border-gray-500 text-white placeholder-gray-400 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button onClick={() => sendChatMessage()} 
                    disabled={!reportReady || isUploading || isProcessingReport || isChatProcessing || !chatInput.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center aspect-square"
              aria-label="發送訊息">
              {isChatProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          {chatError && (<p className="text-red-400 mt-2 text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {chatError}</p>)}
        </section>
      </main>
      <footer className="w-full max-w-4xl mt-10 sm:mt-16 text-center text-gray-500 text-xs sm:text-sm">
        <p>&copy; {new Date().getFullYear()} Nessus AI 分析助手. Powered by AWS Bedrock.</p>
        <p>請注意：AI 回答僅供參考，實際決策請依據完整報告和專業判斷。</p>
      </footer>
    </div>
  );
};
export default NessusAIPage;