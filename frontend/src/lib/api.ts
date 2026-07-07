const AUTH_TOKEN_KEY = "haze_access_token";
const AUTH_UNAUTHORIZED_EVENT = "haze:unauthorized";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  token?: string;
  body?: BodyInit | object | null;
}

export class ApiError<T = unknown> extends Error {
  readonly status: number;
  readonly code: number;
  readonly requestId?: string;
  readonly data?: T;

  constructor(
    message: string,
    options: { status: number; code: number; requestId?: string; data?: T },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.data = options.data;
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

function isObjectBody(body: ApiRequestOptions["body"]): body is object {
  return (
    body !== null
    && typeof body === "object"
    && !(body instanceof Blob)
    && !(body instanceof FormData)
    && !(body instanceof URLSearchParams)
    && !(body instanceof ArrayBuffer)
    && !ArrayBuffer.isView(body)
  );
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { token, body, headers: initialHeaders, ...requestInit } = options;
  const headers = new Headers(initialHeaders);
  let requestBody = body as BodyInit | null | undefined;
  const accessToken = token ?? localStorage.getItem(AUTH_TOKEN_KEY) ?? undefined;

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (isObjectBody(body)) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${apiBaseUrl}${normalizedPath}`, {
    ...requestInit,
    headers,
    body: requestBody,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json() as ApiResponse<T>
    : undefined;

  if (!response.ok || !payload || payload.code !== 0) {
    if (response.status === 401 && accessToken) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      payload?.message ?? response.statusText ?? "API request failed",
      {
        status: response.status,
        code: payload?.code ?? response.status,
        requestId: payload?.request_id
          ?? response.headers.get("X-Request-ID")
          ?? undefined,
        data: payload?.data,
      },
    );
  }
  return payload;
}
export async function apiBlobRequest(path: string): Promise<Blob> {
  const accessToken = localStorage.getItem(AUTH_TOKEN_KEY) ?? undefined;
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${apiBaseUrl}${normalizedPath}`, { headers });
  if (!response.ok) {
    if (response.status === 401 && accessToken) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new ApiError(response.statusText || "API request failed", {
      status: response.status,
      code: response.status,
      requestId: response.headers.get("X-Request-ID") ?? undefined,
    });
  }
  return response.blob();
}
