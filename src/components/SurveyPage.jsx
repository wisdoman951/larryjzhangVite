// src/components/SurveyPage.jsx
import React from 'react';

const SurveyPage = () => {
  return (
    <div className="p-6 bg-gray-800/50 text-white rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-purple-300 mb-6 border-b pb-3 border-gray-700">
        LLM 智能客服技術架構調查表
      </h1>
      <p className="mb-4 text-gray-300">
        此調查表旨在協助我們了解您 LLM 智能客服的整體架構、資料流程及現有安全措施，以便提供更精準的資訊安全評估。
        在 MVP DEMO 中，此頁面主要用於展示我們將會收集的資訊類型。
      </p>

      {/* 在這裡可以靜態展示調查表的內容，或者逐步實現表單 */}
      <div className="space-y-8 mt-8">
        <section>
          <h2 className="text-2xl font-semibold text-purple-400 mb-4">A. 核心大型語言模型 (LLM) 資訊</h2>
          <p className="text-gray-400">此部分將詢問關於您使用的 LLM 模型類型、部署方式、存取方式、是否微調、是否使用 RAG 等問題...</p>
          {/* 可以放一個折疊區塊或連結到完整的調查表內容 */}
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-purple-400 mb-4">B. 智能客服應用層資訊</h2>
          <p className="text-gray-400">此部分將涵蓋前端介面、後端邏輯、API 安全機制、LLM 安全防護、外部工具整合及資料流等...</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-purple-400 mb-4">C. 維運與監控</h2>
          <p className="text-gray-400">此部分關注日誌記錄、監控機制以及您目前已知的安全考量...</p>
        </section>
      </div>
      {/* 導覽到下一步的按鈕 */}
      {/* <div className="mt-10 text-center">
        <Link to="/llm-security/testing" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
          下一步：查看模擬測試流程
        </Link>
      </div> 
      */}
    </div>
  );
};
export default SurveyPage;