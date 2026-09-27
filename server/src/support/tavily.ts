export type TavilyResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function tavilySearch(args: {
  query: string;
}): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  const extractQuery = args.query.trim();
  if (!extractQuery) return [];

  try {
    const result = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: key,
        query: extractQuery,
        max_results: 3,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
    });

    if (!result.ok) return [];

    const data = (await result.json()) as unknown as {
      results?: Array<{
        title?: unknown;
        url?: unknown;
        content?: unknown;
      }>;
    };

    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .map((res) => {
        const title = typeof res.title === "string" ? res.title : "Result";
        const url = typeof res.url === "string" ? res.url : "";

        const content = typeof res.content === "string" ? res.content : "";

        return {
          title,
          url,
          snippet: content.slice(0, 350),
        };
      })
      .filter((filteredRes) => filteredRes.url.length > 0);
  } catch (e) {
    return [];
  }
}
