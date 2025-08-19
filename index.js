require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const mime = require("mime-types");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ENDPOINT,
} = process.env;

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(path, contentBuffer, originalname) {
  const contentType = mime.lookup(originalname) || 'application/octet-stream';
  
  const uploadParams = {
    Bucket: R2_BUCKET_NAME,
    Key: path,
    Body: contentBuffer,
    ContentType: contentType,
  };

  try {
    // Check if file exists (optional, just maintaining consistency with original code)
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: path,
      }));
    } catch (e) {
      if (e.name !== 'NotFound') {
        throw e;
      }
    }

    // Upload the file with proper content type
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    return path;
  } catch (err) {
    console.error("Error uploading to R2:", err);
    throw err;
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "Cloudflare R2 File Upload Server is running" 
  });
});

// File upload endpoint
app.post("/upload", upload.fields([{ name: "file1" }, { name: "file2" }]), async (req, res) => {
  try {
    const folder = req.body.folder || "uploads";
    const results = {};
    
    if (req.files.file1) {
      const file1 = req.files.file1[0];
      const file1Path = `${folder}/${file1.originalname}`;
      results.file1URL = await uploadToR2(file1Path, file1.buffer, file1.originalname);
    }
    
    if (req.files.file2) {
      const file2 = req.files.file2[0];
      const file2Path = `${folder}/${file2.originalname}`;
      results.file2URL = await uploadToR2(file2Path, file2.buffer, file2.originalname);
    }
    
    if (!req.files.file1 && !req.files.file2) {
      return res.status(400).json({ error: "At least one file is required" });
    }
    
    res.json({
      success: true,
      message: "Files uploaded successfully",
      ...results
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ 
      error: "Upload failed", 
      details: err.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
