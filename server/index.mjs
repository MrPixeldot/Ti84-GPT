import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";
import dot from "dotenv";
import { chatgpt } from "./routes/chatgpt.mjs";
import { images } from "./routes/images.mjs";
import { chat } from "./routes/chat.mjs";
import { programs } from "./routes/programs.mjs";
import { googleApi } from "./routes/googleApi.mjs";
import Redis from "ioredis";
import 'dotenv/config';
dot.config();

async function main() {
  const port = +(process.env.PORT ?? 8080);
  if (!port || !Number.isInteger(port)) {
    console.error("bad port");
    process.exit(1);
  }

  const app = express();
  app.use(morgan("dev"));
  app.use(cors("*"));
  app.use(
    bodyParser.raw({
      type: "image/jpg",
      limit: "10mb",
    })
  );

    // Redis (optional but recommended)
  let redis = null;

  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);

    redis.on("connect", () => {
      console.log("Redis connected");
    });

    redis.on("error", (err) => {
      console.error("Redis error:", err);
    });
  }

    app.get("/healthz", async (req, res) => {
    try {
      if (redis) {
        await redis.ping(); // keeps Redis awake
      }
      res.status(200).send("OK");
    } catch (err) {
      console.error("Health check failed:", err);
      res.status(500).send("NOT OK");
    }
  });

  app.use((req, res, next) => {
    console.log(req.headers.authorization);
    next();
  });

  // Programs
  app.use("/programs", programs());

  // OpenAI API
  app.use("/gpt", await chatgpt());

  // Google API
  app.use("/google", await googleApi());

  // Chat
  app.use("/chats", await chat());

  // Images
  app.use("/image", images());

  app.listen(port, () => {
    console.log(`listening on ${port}`);
  });
}

main();