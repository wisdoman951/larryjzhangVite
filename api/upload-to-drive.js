import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

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

    const uploadedFile = files.file;
    if (!uploadedFile || !uploadedFile.filepath) {
      console.error('Missing uploaded file');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = uploadedFile.filepath;
    const originalFilename = uploadedFile.originalFilename?.replace(/
