import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const upload = multer(); // store file in memory

app.use(cors());
app.use(express.json());

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const filename = `${Date.now()}-${file.originalname}`;
    const bucket = process.env.R2_BUCKET_NAME;

    console.log(`Uploading to Bucket: ${bucket}`);
    console.log(`File size: ${file.size} bytes`);
    console.log(`Key: ${filename}`);

    const uploadParams = {
      Bucket: bucket,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${filename}`;
    res.status(200).json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
