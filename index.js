import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const app = express();
const port = process.env.PORT || 3000;

// Multer setup para sa file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudflare R2 client setup
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const bucketName = process.env.CLOUDFLARE_BUCKET;
    const key = `${Date.now()}-${req.file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await r2.send(command);

    const fileUrl = `https://${process.env.CLOUDFLARE_BUCKET}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    res.json({
      message: "Upload successful",
      url: fileUrl,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Cloudflare R2 Uploader is running 🚀");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
