// Thin wrapper around OpenAI's embeddings endpoint. Used to embed both
// policy chunks (once, at seed time) and incoming search queries (at
// request time) into the same 1536-dimensional vector space so they can
// be compared with pgvector's cosine-distance operator.
//
// This always uses OpenAI for embeddings specifically, even if the chat
// provider selected for a given ticket is Gemini/Anthropic/Groq/Mistral.
// Embeddings and chat completions are independent choices - you don't
// need to match them - and OpenAI's text-embedding-3-small is cheap,
// fast, and a common default. Requires OPENAI_API_KEY to be set even if
// you're chatting with a different provider.

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dimensions

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // stay well under the model's input limit
    }),
  });

  if (!res.ok) {
    console.error("Embeddings request failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  return data.data?.[0]?.embedding ?? null;
}

// pgvector expects a literal like "[0.01,-0.02,...]" when passed as a
// query parameter to a VECTOR column.
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
