import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
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

app.get("/", (req, res) => {
  res.send("caita!");
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
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
