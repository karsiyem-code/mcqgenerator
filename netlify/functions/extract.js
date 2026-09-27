exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed. Gunakan POST." })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Format request body bukan JSON yang valid." })
    };
  }

  const { imageBase64, mimeType = "image/png" } = body;
  if (!imageBase64) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "imageBase64 wajib dikirimkan." })
    };
  }

  const ocrPrompt = "Extract ALL text from this image accurately. Return ONLY the raw extracted text, preserving structure and paragraphs. No explanations, no markdown.";

  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const groqVisionModel = process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview";

  const attempts = [
    {
      name: "Gemini (Key 1)",
      type: "gemini",
      key: process.env.GEMINI_API_KEY_1,
      model: geminiModel
    },
    {
      name: "Gemini (Key 2)",
      type: "gemini",
      key: process.env.GEMINI_API_KEY_2,
      model: geminiModel
    },
    {
      name: "Groq Vision (Fallback)",
      type: "groq",
      key: process.env.GROQ_API_KEY,
      model: groqVisionModel
    }
  ];

  const errors = [];

  for (const attempt of attempts) {
    if (!attempt.key) continue;

    try {
      if (attempt.type === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${attempt.key}`;
        const payload = {
          contents: [{
            parts: [
              { text: ocrPrompt },
              { inlineData: { data: imageBase64, mimeType: mimeType } }
            ]
          }]
        };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || `HTTP ${res.status}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              success: true,
              provider: attempt.name,
              extractedText: text.trim()
            })
          };
        } else {
          throw new Error("Respons kosong dari Gemini");
        }
      } else if (attempt.type === "groq") {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const payload = {
          model: attempt.model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: ocrPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ]
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${attempt.key}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || `HTTP ${res.status}`);
        }

        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim()) {
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              success: true,
              provider: attempt.name,
              extractedText: text.trim()
            })
          };
        } else {
          throw new Error("Respons kosong dari Groq Vision");
        }
      }
    } catch (err) {
      console.warn(`[OCR Failover] ${attempt.name} gagal: ${err.message}`);
      errors.push(`${attempt.name}: ${err.message}`);
    }
  }

  return {
    statusCode: 502,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: false,
      error: "Gagal mengekstrak teks dari gambar setelah mencoba semua provider.",
      details: errors
    })
  };
};
