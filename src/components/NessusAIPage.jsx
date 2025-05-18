import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, MessageSquare, Send, Download, AlertCircle, Loader2, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- API 端點 ---
const GENERATE_PRESIGNED_URL_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url';
const CHAT_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/chat';
const CHECK_REPORT_STATUS_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/get-process-report';

const NessusAIPage = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null); 

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

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const pollingIntervalRef = useRef(null); 

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

  useEffect(() => { 
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; 
  }, [chatMessages]);

  const triggerFileInput = () => {
    // 只有在沒有活動任務時才允許觸發檔案選擇
    if (currentJobId || isUploading || isProcessingReport) {
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
        logger.info(`resetTaskStates: 正在為新任務重置 currentJobId (之前是: ${currentJobId})。`);
        setCurrentJobId(null); 
    }
    
    setReportReady(false); 
    setReportDownloadUrl(''); 
    setReportS3KeyForChat('');
    setReportS3BucketForChat(''); 
    setReportFileNameForDisplay('');
    // isProcessingReport 和 processingStatusMessage 應該由 handleUploadAndProcess 控制
    // 但如果是由「處理新報告」按鈕觸發，則應重置
    if (initiatingNewJob) { // 只有在明確開始新任務或點擊重置按鈕時才重置這些
        setIsProcessingReport(false); 
        setProcessingStatusMessage('');
        if (fromNewFileSelection) { // 如果是來自檔案選擇，聊天訊息可以更通用
             setChatMessages([{ id: Date.now(), text: '請選擇一個 ZIP 檔案以上傳。', sender: 'system' }]);
        } else {
             setChatMessages([{ id: Date.now(), text: '請上傳一個新的 ZIP 壓縮檔。', sender: 'system' }]);
        }
    }
  };

  const handleFilesValidation = (incomingFiles) => {
    // 這個函數現在只負責驗證和設定 selectedFiles，不直接調用 resetTaskStates
    setSelectedFiles([]); // 先清空
    setUploadError('');   // 清除舊錯誤

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
    // 如果當前有任務正在上傳或處理，則不允許更改選擇，避免狀態混亂
    if (isUploading || isProcessingReport) {
        logger.warn("handleFileChange: 操作被忽略，目前有任務正在上傳或處理中。");
        setUploadError("目前有任務正在處理中，請先等待其完成。");
        if (fileInputRef.current) fileInputRef.current.value = ""; // 仍然清空，避免瀏覽器記住選擇
        return;
    }
    // 選擇新檔案代表開始一個新任務的意圖
    resetTaskStates(true, true); // initiatingNewJob = true, fromNewFileSelection = true
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
    resetTaskStates(true, true); // initiatingNewJob = true, fromNewFileSelection = true
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
    
    // 1. 清理任何可能正在運行的舊輪詢 (如果有的話)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      logger.info("handleUploadAndProcess: 已清除舊的輪詢 interval。");
    }

    // 2. 為新任務生成 ID
    const newJobId = uuidv4();
    
    // 3. 設定與新任務相關的初始狀態
    //    確保在 setCurrentJobId 之前設定好其他初始狀態
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
    // 更新聊天訊息，只保留初始系統訊息（如果有的話）並添加新任務開始訊息
    setChatMessages(prev => prev.filter(m => m.sender === 'system' && m.text.startsWith('您好！')).concat({id: Date.now(), text: `🚀 任務 ${newJobId} 開始，準備上傳檔案...`, sender: 'system'}));
    
    // 4. **在所有其他相關狀態更新之後，並且在異步操作 (如 S3 上傳) 之前，設定 currentJobId**
    setCurrentJobId(newJobId); 
    logger.info(`新任務開始，Job ID (已設定 React state): ${newJobId}`);
    
    setIsUploading(true); 
    
    const result = await uploadSingleFileToS3(fileToUpload, newJobId); 
    
    if (!result.success) {
        setIsUploading(false);
        setIsProcessingReport(false); 
        setUploadError(prev => `${prev}檔案 ${result.originalFileName} 上傳失敗: ${result.error}. `);
        setChatMessages(prevMsgs => [...prevMsgs, {id: Date.now(), text: `❌ 檔案 ${result.originalFileName} 上傳失敗。任務 ${newJobId} 中止。`, sender: 'system-error'}]);
        setCurrentJobId(null); // 任務失敗，清除 jobId，允許用戶重新開始
        return; 
    }
    
    setFilesUploadedCount(1);
    setUploadProgress(100);   
    
    setIsUploading(false); 
    setProcessingStatusMessage('✅ ZIP 檔案已上傳到 S3。後端正在處理報告，請稍候...');
    setChatMessages(prev => [...prev, {id: Date.now()+1, text: `✅ ZIP 檔案上傳成功！任務 ${newJobId} 的報告正在後端生成中...`, sender: 'system'}]);
    
    // 將 newJobId (當前任務的 ID) 傳遞給 startPollingForReport 作為其「活躍會話 ID」
    startPollingForReport(newJobId, newJobId); 
  };
  
  const startPollingForReport = (jobIdToPoll, activeJobIdForThisInterval) => {
    // activeJobIdForThisInterval 是此輪詢實例被啟動時的 jobId
    if (pollingIntervalRef.current) { // 清除任何可能存在的舊 interval
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    let attempts = 0;
    const maxAttempts = 36; 
    const pollIntervalMs = 10000;
    logger.info(`輪詢啟動: 針對 jobId=${jobIdToPoll}, 此輪詢的活躍ID=${activeJobIdForThisInterval}, API=${CHECK_REPORT_STATUS_API}`);
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      
      // **關鍵檢查點1：如果 React state 中的 currentJobId 已經不是啟動此輪詢時的 activeJobIdForThisInterval，
      // 表示用戶已經開始了一個全新的任務 (例如，重新選擇了檔案並點擊了上傳)，則此舊輪詢應停止。**
      if (currentJobId !== activeJobIdForThisInterval) {
          logger.warn(`全局 currentJobId (${currentJobId}) 與此輪詢實例的 activeJobId (${activeJobIdForThisInterval}) 不符，停止對 jobId ${jobIdToPoll} 的輪詢。`);
          clearInterval(pollingIntervalRef.current);
          return;
      }

      if (attempts > maxAttempts) { 
        logger.warn(`輪詢 jobId ${jobIdToPoll} 已達到最大嘗試次數 ${maxAttempts}。`);
        clearInterval(pollingIntervalRef.current); 
        if (isProcessingReport) { 
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

        // **關鍵檢查點2：在處理回應之前，再次檢查 currentJobId**
        if (currentJobId !== activeJobIdForThisInterval) {
            logger.warn(`在 fetch 回應後，全局 currentJobId (${currentJobId}) 與 activeJobId (${activeJobIdForThisInterval}) 不符，停止對 jobId ${jobIdToPoll} 的輪詢。`);
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
          // setCurrentJobId(jobIdToPoll); // currentJobId 應該已經是 jobIdToPoll (即 activeJobIdForThisInterval)
          setIsProcessingReport(false); 
          setReportReady(true);       
          setProcessingStatusMessage(`🎉 報告 "${data.fileName}" (任務 ${jobIdToPoll}) 已成功產生！`);
          setChatMessages(prev => [...prev.filter(m=>m.sender !== 'system-error'), {id: Date.now(), text: `🎉 報告 "${data.fileName}" 已就緒！`, sender: 'system'}]);
          return; 
        }
        
        if (data.status === 'PROCESSING' || data.status === 'UPLOADING' || reportStatusResponse.status === 202) {
            logger.info(`輪詢嘗試 ${attempts}: 報告仍在處理中 (JobId: ${jobIdToPoll}, API狀態: ${data.status || 'N/A'})`);
        } else if (data.status === 'FAILED') {
          logger.error(`輪詢嘗試 ${attempts}: 報告處理失敗 (JobId: ${jobIdToPoll})`, data.message);
          clearInterval(pollingIntervalRef.current); 
          setIsProcessingReport(false);
          setProcessingStatusMessage(`報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`);
          setChatMessages(prev => [...prev, {id: Date.now(), text: `❌ 報告處理失敗 (任務 ${jobIdToPoll}): ${data.message}`, sender: 'system-error'}]);
        } else if (reportStatusResponse.status === 404) { // JobId 在 DynamoDB 中還沒找到
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
        if (attempts > maxAttempts - 3) { // 在最後幾次嘗試時如果還是網路錯誤，就停止
            clearInterval(pollingIntervalRef.current); setIsProcessingReport(false);
            setProcessingStatusMessage(`輪詢因網路問題多次失敗 (任務 ${jobIdToPoll})。`);
            setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 輪詢 API 失敗多次，請檢查網路。`, sender: 'system-error'}]);
        }
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
        body: JSON.stringify({ query: currentQuery, s3Bucket: reportS3BucketForChat, s3Key: reportS3KeyForChat, jobId: currentJobId }),
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
  
  const osPathBaseName = (path, removeExtension = false) => { if (!path) return ''; let base = path.substring(path.lastIndexOf('/') + 1); if (removeExtension) { const lastDot = base.lastIndexOf('.'); if (lastDot !== -1) base = base.substring(0, lastDot); } return base; };

  return ( 
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
        {/* 檔案上傳區: 只有在沒有 currentJobId (即全新任務) 且不在處理中時才顯示 */}
        {(!currentJobId || !isProcessingReport) && !reportReady && ( // 調整顯示條件
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
            {/* isUploading 現在只用於 S3 PUT 階段，不在這裡顯示進度條，processingStatusMessage 會顯示整體狀態 */}
            {selectedFiles.length > 0 && (
              <button onClick={handleUploadAndProcess} disabled={isUploading || isProcessingReport} /* 增加 isProcessingReport 禁用 */
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-purple-500/50">
                {(isUploading || isProcessingReport) ? (<><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />處理中...</>) : (<><UploadCloud className="mr-2 h-5 w-5" />開始上傳並處理</>)}
              </button>
            )}
            {uploadError && (<p className="text-red-400 mt-3 text-sm flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-1" /> {uploadError}</p>)}
          </section>
        )}

         {(currentJobId && isProcessingReport) && !reportReady && ( // 只有當有 jobId 且在處理中才顯示
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
                    onClick={() => { resetTaskStates(true, true); /* initiatingNewJob=true, fromNewFileSelection=true */ }} 
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