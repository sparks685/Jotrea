import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";

import { createReviewerCodeHandler } from "./validate-reviewer-code.js";

const REVIEWER_CODE = "a-secure-reviewer-code";
const LOCAL_ORIGIN = "http://localhost";
const JSON_CONTENT_TYPE = "application/json";

class MockResponse {
  constructor() {
    this.headers = new Map();
    this.statusCode = 200;
    this.body = "";
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), String(value));
  }

  end(body = "") {
    this.body = body;
  }

  json() {
    return this.body ? JSON.parse(this.body) : undefined;
  }

  header(name) {
    return this.headers.get(name.toLowerCase());
  }
}

function makeRequest({
  body = { code: REVIEWER_CODE },
  method = "POST",
  contentType = JSON_CONTENT_TYPE,
  origin,
  ip = "198.51.100.10",
  contentLength,
  extraHeaders = {},
} = {}) {
  const serializedBody =
    typeof body === "string" ? body : JSON.stringify(body);
  const headers = {
    ...extraHeaders,
    ...(contentType ? { "content-type": contentType } : {}),
    ...(origin ? { origin } : {}),
    ...(contentLength !== undefined
      ? { "content-length": String(contentLength) }
      : {}),
    "x-forwarded-for": ip,
  };
  const request = Readable.from([serializedBody]);
  request.method = method;
  request.headers = headers;
  request.socket = { remoteAddress: ip };
  return request;
}

function makeHandler({
  code = REVIEWER_CODE,
  now = () => Date.parse("2026-01-01T00:00:00.000Z"),
} = {}) {
  const environment = {};
  if (code !== undefined) {
    environment.REVIEWER_CODE = code;
  }
  return createReviewerCodeHandler({ environment, now });
}

async function invoke(handler, requestOptions = {}) {
  const response = new MockResponse();
  await handler(makeRequest(requestOptions), response);
  return response;
}

test("returns the Android Jotrea Plus grant for a valid reviewer code", async () => {
  const response = await invoke(makeHandler(), {
    origin: LOCAL_ORIGIN,
    body: { code: REVIEWER_CODE, platform: "ios" },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    grant: {
      platform: "android",
      access: "jotrea_plus",
      activatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  assert.equal(response.header("cache-control"), "no-store");
  assert.equal(response.header("access-control-allow-origin"), LOCAL_ORIGIN);
  assert.equal(response.body.includes(REVIEWER_CODE), false);
});

test("rejects an invalid reviewer code without echoing it", async () => {
  const submittedCode = "this-is-not-the-reviewer-code";
  const response = await invoke(makeHandler(), {
    body: { code: submittedCode },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    ok: false,
    error: "Invalid reviewer code",
  });
  assert.equal(response.body.includes(submittedCode), false);
});

test("rejects an empty code and an oversized JSON body", async () => {
  const emptyResponse = await invoke(makeHandler(), { body: { code: "" } });
  assert.equal(emptyResponse.statusCode, 400);
  assert.deepEqual(emptyResponse.json(), {
    ok: false,
    error: "Invalid request body",
  });

  const hugeResponse = await invoke(makeHandler(), {
    body: JSON.stringify({ code: "x".repeat(2_000) }),
  });
  assert.equal(hugeResponse.statusCode, 413);
  assert.deepEqual(hugeResponse.json(), {
    ok: false,
    error: "Request body is too large",
  });
});

test("fails closed when REVIEWER_CODE is missing, weak, or only exposed as VITE_", async () => {
  const missing = await invoke(makeHandler({ code: null }));
  assert.equal(missing.statusCode, 503);

  const weak = await invoke(makeHandler({ code: "short" }));
  assert.equal(weak.statusCode, 503);

  const viteOnlyHandler = createReviewerCodeHandler({
    environment: { VITE_REVIEWER_CODE: REVIEWER_CODE },
  });
  const viteOnly = await invoke(viteOnlyHandler);
  assert.equal(viteOnly.statusCode, 503);
  assert.equal(viteOnly.body.includes(REVIEWER_CODE), false);
});

test("rejects non-POST methods and non-JSON content types", async () => {
  const getResponse = await invoke(makeHandler(), { method: "GET" });
  assert.equal(getResponse.statusCode, 405);
  assert.equal(getResponse.header("allow"), "POST, OPTIONS");

  const contentTypeResponse = await invoke(makeHandler(), {
    contentType: "text/plain",
  });
  assert.equal(contentTypeResponse.statusCode, 415);
  assert.deepEqual(contentTypeResponse.json(), {
    ok: false,
    error: "Content-Type must be application/json",
  });
});

test("allows configured CORS origins and rejects forbidden origins", async () => {
  const allowedResponse = await invoke(makeHandler(), {
    origin: "https://www.jotrea.com",
  });
  assert.equal(allowedResponse.statusCode, 200);
  assert.equal(
    allowedResponse.header("access-control-allow-origin"),
    "https://www.jotrea.com",
  );

  const forbiddenResponse = await invoke(makeHandler(), {
    origin: "https://evil.example",
  });
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(forbiddenResponse.header("access-control-allow-origin"), undefined);
  assert.deepEqual(forbiddenResponse.json(), {
    ok: false,
    error: "Origin not allowed",
  });
});

test("handles allowed and forbidden preflight requests without a wildcard", async () => {
  const allowedResponse = await invoke(makeHandler(), {
    method: "OPTIONS",
    origin: "https://localhost",
    body: "",
  });
  assert.equal(allowedResponse.statusCode, 204);
  assert.equal(allowedResponse.body, "");
  assert.equal(
    allowedResponse.header("access-control-allow-origin"),
    "https://localhost",
  );
  assert.equal(
    allowedResponse.header("access-control-allow-methods"),
    "POST, OPTIONS",
  );
  assert.notEqual(allowedResponse.header("access-control-allow-origin"), "*");
  assert.equal(allowedResponse.header("cache-control"), "no-store");

  const forbiddenResponse = await invoke(makeHandler(), {
    method: "OPTIONS",
    origin: "https://evil.example",
    body: "",
  });
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(forbiddenResponse.header("access-control-allow-origin"), undefined);
});

test("applies a bounded ten-request burst limit per trusted forwarded IP", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const handler = makeHandler({ now: () => now });

  for (let requestNumber = 0; requestNumber < 10; requestNumber += 1) {
    const response = await invoke(handler, { ip: "203.0.113.20" });
    assert.equal(response.statusCode, 200);
  }

  const limitedResponse = await invoke(handler, { ip: "203.0.113.20" });
  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.header("retry-after"), "60");
  assert.equal(limitedResponse.body.includes(REVIEWER_CODE), false);

  now += 60_000;
  const afterExpiryResponse = await invoke(handler, {
    ip: "203.0.113.20",
  });
  assert.equal(afterExpiryResponse.statusCode, 200);
});

test("reads rotated reviewer codes on each request", async () => {
  const environment = { REVIEWER_CODE: REVIEWER_CODE };
  const handler = createReviewerCodeHandler({ environment });

  const oldCodeResponse = await invoke(handler);
  assert.equal(oldCodeResponse.statusCode, 200);

  environment.REVIEWER_CODE = "a-new-secure-reviewer-code";
  const oldCodeAfterRotation = await invoke(handler, {
    body: { code: REVIEWER_CODE },
    ip: "203.0.113.21",
  });
  assert.equal(oldCodeAfterRotation.statusCode, 401);

  const newCodeResponse = await invoke(handler, {
    body: { code: "a-new-secure-reviewer-code" },
    ip: "203.0.113.22",
  });
  assert.equal(newCodeResponse.statusCode, 200);
  assert.equal(newCodeResponse.body.includes(REVIEWER_CODE), false);
});