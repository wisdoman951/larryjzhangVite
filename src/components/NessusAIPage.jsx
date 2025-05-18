import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, MessageSquare, Send, Download, AlertCircle, Loader2, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- API 端點 ---
const GENERATE_PRESIGNED_URL_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url';
const CHAT_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/chat';
const CHECK_REPORT_STATUS_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/get-process-report';

const NessusAIPage = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null); // 當前正在處理或關注的 Job ID

  const [isUploading, setIsUploading] = useState(false); // 標記 Presigned URL 獲取和 S3 PUT 過程
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const pollingIntervalRef = useRef(null); // 只用來存儲 interval ID

  const logger = {
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  };

  useEffect(() => {
    setChatMessages([{ id: Date.now(), text: '您好！請上傳一個包含 Nessus CSV 報告的 ZIP 壓縮檔。', sender: 'system' }]);
    return () => { // 組件卸載時清除輪詢
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => { 
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; 
  }, [chatMessages]);

  const triggerFileInput = () => fileInputRef.current.click();
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  // 重置所有與任務相關的狀態，用於開始一個全新的上傳流程或用戶取消/完成後
  const resetTaskStates = (initiatingNewJob = false) => {
    if (pollingIntervalRef.current) { // 無論如何，先停止任何正在運行的輪詢
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setUploadError(''); 
    setUploadProgress(0); 
    setFilesUploadedCount(0);
    
    // 只有在明確開始一個全新任務時才重置 currentJobId
    // 或者當任務完成/失敗/超時後，用戶點擊“處理新報告”按鈕時
    if (initiatingNewJob) {
        setCurrentJobId(null); 
    }
    
    setReportReady(false); 
    setReportDownloadUrl(''); 
    setReportS3KeyForChat('');
    setReportS3BucketForChat(''); 
    setReportFileNameForDisplay('');
    setIsProcessingReport(false); 
    setProcessingStatusMessage('');

    // 根據情況決定是否重置聊天訊息
    if (initiatingNewJob) {
        setChatMessages([{ id: Date.now(), text: '請上傳一個新的 ZIP 壓縮檔。', sender: 'system' }]);
    }
  };

  const handleFilesValidation = (incomingFiles) => {
    // 當用戶選擇或拖曳新檔案時，我們認為這是一個新任務的開始意圖
    // 因此，重置與上一個任務相關的狀態，並清除已選檔案列表等待新的有效選擇
    resetTaskStates(true); // initiatingNewJob = true
    setSelectedFiles([]); 

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
    handleFilesValidation(event.target.files ? Array.from(event.target.files) : []);
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const handleDrop = (event) => {
    event.preventDefault(); setIsDragging(false); 
    handleFilesValidation(event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []);
  };

  const uploadSingleFileToS3 = async (file, jobIdToUse) => {
    // ... (此函數與  中的版本相同，已包含 x-amz-meta-* headers)
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
    
    // 1. 清理任何可能正在運行的舊輪詢 (如果有的話)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // 2. 為新任務生成 ID
    const newJobId = uuidv4();
    
    // 3. 設定與新任務相關的初始狀態
    //    將 setCurrentJobId 移到所有其他相關狀態設定之後，或作為它們的一部分
    //    或者，更好的方式是，確保 startPollingForReport 捕獲 newJobId，而不是依賴於異步的 currentJobId state
    setUploadError(''); 
    setUploadProgress(0);
    setFilesUploadedCount(0);
    setReportReady(false); 
    setReportDownloadUrl(''); 
    setReportS3KeyForChat('');
    setReportS3BucketForChat(''); 
    setReportFileNameForDisplay('');
    setIsProcessingReport(true); // 新任務開始，設定為處理中
    setProcessingStatusMessage('🚀 準備上傳檔案...');
    setChatMessages(prev => prev.filter(m => m.sender === 'system' && m.text.startsWith('您好！')).concat({id: Date.now(), text: `🚀 任務 ${newJobId} 開始，準備上傳檔案...`, sender: 'system'}));
    
    // **在所有其他狀態更新之後設定 currentJobId，並確保它是此函數作用域內最新的**
    setCurrentJobId(newJobId); 
    logger.info(`新任務開始，Job ID (已設定 state): ${newJobId}`);
    
    setIsUploading(true); // 表示正在獲取 Presigned URL 和上傳 S3
    
    const result = await uploadSingleFileToS3(fileToUpload, newJobId); // 傳遞 newJobId
    
    if (!result.success) {
        setIsUploading(false);
        setIsProcessingReport(false); // 上傳失敗，也應停止處理狀態
        setUploadError(prev => `${prev}檔案 ${result.originalFileName} 上傳失敗: ${result.error}. `);
        setChatMessages(prevMsgs => [...prevMsgs, {id: Date.now(), text: `❌ 檔案 ${result.originalFileName} 上傳失敗。任務 ${newJobId} 中止。`, sender: 'system-error'}]);
        setCurrentJobId(null); // 任務失敗，清除 jobId
        return; 
    }
    
    setFilesUploadedCount(1);
    setUploadProgress(100);   
    
    setIsUploading(false); 
    // isProcessingReport 保持 true
    setProcessingStatusMessage('✅ ZIP 檔案已上傳到 S3。後端正在處理報告，請稍候...');
    setChatMessages(prev => [...prev, {id: Date.now()+1, text: `✅ ZIP 檔案上傳成功！任務 ${newJobId} 的報告正在後端生成中...`, sender: 'system'}]);
    
    startPollingForReport(newJobId, newJobId); // 傳遞 newJobId 作為 pollForThisJobId
  };
  
  // 修改 startPollingForReport 函數，使其依賴傳入的 jobIdToPoll，而不是 React state 的 currentJobId 來決定是否處理 COMPLETED
  const startPollingForReport = (jobIdToPoll, activeJobIdForThisSession) => {
    // activeJobIdForThisSession 是 handleUploadAndProcess 啟動時的 currentJobId (即 newJobId)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    let attempts = 0;
    const maxAttempts = 36; 
    const pollIntervalMs = 10000;
    logger.info(`輪詢啟動: 針對 jobId=${jobIdToPoll}, 當前活躍任務ID=${activeJobIdForThisSession}, API=${CHECK_REPORT_STATUS_API}`);
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      
      // 檢查全局的 currentJobId 是否已經改變，如果改變了，表示用戶開始了新任務，此輪詢應停止
      if (currentJobId !== activeJobIdForThisSession) {
          logger.warn(`全局 currentJobId (${currentJobId}) 與此輪詢會話的 activeJobId (${activeJobIdForThisSession}) 不符，停止對 jobId ${jobIdToPoll} 的輪詢。`);
          clearInterval(pollingIntervalRef.current);
          return;
      }

      if (attempts > maxAttempts) { 
        logger.warn(`輪詢 jobId ${jobIdToPoll} 已達到最大嘗試次數 ${maxAttempts}。`);
        clearInterval(pollingIntervalRef.current); 
        if (isProcessingReport) { // 只有當 UI 仍在處理中時才更新為超時
            setIsProcessingReport(false);
            setProcessingStatusMessage(`報告處理超時 (任務 ${jobIdToPoll})。`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 任務 ${jobIdToPoll} 報告處理超時。`, sender: 'system-error'}]);
        }
        return;
      }

      setProcessingStatusMessage(`正在檢查報告狀態 (任務 ${jobIdToPoll}, 嘗試 ${attempts}/${maxAttempts})...`);
      
      try {
        const apiUrl = `${CHECK_REPORT_STATUS_API}?jobId=${encodeURIComponent(jobIdToPoll)}`;
        logger.info(`輪詢 API (為 jobId ${jobIdToPoll}): ${apiUrl}`);
        const reportStatusResponse = await fetch(apiUrl);
        const data = await reportStatusResponse.json();

        // 如果全局 currentJobId 在 fetch 期間改變了，也停止 (雙重保險)
        if (currentJobId !== activeJobIdForThisSession) {
            logger.warn(`在 fetch 回應後，全局 currentJobId (${currentJobId}) 與 activeJobId (${activeJobIdForThisSession}) 不符，停止對 jobId ${jobIdToPoll} 的輪詢。`);
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

          // 更新 UI 狀態
          setReportDownloadUrl(data.downloadUrl);
          setReportFileNameForDisplay(data.fileName);
          setReportS3KeyForChat(data.s3Key); 
          setReportS3BucketForChat(data.s3Bucket);
          setCurrentJobId(jobIdToPoll); // 確保 currentJobId 是這個已完成的 job
          setIsProcessingReport(false); 
          setReportReady(true);       
          setProcessingStatusMessage(`🎉 報告 "${data.fileName}" (任務 ${jobIdToPoll}) 已成功產生！`);
          setChatMessages(prev => [...prev.filter(m=>m.sender !== 'system-error'), {id: Date.now(), text: `🎉 報告 "${data.fileName}" 已就緒！`, sender: 'system'}]);
          return; 
        }
        
        // 其他狀態處理 (PROCESSING, FAILED, 404等)
        if (data.status === 'PROCESSING' || data.status === 'UPLOADING' || reportStatusResponse.status === 202) {
            logger.info(`輪詢嘗試 ${attempts}: 報告仍在處理中 (JobId: ${jobIdToPoll}, API狀態: ${data.status || 'N/A'})`);
            // UI 上的 processingStatusMessage 會由 setProcessingStatusMessage 在 interval 開始時更新
        } else if (data.status === 'FAILED') {
          logger.error(`輪詢嘗試 ${attempts}: 報告處理失敗 (JobId: ${jobIdToPoll})`, data.message);
          clearInterval(pollingIntervalRef.current); 
          setIsProcessingReport(false);
          setProcessingStatusMessage(`報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`);
          setChatMessages(prev => [...prev, {id: Date.now(), text: `❌ 報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`, sender: 'system-error'}]);
        } else if (reportStatusResponse.status === 404) {
            if (attempts < 6) { 
                logger.info(`輪詢嘗試 ${attempts}: 任務 ${jobIdToPoll} 尚未在追蹤系統中找到 (404)，繼續嘗試...`);
                setProcessingStatusMessage(`等待任務 ${jobIdToPoll} 註冊於追蹤系統... (嘗試 ${attempts})`);
            } else {
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
        // 如果連續多次網路錯誤，也應該考慮停止輪詢
        if (attempts > maxAttempts - 5) { // 例如，在最後幾次嘗試時如果還是網路錯誤，就停止
            clearInterval(pollingIntervalRef.current); setIsProcessingReport(false);
            setProcessingStatusMessage(`輪詢因網路問題多次失敗 (任務 ${jobIdToPoll})。`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 輪詢 API 失敗多次，請檢查網路。`, sender: 'system-error'}]);
        }
      }
    }, pollIntervalMs);
  };

  const sendChatMessage = async () => { /* ... (與之前版本相同) ... */ };
  const osPathBaseName = (path, removeExtension = false) => { /* ... (與之前版本相同) ... */ };

  return ( /* ... (JSX 結構與  基本相同) ... */ 
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 sm:p-6 flex flex-col items-center font-sans">
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
        {!currentJobId && !isProcessingReport && (
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
            {isUploading && ( 
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-purple-600 h-2.5 rounded-full transition-all duration-100" style={{ width: `${Math.round(uploadProgress)}%` }}></div></div>
                <p className="text-center text-purple-300 text-sm mt-1">{processingStatusMessage || (uploadProgress > 0 ? `${Math.round(uploadProgress)}% 已上傳` : "準備上傳...")}</p>
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

         {(currentJobId || isProcessingReport) && !reportReady && (
             <section id="processing-status-section" className="mb-6 text-center p-6 bg-blue-900/30 rounded-lg border border-blue-700">
                <Loader2 className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-spin" />
                <h2 className="text-xl sm:text-2xl font-semibold text-blue-400 mb-2">報告處理中</h2>
                <p className="text-gray-300 text-sm sm:text-base">{processingStatusMessage}</p>
                {currentJobId && <p className="text-gray-400 text-xs mt-1">任務 ID: {currentJobId}</p>}
                <p className="text-gray-400 text-xs mt-2">這可能需要幾分鐘，請耐心等候。</p>
             </section>
        )}
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
                    onClick={() => { resetTaskStates(true); /* setSelectedFiles([]); // 已在 resetTaskStates 中處理 */ }} 
                    className="inline-flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md w-full sm:w-auto"
                >
                    <RefreshCw className="mr-2 h-5 w-5" /> 處理新報告
                </button>
            </div>
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