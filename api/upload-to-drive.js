import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';


export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const encodedCredentials = process.env.GOOGLE_CREDENTIALS;
  if (!encodedCredentials) {
    console.error('GOOGLE_CREDENTIALS not set');
    return res.status(500).json({ error: 'Missing GOOGLE_CREDENTIALS' });
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(encodedCredentials, 'base64').toString('utf-8'));
  } catch (err) {
    console.error('Invalid GOOGLE_CREDENTIALS:', err);
    return res.status(500).json({ error: 'Invalid GOOGLE_CREDENTIALS' });
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

	const form = new IncomingForm({
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
	console.log('Uploaded files:', files);
    const uploadedFile = files.file;
    if (!uploadedFile || !uploadedFile.filepath) {
      console.error('Missing uploaded file');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = uploadedFile.filepath;
    const originalFilename = uploadedFile.originalFilename?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'uploaded_document';

    const fileMetadata = {
      name: originalFilename,
      mimeType: uploadedFile.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const media = {
      mimeType: fileMetadata.mimeType,
      body: fs.createReadStream(tempFilePath),
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name',
    });

    const uploadedOriginalFileId = driveResponse.data.id;

    const copiedFileResource = {
      name: `${driveResponse.data.name}_GoogleDoc`,
      mimeType: 'application/vnd.google-apps.document',
    };

    const docConversionResponse = await drive.files.copy({
      fileId: uploadedOriginalFileId,
      resource: copiedFileResource,
      fields: 'id, webViewLink',
    });

    const googleDocId = docConversionResponse.data.id;

    await drive.permissions.create({
      fileId: googleDocId,
      resource: {
        role: process.env.GOOGLE_DOC_PERMISSION_ROLE || 'writer',
        type: process.env.GOOGLE_DOC_PERMISSION_TYPE || 'anyone',
      },
    });

    const editableDocUrl = `https://docs.google.com/document/d/${googleDocId}/edit?usp=sharing&rm=minimal`;

    if (process.env.DELETE_ORIGINAL_UPLOAD_FROM_DRIVE === 'true') {
      try {
        await drive.files.delete({ fileId: uploadedOriginalFileId });
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }

    res.status(200).json({
      docUrl: editableDocUrl,
      fileId: googleDocId,
      webViewLink: docConversionResponse.data.webViewLink,
    });

  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({
      error: `上傳失敗：${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  } finally {
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('Temp file delete failed:', err);
      }
    }
  }
}
