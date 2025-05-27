// src/components/TestingProcessPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { Zap, Edit3, ShieldAlert, CheckSquare, Loader2, ChevronRight, ListChecks, Search, ArrowRightCircle, Filter, RefreshCcw, Wand2, Info, Settings2, Layers, Tag } from 'lucide-react';

const GENERATE_EVOLVED_PROMPTS_API = 'https://dm2nkd04w0.execute-api.ap-northeast-1.amazonaws.com/prod/promptgenerator'; // 確保這個路徑與您 API Gateway 設定一致

const SectionCard = ({ title, icon, children, initiallyOpen = false, cardBgColor = "bg-slate-800/70", textColor = "text-purple-300" }) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return (
    <div className={`mb-8 ${cardBgColor} p-4 md:p-6 rounded-xl shadow-2xl border border-slate-700/60 transition-all duration-300 hover:shadow-purple-500/30`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center text-left text-lg md:text-xl font-semibold ${textColor} hover:text-purple-200 transition-colors mb-3 pb-2 border-b border-slate-600/50`}
      >
        <div className="flex items-center">
          {icon}
          <span className="ml-3">{title}</span>
        </div>
        <ChevronRight size={24} className={`transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <div className="text-gray-300 space-y-3 md:space-y-4 mt-4 pl-1 pr-1 md:pl-2 md:pr-2 text-sm md:text-base">{children}</div>}
    </div>
  );
};
const owaspCategories = [
  { id: "LLM01", name: "提示詞注入" }, { id: "LLM02", name: "不安全輸出" },
  { id: "LLM03", name: "訓練數據污染" }, { id: "LLM04", name: "模型阻斷服務" },
  { id: "LLM05", name: "供應鏈漏洞" }, { id: "LLM06", name: "敏感資訊洩露" },
  { id: "LLM07", name: "不安全插件" }, { id: "LLM08", name: "過度代理" }, 
  { id: "LLM09", name: "錯誤資訊/幻覺" }, { id: "LLM10", name: "模型竊取" }
];
const thematicCategoriesFromExcel = [
  "娛樂", "政治", "違反善良風俗", "健康", "運動", "教育", 
  "旅遊", "財經", "環保", "文化", "同業", "價值觀"
];

// 為了 DEMO，前端也需要知道這些關鍵字，以便可以選擇性地傳遞給 Lambda
// 或者 Lambda 內部有更完整的映射表
const thematicKeywordsMapForFrontend = {
    "娛樂": "德州撲克, 賭博", "政治": "選舉, 國際關係", "違反善良風俗": "不當言論",
    "健康": "醫療諮詢, 心理健康", "運動": "賽事, 運彩", "教育": "學術誠信, 課程內容",
    "旅遊": "行程規劃, 安全問題", "財經": "投資建議, 市場分析", "環保": "環境政策, 汙染問題",
    "文化": "藝術, 傳統習俗", "同業": "競爭分析", "價值觀": "道德判斷"
};
const CategorySelectionItem = ({ category, isSelected, onSelect, count, onCountChange, maxCount }) => (
    <div className={`p-2.5 rounded-md flex items-center justify-between transition-colors ${isSelected ? 'bg-purple-600/30 ring-1 ring-purple-500' : 'bg-slate-700/50 hover:bg-slate-600/50'}`}>
        <label className="flex items-center cursor-pointer flex-grow">
            <input 
                type="checkbox" 
                checked={isSelected} 
                onChange={() => onSelect(category.id || category)} 
                className="form-checkbox h-4 w-4 text-purple-500 bg-slate-600 border-slate-500 rounded focus:ring-purple-400 mr-2"
            />
            <span className="text-xs select-none">{category.name || category}</span>
        </label>
        {isSelected && (
            <div className="flex items-center ml-2">
                <button onClick={() => onCountChange(category.id || category, Math.max(1, count - 1))} className="p-0.5 text-slate-400 hover:text-white"><MinusCircle size={16}/></button>
                <input 
                    type="number" 
                    value={count}
                    onChange={(e) => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > maxCount) val = maxCount;
                        onCountChange(category.id || category, val);
                    }}
                    min="1" max={maxCount}
                    className="w-10 mx-1 text-center bg-slate-800 border border-slate-600 rounded text-xs"
                />
                <button onClick={() => onCountChange(category.id || category, Math.min(maxCount, count + 1))} className="p-0.5 text-slate-400 hover:text-white"><PlusCircle size={16}/></button>
            </div>
        )}
    </div>
);
const handleSeedPromptClick = (prompt) => {
    setSeedInput(prompt); 
  };
const SectionCard = ({ title, icon, children, initiallyOpen = false, cardBgColor = "bg-slate-800/70", textColor = "text-purple-300" }) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return (
    <div className={`mb-8 ${cardBgColor} p-6 rounded-xl shadow-2xl border border-slate-700/60 transition-all duration-300 hover:shadow-purple-500/30`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center text-left text-xl font-semibold ${textColor} hover:text-purple-200 transition-colors mb-3 pb-2 border-b border-slate-600/50`}
      >
        <div className="flex items-center">
          {icon}
          <span className="ml-3">{title}</span>
        </div>
        <ChevronRight size={24} className={`transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <div className="text-gray-300 space-y-4 mt-4 pl-2 pr-2 text-sm md:text-base">{children}</div>}
    </div>
  );
};

// Evol-Instruct 流程示意圖元件
const EvolInstructFlowDiagram = () => {
  const flowStepStyle = "bg-sky-700/50 p-3 rounded-lg shadow-md text-center text-sky-100 text-sm min-h-[80px] flex flex-col justify-center";
  const arrowStyle = "text-sky-400 mx-2 md:mx-4 self-center text-2xl md:text-3xl transform md:rotate-0"; // 箭頭在小螢幕上可能需要調整

  return (
    <div className="mt-6 mb-4 p-4 bg-slate-700/40 rounded-lg border border-slate-600">
      <h4 className="text-md font-semibold text-purple-200 mb-4 text-center">Evol-Instruct 流程示意</h4>
      <div className="flex flex-col md:flex-row items-stretch justify-around gap-4">
        {/* 步驟 1: 初始指令 */}
        <div className={`flex-1 ${flowStepStyle}`}>
          <Edit3 size={24} className="mx-auto mb-1 text-sky-300"/>
          <p className="font-semibold">1. 初始指令</p>
          <p className="text-xs">(Seed Prompts)</p>
        </div>
        <div className={arrowStyle}>&rarr;</div>
        
        {/* 步驟 2: 演化 (深化/廣化) */}
        <div className={`flex-1 ${flowStepStyle}`}>
          <Zap size={24} className="mx-auto mb-1 text-sky-300"/>
          <p className="font-semibold">2. 演化增強</p>
          <p className="text-xs">(In-depth & In-breadth Evolving)</p>
        </div>
        <div className={arrowStyle}>&rarr;</div>

        {/* 步驟 3: 過濾 */}
        <div className={`flex-1 ${flowStepStyle}`}>
          <Filter size={24} className="mx-auto mb-1 text-sky-300"/>
          <p className="font-semibold">3. 過濾篩選</p>
          <p className="text-xs">(Elimination Evolving)</p>
        </div>
        <div className={arrowStyle}>&rarr;</div>
        
        {/* 步驟 4: 迭代 */}
        <div className={`flex-1 ${flowStepStyle}`}>
          <RefreshCcw size={24} className="mx-auto mb-1 text-sky-300"/>
          <p className="font-semibold">4. 迭代循環</p>
          <p className="text-xs">(Iteration)</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-4 text-center">
        此流程旨在從少量種子提示詞自動生成大量、多樣化且高質量的測試案例。
      </p>
    </div>
  );
};


const TestingProcessPage = () => {
  const [simulatingScan, setSimulatingScan] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [simulatingJudge, setSimulatingJudge] = useState(false);
  const [judgeResults, setJudgeResults] = useState(null);
  // history for navigation (ensure react-router-dom v5 if using useHistory)
  // For react-router-dom v6+, use useNavigate
  const history = useHistory(); 


  const [seedInput, setSeedInput] = useState('例如：我的信用卡帳單有問題，請幫我查詢明細。');
  const [generatedEvolvedPrompts, setGeneratedEvolvedPrompts] = useState([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [promptGenerationError, setPromptGenerationError] = useState('');

  const [generationMode, setGenerationMode] = useState('owasp'); 
  // Use objects to store counts per category: { categoryId: count }
  const [selectedOwasp, setSelectedOwasp] = useState({}); 
  const [selectedThematic, setSelectedThematic] = useState({});
  
  const MAX_PROMPTS_PER_CATEGORY = 10;
  const OVERALL_MAX_PROMPTS_TARGET = 15; // 目標總數

  const logger = { 
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
  };
  
  const handleCategorySelection = (categoryIdentifier, type) => {
    const setter = type === 'owasp' ? setSelectedOwasp : setSelectedThematic;
    setter(prev => {
      const newSelection = {...prev};
      if (newSelection[categoryIdentifier]) {
        delete newSelection[categoryIdentifier]; // Uncheck
      } else {
        newSelection[categoryIdentifier] = 1; // Check and set default count to 1
      }
      return newSelection;
    });
  };

  const handleCountChange = (categoryIdentifier, newCount, type) => {
    const setter = type === 'owasp' ? setSelectedOwasp : setSelectedThematic;
    const maxVal = MAX_PROMPTS_PER_CATEGORY;
    let finalCount = parseInt(newCount, 10);
    if (isNaN(finalCount) || finalCount < 1) finalCount = 1;
    if (finalCount > maxVal) finalCount = maxVal;

    setter(prev => ({
      ...prev,
      [categoryIdentifier]: finalCount
    }));
  };

  const handleSelectAll = (type) => {
    const categories = type === 'owasp' ? owaspCategories.map(c => c.id) : thematicCategoriesFromExcel;
    const currentSelection = type === 'owasp' ? selectedOwasp : selectedThematic;
    const setter = type === 'owasp' ? setSelectedOwasp : setSelectedThematic;

    if (Object.keys(currentSelection).length === categories.length) { // If all are selected, deselect all
      setter({});
    } else { // Else, select all with default count 1
      const newSelection = {};
      categories.forEach(catIdOrName => {
        const key = typeof catIdOrName === 'object' ? catIdOrName.id : catIdOrName;
        newSelection[key] = 1;
      });
      setter(newSelection);
    }
  };

  const handleGenerateEvolvedPrompts = async () => {
    if (!seedInput.trim()) { setPromptGenerationError("請輸入種子提示詞！"); return; }
    
    let generationConfigPayload = [];
    if (generationMode === 'owasp') {
      generationConfigPayload = Object.entries(selectedOwasp).map(([category, count]) => ({
        mode: 'owasp', category, count
      }));
    } else if (generationMode === 'thematic') {
      generationConfigPayload = Object.entries(selectedThematic).map(([category, count]) => ({
        mode: 'thematic', category, count
        // Optionally pass keywords if needed by Lambda, though current Lambda uses hardcoded map
        // topic_keywords_map_entry: thematicKeywordsMapForFrontend[category] 
      }));
    }

    if (generationConfigPayload.length === 0) {
      setPromptGenerationError(`請至少選擇一個 ${generationMode === 'owasp' ? 'OWASP 風險' : '主題'} 類別！`);
      return;
    }
    
    setIsGeneratingPrompts(true);
    setGeneratedEvolvedPrompts([]);
    setPromptGenerationError('');
    
    try {
      logger.info(`向 API (${GENERATE_EVOLVED_PROMPTS_API}) 發送請求: seed=${seedInput}, config=${JSON.stringify(generationConfigPayload)}`);
      const response = await fetch(GENERATE_EVOLVED_PROMPTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          seed_prompt: seedInput,
          generation_config: generationConfigPayload,
          total_count: OVERALL_MAX_PROMPTS_TARGET // Pass the overall target to Lambda
        }),
      });

      const responseText = await response.text();
      logger.info("Raw API response for evolved prompts:", responseText);

      if (!response.ok) {
        let errorMsg = `API 請求失敗 (狀態碼: ${response.status})`;
        try { const errorData = JSON.parse(responseText); errorMsg = errorData.error || errorData.message || JSON.stringify(errorData); } 
        catch (e) { /* ignore */ }
        throw new Error(errorMsg);
      }

      const data = JSON.parse(responseText);
      if (data.evolved_prompts && data.evolved_prompts.length > 0) {
        setGeneratedEvolvedPrompts(data.evolved_prompts);
      } else {
        setPromptGenerationError(data.message || "後端未能成功生成演化提示詞，或返回了空列表。");
      }
    } catch (error) {
      logger.error("生成演化提示詞時發生錯誤:", error);
      setPromptGenerationError(`生成演化提示詞失敗: ${error.message}`);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleSimulateScan = async () => {
    setSimulatingScan(true);
    setScanResults(null); 
    setJudgeResults(null); 
    await new Promise(resolve => setTimeout(resolve, 2500)); 
    try {
      const response = await fetch('/data/simulated_deepteam_results.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setScanResults(data);
    } catch (error) {
      console.error("Error fetching simulated scan results:", error);
      setScanResults({ error: "無法載入模擬掃描結果。" });
    }
    setSimulatingScan(false);
  };

  const handleSimulateJudge = async () => {
    if (!scanResults || scanResults.error) { 
        alert("請先執行模擬掃描。");
        return;
    }
    setSimulatingJudge(true);
    setJudgeResults(null);
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const response = await fetch('/data/simulated_llm_judge_results.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setJudgeResults(data);
    } catch (error) {
      console.error("Error fetching simulated judge results:", error);
      setJudgeResults({ error: "無法載入模擬評估結果。" });
    }
    setSimulatingJudge(false);
  };
  
  const handleGoToDashboard = () => {
    if (scanResults && !scanResults.error && judgeResults && !judgeResults.error) {
        history.push("/llm-security/dashboard");
    } else {
        alert("請先完成模擬掃描與回應評估，才能查看儀表板。");
    }
  };

  // 使用更淺或對比更明顯的背景色給 SectionCard
  const sectionCardBg = "bg-slate-700/70"; // 例如，比之前的 bg-slate-800/60 更淺一點，或透明度低一點
  const sectionTitleColor = "text-sky-300"; // 調整標題顏色以匹配新的背景

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto text-white">
      <header className="mb-10 text-center">
        <Zap size={48} className="mx-auto text-purple-400 mb-4" />
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-3">
          進階提示詞生成與安全評估流程
        </h1>
      </header>

      <SectionCard title="1. 提示詞生成邏輯說明" icon={<Info size={24} />} initiallyOpen={true} cardBgColor="bg-sky-800/50" textColor="text-sky-200">
        <p className="text-sm">
          本工具利用 AI (AWS Bedrock) 實現提示詞演化，模擬更複雜的攻擊場景。
        </p>
        <ul className="list-disc list-inside pl-4 mt-2 text-xs space-y-1">
          <li>輸入您的「種子提示詞」作為演化的基礎。</li>
          <li>選擇「生成模式」：
            <ul className="list-circle list-inside pl-5">
              <li><strong>OWASP Top 10 模式：</strong> 針對選定的 OWASP LLM 風險類別，AI 將結合您的種子提示詞生成特定攻擊角度的演化提示詞。</li>
              <li><strong>主題類別模式：</strong> 根據選定的主題（如娛樂、政治等）及其預設的相關關鍵字，AI 將結合您的種子提示詞生成與該主題相關的測試提示詞。</li>
            </ul>
          </li>
          <li>您可以勾選想要針對其生成提示詞的具體「類別」。</li>
          <li>為每個選中的類別指定希望生成的提示詞數量 (上限 {MAX_PROMPTS_PER_CATEGORY} 個)。</li>
          <li>系統將盡力生成總數約 {OVERALL_MAX_PROMPTS_TARGET} 個的多樣化提示詞 (實際數量可能因 AI 生成效果和去重而略有差異)。</li>
        </ul>
         <p className="text-xs mt-2">* 此為 DEMO 功能，演化策略和生成數量有限。真實評估將採用更全面的方法。</p>
      </SectionCard>

      <SectionCard title="2. 互動式提示詞演化器 (AI 驅動)" icon={<Wand2 size={24} />} initiallyOpen={true} cardBgColor={sectionCardBg} textColor={sectionTitleColor}>
        <div className="p-2 md:p-4 bg-slate-700/40 rounded-lg border border-slate-600">
          <div className="mb-4">
            <label htmlFor="seedPrompt" className="block text-md font-semibold text-purple-200 mb-2">輸入您的「種子提示詞」：</label>
            <textarea
              id="seedPrompt" value={seedInput} onChange={(e) => setSeedInput(e.target.value)}
              placeholder="例如：我的信用卡帳單有問題，請幫我查詢明細。"
              className="w-full p-3 border border-slate-500 rounded-lg bg-slate-800 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm min-h-[70px]"
              rows="2"
            />
          </div>

          <div className="mb-4">
            <label className="block text-md font-semibold text-purple-200 mb-2">選擇生成模式：</label>
            <div className="flex gap-4 mb-3">
              <button onClick={() => setGenerationMode('owasp')} className={`py-2 px-4 rounded-lg text-sm ${generationMode === 'owasp' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-slate-600 hover:bg-slate-500'}`}>OWASP Top 10 風險</button>
              <button onClick={() => setGenerationMode('thematic')} className={`py-2 px-4 rounded-lg text-sm ${generationMode === 'thematic' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-slate-600 hover:bg-slate-500'}`}>主題類別</button>
            </div>
          </div>

          {generationMode === 'owasp' && (
            <div className="mb-4 p-3 bg-slate-900/20 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-purple-200">選擇 OWASP LLM 風險類別 (可多選)：</label>
                <button onClick={() => handleSelectAll('owasp')} className="text-xs py-1 px-2 bg-sky-600 hover:bg-sky-700 rounded">
                  {Object.keys(selectedOwasp).length === owaspCategories.length ? "取消全選" : "全選 OWASP"}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1">
                {owaspCategories.map(cat => (
                  <CategorySelectionItem 
                    key={cat.id} category={cat} isSelected={!!selectedOwasp[cat.id]} 
                    onSelect={() => handleCategorySelection(cat.id, 'owasp')}
                    count={selectedOwasp[cat.id] || 1}
                    onCountChange={(id, count) => handleCountChange(id, count, 'owasp')}
                    maxCount={MAX_PROMPTS_PER_CATEGORY}
                  />
                ))}
              </div>
            </div>
          )}

          {generationMode === 'thematic' && (
            <div className="mb-4 p-3 bg-slate-900/20 rounded-md">
               <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-purple-200">選擇主題類別 (可多選)：</label>
                <button onClick={() => handleSelectAll('thematic')} className="text-xs py-1 px-2 bg-sky-600 hover:bg-sky-700 rounded">
                  {Object.keys(selectedThematic).length === thematicCategoriesFromExcel.length ? "取消全選" : "全選主題"}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1">
                {thematicCategoriesFromExcel.map(catName => (
                   <CategorySelectionItem 
                    key={catName} category={catName} isSelected={!!selectedThematic[catName]} 
                    onSelect={() => handleCategorySelection(catName, 'thematic')}
                    count={selectedThematic[catName] || 1}
                    onCountChange={(name, count) => handleCountChange(name, count, 'thematic')}
                    maxCount={MAX_PROMPTS_PER_CATEGORY}
                  />
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={handleGenerateEvolvedPrompts}
            disabled={isGeneratingPrompts || !seedInput.trim() || (generationMode === 'owasp' && Object.keys(selectedOwasp).length === 0) || (generationMode === 'thematic' && Object.keys(selectedThematic).length === 0)}
            className="w-full mt-4 flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-5 rounded-lg transition-all shadow-lg hover:shadow-pink-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGeneratingPrompts ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Wand2 className="mr-2 h-5 w-5" />}
            {isGeneratingPrompts ? "AI 努力生成中..." : "AI 生成演化提示詞"}
          </button>

          {promptGenerationError && ( <p className="text-red-400 text-sm mt-3 flex items-center"><AlertCircle size={16} className="mr-1" />{promptGenerationError}</p> )}
          {generatedEvolvedPrompts.length > 0 && (
            <div className="mt-6">
              <h5 className="text-md font-semibold text-purple-300 mb-2">AI 生成的演化提示詞 ({generatedEvolvedPrompts.length} 個)：</h5>
              <ul className="list-decimal list-inside pl-4 space-y-2 text-sm bg-slate-800/60 p-4 rounded-md shadow max-h-96 overflow-y-auto">
                {generatedEvolvedPrompts.map((p, i) => <li key={`gen-${i}`} className="p-1.5 rounded hover:bg-slate-700/50">{p}</li>)}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>
<SectionCard title="3. 模擬自動化掃描與 AI 評估" icon={<Search size={24} />} initiallyOpen={true} cardBgColor={sectionCardBg} textColor={sectionTitleColor}>
        <div className="space-y-6">
          <div>
            <button
              onClick={handleSimulateScan}
              disabled={simulatingScan || simulatingJudge}
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-blue-500/50 disabled:opacity-60"
            >
              {simulatingScan ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2" />}
              {simulatingScan ? "正在模擬 DeepTeam 掃描..." : "開始模擬 DeepTeam 安全掃描"}
            </button>
            {scanResults && (
              <div className="mt-4 p-4 bg-slate-700/50 rounded-md max-h-80 overflow-y-auto">
                <h4 className="text-lg font-semibold text-sky-300 mb-2">模擬掃描結果摘要：</h4>
                {scanResults.error ? <p className="text-red-400">{scanResults.error}</p> : (
                  <ul className="text-sm space-y-2">
                    {scanResults.slice(0, 3).map(vuln => ( // 只顯示前3個作為預覽
                      <li key={vuln.vulnerabilityId} className="p-2 border border-slate-600 rounded">
                        <p><strong>{vuln.vulnerabilityName}</strong> ({vuln.owaspLlmTop10 && vuln.owaspLlmTop10.split(':')[0]})</p>
                        <p><span className={`font-bold ${vuln.severity === 'High' || vuln.severity === 'Critical' ? 'text-red-400' : vuln.severity === 'Medium' ? 'text-yellow-400' : 'text-green-400'}`}>{vuln.severity}</span></p>
                        <p className="text-xs text-gray-400 truncate mt-1">提示範例: {vuln.triggeredByPromptExample}</p>
                        <p className="text-xs text-gray-300 mt-1 truncate">LLM回應範例: {vuln.llmResponseExample}</p>
                      </li>
                    ))}
                    {scanResults.length > 3 && <p className="text-xs text-gray-400 mt-2">...等共 {scanResults.length} 項發現 (詳見儀表板)。</p>}
                  </ul>
                )}
              </div>
            )}
          </div>

          {scanResults && !scanResults.error && (
            <div>
              <button
                onClick={handleSimulateJudge}
                disabled={simulatingJudge || simulatingScan}
                className="w-full flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-teal-500/50 disabled:opacity-60"
              >
                {simulatingJudge ? <Loader2 className="animate-spin mr-2" /> : <ListChecks className="mr-2" />}
                {simulatingJudge ? "正在模擬 LLM-as-a-Judge 評估..." : "開始模擬 LLM 回應評估"}
              </button>
              {judgeResults && (
                <div className="mt-4 p-4 bg-slate-700/50 rounded-md max-h-80 overflow-y-auto">
                  <h4 className="text-lg font-semibold text-sky-300 mb-2">模擬 LLM 回應評估摘要：</h4>
                  {judgeResults.error ? <p className="text-red-400">{judgeResults.error}</p> : (
                    <ul className="text-sm space-y-2">
                       {judgeResults.map(evalItem => ( // 顯示所有評估結果
                        <li key={evalItem.evaluationId || evalItem.responseId} className="p-2 border border-slate-600 rounded">
                          <p><strong>提示:</strong> <span className="text-gray-400 text-xs">"{evalItem.originalPrompt}"</span></p>
                          {/* ***** 修改點：顯示更長或完整的 LLM 回應 ***** */}
                          <p>
                            <strong>LLM回應:</strong> 
                            <span className="text-gray-400 text-xs whitespace-pre-wrap ml-1">
                              "{evalItem.llmResponseToEvaluate || evalItem.llmResponse}" 
                              {/* 使用 llmResponseToEvaluate 或 llmResponse，並移除 substring */}
                            </span>
                          </p>
                          {/* 確保 evaluationResults 或 evaluation 存在 */}
                          {(evalItem.evaluationResults || evalItem.evaluation) && ( 
                            <>
                              <p><strong>評估安全分數:</strong> 
                                <span className={`font-bold ml-1 ${
                                  (evalItem.evaluationResults || evalItem.evaluation).overallSafetyScore < 0.5 ? 'text-red-400' : 
                                  (evalItem.evaluationResults || evalItem.evaluation).overallSafetyScore < 0.8 ? 'text-yellow-400' : 
                                  'text-green-400'}`
                                }>
                                  {/* 處理 undefined 的情況 */}
                                  {(evalItem.evaluationResults || evalItem.evaluation).overallSafetyScore !== undefined ? 
                                    (evalItem.evaluationResults || evalItem.evaluation).overallSafetyScore.toFixed(2) : 'N/A'}
                                </span>
                              </p>
                              {(evalItem.evaluationResults || evalItem.evaluation).jailbreakAttemptDetected && <p className="text-xs text-red-300">檢測到越獄嘗試!</p>}
                              {(evalItem.evaluationResults || evalItem.evaluation).containsPII && <p className="text-xs text-red-300">可能包含 PII!</p>}
                              <p className="text-xs text-gray-400 mt-1">
                                <i>評審意見: {(evalItem.evaluationResults || evalItem.evaluation).judgeComment || "無"}</i>
                              </p>
                            </>
                          )}
                        </li>
                       ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      <div className="mt-12 text-center">
        <button
          onClick={handleGoToDashboard}
          disabled={!scanResults || !!scanResults.error || !judgeResults || !!judgeResults.error || simulatingScan || simulatingJudge}
          className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(simulatingScan || simulatingJudge) ? <Loader2 className="animate-spin mr-2" /> : <CheckSquare size={20} className="mr-2" />}
          {(simulatingScan || simulatingJudge) ? "請等待模擬完成..." : "查看評估結果儀表板"}
          <ChevronRight size={20} className="ml-2" />
        </button>
      </div>
    </div>
  );
};

export default TestingProcessPage;
