import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
// import { ConversationalRetrievalQAChain } from 'langchain/chains'; // 暫時保留

const awsConfig = {
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const bedrockClient = new BedrockRuntimeClient(awsConfig);
const s3Client = new S3Client(awsConfig);

async function fetchDocContent(url) {
  console.log(`Fetching content from URL: ${url}`);
  if (url.startsWith('https://docs.google.com/')) {
    return `模擬 Google Doc 內容來自 ${url}`;
  } else if (url.includes('.s3.')) {
    try {
      const urlParts = new URL(url);
      const bucket = urlParts.hostname.split('.')[0];
      const key = urlParts.pathname.substring(1);
      const s3Object = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return await s3Object.Body.transformToString();
    } catch (err) {
      console.error(`Error fetching from S3:`, err);
      throw new Error(`Failed to fetch S3 URL ${url}: ${err.message}`);
    }
  }
  return `模擬文件內容來自 ${url}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { docUrl, helperUrls = [], pbcUrl } = req.body;
  if (!docUrl) return res.status(400).json({ error: "Missing required field: docUrl" });

  try {
    const mainContent = await fetchDocContent(docUrl);
    const helperContents = await Promise.all(helperUrls.map(url => fetchDocContent(url)));
    const pbcContent = pbcUrl ? await fetchDocContent(pbcUrl) : null;

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const allDocsInput = [];

    if (mainContent) allDocsInput.push(new Document({ pageContent: mainContent, metadata: { source: 'main', url: docUrl } }));
    helperContents.forEach((content, index) => {
      if (content) allDocsInput.push(new Document({ pageContent: content, metadata: { source: 'helper', url: helperUrls[index] } }));
    });
    if (pbcContent) allDocsInput.push(new Document({ pageContent: pbcContent, metadata: { source: 'pbc', url: pbcUrl } }));

    if (allDocsInput.length === 0) return res.status(400).json({ error: "No content could be fetched." });

    const splitDocs = await splitter.splitDocuments(allDocsInput);

    const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
    const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

    // ❗️尚未整合 Bedrock LLM，以下為模擬建議
    const mockSuggestions = [
      "這是基於模擬處理的建議 1。",
      "建議 2：檢查文件中的數據一致性。",
      "建議 3：考慮為圖表添加更詳細的標題。"
    ];

    res.status(200).json({ suggestions: mockSuggestions });
  } catch (err) {
    console.error('AI 處理錯誤:', err);
    res.status(500).json({ error: `處理失敗：${err.message}`, details: err.stack });
  }
}
