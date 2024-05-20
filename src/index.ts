import express from "express";
import cors from "cors";

const app = express();
const port = 3001;

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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
