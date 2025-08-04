require('dotenv').config();
const express = require('express');
const { S3Client, PutBucketPolicyCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(fileUpload({
  useTempFiles: false,
  limits: { fileSize: 100 * 1024 * 1024 },
  abortOnLimit: true
}));

// S3 Client Configuration
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

// New Route: Configure Public Access
app.post('/configure-public-access', async (req, res) => {
  try {
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [
          `arn:aws:s3:::${process.env.R2_BUCKET_NAME}/*`
        ]
      }]
    };

    await s3.send(new PutBucketPolicyCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Policy: JSON.stringify(policy)
    }));

    res.json({
      status: 'success',
      message: 'Public access configured',
      publicUrlFormat: `https://pub-4ec77915cbb84de6b020ec75ce082114.r2.dev/[filename]`
    });

  } catch (error) {
    console.error('Policy configuration error:', error);
    
    let solution = '';
    if (error.name === 'NoSuchBucket') {
      solution = 'Create the bucket first in Cloudflare dashboard';
    } else if (error.name === 'AccessDenied') {
      solution = 'Check your R2 credentials have PutBucketPolicy permissions';
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
      solution: solution || 'Check server logs'
    });
  }
});

// Existing Upload Route
app.post('/upload', async (req, res) => {
  try {
    if (!req.files?.file) {
      return res.status(400).json({ 
        status: 'error',
        message: 'No file uploaded' 
      });
    }

    const file = req.files.file;
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
      ACL: 'public-read'
    }));

    const publicUrl = `https://pub-4ec77915cbb84de6b020ec75ce082114.r2.dev/${fileName}`;

    res.json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        publicUrl,
        fileSize: file.size
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
