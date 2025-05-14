// CompliancePage.jsx 開頭範例
import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CompliancePage = () => {
  const { useState } = React;
  const { useHistory } = ReactRouterDOM;

  const [file, setFile] = useState(null);
  const [regulationFile, setRegulationFile] = useState(null);
  const [regulationName, setRegulationName] = useState("");
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory();

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: "" });
        const headData = jsonData.slice(0, 5);
        if (headData.length > 0) {
          const newHeadData = headData.map(row => {
            const newRow = {};
            for (let key in row) {
              const newKey = key.replace(/\n/g, " ");
              newRow[newKey] = row[key];
            }
            return newRow;
          });
          setPreviewData(newHeadData);
        }
      };
      reader.readAsArrayBuffer(uploadedFile);
    }
  };

  const handleRegulationFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    setRegulationFile(uploadedFile);
  };

  const debounceComplianceCheck = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  const handleComplianceCheck = async () => {
    if (!file || !regulationFile || !regulationName) {
      alert("請上傳 Excel 檔案、法規文件並輸入法規名稱");
      return;
    }

    setIsLoading(true);
    try {
      const excelResponse = await axios.post(
        "https://dm2nkd04w0.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url",
        {
          bucket: "ai-platform-files-2025",
          key: file.name,
          contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        },
        { timeout: 10000 }
      );

      if (excelResponse.status !== 200) {
        throw new Error(`伺服器返回錯誤：${excelResponse.status} - ${JSON.stringify(excelResponse.data)}`);
      }

      let excelBody;
      try {
        excelBody = excelResponse.data.body ? JSON.parse(excelResponse.data.body) : excelResponse.data;
      } catch (parseError) {
        throw new Error(`無法解析 Excel Pre-signed URL 回應：${parseError.message}`);
      }

      if (!excelBody.presignedUrl) {
        throw new Error("Excel Pre-signed URL 回應中缺少 presignedUrl 字段");
      }
      const excelPresignedUrl = excelBody.presignedUrl;

      await axios.put(excelPresignedUrl, file, {
        headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
      });

      const regulationResponse = await axios.post(
        "https://dm2nkd04w0.execute-api.ap-northeast-1.amazonaws.com/prod/generate-presigned-url",
        {
          bucket: "ai-platform-files-2025",
          key: `regulations/${regulationName}.txt`,
          contentType: regulationFile.type || "text/plain"
        },
        { timeout: 10000 }
      );

      if (regulationResponse.status !== 200) {
        throw new Error(`伺服器返回錯誤：${regulationResponse.status} - ${JSON.stringify(regulationResponse.data)}`);
      }

      let regulationBody;
      try {
        regulationBody = regulationResponse.data.body ? JSON.parse(regulationResponse.data.body) : regulationResponse.data;
      } catch (parseError) {
        throw new Error(`無法解析法規文件 Pre-signed URL 回應：${parseError.message}`);
      }

      if (!regulationBody.presignedUrl) {
        throw new Error("法規文件 Pre-signed URL 回應中缺少 presignedUrl 字段");
      }
      const regulationPresignedUrl = regulationBody.presignedUrl;

      await axios.put(regulationPresignedUrl, regulationFile, {
        headers: { "Content-Type": regulationFile.type || "text/plain" }
      });

      const complianceResponse = await axios.post(
        "https://dm2nkd04w0.execute-api.ap-northeast-1.amazonaws.com/prod/compliance-check",
        {
          bucket: "ai-platform-files-2025",
          key: file.name,
          regulation: regulationName,
          regulationFileKey: `regulations/${regulationName}.txt`
        },
        { timeout: 30000 }
      );

      if (complianceResponse.status !== 200) {
        throw new Error(`伺服器返回錯誤：${complianceResponse.status} - ${JSON.stringify(complianceResponse.data)}`);
      }

      let complianceResult;
      try {
        complianceResult = complianceResponse.data.body ? JSON.parse(complianceResponse.data.body) : complianceResponse.data;
      } catch (parseError) {
        throw new Error(`無法解析 ComplianceCheck 回應：${parseError.message}`);
      }

      console.log("Compliance check result:", complianceResult);

      setResults(complianceResult.result);

      const updatedKey = complianceResult.updated_key;
      const bucket = complianceResult.bucket;
      const downloadUrl = `https://${bucket}.s3.ap-northeast-1.amazonaws.com/${updatedKey}`;
      document.getElementById("result").innerHTML = `
        <p>合規性評估完成！</p>
        <p>下載更新後的 Excel 文件：<a href="${downloadUrl}" target="_blank">${updatedKey}</a></p>
      `;
    } catch (error) {
      console.error("Error during compliance check:", error);
      document.getElementById("result").innerHTML = `<p style="color: red;">錯誤：${error.message}</p>`;
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedHandleComplianceCheck = debounceComplianceCheck(handleComplianceCheck, 2000);

  return (
  <>
      <header className="bg-green-700/80 text-white p-4 shadow-lg backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => history.push("/")} className="text-white mr-4 hover:bg-green-800/50 p-2 rounded-md transition-colors">
           ← 返回 Dashboard
        </button>
        <h1 className="text-2xl font-bold">合規性評估</h1>
      </header>
      <div className="flex-1 p-10 overflow-y-auto"> {/* 允許此頁面內容滾動 */}
        <h2 className="text-4xl font-semibold text-white text-shadow-lg mb-6 text-center">合規性評估</h2>
        <p className="text-gray-200 text-xl text-shadow-sm text-center">此頁面功能正在努力建設中，敬請期待！</p>
     
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex items-center">
        <button onClick={() => history.push("/")} className="text-white mr-4">
          ← 返回
        </button>
        <h1 className="text-2xl font-bold">合規性評估</h1>
      </header>
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">輸入法規名稱</h2>
          <input
            type="text"
            value={regulationName}
            onChange={(e) => setRegulationName(e.target.value)}
            className="p-2 border rounded"
            placeholder="例如：ISO27001"
            disabled={isLoading}
          />
        </div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">上傳法規文件（純文字或 PDF）</h2>
          <input
            type="file"
            accept=".txt,.pdf"
            onChange={handleRegulationFileChange}
            className="p-2 border rounded"
            disabled={isLoading}
          />
        </div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">上傳訪談底稿（Excel 檔案）</h2>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="p-2 border rounded"
            disabled={isLoading}
          />
        </div>
        {previewData && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Excel 數據預覽（前 5 行）</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map((key, index) => (
                      <th key={index} className="border px-4 py-2 text-left bg-gray-100">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, i) => (
                        <td key={i} className="border px-4 py-2">{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <button
          onClick={debouncedHandleComplianceCheck}
          className="bg-blue-500 text-white px-4 py-2 rounded mb-6"
          disabled={isLoading}
        >
          {isLoading ? "評估中..." : "開始評估"}
        </button>
        <div id="result" className="mb-6"></div>
        {results && (
          <div>
            <h2 className="text-xl font-semibold mb-2">評估結果</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead>
                  <tr>
                    <th className="border px-4 py-2">問題</th>
                    <th className="border px-4 py-2">是否合規</th>
                    <th className="border px-4 py-2">解釋</th>
                    <th className="border px-4 py-2">建議</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td className="border px-4 py-2">{result.Question}</td>
                      <td className="border px-4 py-2">{result.Compliant}</td>
                      <td className="border px-4 py-2">{result.Explanation}</td>
                      <td className="border px-4 py-2">{result["不合規之建議"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
	</div>
    </>
  );
};
export default CompliancePage;