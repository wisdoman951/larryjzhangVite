// api/upload-helper-file.js
const formidable = require('formidable');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3"); // AWS SDK v3

// S3 Client Configuration
// Credentials and region should ideally be set via environment variables.
// Vercel automatically provides AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
// if an IAM role is correctly configured for the Vercel project.
const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || 'ap-northeast-1', // Fallback to your default region
  // Credentials will be picked up from the environment if available and configured
});

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'report-files-2025'; // Fallback bucket name

module.exports = async (req, res) => {
  // CORS Headers - Restrict origin in production
  const allowedOrigin = process.env.FRONTEND_URL || '*'; // Use '*' for local dev, specific domain for prod
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']); // Specify allowed methods
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = new formidable.IncomingForm({
    uploadDir: '/tmp', // Vercel allows writing to /tmp
    keepExtensions: true,
    multiples: false, // Expect a single file for the 'file' field
  });

  let tempFilePath; // Variable to store the temporary file path for cleanup

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          return reject(err); // Propagate error
        }
        resolve({ fields, files });
      });
    });

    // With multiples: false, files.file should be a single file object.
    // If not, files.file might not exist or might be an array if form field name is different.
    const uploadedFile = files.file;

    if (!uploadedFile || !uploadedFile.filepath) {
      console.error('Formidable files object:', files); // Log for debugging
      return res.status(400).json({ error: 'No file uploaded or file path is missing. Ensure the form field name is "file".' });
    }
    tempFilePath = uploadedFile.filepath; // Store for cleanup

    const fileContent = fs.readFileSync(tempFilePath);
    // Sanitize filename before using it in the key
    const originalFilename = uploadedFile.originalFilename ? uploadedFile.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_') : 'unknownfile';
    const key = `helper-files/${Date.now()}_${originalFilename}`;

    const putObjectParams = {
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: uploadedFile.mimetype || 'application/octet-stream',
    };

    await s3Client.send(new PutObjectCommand(putObjectParams));
    
    // Construct the S3 file URL
    // Standard URL format: https://<bucket-name>.s3.<region>.amazonaws.com/<key>
    // Virtual-hosted–style URL: https://<bucket-name>.s3.amazonaws.com/<key> (if region is us-east-1 or using legacy global endpoint)
    // Path-style URL: https://s3.<region>.amazonaws.com/<bucket-name>/<key>
    const s3RegionForUrl = process.env.AWS_S3_REGION || 'ap-northeast-1';
    const s3FileUrl = `https://${S3_BUCKET_NAME}.s3.${s3RegionForUrl}.amazonaws.com/${key}`;

    res.status(200).json({ message: '上傳成功', url: s3FileUrl, key: key });

  } catch (err) {
    console.error('Upload to S3 failed:', err);
    res.status(500).json({ error: '上傳失敗', detail: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  } finally {
    // Cleanup temporary file
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('Temporary file deleted:', tempFilePath);
      } catch (unlinkErr) {
        console.error('Failed to delete temporary file:', tempFilePath, unlinkErr);
      }
    }
  }
};