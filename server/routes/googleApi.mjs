import express from "express";
import axios from "axios";

export function googleApi() {
  const router = express.Router();

  router.get("/ask", async (req, res) => {
    const question = req.query.question ?? "";

    const apiKey = "AIzaSyCPoNEu6vHKa3jv9ph4y2DmLZ6DNvgijOk"; // your key
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Minimal request payload
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Answer this math or physics question concisely. Only give the formula or method. KEEP IT AS SHORT AS POSSIBLE AND CORRECT! Question: ${question}`
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
