import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, MessageSquare, Send, Download, AlertCircle, Loader2, CheckCircle, RefreshCw } from 'lucide-react';

// --- API 端點 ---
const GENERATE_PRESIGNED_URL_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url';
const CHAT_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/chat';
// TODO: 將 YOUR_API_GATEWAY_ID.execute-api.YOUR_REGION.amazonaws.com 替換為您的 get_processed_report_url_lambda 的實際 API Gateway 端點
const GET_PROCESSED_REPORT_DOWNLOAD_URL_API = 'https://gdc4pbpk35.execute-api.ap-northeast-1.amazonaws.com/prod/get-process-report'; 

const NessusAIPage = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100 for overall S3 upload progress
  const [filesUploadedToS3Info, setFilesUploadedToS3Info] = useState([]); // Stores {s3Key, s3Bucket, originalFileName} for successfully uploaded files

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

  // 簡單的 console logger 封裝
  const logger = {
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  };

  useEffect(() => {
    setChatMessages([
      { id: Date.now(), text: '您好！請先上傳您的 Nessus CSV 報告檔案 (可多選或上傳單一 ZIP)。', sender: 'system' }
    ]);
    return () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages]);

  const triggerFileInput = () => fileInputRef.current.click();
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const resetStateBeforeUpload = () => {
    setUploadError('');
    setUploadProgress(0);
    setFilesUploadedToS3Info([]);
    setReportReady(false);
    setReportDownloadUrl('');
    setReportS3KeyForChat('');
    setReportS3BucketForChat('');
    setReportFileNameForDisplay('');
    setIsProcessingReport(false);
    setProcessingStatusMessage('');
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
  };

  const handleFileChange = (event) => {
    resetStateBeforeUpload();
    const files = Array.from(event.target.files);
    // 允許多個 CSV 或單一 ZIP
    if (files.length > 1 && files.some(f => f.name.toLowerCase().endsWith('.zip'))) {
        setUploadError('如果您上傳 ZIP 檔案，請只選擇一個 ZIP 檔案。');
        setSelectedFiles([]);
        return;
    }
    const validFiles = files.filter(file => 
        file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.zip')
    );
    if (validFiles.length !== files.length) {
        setUploadError('部分檔案類型不支援。僅支援 CSV 或 ZIP 檔案。');
    }
    setSelectedFiles(validFiles);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    resetStateBeforeUpload();
    const files = Array.from(event.dataTransfer.files);
    // ... (檔案類型驗證同 handleFileChange)
    if (files.length > 1 && files.some(f => f.name.toLowerCase().endsWith('.zip'))) {
        setUploadError('如果您上傳 ZIP 檔案，請只選擇一個 ZIP 檔案。');
        setSelectedFiles([]);
        return;
    }
    const validFiles = files.filter(file => 
        file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.zip')
    );
    if (validFiles.length !== files.length) {
        setUploadError('部分檔案類型不支援。僅支援 CSV 或 ZIP 檔案。');
    }
    setSelectedFiles(validFiles);
  };

  const uploadSingleFileToS3 = async (file, index, totalFiles) => {
    try {
      const presignedUrlResponse = await fetch(GENERATE_PRESIGNED_URL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      });
      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json();
        throw new Error(errorData.error || `無法獲取 ${file.name} 的上傳授權。`);
      }
      const { presignedUrl, s3Key, s3Bucket } = await presignedUrlResponse.json();
      
      const uploadToS3Response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!uploadToS3Response.ok) throw new Error(`檔案 ${file.name} 上傳 S3 失敗。`);
      
      // 更新整體進度
      setUploadProgress(prev => prev + (100 / totalFiles));
      logger.info(`檔案 ${file.name} 已成功上傳到 s3://${s3Bucket}/${s3Key}`);
      return { success: true, s3Key, s3Bucket, originalFileName: file.name };
    } catch (error) {
      logger.error(`上傳檔案 ${file.name} 失敗:`, error);
      setUploadError(prev => `${prev} 上傳 ${file.name} 失敗: ${error.message}\n`);
      return { success: false, originalFileName: file.name, error: error.message };
    }
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFiles.length) {
      setUploadError('請選擇檔案。');
      return;
    }
    resetStateBeforeUpload(); // 確保狀態乾淨
    setIsUploading(true);
    setProcessingStatusMessage('🚀 準備上傳檔案...');
    setChatMessages([{id: Date.now(), text: '🚀 準備上傳檔案...', sender: 'system'}]);

    // 如果是單一 ZIP，直接處理；如果是多個 CSV，也直接處理
    const totalFilesToUpload = selectedFiles.length;
    setUploadProgress(0); // 重置進度條

    const uploadResults = [];
    for (let i = 0; i < selectedFiles.length; i++) {
        setProcessingStatusMessage(`正在上傳檔案 ${i+1}/${totalFilesToUpload}: ${selectedFiles[i].name}...`);
        const result = await uploadSingleFileToS3(selectedFiles[i], i, totalFilesToUpload);
        uploadResults.push(result);
        if (!result.success) {
            // 如果有任何檔案上傳失敗，則停止並顯示錯誤
            setIsUploading(false);
            setUploadError(prev => prev + `檔案 ${result.originalFileName} 上傳失敗，請重試。`);
            setChatMessages(prevMsgs => [...prevMsgs, {id: Date.now()+i, text: `❌ 檔案 ${result.originalFileName} 上傳失敗。`, sender: 'system-error'}]);
            return; // 提前退出
        }
    }
    
    setUploadProgress(100); // 所有檔案上傳完成
    setFilesUploadedToS3Info(uploadResults.filter(r => r.success)); // 儲存成功上傳的檔案資訊
    setIsUploading(false);
    setIsProcessingReport(true);
    setProcessingStatusMessage('✅ 檔案已全部上傳到 S3。後端正在處理報告，請稍候...');
    setChatMessages(prev => [...prev, {id: Date.now()+1, text: '✅ 檔案上傳成功！後端報告生成中... (這可能需要幾分鐘)', sender: 'system'}]);
    
    // 假設 S3 事件會觸發 process_nessus_report_lambda
    // 我們需要一個方法來輪詢最終報告的產生
    // 使用第一個成功上傳的檔案資訊來幫助定位 (如果 process_nessus_report_lambda 的輸出與輸入有關聯)
    // 或者，如果 process_nessus_report_lambda 完成後會通知 (例如寫入 DynamoDB)，則輪詢該通知
    const primaryFileInfo = uploadResults.find(r => r.success);
    if (primaryFileInfo) {
        // 輪詢時，我們不知道最終報告的確切名稱 (因為有時間戳)
        // 所以 get_processed_report_url_lambda 需要能根據前綴找到最新的報告
        // 我們將傳遞原始上傳檔案的 bucket 和一個預期的 processed_reports/ 前綴
        // 也可以傳遞原始檔案名作為線索，讓 Lambda 嘗試匹配
        let pollingPrefix = `processed_reports/Nessus_Report_${osPathBaseName(primaryFileInfo.originalFileName, true)}_`;
        // 如果是 ZIP，通常我們希望報告是基於 ZIP 名稱，而不是 ZIP 內的某個 CSV
        if (selectedFiles.length === 1 && selectedFiles[0].name.toLowerCase().endsWith('.zip')) {
             pollingPrefix = `processed_reports/Nessus_Report_${osPathBaseName(selectedFiles[0].name, true)}_`;
        }
        logger.info(`開始輪詢報告，使用前綴: ${pollingPrefix} in bucket ${primaryFileInfo.s3Bucket}`);
        startPollingForReport(primaryFileInfo.s3Bucket, pollingPrefix);
    } else {
        // 理論上不應該到這裡，因為上面有檢查
        setProcessingStatusMessage('所有檔案上傳失敗，無法處理報告。');
        setIsProcessingReport(false);
    }
  };
  
  // 輔助函數：類似 Python os.path.basename，並可選擇移除副檔名
  const osPathBaseName = (path, removeExtension = false) => {
    let base = path.substring(path.lastIndexOf('/') + 1);
    if (removeExtension) {
      base = base.substring(0, base.lastIndexOf('.'));
    }
    return base;
  };

  const startPollingForReport = (bucket, s3KeyPrefixForPolling) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    let attempts = 0;
    const maxAttempts = 30; // 增加嘗試次數 (30 * 10秒 = 5分鐘)
    const pollIntervalMs = 10000; // 10 秒

    logger.info(`輪詢啟動: bucket=${bucket}, prefix=${s3KeyPrefixForPolling}, interval=${pollIntervalMs}ms, maxAttempts=${maxAttempts}`);
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollingIntervalRef.current);
        setIsProcessingReport(false);
        setProcessingStatusMessage('報告處理超時或未找到。請稍後手動檢查或聯繫管理員。');
        setChatMessages(prev => [...prev, {id: Date.now(), text: '⚠️ 報告處理超時。', sender: 'system-error'}]);
        return;
      }
      
      setProcessingStatusMessage(`正在檢查報告狀態 (嘗試 ${attempts}/${maxAttempts})...`);
      
      try {
        // 呼叫 get_processed_report_url_lambda，傳遞 s3Prefix
        const apiUrl = `${GET_PROCESSED_REPORT_DOWNLOAD_URL_API}?s3Prefix=${encodeURIComponent(s3KeyPrefixForPolling)}`;
        logger.info(`輪詢 API: ${apiUrl}`);
        const reportStatusResponse = await fetch(apiUrl);

        if (reportStatusResponse.ok) {
          const data = await reportStatusResponse.json();
          logger.info("輪詢成功，收到報告資料:", data);
          clearInterval(pollingIntervalRef.current);
          setReportDownloadUrl(data.downloadUrl);
          setReportFileNameForDisplay(data.fileName);
          setReportS3KeyForChat(data.s3Key); 
          setReportS3BucketForChat(data.s3Bucket);
          setReportReady(true);
          setIsProcessingReport(false);
          setProcessingStatusMessage(`🎉 報告 "${data.fileName}" 已成功產生！`);
          setChatMessages(prev => [...prev, {id: Date.now(), text: `🎉 報告 "${data.fileName}" 已就緒！您可以下載報告，或開始提問。`, sender: 'system'}]);
        } else if (reportStatusResponse.status === 404) {
          logger.info(`輪詢嘗試 ${attempts}: 報告尚未就緒 (404)`);
        } else {
          const errorData = await reportStatusResponse.json().catch(() => ({error: "未知錯誤"}));
          logger.error(`輪詢嘗試 ${attempts}: 檢查報告狀態時發生錯誤 ${reportStatusResponse.status}`, errorData);
          // 暫時不因非404錯誤停止輪詢，除非達到最大次數
          // clearInterval(pollingIntervalRef.current);
          // setIsProcessingReport(false);
          // setProcessingStatusMessage(`檢查報告狀態時發生錯誤: ${errorData.error || reportStatusResponse.statusText}`);
          // setChatMessages(prev => [...prev, {id: Date.now(), text: `⚠️ 檢查報告狀態失敗: ${errorData.error || reportStatusResponse.statusText}`, sender: 'system-error'}]);
        }
      } catch (error) {
        logger.error(`輪詢嘗試 ${attempts}: 網路錯誤或 API 呼叫失敗`, error);
      }
    }, pollIntervalMs);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !reportReady || isChatProcessing) return;
    const newUserMessage = { id: Date.now(), text: chatInput, sender: 'user' };
    setChatMessages(prev => [...prev, newUserMessage]);
    const currentQuery = chatInput;
    setChatInput('');
    setIsChatProcessing(true);
    setChatError('');

    try {
      const chatApiResponse = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentQuery,
          s3Bucket: reportS3BucketForChat, 
          s3Key: reportS3KeyForChat,       
        }),
      });
      if (!chatApiResponse.ok) {
        const errorData = await chatApiResponse.json().catch(()=>({error: "AI服務回應非JSON格式"}));
        throw new Error(errorData.error || 'AI 服務回應錯誤。');
      }
      const data = await chatApiResponse.json();
      const aiMessage = { id: Date.now() + 1, text: data.answer || "AI 沒有提供有效的回答。", sender: 'ai' };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      logger.error("Chat API 錯誤:", error);
      setChatError(`與 AI 溝通時發生錯誤: ${error.message}`);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, text: `🤖 AI 回應錯誤: ${error.message}`, sender: 'system-error' }]);
    } finally {
      setIsChatProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 sm:p-6 flex flex-col items-center font-sans">
      <header className="w-full max-w-4xl mb-6 sm:mb-10 text-center">
        <div className="flex items-center justify-center mb-2">
          <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 mr-3" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Nessus 報告 AI 分析助手
          </h1>
        </div>
        <p className="text-gray-400 mt-2 text-sm sm:text-base">
          上傳 Nessus CSV 報告 (或單一 ZIP 檔)，AI 將自動整理、翻譯 Plugin ID 並提供智能問答。
        </p>
      </header>

      <main className="w-full max-w-3xl bg-gray-800/80 backdrop-blur-md p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700/50">
        {!filesUploadedToS3Info.length > 0 && !isProcessingReport && (
          <section id="upload-section" className="mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-300 mb-4 flex items-center">
              <UploadCloud className="w-6 h-6 mr-2" /> 步驟 1: 上傳報告檔案
            </h2>
            <div
              className={`border-2 border-dashed ${isDragging ? 'border-purple-500 bg-purple-900/30' : 'border-gray-600 hover:border-purple-400'} p-6 sm:p-8 rounded-lg text-center cursor-pointer transition-all duration-300 ease-in-out`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={triggerFileInput}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.zip,application/zip,application/x-zip-compressed,text/csv" multiple />
              <UploadCloud className={`w-12 h-12 mx-auto mb-3 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
              {selectedFiles.length === 0 && (
                <p className="text-gray-400 text-sm sm:text-base">
                  將 Nessus CSV 檔案 (可多選) 或單一 ZIP 檔案拖曳至此，<br className="hidden sm:inline"/>或 <span className="text-purple-400 font-semibold">點擊選擇檔案</span>。
                </p>
              )}
              {selectedFiles.length > 0 && (
                <div>
                  <p className="text-purple-300 font-semibold mb-2">已選擇檔案:</p>
                  <ul className="text-left max-h-32 overflow-y-auto text-xs sm:text-sm">
                    {selectedFiles.map(file => (<li key={file.name} className="text-gray-300 truncate list-disc list-inside ml-2">{file.name}</li>))}
                  </ul>
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
                {isUploading ? (<><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />上傳中...</>) : (<><UploadCloud className="mr-2 h-5 w-5" />開始上傳並處理</>)}
              </button>
            )}
            {uploadError && (<p className="text-red-400 mt-3 text-sm flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-1" /> {uploadError}</p>)}
          </section>
        )}

        {(filesUploadedToS3Info.length > 0 || isProcessingReport) && !reportReady && (
             <section id="processing-status-section" className="mb-6 text-center p-6 bg-blue-900/30 rounded-lg border border-blue-700">
                <Loader2 className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-spin" />
                <h2 className="text-xl sm:text-2xl font-semibold text-blue-400 mb-2">報告處理中</h2>
                <p className="text-gray-300 text-sm sm:text-base">{processingStatusMessage}</p>
                <p className="text-gray-400 text-xs mt-2">這可能需要幾分鐘，請耐心等候。</p>
             </section>
        )}

        {reportReady && reportDownloadUrl && (
          <section id="report-download-section" className="mb-6 text-center p-6 bg-green-900/30 rounded-lg border border-green-700">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl sm:text-2xl font-semibold text-green-400 mb-3">報告已就緒！</h2>
            <p className="text-gray-300 mb-4 text-sm sm:text-base">檔案: <span className="font-semibold">{reportFileNameForDisplay}</span></p>
            <a href={reportDownloadUrl} target="_blank" rel="noopener noreferrer" download={reportFileNameForDisplay}
              className="inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md hover:shadow-green-500/50">
              <Download className="mr-2 h-5 w-5" /> 下載 Excel 報告
            </a>
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
```
**對 `NessusAIPage.jsx` 的重要修改與說明：**
* **API 端點 `GET_PROCESSED_REPORT_DOWNLOAD_URL_API`**: **請務必將佔位符 `https://YOUR_API_GATEWAY_ID.execute-api.YOUR_REGION.amazonaws.com/prod/get-download-url` 替換為您為 `get_processed_report_url_lambda` 設定的真實 API Gateway 端點。**
* **檔案上傳邏輯 (`handleUploadAndProcess`, `uploadSingleFileToS3`)**:
    * 現在會逐個為選中的檔案請求預簽名 URL 並上傳。
    * 增加了對單一 ZIP 檔案或多個 CSV 檔案的處理邏輯。
    * `filesUploadedToS3Info` 狀態會儲存成功上傳的檔案資訊 (S3 Key, Bucket, 原始檔名)。
* **輪詢邏輯 (`startPollingForReport`)**:
    * 現在會向 `GET_PROCESSED_REPORT_DOWNLOAD_URL_API` 發送請求，並在查詢參數中帶上 `s3Prefix`。這個 `s3Prefix` 是基於原始上傳檔案的名稱和固定的 `processed_reports/Nessus_Report_` 前綴來構造的，以便 `get_processed_report_url_lambda` 可以找到對應的最新已處理報告。
    * 成功獲取下載 URL 後，會更新相關狀態以啟用下載和聊天功能。
* **狀態管理**: 增加了更多狀態來追蹤上傳進度、S3 上傳完成情況、報告處理狀態等，以提供更清晰的 UI 反饋。
* **錯誤處理與日誌**: 增加了更多的錯誤處理和 console log。
* **UI/UX**: 調整了上傳提示，明確說明可以上傳多個 CSV 或單一 ZIP。處理中和錯誤訊息更