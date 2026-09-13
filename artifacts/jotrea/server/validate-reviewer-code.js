import { createHash, timingSafeEqual } from "node:crypto";

const ALLOWED_ORIGINS = new Set([
  "http://localhost",
  "https://localhost",
  "https://www.jotrea.com",
]);

const MAX_BODY_BYTES = 1024;
const MAX_CODE_LENGTH = 256;
const MIN_CONFIGURED_CODE_LENGTH = 12;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ENTRIES = 10_000;
const IP_HEADER_NAMES = [
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-real-ip",
];

const WEAK_REVIEWER_CODES = new Set([
  "change-me",
  "changeme",
  "example",
  "example-code",
  "password",
  "password123",
  "placeholder",
  "reviewer",
  "reviewer-code",
  "secret",
  "test",
  "test-code",
]);

const ERROR_MESSAGES = {
  configuration: "Reviewer code verification is unavailable",
  contentType: "Content-Type must be application/json",
  invalidBody: "Invalid request body",
  invalidCode: "Invalid reviewer code",
  method: "Method not allowed",
  origin: "Origin not allowed",
  tooLarge: "Request body is too large",
  tooManyRequests: "Too many requests",
};

class RequestBodyTooLargeError extends Error {
  constructor() {
    super(ERROR_MESSAGES.tooLarge);
    this.name = "RequestBodyTooLargeError";
  }
}

class RequestBodyReadError extends Error {
  constructor() {
    super("Unable to read request body");
    this.name = "RequestBodyReadError";
  }
}

function getHeader(headers, name) {
  if (!headers) {
    return undefined;
  }

  const lowerName = name.toLowerCase();
  let headerValue = headers[lowerName] ?? headers[name];
  if (headerValue === undefined && typeof headers === "object") {
    const matchingName = Object.keys(headers).find(
      (headerName) => headerName.toLowerCase() === lowerName,
    );
    headerValue = matchingName === undefined ? undefined : headers[matchingName];
  }

  if (Array.isArray(headerValue)) {
    return headerValue.length === 1 ? headerValue[0] : undefined;
  }

  return typeof headerValue === "string" ? headerValue : undefined;
}

function setCommonHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
}

function setCorsHeaders(response, origin) {
  if (!origin) {
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");
}

function writeJson(response, statusCode, body, origin) {
  setCommonHeaders(response);
  setCorsHeaders(response, origin);
  response.statusCode = statusCode;
  response.end(JSON.stringify(body));
}

function writeEmpty(response, statusCode, origin) {
  setCommonHeaders(response);
  setCorsHeaders(response, origin);
  response.statusCode = statusCode;
  response.end();
}

function getAllowedOrigin(request) {
  const origin = getHeader(request.headers, "origin");

  if (origin === undefined) {
    return { allowed: true, origin: undefined };
  }

  return {
    allowed: ALLOWED_ORIGINS.has(origin),
    origin: ALLOWED_ORIGINS.has(origin) ? origin : undefined,
  };
}

function isWeakConfiguredCode(code) {
  if (
    typeof code !== "string" ||
    code.length < MIN_CONFIGURED_CODE_LENGTH ||
    code.length > MAX_CODE_LENGTH ||
    code.trim() !== code ||
    code.length === 0
  ) {
    return true;
  }

  if (WEAK_REVIEWER_CODES.has(code.toLowerCase())) {
    return true;
  }

  return /^([^\n])\1+$/.test(code);
}

function getConfiguredCode(environment) {
  const configuredCode = environment?.REVIEWER_CODE;
  return isWeakConfiguredCode(configuredCode) ? undefined : configuredCode;
}

function digestCode(code) {
  return createHash("sha256").update(code, "utf8").digest();
}

function codesMatch(submittedCode, configuredCode) {
  const submittedDigest = digestCode(submittedCode);
  const configuredDigest = digestCode(configuredCode);
  return timingSafeEqual(submittedDigest, configuredDigest);
}

function getTrustedIp(request) {
  for (const headerName of IP_HEADER_NAMES) {
    const headerValue = getHeader(request.headers, headerName);
    if (headerValue) {
      const firstAddress = headerValue.split(",", 1)[0]?.trim();
      if (firstAddress && firstAddress.length <= 128) {
        return firstAddress;
      }
    }
  }

  const socketAddress = request.socket?.remoteAddress;
  return typeof socketAddress === "string" && socketAddress.length > 0
    ? socketAddress
    : "unknown";
}

class InMemoryRateLimiter {
  constructor(now) {
    this.now = now;
    this.entries = new Map();
  }

  pruneExpired(now) {
    for (const [ip, entry] of this.entries) {
      if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
        this.entries.delete(ip);
      }
    }
  }

  check(ip) {
    const now = this.now();
    this.pruneExpired(now);

    let entry = this.entries.get(ip);
    if (!entry) {
      if (this.entries.size >= RATE_LIMIT_MAX_ENTRIES) {
        const oldestIp = this.entries.keys().next().value;
        if (oldestIp !== undefined) {
          this.entries.delete(oldestIp);
        }
      }

      entry = { count: 0, windowStartedAt: now };
      this.entries.set(ip, entry);
    }

    if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      entry.count = 0;
      entry.windowStartedAt = now;
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (entry.windowStartedAt + RATE_LIMIT_WINDOW_MS - now) / 1000,
          ),
        ),
      };
    }

    entry.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

function getContentLength(request) {
  const rawContentLength = getHeader(request.headers, "content-length");
  if (rawContentLength === undefined) {
    return { valid: true, length: undefined };
  }

  if (!/^\d+$/.test(rawContentLength)) {
    return { valid: false, length: undefined };
  }

  const length = Number(rawContentLength);
  if (!Number.isSafeInteger(length)) {
    return { valid: false, length: undefined };
  }

  return { valid: true, length };
}

async function readBody(request) {
  const chunks = [];
  let totalBytes = 0;

  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > MAX_BODY_BYTES) {
        throw new RequestBodyTooLargeError();
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      throw error;
    }

    throw new RequestBodyReadError();
  }

  return Buffer.concat(chunks, totalBytes);
}

function parseJsonBody(body) {
  let decodedBody;

  try {
    decodedBody = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return undefined;
  }

  try {
    const parsedBody = JSON.parse(decodedBody);
    if (
      parsedBody === null ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody) ||
      typeof parsedBody.code !== "string" ||
      parsedBody.code.length === 0 ||
      parsedBody.code.length > MAX_CODE_LENGTH
    ) {
      return undefined;
    }

    return parsedBody;
  } catch {
    return undefined;
  }
}

function isJsonContentType(request) {
  const contentType = getHeader(request.headers, "content-type");
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

function successGrant(now) {
  return {
    platform: "android",
    access: "jotrea_plus",
    activatedAt: new Date(now()).toISOString(),
  };
}

/**
 * Creates a Vercel-compatible Node serverless handler.
 *
 * The optional arguments are intentionally kept for server tests. Production
 * uses process.env and Date.now, while tests can use an isolated environment
 * and clock without changing the endpoint's behavior.
 */
export function createReviewerCodeHandler({
  environment = process.env,
  now = () => Date.now(),
} = {}) {
  const rateLimiter = new InMemoryRateLimiter(now);

  return async function validateReviewerCode(request, response) {
    const originResult = getAllowedOrigin(request);
    if (!originResult.allowed) {
      writeJson(response, 403, { ok: false, error: ERROR_MESSAGES.origin });
      return;
    }

    if (request.method === "OPTIONS") {
      writeEmpty(response, 204, originResult.origin);
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST, OPTIONS");
      writeJson(response, 405, { ok: false, error: ERROR_MESSAGES.method });
      return;
    }

    const configuredCode = getConfiguredCode(environment);
    if (!configuredCode) {
      writeJson(
        response,
        503,
        { ok: false, error: ERROR_MESSAGES.configuration },
        originResult.origin,
      );
      return;
    }

    const rateLimitResult = rateLimiter.check(getTrustedIp(request));
    if (!rateLimitResult.allowed) {
      response.setHeader(
        "Retry-After",
        String(rateLimitResult.retryAfterSeconds),
      );
      writeJson(
        response,
        429,
        { ok: false, error: ERROR_MESSAGES.tooManyRequests },
        originResult.origin,
      );
      return;
    }

    const contentLength = getContentLength(request);
    if (!contentLength.valid) {
      writeJson(
        response,
        400,
        { ok: false, error: ERROR_MESSAGES.invalidBody },
        originResult.origin,
      );
      return;
    }

    if (
      contentLength.length !== undefined &&
      contentLength.length > MAX_BODY_BYTES
    ) {
      writeJson(
        response,
        413,
        { ok: false, error: ERROR_MESSAGES.tooLarge },
        originResult.origin,
      );
      return;
    }

    if (!isJsonContentType(request)) {
      writeJson(
        response,
        415,
        { ok: false, error: ERROR_MESSAGES.contentType },
        originResult.origin,
      );
      return;
    }

    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      const isTooLarge = error instanceof RequestBodyTooLargeError;
      writeJson(
        response,
        isTooLarge ? 413 : 400,
        {
          ok: false,
          error: isTooLarge
            ? ERROR_MESSAGES.tooLarge
            : ERROR_MESSAGES.invalidBody,
        },
        originResult.origin,
      );
      return;
    }

    const parsedBody = parseJsonBody(body);
    if (!parsedBody) {
      writeJson(
        response,
        400,
        { ok: false, error: ERROR_MESSAGES.invalidBody },
        originResult.origin,
      );
      return;
    }

    if (!codesMatch(parsedBody.code, configuredCode)) {
      writeJson(
        response,
        401,
        { ok: false, error: ERROR_MESSAGES.invalidCode },
        originResult.origin,
      );
      return;
    }

    writeJson(
      response,
      200,
      { ok: true, grant: successGrant(now) },
      originResult.origin,
    );
  };
}

const handler = createReviewerCodeHandler();

export default handler;