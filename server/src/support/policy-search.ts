import { pool } from "../db/pool";
import { embedText, toVectorLiteral } from "./embeddings";

// Real semantic RAG, replacing the earlier keyword-overlap version:
//
//  1. Each policy chunk was embedded once at seed time (see db/seed.ts)
//     and stored in policy_chunks.embedding (a pgvector column).
//  2. At query time, the incoming search query is embedded with the
//     same model, and pgvector's `<=>` cosine-distance operator finds
//     the closest chunks - "closest in meaning", not "shares the most
//     literal words" like the old version did.
//  3. Every query is scoped to company_id, so Company A's search can
//     never surface Company B's policy chunks.
//
// If OPENAI_API_KEY isn't set (so embeddings can't be computed), this
// falls back to plain Postgres full-text search (to_tsvector/websearch),
// so the tool still works, just less precisely - it never silently
// returns nothing just because embeddings aren't configured.

export type PolicyChunk = {
  source: string; // the policy document's title
  heading: string;
  text: string;
};

const SELECT_FIELDS = `
  pd.title AS source,
  pc.heading,
  pc.text
`;

async function semanticSearch(
  companyId: string,
  query: string,
  k: number,
): Promise<PolicyChunk[] | null> {
  const embedding = await embedText(query);
  if (!embedding) return null; // no API key configured - caller falls back

  const result = await pool.query<PolicyChunk>(
    `SELECT ${SELECT_FIELDS}
     FROM policy_chunks pc
     JOIN policy_documents pd ON pd.id = pc.policy_document_id
     WHERE pc.company_id = $1 AND pc.embedding IS NOT NULL
     ORDER BY pc.embedding <=> $2::vector
     LIMIT $3`,
    [companyId, toVectorLiteral(embedding), k],
  );
  return result.rows;
}

async function keywordFallbackSearch(
  companyId: string,
  query: string,
  k: number,
): Promise<PolicyChunk[]> {
  const result = await pool.query<PolicyChunk>(
    `SELECT ${SELECT_FIELDS}
     FROM policy_chunks pc
     JOIN policy_documents pd ON pd.id = pc.policy_document_id
     WHERE pc.company_id = $1
       AND to_tsvector('english', pc.heading || ' ' || pc.text)
           @@ websearch_to_tsquery('english', $2)
     LIMIT $3`,
    [companyId, query, k],
  );
  return result.rows;
}

export async function searchPolicy(
  companyId: string,
  query: string,
  k = 3,
): Promise<PolicyChunk[]> {
  if (!query.trim()) return [];

  const semantic = await semanticSearch(companyId, query, k);
  if (semantic) return semantic;

  return keywordFallbackSearch(companyId, query, k);
}
