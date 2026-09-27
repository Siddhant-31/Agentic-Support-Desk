export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export type ApiResponse<TData = unknown> = {
  ok: boolean;
  status: number;
  data: TData;
};

async function apiCommonRequest<TData = unknown>(
  path: string,
  init: RequestInit,
): Promise<ApiResponse<TData>> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.headers || {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const text = await res.text();

  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: res.ok,
    status: res.status,
    data: data as TData,
  };
}

export function apiGet<TData = unknown>(path: string) {
  return apiCommonRequest<TData>(path, { method: "GET" });
}

export function apiPost<TData = unknown>(path: string, body?: unknown) {
  return apiCommonRequest<TData>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
