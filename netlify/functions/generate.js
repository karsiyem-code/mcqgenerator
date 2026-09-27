const BARRETT_TAXONOMY_REFERENCE = `
BARRETT TAXONOMY COMPLETE REFERENCE (Clymer, 1968):

1.0 LITERAL COMPREHENSION — explicitly stated ideas, closed questions, single correct response.
1.1 Recognition: 1.1.1 Details, 1.1.2 Main Ideas, 1.1.3 Sequence, 1.1.4 Comparison, 1.1.5 Cause & Effect, 1.1.6 Character Traits
1.2 Recall: 1.2.1 Details, 1.2.2 Main Ideas, 1.2.3 Sequence, 1.2.4 Comparison, 1.2.5 Cause & Effect, 1.2.6 Character Traits

2.0 REORGANIZATION — analyze, synthesize, organize explicit info.
2.1 Classifying, 2.2 Outlining, 2.3 Summarizing, 2.4 Synthesizing

3.0 INFERENTIAL COMPREHENSION — explicit ideas + intuition + experience; answers NOT stated, must be inferred; open-ended.
3.1 Inferring Supporting Details, 3.2 Inferring Main Ideas, 3.3 Inferring Sequence,
3.4 Inferring Comparisons, 3.5 Inferring Cause & Effect (motivations, authorial choices),
3.6 Inferring Character Traits, 3.7 Predicting Outcomes, 3.8 Interpreting Figurative Language

4.0 EVALUATION — evaluative judgment vs external/internal criteria; accuracy, acceptability, desirability, worth.
4.1 Reality or Fantasy, 4.2 Fact or Opinion, 4.3 Adequacy & Validity,
4.4 Appropriateness, 4.5 Worth/Desirability/Acceptability (moral code)

5.0 APPRECIATION — psychological & aesthetic impact; emotional/aesthetic sensitivity.
5.1 Emotional Response, 5.2 Identification with Characters/Incidents,
5.3 Reactions to Author's Use of Language, 5.4 Imagery
`;

function sanitizeAndParseJSON(rawText) {
  if (!rawText) throw new Error("Empty response text");
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Gagal parsing JSON: " + err.message);
  }
}

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

  const {
    stimulus,
    kisiKisi,
    barrettLevel,
    cefrLevel,
    itemType,
    dynamicParams = ""
  } = body;

  if (!stimulus || !kisiKisi) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Stimulus dan Kisi-Kisi/Indikator wajib diisi." })
    };
  }

  const promptText = `Role: Expert English Assessment Developer.
Task: Create EXACTLY ONE (1) assessment item based on the provided stimulus.

LANGUAGE: English only for Question Stem, Options, Explanation.
TARGET CEFR: ${cefrLevel} (A1=Basic, B1=Intermediate, C2=Proficient/Complex).

BARRETT TAXONOMY REFERENCE:
${BARRETT_TAXONOMY_REFERENCE}

PARAMETERS:
- Indicator: "${kisiKisi}"
- Barrett Level: ${barrettLevel}
- Item Type: ${itemType}

BARRETT ALIGNMENT: Identify the most relevant sub-level within "${barrettLevel}" matching indicator "${kisiKisi}". Use it to guide cognitive depth. Include in stimulus_analysis (e.g., "Barrett Sub-level: 3.5 Inferring Cause and Effect").

CONSTRAINTS:
${dynamicParams}

OUTPUT FORMAT (JSON ONLY, no other text):
{
  "stimulus_analysis": "Context + Barrett Sub-level matched",
  "question_stem": "Question text",
  "type": "${itemType}",
  "options": [{"label":"A","text":"..."}],
  "matrix_headers": ["Statement","Cat1","Cat2"],
  "matrix_rows": [{"statement":"...","answer":"Cat1"}],
  "correct_answer": "A",
  "explanation": "Explanation referencing Barrett sub-level."
}

STIMULUS: "${stimulus}"`;

  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  // Daftar prioritas model Groq (Qwen diprioritaskan)
  const candidateGroqModels = [
    process.env.GROQ_MODEL,
    "qwen/qwen3.8-27b",
    "qwen/qwen3.6-27b",
    "qwen-2.5-32b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
  ].filter(Boolean);

  const attempts = [
    {
      name: "Gemini Flash (Key 1)",
      type: "gemini",
      key: process.env.GEMINI_API_KEY_1,
      model: geminiModel
    },
    {
      name: "Gemini Flash (Key 2)",
      type: "gemini",
      key: process.env.GEMINI_API_KEY_2,
      model: geminiModel
    },
    {
      name: "Groq Qwen (Fallback)",
      type: "groq",
      key: process.env.GROQ_API_KEY,
      models: candidateGroqModels
    }
  ];

  const errors = [];

  for (const attempt of attempts) {
    if (!attempt.key) continue;

    try {
      if (attempt.type === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${attempt.key}`;
        const payload = {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
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

        const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = sanitizeAndParseJSON(rawResult);

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: true,
            provider: attempt.name,
            model: attempt.model,
            data: parsed
          })
        };
      } else if (attempt.type === "groq") {
        let lastGroqError = null;
        let successResult = null;

        // Mencoba daftar model Groq (Qwen -> varian lain) jika terjadi deprecation
        for (const groqModelId of attempt.models) {
          try {
            const url = "https://api.groq.com/openai/v1/chat/completions";
            const payload = {
              model: groqModelId,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: "You are an expert English assessment developer. Always reply with valid JSON only."
                },
                {
                  role: "user",
                  content: promptText
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
              const errMsg = data.error?.message || `HTTP ${res.status}`;
              // Jika model tidak ditemukan atau sudah decommissioned, coba kandidat model berikutnya
              if (errMsg.includes("decommissioned") || errMsg.includes("not found") || res.status === 404) {
                console.warn(`[Groq Model Deprecated] ${groqModelId} tidak aktif. Mencoba model Groq berikutnya...`);
                lastGroqError = new Error(`${groqModelId}: ${errMsg}`);
                continue;
              }
              throw new Error(errMsg);
            }

            const rawResult = data.choices?.[0]?.message?.content;
            const parsed = sanitizeAndParseJSON(rawResult);

            successResult = {
              statusCode: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                success: true,
                provider: `Groq (${groqModelId})`,
                model: groqModelId,
                data: parsed
              })
            };
            break;
          } catch (modelErr) {
            lastGroqError = modelErr;
          }
        }

        if (successResult) {
          return successResult;
        } else {
          throw lastGroqError || new Error("Semua model Groq gagal dijalankan.");
        }
      }
    } catch (err) {
      console.warn(`[Generate Failover] ${attempt.name} gagal: ${err.message}`);
      errors.push(`${attempt.name}: ${err.message}`);
    }
  }

  return {
    statusCode: 502,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: false,
      error: "Semua provider (Gemini Key 1, Key 2, dan Groq) gagal memproses permintaan.",
      details: errors
    })
  };
};
