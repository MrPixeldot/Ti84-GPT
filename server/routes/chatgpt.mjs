import express from "express";
import openai from "openai";
import i264 from "image-to-base64";
import * as jimp from "jimp";
import fs from "fs";
import path from "path";

// File to track usage
const usageFile = path.resolve("./usage.json");
const MONTHLY_LIMIT = 2.0; // USD
const COST_PER_1K_TOKENS = 0.005; // Approx. GPT-4o input + output

// Load usage from file
function loadUsage() {
  try {
    if (!fs.existsSync(usageFile)) {
      return { month: getCurrentMonth(), total_cost_usd: 0 };
    }
    const raw = fs.readFileSync(usageFile);
    const data = JSON.parse(raw);
    if (data.month !== getCurrentMonth()) {
      // Reset for a new month
      return { month: getCurrentMonth(), total_cost_usd: 0 };
    }
    return data;
  } catch (e) {
    console.error("Failed to load usage file:", e);
    return { month: getCurrentMonth(), total_cost_usd: 0 };
  }
}

// Save usage to file
function saveUsage(usage) {
  fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2));
}

// Estimate cost by token count
function estimateCost(promptTokens, responseTokens) {
  const totalTokens = promptTokens + responseTokens;
  return (totalTokens / 1000) * COST_PER_1K_TOKENS;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function chatgpt() {
  const routes = express.Router();
  const gpt = new openai.OpenAI();

  // Ask endpoint
  routes.get("/ask", async (req, res) => {
    const question = req.query.question ?? "";
    if (Array.isArray(question)) return res.sendStatus(400);

    const usage = loadUsage();
    if (usage.total_cost_usd >= MONTHLY_LIMIT) {
      return res.status(403).send("Monthly GPT usage limit reached.");
    }

    try {
      const result = await gpt.chat.completions.create({
        messages: [
          { role: "system", content: "Do not use emojis." },
          { role: "user", content: question },
        ],
        model: "gpt-4o",
      });

      const content = result.choices[0]?.message?.content ?? "no response";
      const usageData = result.usage; // {prompt_tokens, completion_tokens}
      const cost = estimateCost(
        usageData?.prompt_tokens ?? 100,
        usageData?.completion_tokens ?? 100
      );

      usage.total_cost_usd += cost;
      saveUsage(usage);

      res.send(content);
    } catch (e) {
      console.error(e);
      res.sendStatus(500);
    }
  });

  // Solve endpoint
  routes.post("/solve", async (req, res) => {
    const usage = loadUsage();
    if (usage.total_cost_usd >= MONTHLY_LIMIT) {
      return res.status(403).send("Monthly GPT usage limit reached.");
    }

    try {
      const contentType = req.headers["content-type"];
      if (contentType !== "image/jpg") {
        res.status(400).send(`bad content-type: ${contentType}`);
        return;
      }

      const image_data = await jimp.read(req.body);
      const image_path = "./to_solve.jpg";
      await image_data.writeAsync(image_path);

      const encoded_image = await i264(image_path);
      const question_number = req.query.n;
      const question = question_number
        ? `What is the answer to question ${question_number}?`
        : "What is the answer to this question?";

      const result = await gpt.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful math tutor, specifically designed to help with basic arithmetic, but also can answer a broad range of math questions from uploaded images. Be as accurate and brief as possible.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${question} Do not explain how you found the answer. If the question is multiple-choice, give the letter answer.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${encoded_image}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        model: "gpt-4o",
      });

      const content = result.choices[0]?.message?.content ?? "no response";
      const usageData = result.usage;
      const cost = estimateCost(
        usageData?.prompt_tokens ?? 100,
        usageData?.completion_tokens ?? 100
      );

      usage.total_cost_usd += cost;
      saveUsage(usage);

      res.send(content);
    } catch (e) {
      console.error(e);
      res.sendStatus(500);
    }
  });

  return routes;
}