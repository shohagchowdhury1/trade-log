import type { Trade, TradeInput } from "./generated/api.schemas";

export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

// ---------------------------------------------------------------------------
// Browser-local API fallback (uses localStorage when no remote API is configured)
// ---------------------------------------------------------------------------

const LOCAL_TRADES_KEY = "trade-log-trades";

function resolveLocalUrl(input: RequestInfo | URL): string | null {
  if (typeof window === "undefined") return null;
  const url = resolveUrl(input);
  if (!url.startsWith("/api/")) return null;
  return url;
}

function loadTrades(): Trade[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_TRADES_KEY);
    return raw ? (JSON.parse(raw) as Trade[]) : [];
  } catch {
    return [];
  }
}

function saveTrades(trades: Trade[]): void {
  window.localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(trades));
}

function computeTradeFields(
  input: TradeInput,
): Pick<Trade, "netPnl" | "rr" | "result"> {
  const { entryPrice, exitPrice, stopLoss, shares, side } = input;
  const netPnl =
    side === "Long"
      ? (exitPrice - entryPrice) * shares
      : (entryPrice - exitPrice) * shares;
  const result = netPnl >= 0 ? "Win" : "Loss";
  const risk = Math.abs(entryPrice - stopLoss);
  const rr = risk > 0 ? Math.abs(exitPrice - entryPrice) / risk : 0;
  return { netPnl, rr, result };
}

function buildLocalResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildLocalErrorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleLocalApiRequest(
  url: string,
  method: string,
  body: string | undefined,
): Promise<Response | null> {
  if (url === "/api/healthz") {
    return buildLocalResponse({ status: "ok" });
  }

  if (url === "/api/trades" && method === "GET") {
    const parsed = new URL(url, window.location.origin);
    const search = parsed.searchParams.get("search")?.toLowerCase() || "";
    const side = parsed.searchParams.get("side");
    const result = parsed.searchParams.get("result");
    const sortOrder = parsed.searchParams.get("sortOrder") || "desc";

    let trades = loadTrades();

    if (search) {
      trades = trades.filter((t) => t.ticker.toLowerCase().includes(search));
    }
    if (side) {
      trades = trades.filter((t) => t.side === side);
    }
    if (result) {
      trades = trades.filter((t) => t.result === result);
    }

    trades.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === "asc" ? da - db : db - da;
    });

    return buildLocalResponse(trades);
  }

  if (url === "/api/trades" && method === "POST") {
    const data = body ? (JSON.parse(body) as TradeInput) : ({} as TradeInput);
    const trades = loadTrades();
    const now = new Date().toISOString();
    const newTrade: Trade = {
      ...data,
      id: Date.now(),
      createdAt: now,
      ...computeTradeFields(data),
    };
    trades.push(newTrade);
    saveTrades(trades);
    return buildLocalResponse(newTrade, 201);
  }

  if (url === "/api/trades/stats" && method === "GET") {
    const trades = loadTrades();
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.result === "Win").length;
    const losses = totalTrades - wins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const netPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
    const grossProfit = trades
      .filter((t) => t.netPnl > 0)
      .reduce((sum, t) => sum + t.netPnl, 0);
    const grossLoss = trades
      .filter((t) => t.netPnl < 0)
      .reduce((sum, t) => sum + t.netPnl, 0);
    const profitFactor =
      grossLoss !== 0
        ? grossProfit / Math.abs(grossLoss)
        : grossProfit > 0
          ? Infinity
          : 0;

    const pnlByTrade = trades.map((t, idx) => ({
      tradeNumber: idx + 1,
      pnl: t.netPnl,
      result: t.result,
      ticker: t.ticker,
      date: t.date,
    }));

    return buildLocalResponse({
      totalTrades,
      winRate,
      netPnl,
      profitFactor,
      wins,
      losses,
      pnlByTrade,
    });
  }

  const updateMatch = url.match(/^\/api\/trades\/(\d+)$/);
  if (updateMatch && method === "PUT") {
    const id = Number(updateMatch[1]);
    const data = body ? (JSON.parse(body) as TradeInput) : ({} as TradeInput);
    const trades = loadTrades();
    const index = trades.findIndex((t) => t.id === id);
    if (index === -1) {
      return buildLocalErrorResponse("Trade not found", 404);
    }
    trades[index] = {
      ...trades[index],
      ...data,
      id,
      ...computeTradeFields(data),
    };
    saveTrades(trades);
    return buildLocalResponse(trades[index]);
  }

  if (updateMatch && method === "DELETE") {
    const id = Number(updateMatch[1]);
    const trades = loadTrades();
    const index = trades.findIndex((t) => t.id === id);
    if (index === -1) {
      return buildLocalErrorResponse("Trade not found", 404);
    }
    trades.splice(index, 1);
    saveTrades(trades);
    return buildLocalResponse({ success: true });
  }

  return null;
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const localUrl = resolveLocalUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;
  const method = resolveMethod(input, init.method);

  if (localUrl) {
    const localResponse = await handleLocalApiRequest(
      localUrl,
      method,
      typeof init.body === "string" ? init.body : undefined,
    );
    if (localResponse) {
      const requestInfo = { method, url: localUrl };
      if (!localResponse.ok) {
        const errorData = await parseErrorBody(localResponse, method);
        throw new ApiError(localResponse, errorData, requestInfo);
      }
      return (await parseSuccessBody(
        localResponse,
        responseType,
        requestInfo,
      )) as T;
    }
  }

  input = applyBaseUrl(input);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  // Attach bearer token when an auth getter is configured and no
  // Authorization header has been explicitly provided.
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolveUrl(input) };

  const response = await fetch(input, { ...init, method, headers });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}
