import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import session from "express-session";
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
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", function (req, res, next) {
  if (req.session.views) {
    req.session.views++;
    res.setHeader("Content-Type", "text/html");
    res.write("<p>views: " + req.session.views + "</p>");
    res.write("<p>expires in: " + req.session.cookie.maxAge / 1000 + "s</p>");
    res.end();
  } else {
    req.session.views = 1;
    res.end("welcome to the session demo. refresh!");
  }
});
});

app.get("/creators/current_creator_profile", async (req, res) => {
  const creator = await prisma.creators.findFirst();

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
  console.log(`Example app listening on port ${port}`);
});
