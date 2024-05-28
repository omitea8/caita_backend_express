import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { createHash } from "crypto";
import session from "express-session";
import bodyParser from "body-parser";
import { getTokenFromTwitter, fetchMeFromTwitter } from "./modules/auth";
import { isValidImage, isValidCaption } from "./modules/image";
import multer from "multer";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();
const upload = multer({ dest: "uploads/" });

const app = express();
const port = 3001;

const prisma = new PrismaClient();
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_KEY || "",
  },
});

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET"],
    credentials: true,
  })
);
app.set("trust proxy", 1);
app.use(
  session({
    secret: "keyboard cat", // TODO: 後で変更する
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ログイン処理
// ログインURLの作成
app.get("/creators/login_url", async (req, res) => {
  const state = crypto.randomUUID();
  req.session.state = state;
  const challengeVerifier = crypto.randomUUID() + crypto.randomUUID();
  req.session.challengeVerifier = challengeVerifier;
  const hash = createHash("sha256");
  hash.update(challengeVerifier);
  const challengeHash = hash.digest("base64url");
  const challenge = encodeURIComponent(challengeHash);
  return res.json({
    url: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.TWITTER_CALLBACK_URL}&scope=tweet.read%20users.read&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`,
  });
});
// アクセストークンの取得
app.post("/creators/handle_token_callback", async (req, res) => {
  // stateの検証
  if (req.body.state !== req.session.state) {
    return res.status(400);
  }
  // アクセストークンの作成
  const accessToken = await getTokenFromTwitter(
    process.env.CLIENT_ID || "",
    process.env.CLIENT_SECRET || "",
    req.body.code,
    req.session.challengeVerifier,
    process.env.TWITTER_CALLBACK_URL || ""
  );
  const body = await fetchMeFromTwitter(accessToken);
  req.session.userId = body.data.username;
  // TODO: DBのサポートされていないカラム(型)について後で考える
  // TODO: サポートされている型を使えばupsertが使えるようになる
  await prisma.creators.updateMany({
    where: { twitter_system_id: body.data.id },
    data: {
      twitter_system_id: body.data.id,
      twitter_id: body.data.username,
      twitter_name: body.data.name,
      twitter_profile_image: body.data.profile_image_url,
      twitter_description: body.data.description,
    },
  });
  return res.json({ message: "ok" });
});

// 現在ログイン中のクリエイターのプロフィールの取得
app.get("/creators/current_creator_profile", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not Login" });
  }
  const creator = await prisma.creators.findFirst({
    where: { twitter_id: req.session.userId },
  });
  return res.json({
    profile_image_url: creator?.twitter_profile_image,
    name: creator?.twitter_name,
    description: creator?.twitter_description,
    username: creator?.twitter_id,
  });
});
// TwitterIDを使ってクリエイターのプロフィールを取得
app.get("/creators/:creatorId", async (req, res) => {
  const creator = await prisma.creators.findFirst({
    where: { twitter_id: req.params.creatorId },
  });
  return res.json({
    twitter_name: creator?.twitter_id,
    twitter_profile_image: creator?.twitter_profile_image,
    twitter_description: creator?.twitter_description,
  });
});

// 画像一覧を取得
app.get("/images/creator/:creatorId", async (req, res) => {
  const creator = await prisma.creators.findFirst({
    where: { twitter_id: req.params.creatorId },
  });
  const images = await prisma.images.findMany({
    where: { creator_id: creator?.id },
    select: {
      caption: true,
      image_url: true,
      image_name: true,
      storage_name: true,
    },
    // orderBy: { created_at: "desc" },
  });
  const data = images.map((image) => {
    const resizedImageUrl = `${awsBucketUrl}${image.storage_name}.webp`;
    return {
      caption: image.caption,
      image_name: image.image_name,
      resized_image_url: resizedImageUrl,
    };
  });
  return res.json(data);
});

// 画像Dataを作成
app.get("/images/imagedata", async (req, res) => {
  const image = await prisma.images.findFirst({
    where: { image_name: req.body.image_name },
  });
  const resizedImageUrl = `${awsBucketUrl}${image?.storage_name}.webp`;
  const data = {
    caption: image?.caption,
    image_url: image?.image_url,
    resized_image_url: resizedImageUrl,
  };
  return res.json(data);
});

// 画像をアップロード
app.post("/images/post", upload.single("image"), async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (
    !(req.file && isValidImage(req.file) && isValidCaption(req.body.caption))
  ) {
    return res.status(422).json({ message: "Unprocessable Entity" });
  }
  // ランダムな画像の名前を作成
  const imageName = crypto.randomUUID();
  //　拡張子を取り出す
  const extension = req.file.mimetype.replace("image/", "");
  // S3に複数の画像をアップロード
  //  AWS S3に画像をアップロード
  const image = sharp(req.file.path);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: `${imageName}.${extension}`,
      Body: await image.toBuffer(),
      ContentType: req.file.mimetype,
      CacheControl: "no-cache, no-store, must-revalidate",
    })
  );
  // webp
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: `${imageName}_resized.webp`,
      Body: await image
        .resize(1200, 1200, { fit: "inside" })
        .webp({ quality: 100 })
        .toBuffer(),
      ContentType: "image/webp",
      CacheControl: "no-cache, no-store, must-revalidate",
    })
  );
  // 原寸画像
  // image_urlを作成
  // DBに保存
});

// AWS S3へリクエストを送る時のURLを作成
const awsBucketUrl = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;

// 接続を開始
// https://expressjs.com/ja/4x/api.html#app.listen
app.listen(port, () => {
  console.log(`port ${port}でサーバーを起動しました。`);
});
