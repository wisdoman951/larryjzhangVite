import formidable from 'formidable';
import fs from 'fs';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || 'ap-northeast-1',
});

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'report-files-2025';

export default async function handler(req, res) {
  const allowedOrigin = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = new formidable.IncomingForm({
    uploadDir: '/tmp',
    keepExtensions: true,
    multiples: false,
  });

  let tempFilePath;

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

	const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile || !uploadedFile.filepath) {
	  console.error('Missing uploaded file or filepath:', uploadedFile);
	  return res.status(400).json({ error: 'No file uploaded' });
	}
    tempFilePath = uploadedFile.filepath;

    const fileContent = fs.readFileSync(tempFilePath);
    const originalFilename = uploadedFile.originalFilename ? uploadedFile.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_') : 'unknownfile';
    const key = `helper-files/${Date.now()}_${originalFilename}`;

    const putObjectParams = {
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: uploadedFile.mimetype || 'application/octet-stream',
    };

    await s3Client.send(new PutObjectCommand(putObjectParams));

    const s3RegionForUrl = process.env.AWS_S3_REGION || 'ap-northeast-1';
    const s3FileUrl = `https://${S3_BUCKET_NAME}.s3.${s3RegionForUrl}.amazonaws.com/${key}`;

    res.status(200).json({ message: '上傳成功', url: s3FileUrl, key });
  } catch (err) {
    console.error('Upload to S3 failed:', err);
    res.status(500).json({ error: '上傳失敗', detail: err.message, stack: err.stack });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}
