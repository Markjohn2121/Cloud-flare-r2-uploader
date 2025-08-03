import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Multer to parse multipart/form-data
const upload = multer();

// Cloudflare R2 S3 client
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const bucketName = process.env.R2_BUCKET;
  const objectKey = Date.now() + "-" + req.file.originalname;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const publicUrl = `${process.env.PUBLIC_URL}/${objectKey}`;
    res.json({ url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
