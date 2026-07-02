// Wrapper fino sobre a API da Groq (compatível com o formato OpenAI de chat completions).
// Usa o fetch nativo do Node — sem SDK extra, para manter o número de dependências mínimo.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function chatCompletion({ messages, tools }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY não configurada. Defina no .env para usar o Plano Profissional.');
  }

  const resposta = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
      temperature: 0.4
    })
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Groq API retornou ${resposta.status}: ${corpo}`);
  }

  const dados = await resposta.json();
  return dados.choices[0].message;
}

module.exports = { chatCompletion };
