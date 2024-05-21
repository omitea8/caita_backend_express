import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { createHash } from "crypto";
import session from "express-session";
import bodyParser from "body-parser";
import { getTokenFromTwitter, fetchMeFromTwitter } from "./modules/auth";

dotenv.config();

const app = express();
const port = 3001;

const prisma = new PrismaClient();

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

// プロフィールの取得
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

// 接続を開始
// https://expressjs.com/ja/4x/api.html#app.listen
app.listen(port, () => {
  console.log(`port ${port}でサーバーを起動しました。`);
});
