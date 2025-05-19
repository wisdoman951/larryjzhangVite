// src/components/SurveyPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronRight, Database, Cloud, ShieldCheck, Settings, MessageCircle, Server, Users } from 'lucide-react';

const SurveySection = ({ title, icon, children }) => (
  <section className="mb-10 p-6 bg-slate-800/50 rounded-lg shadow-lg border border-slate-700/50">
    <div className="flex items-center text-purple-300 mb-4">
      {icon}
      <h2 className="text-2xl font-semibold ml-3">{title}</h2>
    </div>
    <div className="text-gray-300 space-y-3">{children}</div>
  </section>
);

const SurveyItem = ({ question, options, note }) => (
  <div className="py-2">
    <p className="font-medium text-gray-100">{question}</p>
    {options && (
      <ul className="list-disc list-inside pl-4 mt-1 text-gray-400 text-sm">
        {options.map((opt, i) => <li key={i}>{opt}</li>)}
      </ul>
    )}
    {note && <p className="text-xs text-purple-400/80 mt-1 italic">{note}</p>}
  </div>
);


const SurveyPage = () => {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto text-white">
      <header className="mb-10 text-center">
        <FileText size={48} className="mx-auto text-purple-400 mb-4" />
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-3">
          LLM 智能客服技術架構調查表
        </h1>
        <p className="text-lg text-gray-400">
          此調查表旨在協助我們了解您 LLM 智能客服的整體架構、資料流程及現有安全措施，以便提供更精準的資訊安全評估。
        </p>
        <p className="text-sm text-gray-500 mt-2">
          (在 MVP DEMO 中，此頁面主要用於展示我們將會收集的資訊類型。)
        </p>
      </header>

      <SurveySection title="A. 核心大型語言模型 (LLM) 資訊">
        <SurveyItem 
          question="1. LLM 模型類型：" 
          options={[
            "GPT 系列 (例如：GPT-3.5, GPT-4, GPT-4o)",
            "Claude 系列 (例如：Claude 2, Claude 3 Sonnet/Opus)",
            "Gemini 系列",
            "Llama 系列 (例如：Llama 2, Llama 3)",
            "其他開源模型 (請註明)",
            "自行研發/微調模型 (請註明基礎模型)",
            "第三方廠商閉源模型 (請註明廠商與模型名稱)"
          ]}
        />
        <SurveyItem 
          question="2. 模型部署方式："
          options={[
            "雲端供應商 API (例如：Azure OpenAI, AWS Bedrock, Google Vertex AI)",
            "模型即服務 (MaaS) 平台",
            "自建/私有雲部署",
            "地端 (On-premise) 部署"
          ]}
        />
        <SurveyItem 
          question="3. 模型存取方式："
          options={["透過 API Gateway", "直接 API 呼叫", "SDK", "其他"]}
        />
        <SurveyItem 
          question="4. 模型是否經過微調 (Fine-tuning)？"
          options={["是 (請簡述目的與數據集類型)", "否"]}
        />
        <SurveyItem 
          question="5. 模型是否使用外部知識庫 (Retrieval Augmented Generation - RAG)？"
          options={[
            "是 (知識庫類型：內部文件, 外部數據庫, 向量數據庫 (請註明類型), 其他)",
            "否"
          ]}
          note="若為是，請提供知識庫更新頻率。"
        />
      </SurveySection>

      <SurveySection title="B. 智能客服應用層資訊" icon={<MessageCircle size={28} />}>
        <SurveyItem question="1. 前端介面：" options={["網站嵌入式聊天視窗", "手機 App 內建", "第三方即時通訊平台整合", "其他"]} />
        <SurveyItem question="2. 後端應用邏輯：" note="請註明所使用的程式語言/框架 (例如：Python/Flask, Node.js/Express)。" />
        <SurveyItem question="3. 是否有中間件或業務邏輯處理層介於前端與 LLM 之間？" options={["是", "否"]} />
        <SurveyItem question="4. API 安全機制：" options={["API 金鑰", "OAuth 2.0", "JWT", "IP 白名單", "WAF", "其他"]} />
        <SurveyItem question="5. 是否使用任何 LLM 安全防護或過濾機制？" options={["是 (請註明工具/方法)", "否"]} />
        <SurveyItem question="6. 是否使用外部工具或插件 (Plugins/Tools) 與 LLM 互動？" options={["是 (請列舉)", "否"]} />
        <SurveyItem question="7. 資料流 - 使用者輸入是否包含敏感資訊？" options={["是", "否"]} />
        <SurveyItem question="8. 資料流 - LLM 回應是否可能包含敏感資訊？" options={["是", "否"]} />
        <SurveyItem question="9. 資料流 - 資料傳輸是否全程加密 (HTTPS/TLS)？" options={["是", "否"]} />
        <SurveyItem question="10. 資料流 - 敏感資料在儲存時是否進行加密或脫敏處理？" options={["是 (請說明方式)", "否"]} />
      </SurveySection>

      <SurveySection title="C. 維運與監控" icon={<Settings size={28} />}>
        <SurveyItem question="1. 日誌記錄範圍：" options={["使用者互動內容", "API 請求與回應", "錯誤與異常事件"]} />
        <SurveyItem question="2. 日誌保存位置與期限：" note="請說明。" />
        <SurveyItem question="3. 監控機制：" options={["效能監控", "安全事件監控", "模型漂移/回應品質監控", "其他"]} />
        <SurveyItem question="4. 目前已知的安全考量或疑慮：" note="請簡述。" />
      </SurveySection>
      
      <div className="mt-12 text-center">
        <Link 
          to="/llm-security/testing" 
          className="inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-purple-500/50"
        >
          了解評估流程與模擬測試
          <ChevronRight size={20} className="ml-2" />
        </Link>
      </div>
    </div>
  );
};

export default SurveyPage;
