import express from "express";
import axios from "axios";

export function googleApi() {
  const router = express.Router();

  router.get("/ask", async (req, res) => {
    const question = req.query.question ?? "";

    const apiKey = process.env.GOOGLE_API_KEY; // your key
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    // Minimal request payload
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Answer this question concisely. Question: ${question}`
            }
          ]
        }
      ]
    };

    try {
      const response = await axios.post(url, body);

      // Safe extraction of the response text
      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response.";

      // Trim to avoid overflow on your calculator
      text = text.trim().substring(0, 512);

      res.send(text);

    } catch (err) {
      console.error("Gemini error:", err.response?.data ?? err);
      res.status(500).send("Gemini error");
    }
  });

  return router;
}
