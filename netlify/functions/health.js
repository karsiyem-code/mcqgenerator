exports.handler = async (event, context) => {
  const hasGemini1 = Boolean(process.env.GEMINI_API_KEY_1);
  const hasGemini2 = Boolean(process.env.GEMINI_API_KEY_2);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  const configuredCount = [hasGemini1, hasGemini2, hasGroq].filter(Boolean).length;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      status: configuredCount > 0 ? "ready" : "unconfigured",
      providers: {
        gemini_key_1: hasGemini1,
        gemini_key_2: hasGemini2,
        groq: hasGroq
      },
      message: configuredCount > 0
        ? `Sistem siap (${configuredCount} provider aktif)`
        : "Belum ada API Key yang dikonfigurasi di Environment Variables Netlify."
    })
  };
};
