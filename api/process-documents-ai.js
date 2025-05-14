// api/process-documents-ai.js
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3 } = require('@aws-sdk/client-s3'); // 假設你也會用到 S3 下載
const { Document } = require('langchain/document');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { OpenAIEmbeddings } = require('@langchain/openai'); // 注意：套件名稱可能是 @langchain/openai
const { ConversationalRetrievalQAChain } = require('langchain/chains');
// const express = require('express'); // 不再需要 Express Router
// const router = express.Router();    // 不再需要 Express Router

const awsConfig = {
  region: process.env.AWS_REGION || 'ap-northeast-1', // 提供預設值或確保環境變數已設定
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const bedrockClient = new BedrockRuntimeClient(awsConfig);
const s3Client = new S3(awsConfig); // S3 客戶端

// 假設的 Google Docs/S3 內容提取函數
async function fetchDocContent(url) {
    console.log(`Workspaceing content from URL: ${url}`);
    if (url.startsWith('https://docs.google.com/')) {
        // 這裡需要一個實際的方法來從 Google Doc URL 提取內容
        // 這通常需要在後端完成，因為它可能涉及 OAuth 和 Google API 呼叫
        // 由於這是一個複雜的操作，這裡我們返回模擬內容
        // 在實際應用中，你可能需要呼叫另一個內部 API 或服務來獲取 Google Doc 內容
        console.warn(`Google Docs URL detected (${url}). Actual content fetching not implemented in this mock.`);
        return `模擬 Google Doc 內容來自 ${url}`;
    } else if (url.includes('.s3.')) { // 簡易判斷是否為 S3 URL
        try {
            const urlParts = new URL(url);
            const bucket = urlParts.hostname.split('.')[0];
            const key = urlParts.pathname.substring(1); // 移除開頭的 '/'
            console.log(`Workspaceing from S3: Bucket=<span class="math-inline">\{bucket\}, Key\=</span>{key}`);
            const s3Object = await s3Client.getObject({ Bucket: bucket, Key: key });
            return await s3Object.Body.transformToString();
        } catch (s3Error) {
            console.error(`Error fetching from S3 (${url}):`, s3Error);
            throw new Error(`Failed to fetch content from S3 URL ${url}: ${s3Error.message}`);
        }
    }
    // 對於其他類型的 URL，返回模擬內容或拋出錯誤
    console.warn(`Non-Google Docs/S3 URL detected (${url}). Returning generic mock content.`);
    return `模擬文件內容來自 ${url}`;
}


module.exports = async (req, res) => {
  // 設定 CORS 頭部
  res.setHeader('Access-Control-Allow-Origin', '*'); // 在生產中應限制為你的前端網域
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { docUrl, helperUrls = [], pbcUrl } = req.body;

  if (!docUrl) {
    return res.status(400).json({ error: "Missing required field: docUrl" });
  }

  try {
    const mainContent = await fetchDocContent(docUrl);
    const helperContents = await Promise.all((helperUrls || []).map(url => fetchDocContent(url)));
    const pbcContent = pbcUrl ? await fetchDocContent(pbcUrl) : null;

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const allDocsInput = [];

    if (mainContent) {
        allDocsInput.push(new Document({ pageContent: mainContent, metadata: { source: 'main', url: docUrl } }));
    }
    helperContents.forEach((content, index) => {
        if (content) {
            allDocsInput.push(new Document({ pageContent: content, metadata: { source: 'helper', url: helperUrls[index] } }));
        }
    });
    if (pbcContent) {
        allDocsInput.push(new Document({ pageContent: pbcContent, metadata: { source: 'pbc', url: pbcUrl } }));
    }

    if (allDocsInput.length === 0) {
        return res.status(400).json({ error: "No document content could be fetched or processed." });
    }

    const splitDocs = await splitter.splitDocuments(allDocsInput);

    if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not set.");
        return res.status(500).json({ error: "Server configuration error: OPENAI_API_KEY missing." });
    }
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
    const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

    const llmModel = new InvokeModelCommand({ // 這是用於 Bedrock 的範例，但 ConversationalRetrievalQAChain 需要一個 LangChain LLM 實例
        // 你需要將 Bedrock Client 包裝成 LangChain 相容的 LLM
        // 例如：使用 langchain/llms/bedrock
        // 以下僅為示意，實際 langchain 的 Bedrock LLM 初始化方式可能不同
        // import { Bedrock } from "langchain/llms/bedrock";
        // const model = new Bedrock({ client: bedrockClient, model: "anthropic.claude-v2" /* 或其他模型 */ });
        // 這部分你需要根據 LangChain 的 Bedrock 整合來調整
        // 暫時用一個佔位符，你需要替換成實際的 LangChain LLM
        // model: "anthropic.claude-v2", // 替換為你的 Bedrock 模型 ID
        // contentType: "application/json",
        // accept: "application/json",
        // body: "" // 將在 chain 內部填充
    });
    // 由於直接將 bedrockClient 傳給 ConversationalRetrievalQAChain.fromLLM 可能不正確
    // 你需要一個 LangChain LLM 實例。這裡假設你有一個 LangChain Bedrock LLM 封裝器：
    // const { Bedrock } = require("@langchain/community/llms/bedrock"); // 或者對應的套件
    // const model = new Bedrock({
    //   model: "anthropic.claude-v2", // Or your chosen model
    //   region: awsConfig.region,
    //   credentials: awsConfig.credentials,
    //   client: bedrockClient // 傳遞已配置的客戶端
    // });
    // 若直接使用 InvokeModelCommand，則需要自行處理提示和回應的格式，不適用於 LangChain chain

    // 假設你已正確設定 LangChain Bedrock LLM (名為 'model')
    // const chain = ConversationalRetrievalQAChain.fromLLM(
    //   model, // LangChain LLM 實例
    //   vectorStore.asRetriever(),
    //   { returnSourceDocuments: true }
    // );

    // 由於上述 Bedrock LLM 整合的複雜性，這裡先簡化為一個模擬回應
    // 請務必實現正確的 LangChain Bedrock LLM 整合
    console.warn("Bedrock LLM integration is complex and not fully implemented here. Returning mock suggestions.");
    const mockSuggestions = [
        "這是基於模擬處理的建議 1。",
        "建議 2：檢查文件中的數據一致性。",
        "建議 3：考慮為圖表添加更詳細的標題。"
    ];
    // const question = "根據文件內容，找出並建議可優化的表格或內容";
    // const result = await chain.call({ question, chat_history: [] });
    // const suggestions = result.text.split('\n').filter(s => s.trim()).map(s => s.trim());

    res.status(200).json({ suggestions: mockSuggestions /* 替換為 result.text 處理後的 suggestions */ });

  } catch (error) {
    console.error('AI 處理錯誤:', error);
    res.status(500).json({ error: `處理失敗：${error.message}`, details: error.stack });
  }
};