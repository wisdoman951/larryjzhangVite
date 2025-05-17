import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, MessageSquare, Send, Download, AlertCircle, Loader2, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid

// --- API 端點 ---
const GENERATE_PRESIGNED_URL_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url';
const CHAT_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/chat';
// 新的 API 端點，用於檢查報告狀態 (指向 check_report_status_lambda)
// TODO: 將 YOUR_API_GATEWAY_ID.execute-api.YOUR_REGION.amazonaws.com/prod/check-report-status 替換為您的實際端點
const CHECK_REPORT_STATUS_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/get-process-report'; // 您提到已將 /get-process-report 指向新的 Lambda

const NessusAIPage = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);

  const [isUploading, setIsUploading] = useState(false); // 用於標記 Presigned URL 獲取和 S3 PUT 的過程
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100 for overall S3 upload progress of all files
  const [filesUploadedCount, setFilesUploadedCount] = useState(0);

  const [isProcessingReport, setIsProcessingReport] = useState(false); // 標記後端 Lambda 是否正在處理報告 (輪詢時)
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

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const logger = { // 簡單的 console logger
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  };

  useEffect(() => {
    setChatMessages([{ id: Date.now(), text: '您好！請上傳 Nessus CSV 報告 (可多選或單一 ZIP)。處理完成後可進行問答。', sender: 'system' }]);
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, []);

  useEffect(() => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; }, [chatMessages]);

  const triggerFileInput = () => fileInputRef.current.click();
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const resetStateBeforeNewUpload = () => {
    setSelectedFiles([]); // 清空已選檔案
    setUploadError(''); setUploadProgress(0); setCurrentJobId(null);
    setReportReady(false); setReportDownloadUrl(''); setReportS3KeyForChat('');
    setReportS3BucketForChat(''); setReportFileNameForDisplay('');
    setIsProcessingReport(false); setProcessingStatusMessage('');
    setFilesUploadedCount(0);
    setChatMessages([{ id: Date.now(), text: '請上傳新的 Nessus 報告檔案。', sender: 'system' }]);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
  };

	const handleFileChange = (event) => {
		// 在處理新選擇前，先重置與上傳/報告相關的狀態
		resetStateBeforeNewUpload(); 
		handleFiles(event.target.files ? Array.from(event.target.files) : []);
		// 清空 file input 的值，這樣使用者可以再次選擇同一個檔案 (如果他們取消後又想選)
		if (fileInputRef.current) {
			fileInputRef.current.value = ""; 
		}
	};
	const resetStateBeforeNewUpload = () => {
		setSelectedFiles([]);
		setUploadError('');
		setUploadProgress(0);
		setCurrentJobId(null);
		setReportReady(false);
		setReportDownloadUrl('');
		setReportS3KeyForChat('');
		setReportS3BucketForChat('');
		setReportFileNameForDisplay('');
		setIsProcessingReport(false);
		setProcessingStatusMessage('');
		setFilesUploadedCount(0);
		// 清空聊天訊息或保留初始訊息
		setChatMessages([{ id: Date.now(), text: '您好！請上傳一個包含 Nessus CSV 報告的 ZIP 壓縮檔。', sender: 'system' }]);
		if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
	};
	
	const handleFiles = (incomingFiles) => {
    // resetStateBeforeNewUpload(); // 在選擇或拖曳新檔案時先重置一部分狀態
    setUploadError(''); // 清除之前的錯誤訊息
    setSelectedFiles([]); // 清空之前的選擇

    if (!incomingFiles || incomingFiles.length === 0) {
        // logger.info("No files selected or dropped.");
        return;
    }

    if (incomingFiles.length > 1) {
        setUploadError('請一次只上傳一個 ZIP 檔案。');
        return;
    }

    const file = incomingFiles[0];
    if (!file.name.toLowerCase().endsWith('.zip')) {
        setUploadError(`檔案格式錯誤：${file.name} 不是一個 ZIP 檔案。請上傳 .zip 格式的檔案。`);
        return;
    }

    // 如果所有檢查都通過
    setSelectedFiles([file]);
    setUploadError(''); // 清除錯誤訊息
};
	const handleDrop = (event) => {
		event.preventDefault();
		setIsDragging(false);
		// 在處理新拖曳前，先重置與上傳/報告相關的狀態
		resetStateBeforeNewUpload();
		handleFiles(event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []);
	};

  const uploadSingleFileToS3 = async (file, jobIdToUse) => { // jobIdToUse 由外部傳入
    try {
      logger.info(`請求預簽名 URL，jobId: ${jobIdToUse}, fileName: ${file.name}`);
      const presignedUrlResponse = await fetch(GENERATE_PRESIGNED_URL_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', jobId: jobIdToUse }),
      });
      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json().catch(() => ({error: "獲取上傳授權失敗，回應非JSON"}));
        throw new Error(errorData.error || `無法獲取 ${file.name} 的上傳授權 (狀態: ${presignedUrlResponse.status})。`);
      }
      const { presignedUrl, s3Key, s3Bucket, jobId: returnedJobId } = await presignedUrlResponse.json();
      
      // 驗證 jobId 是否一致 (如果 Lambda 可能會自己生成的話)
      if (jobIdToUse !== returnedJobId) {
        logger.warn(`JobId 不匹配！前端使用 ${jobIdToUse}, Lambda 回傳 ${returnedJobId}. 將使用前端生成的 JobId。`);
        // 這裡我們堅持使用前端生成的 jobIdToUse，因為後續輪詢依賴它。
        // 確保 generate_presigned_url_lambda 優先使用前端傳入的 jobId。
      }

      logger.info(`開始上傳 ${file.name} 到 S3 (Key: ${s3Key}) 使用預簽名 URL...`);
      const uploadToS3Response = await fetch(presignedUrl, {
        method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!uploadToS3Response.ok) throw new Error(`檔案 ${file.name} 上傳 S3 失敗 (狀態: ${uploadToS3Response.status})。`);
      
      logger.info(`檔案 ${file.name} 已成功上傳到 s3://${s3Bucket}/${s3Key}`);
      return { success: true, s3Key, s3Bucket, originalFileName: file.name, jobId: jobIdToUse }; // 返回 jobIdToUse
    } catch (error) {
      logger.error(`上傳檔案 ${file.name} 失敗:`, error);
      return { success: false, originalFileName: file.name, error: error.message, jobId: jobIdToUse };
    }
  };

const handleUploadAndProcess = async () => {
    if (!selectedFiles || selectedFiles.length === 0 || !selectedFiles[0]) {
        setUploadError('請先選擇一個 ZIP 檔案。');
        return;
    }
    const fileToUpload = selectedFiles[0];
    if (!fileToUpload.name.toLowerCase().endsWith('.zip')) {
         setUploadError('檔案格式錯誤，請確保上傳的是 .zip 檔案。');
         return;
    }

    // 重置與上一個任務相關的狀態，但保留已選檔案
    // (將 resetStateBeforeNewUpload 的部分邏輯移到這裡，或創建一個更細緻的重置函數)
    setUploadError(''); setUploadProgress(0); setCurrentJobId(null);
    setReportReady(false); setReportDownloadUrl(''); setReportS3KeyForChat('');
    setReportS3BucketForChat(''); setReportFileNameForDisplay('');
    setIsProcessingReport(false); setProcessingStatusMessage('');
    setFilesUploadedCount(0);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setChatMessages([{id: Date.now(), text: '準備開始新任務...', sender: 'system'}]);


    const newJobId = uuidv4();
    setCurrentJobId(newJobId);
    logger.info(`新任務開始，Job ID: ${newJobId}，準備上傳檔案: ${fileToUpload.name}`);

    setIsUploading(true);
    // ... 後續的 S3 上傳和輪詢邏輯與 <immersive id="nessus_ai_page_react_v4_dynamodb_final" ...> 中的類似
    // 但現在我們知道 selectedFiles[0] 就是那個唯一的 ZIP 檔案
    setProcessingStatusMessage(`🚀 準備上傳檔案: ${fileToUpload.name}...`);
    setChatMessages(prev => [...prev.filter(m => m.sender === 'system'), {id: Date.now(), text: `🚀 任務 ${newJobId} 開始，準備上傳檔案: ${fileToUpload.name}...`, sender: 'system'}]);

    const result = await uploadSingleFileToS3(fileToUpload, newJobId);

    if (!result.success) {
        setIsUploading(false);
        setUploadError(prev => `${prev}檔案 ${result.originalFileName} 上傳失敗: ${result.error}. `);
        setChatMessages(prevMsgs => [...prevMsgs, {id: Date.now(), text: `❌ 檔案 ${result.originalFileName} 上傳失敗。任務 ${newJobId} 中止。`, sender: 'system-error'}]);
        setCurrentJobId(null);
        return; 
    }

    setFilesUploadedCount(1); // 因為只上傳一個 ZIP
    setUploadProgress(100);   // ZIP 上傳完成進度就是 100%

    setIsUploading(false); 
    setIsProcessingReport(true); 
    setProcessingStatusMessage('✅ ZIP 檔案已上傳到 S3。後端正在處理報告，請稍候...');
    setChatMessages(prev => [...prev, {id: Date.now()+1, text: `✅ ZIP 檔案上傳成功！任務 ${newJobId} 的報告正在後端生成中... (這可能需要幾分鐘)`, sender: 'system'}]);

    startPollingForReport(newJobId);
};
  
  const startPollingForReport = (jobIdToPoll) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    let attempts = 0;
    const maxAttempts = 36; // 36 * 10秒 = 6分鐘
    const pollIntervalMs = 10000;

    logger.info(`輪詢啟動: jobId=${jobIdToPoll}, API=${CHECK_REPORT_STATUS_API}, interval=${pollIntervalMs}ms, maxAttempts=${maxAttempts}`);
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts && jobIdToPoll === currentJobId) { // 確保只停止當前任務的輪詢
        clearInterval(pollingIntervalRef.current); 
        if (isProcessingReport) { // 只有在仍在處理中時才顯示超時
            setIsProcessingReport(false);
            setProcessingStatusMessage(`報告處理超時 (任務 ${jobIdToPoll})。`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 任務 ${jobIdToPoll} 報告處理超時。請稍後再試或檢查S3。`, sender: 'system-error'}]);
        }
        return;
      }
      setProcessingStatusMessage(`正在檢查報告狀態 (任務 ${jobIdToPoll}, 嘗試 ${attempts}/${maxAttempts})...`);
      
      try {
        const apiUrl = `${CHECK_REPORT_STATUS_API}?jobId=${encodeURIComponent(jobIdToPoll)}`;
        logger.info(`輪詢 API: ${apiUrl}`);
        const reportStatusResponse = await fetch(apiUrl);
        const data = await reportStatusResponse.json();

        if (jobIdToPoll !== currentJobId) { // 如果 jobId 已改變 (使用者開始了新任務)，則停止此輪詢
            logger.warn(`當前 jobId 已變為 ${currentJobId}，停止對舊 jobId ${jobIdToPoll} 的輪詢。`);
            clearInterval(pollingIntervalRef.current);
            return;
        }

        if (data.status === 'COMPLETED' && reportStatusResponse.ok) {
          logger.info("輪詢成功，報告已完成:", data);
          clearInterval(pollingIntervalRef.current);
          setReportDownloadUrl(data.downloadUrl);
          setReportFileNameForDisplay(data.fileName);
          setReportS3KeyForChat(data.s3Key); 
          setReportS3BucketForChat(data.s3Bucket);
          setReportReady(true); setIsProcessingReport(false);
          setProcessingStatusMessage(`🎉 報告 "${data.fileName}" (任務 ${jobIdToPoll}) 已成功產生！`);
          setChatMessages(prev => [...prev, {id: Date.now(), text: `🎉 報告 "${data.fileName}" 已就緒！您可以下載報告，或開始提問。`, sender: 'system'}]);
        } else if (data.status === 'PROCESSING' || data.status === 'UPLOADING' || reportStatusResponse.status === 202) {
          logger.info(`輪詢嘗試 ${attempts}: 報告仍在處理中 (JobId: ${jobIdToPoll}, 狀態: ${data.status || 'N/A'})`);
          setProcessingStatusMessage(`報告仍在處理中 (任務 ${jobIdToPoll}, 狀態: ${data.status || '未知'})...`);
        } else if (data.status === 'FAILED') {
          logger.error(`輪詢嘗試 ${attempts}: 報告處理失敗 (JobId: ${jobIdToPoll})`, data.message);
          clearInterval(pollingIntervalRef.current); setIsProcessingReport(false);
          setProcessingStatusMessage(`報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`);
          setChatMessages(prev => [...prev, {id: Date.now(), text: `❌ 報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`, sender: 'system-error'}]);
        } else { 
          logger.warn(`輪詢嘗試 ${attempts}: 未預期的回應 (JobId: ${jobIdToPoll}, 狀態: ${reportStatusResponse.status})`, data);
          if (reportStatusResponse.status === 404 && attempts < 6) { 
             setProcessingStatusMessage(`等待任務 ${jobIdToPoll} 註冊於追蹤系統... (嘗試 ${attempts})`);
          } else if (reportStatusResponse.status === 404) { // 多次 404 後，可能任務真的有問題
             clearInterval(pollingIntervalRef.current); setIsProcessingReport(false);
             setProcessingStatusMessage(`無法找到任務 ${jobIdToPoll} 的追蹤記錄。`);
             setChatMessages(prev => [...prev, {id: Date.now(), text: `❌ 無法追蹤任務 ${jobIdToPoll}。`, sender: 'system-error'}]);
          }
        }
      } catch (error) {
        logger.error(`輪詢嘗試 ${attempts}: 網路錯誤或 API 呼叫失敗 (JobId: ${jobIdToPoll})`, error);
        // 除非達到最大次數，否則繼續輪詢
      }
    }, pollIntervalMs);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !reportReady || isChatProcessing) return;
    const newUserMessage = { id: Date.now(), text: chatInput, sender: 'user' };
    setChatMessages(prev => [...prev, newUserMessage]);
    const currentQuery = chatInput; setChatInput('');
    setIsChatProcessing(true); setChatError('');
    try {
      const chatApiResponse = await fetch(CHAT_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, s3Bucket: reportS3BucketForChat, s3Key: reportS3KeyForChat, jobId: currentJobId }), // 可以選擇性傳遞 jobId
      });
      if (!chatApiResponse.ok) {
        const errorData = await chatApiResponse.json().catch(()=>({error: "AI服務回應非JSON"}));
        throw new Error(errorData.error || 'AI 服務回應錯誤。');
      }
      const data = await chatApiResponse.json();
      const aiMessage = { id: Date.now() + 1, text: data.answer || "AI 未提供有效回答。", sender: 'ai' };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      logger.error("Chat API 錯誤:", error); setChatError(`與 AI 溝通錯誤: ${error.message}`);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, text: `🤖 AI 回應錯誤: ${error.message}`, sender: 'system-error' }]);
    } finally { setIsChatProcessing(false); }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 sm:p-6 flex flex-col items-center font-sans">
      <header className="w-full max-w-4xl mb-6 sm:mb-10 text-center">
        {/* ... Header ... */}
        <div className="flex items-center justify-center mb-2">
          <FileText size={36} className="text-purple-400 mr-3" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Nessus 報告 AI 分析助手
          </h1>
        </div>
        <p className="text-gray-400 mt-2 text-sm sm:text-base">
          上傳 Nessus CSV 報告 (或單一 ZIP)，AI 將自動整理、翻譯並提供智能問答。
        </p>
      </header>

      <main className="w-full max-w-3xl bg-gray-800/80 backdrop-blur-md p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700/50">
        {/* 檔案上傳區: 只有在沒有 currentJobId (即全新任務) 且不在處理中時才顯示 */}
        {!currentJobId && !isProcessingReport && (
          <section id="upload-section" className="mb-6">
            {/* ... (上傳 UI 與之前版本 v3 類似) ... */}
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-300 mb-4 flex items-center">
              <UploadCloud className="w-6 h-6 mr-2" /> 步驟 1: 上傳報告檔案
            </h2>
            <div
              className={`border-2 border-dashed ${isDragging ? 'border-purple-500 bg-purple-900/30' : 'border-gray-600 hover:border-purple-400'} p-6 sm:p-8 rounded-lg text-center cursor-pointer transition-all duration-300 ease-in-out`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={triggerFileInput}
            >
			<input 
			  type="file" 
			  ref={fileInputRef} 
			  onChange={handleFileChange} 
			  className="hidden" 
			  accept=".zip,application/zip,application/x-zip-compressed" // 明確指定 .zip
			  // multiple={false} // 如果只允許單一 ZIP，則移除 multiple 或設為 false
			/>              
				<UploadCloud className={`w-12 h-12 mx-auto mb-3 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
              {selectedFiles.length === 0 && ( <p className="text-gray-400 text-sm sm:text-base">拖曳 Nessus CSV (可多個) 或單一 ZIP 至此，或 <span className="text-purple-400 font-semibold">點擊選擇</span>。</p> )}
              {selectedFiles.length > 0 && (
                <div>
                  <p className="text-purple-300 font-semibold mb-2">已選擇檔案 ({selectedFiles.length}):</p>
                  <ul className="text-left max-h-32 overflow-y-auto text-xs sm:text-sm">
                    {selectedFiles.map(file => (<li key={file.name} className="text-gray-300 truncate list-disc list-inside ml-2">{file.name}</li>))}
                  </ul>
                </div>
              )}
            </div>
            {isUploading && ( // 這個 isUploading 現在主要用於顯示 "準備上傳" 或初始階段
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-purple-600 h-2.5 rounded-full transition-all duration-100" style={{ width: `${Math.round(uploadProgress)}%` }}></div></div>
                <p className="text-center text-purple-300 text-sm mt-1">{processingStatusMessage || (uploadProgress > 0 ? `${Math.round(uploadProgress)}% 已上傳 (${filesUploadedCount}/${selectedFiles.length})` : "準備上傳...")}</p>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <button onClick={handleUploadAndProcess} disabled={isUploading}
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-purple-500/50">
                {isUploading ? (<><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />上傳處理中...</>) : (<><UploadCloud className="mr-2 h-5 w-5" />開始上傳並處理</>)}
              </button>
            )}
            {uploadError && (<p className="text-red-400 mt-3 text-sm flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-1" /> {uploadError}</p>)}
          </section>
        )}

        {/* 處理狀態區 */}
        {(currentJobId || isProcessingReport) && !reportReady && (
             <section id="processing-status-section" className="mb-6 text-center p-6 bg-blue-900/30 rounded-lg border border-blue-700">
                <Loader2 className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-spin" />
                <h2 className="text-xl sm:text-2xl font-semibold text-blue-400 mb-2">報告處理中</h2>
                <p className="text-gray-300 text-sm sm:text-base">{processingStatusMessage}</p>
                {currentJobId && <p className="text-gray-400 text-xs mt-1">任務 ID: {currentJobId}</p>}
                <p className="text-gray-400 text-xs mt-2">這可能需要幾分鐘，請耐心等候。</p>
             </section>
        )}

        {/* 報告就緒區 */}
        {reportReady && reportDownloadUrl && (
          <section id="report-download-section" className="mb-6 text-center p-6 bg-green-900/30 rounded-lg border border-green-700">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl sm:text-2xl font-semibold text-green-400 mb-3">報告已就緒！</h2>
            {currentJobId && <p className="text-gray-400 text-xs mt-1 mb-2">任務 ID: {currentJobId}</p>}
            <p className="text-gray-300 mb-4 text-sm sm:text-base">檔案: <span className="font-semibold">{reportFileNameForDisplay}</span></p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                <a href={reportDownloadUrl} target="_blank" rel="noopener noreferrer" download={reportFileNameForDisplay}
                className="inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md hover:shadow-green-500/50 w-full sm:w-auto">
                <Download className="mr-2 h-5 w-5" /> 下載報告
                </a>
                <button 
                    onClick={resetStateBeforeNewUpload} 
                    className="inline-flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md w-full sm:w-auto"
                >
                    <RefreshCw className="mr-2 h-5 w-5" /> 處理新報告
                </button>
            </div>
          </section>
        )}
        
        {/* 聊天區 */}
        <section id="chat-section" className="mt-8">
           {/* ... (聊天 UI 與之前版本 v3 類似) ... */}
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
          <div className="flex items-center gap-2 sm:gap-3">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && sendChatMessage()}
              disabled={!reportReady || isUploading || isProcessingReport || isChatProcessing}
              placeholder={reportReady ? "請在此輸入您對報告的問題..." : "請等待報告處理完成"}
              className="flex-grow bg-gray-600/70 border border-gray-500 text-white placeholder-gray-400 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button onClick={sendChatMessage} disabled={!reportReady || isUploading || isProcessingReport || isChatProcessing || !chatInput.trim()}
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
