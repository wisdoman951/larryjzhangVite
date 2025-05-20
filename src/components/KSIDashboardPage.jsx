import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { AlertTriangle, ShieldCheck, FileWarning, Percent, ListChecks, Zap, Target, Activity, Loader2 } from 'lucide-react';
import { Link } from "react-router-dom";

// 模擬從 JSON 檔案載入數據 (在實際應用中，這些數據可能來自 props 或 context)
const loadSimulatedData = async (fileName) => {
  try {
    const response = await fetch(`/data/${fileName}`); // 假設 JSON 檔案在 public/data/ 目錄下
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${fileName}:`, error);
    return null;
  }
};

// 圖表顏色
const OWASP_COLORS = {
  "LLM01": "#FF6384", "LLM02": "#36A2EB", "LLM03": "#FFCE56", "LLM04": "#4BC0C0", 
  "LLM05": "#9966FF", "LLM06": "#FF9F40", "LLM07": "#FFCD56", "LLM08": "#C9CBCF",
  "LLM09": "#DB6284", "LLM10": "#3645EB",
};
const SEVERITY_COLORS = { "Critical": "#DC2626", "High": "#F97316", "Medium": "#FACC15", "Low": "#4ADE80", "Info": "#60A5FA" };


const KSIDashboardPage = () => {
  const [deepteamResults, setDeepteamResults] = useState(null);
  const [judgeResults, setJudgeResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 計算 KSIs 的函數
  const calculateKSIs = () => {
    if (!deepteamResults || !judgeResults) return null;

    let promptInjectionAttempts = 0;
    let promptInjectionSuccesses = 0;
    let piiLeakageCount = 0;
    let harmfulContentCount = 0;
    let totalEvaluatedResponses = judgeResults.length;
    let apiVulnerabilitiesBySeverity = { "Critical": 0, "High": 0, "Medium": 0, "Low": 0 };

    deepteamResults.forEach(vuln => {
      if (vuln.owaspLlmTop10 && vuln.owaspLlmTop10.startsWith("LLM01")) {
        promptInjectionAttempts++; // 假設每個 LLM01 都是一次注入嘗試
        if (vuln.severity === "High" || vuln.severity === "Critical") { // 假設嚴重或高危代表成功
          promptInjectionSuccesses++;
        }
      }
      // 假設 LLM07 (不安全插件) 和 LLM08 (過度代理) 可能關聯到 API 漏洞
      if (vuln.owaspLlmTop10 && (vuln.owaspLlmTop10.startsWith("LLM07") || vuln.owaspLlmTop10.startsWith("LLM08"))) {
        if (apiVulnerabilitiesBySeverity[vuln.severity] !== undefined) {
            apiVulnerabilitiesBySeverity[vuln.severity]++;
        }
      }
    });

    judgeResults.forEach(evalItem => {
      if (evalItem.evaluation.containsPII) piiLeakageCount++;
      if (evalItem.evaluation.isHarmful) harmfulContentCount++;
      // 這裡可以加入更多基於 judgeResults 的指標計算
    });
    
    const promptInjectionSuccessRate = promptInjectionAttempts > 0 ? (promptInjectionSuccesses / promptInjectionAttempts) * 100 : 0;
    const piiLeakageRate = totalEvaluatedResponses > 0 ? (piiLeakageCount / totalEvaluatedResponses) * 100 : 0;
    const harmfulContentRate = totalEvaluatedResponses > 0 ? (harmfulContentCount / totalEvaluatedResponses) * 100 : 0;

    // OWASP 分佈數據
    const owaspDistribution = deepteamResults.reduce((acc, vuln) => {
        const owaspId = vuln.owaspLlmTop10 ? vuln.owaspLlmTop10.split(':')[0] : "Unknown";
        acc[owaspId] = (acc[owaspId] || 0) + 1;
        return acc;
    }, {});
    const owaspChartData = Object.entries(owaspDistribution).map(([name, value]) => ({ name, count: value, fill: OWASP_COLORS[name] || '#8884d8' }));

    // 嚴重性分佈數據
    const severityDistribution = deepteamResults.reduce((acc, vuln) => {
        acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
        return acc;
    }, {});
    const severityChartData = Object.entries(severityDistribution)
                                .map(([name, value]) => ({ name, count: value, fill: SEVERITY_COLORS[name] || '#82ca9d' }))
                                .sort((a,b) => { // 自訂排序
                                    const order = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Info": 4 };
                                    return (order[a.name] ?? 5) - (order[b.name] ?? 5);
                                });


    return {
      promptInjectionSuccessRate,
      piiLeakageRate,
      harmfulContentRate,
      piiLeakageCount,
      harmfulContentCount,
      totalVulnerabilities: deepteamResults.length,
      apiVulnerabilitiesBySeverity,
      owaspChartData,
      severityChartData,
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const dtResults = await loadSimulatedData('simulated_deepteam_results.json');
      const jResults = await loadSimulatedData('simulated_llm_judge_results.json');

      if (dtResults && jResults) {
        setDeepteamResults(dtResults);
        setJudgeResults(jResults);
      } else {
        setError("無法載入必要的模擬數據。請確保 JSON 檔案位於 public/data/ 目錄下。");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const ksis = calculateKSIs();

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin h-12 w-12 text-purple-400" /> <span className="ml-4 text-xl">載入儀表板數據中...</span></div>;
  }
  if (error || !ksis) {
    return <div className="p-6 text-center text-red-400"><AlertTriangle size={48} className="mx-auto mb-4"/> <p>{error || "計算關鍵安全指標時發生錯誤。"}</p></div>;
  }

  const StatCard = ({ title, value, icon, unit = "", color = "text-purple-300" }) => (
    <div className={`bg-slate-800/70 p-6 rounded-xl shadow-lg border border-slate-700 flex flex-col items-center justify-center ${color}`}>
      <div className="mb-2">{icon}</div>
      <div className="text-3xl font-bold">{typeof value === 'number' ? value.toFixed(2) : value}{unit}</div>
      <div className="text-sm text-gray-400 mt-1">{title}</div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 text-white">
      <header className="mb-10 text-center">
        <Activity size={48} className="mx-auto text-purple-400 mb-4" />
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-3">
          LLM 安全評估儀表板 (MVP DEMO)
        </h1>
        <p className="text-lg text-gray-400">
          基於模擬掃描與 AI 評估結果的關鍵安全指標。
        </p>
      </header>

      {/* KSIs 總覽卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
        <StatCard title="提示詞注入成功率" value={ksis.promptInjectionSuccessRate} unit="%" icon={<Zap size={32} />} color="text-red-400" />
        <StatCard title="PII 洩漏率" value={ksis.piiLeakageRate} unit="%" icon={<FileWarning size={32} />} color="text-orange-400" />
        <StatCard title="有害內容生成率" value={ksis.harmfulContentRate} unit="%" icon={<AlertTriangle size={32} />} color="text-yellow-400" />
        <StatCard title="總發現漏洞數" value={ksis.totalVulnerabilities} icon={<ListChecks size={32} />} color="text-sky-300" />
      </div>

      {/* 圖表區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* OWASP LLM Top 10 分佈圖 */}
        <div className="bg-slate-800/70 p-6 rounded-xl shadow-lg border border-slate-700">
          <h3 className="text-xl font-semibold text-purple-300 mb-4">OWASP LLM Top 10 風險分佈</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={ksis.owaspChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis type="number" stroke="#A0AEC0" allowDecimals={false}/>
                <YAxis type="category" dataKey="name" stroke="#A0AEC0" width={100} interval={0} />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(30,41,59,0.9)', border: '1px solid #4A5568', borderRadius: '0.5rem' }} 
                    itemStyle={{ color: '#E2E8F0' }} labelStyle={{ color: '#CBD5E0', fontWeight: 'bold' }}
                    cursor={{fill: 'rgba(74,85,104,0.3)'}}
                />
                <Legend wrapperStyle={{ color: '#A0AEC0' }} />
                <Bar dataKey="count" name="發現次數" radius={[0, 4, 4, 0]}>
                    {ksis.owaspChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 嚴重性等級分佈圖 (圓餅圖) */}
        <div className="bg-slate-800/70 p-6 rounded-xl shadow-lg border border-slate-700">
          <h3 className="text-xl font-semibold text-purple-300 mb-4">漏洞嚴重性等級分佈</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={ksis.severityChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={120} labelLine={false}
                     label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, count }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px">
                            {`${name} (${(percent * 100).toFixed(0)}%)`}
                          </text>
                        );
                     }}
                >
                  {ksis.severityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(30,41,59,0.9)', border: '1px solid #4A5568', borderRadius: '0.5rem' }} 
                    itemStyle={{ color: '#E2E8F0' }} labelStyle={{ color: '#CBD5E0', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ color: '#A0AEC0', marginTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* 模擬修復建議 */}
      <section className="mt-10 p-6 bg-slate-800/50 rounded-lg shadow-lg border border-slate-700/50">
        <h2 className="text-2xl font-semibold text-purple-300 mb-4 flex items-center">
            <ShieldCheck size={28} className="mr-3"/> 模擬修復建議 (示意)
        </h2>
        <div className="space-y-3 text-gray-300 text-sm">
            <p><strong>針對「提示詞注入 (LLM01)」:</strong> 應強化輸入過濾與淨化機制，對系統提示詞進行加固，並考慮使用防禦性提示工程技術。定期審查並更新系統提示詞，避免包含過多敏感配置細節。</p>
            <p><strong>針對「敏感資訊洩露 (LLM02/LLM06)」:</strong> 實施嚴格的輸出過濾和 PII (個人身份資訊) 偵測與遮罩機制。對 LLM 的訓練數據進行徹底的匿名化處理。限制 LLM 直接存取包含大量原始 PII 的資料庫。</p>
            <p><strong>針對「不安全的插件設計 (LLM07)」:</strong> 對所有插件的輸入參數進行嚴格的白名單驗證。插件應以最小權限原則運行，並確保其與後端系統的互動是安全的。</p>
            {/* 更多建議... */}
        </div>
      </section>

      <div className="mt-12 text-center">
        <Link 
          to="/llm-security/survey" 
          className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          返回調查表頁面
        </Link>
      </div>
    </div>
  );
};

export default KSIDashboardPage;
