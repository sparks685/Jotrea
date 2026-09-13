import { isAndroidCapacitor } from "@/utils/capacitor";
import { isValidReviewerAccessGrant } from "@/utils/reviewerAccess";
import type { ReviewerAccessGrant } from "@/types";

export const REVIEWER_ACCESS_URL = "https://www.jotrea.com/api/validate-reviewer-code";
export const REVIEWER_ACCESS_TIMEOUT_MS = 10_000;

export class ReviewerAccessError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ReviewerAccessError";
    this.status = status;
  }
}

const statusMessage = (status: number): string | null => {
  if (status === 401) return "That reviewer code is invalid.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status === 503) return "Reviewer access is not configured. Please try again later.";
  return null;
};

const unreadableResponseMessage = "Reviewer access service returned an unreadable response. Please try again.";
const invalidResponseMessage = "Reviewer access service returned an invalid response. Please try again.";

function errorFromStatus(status: number): ReviewerAccessError {
  return new ReviewerAccessError(
    statusMessage(status) ?? "Reviewer access request failed. Please try again.",
    status
  );
}

function safeServerError(error: unknown, code: string): string | null {
  if (typeof error !== "string") return null;
  const message = error.trim();
  if (!message || message.length > 240) return null;
  // Do not let an accidentally echoed code become visible in the UI.
  if (code && message.toLocaleLowerCase().includes(code.toLocaleLowerCase())) return null;
  return message;
}

/**
 * Validate a reviewer code. This is deliberately a direct, uncached POST:
 * notification service workers have no fetch handler, and cache:no-store
 * protects the request from browser/proxy caching as well.
 */
export async function requestReviewerAccess(code: string): Promise<ReviewerAccessGrant> {
  if (!isAndroidCapacitor()) {
    throw new ReviewerAccessError("Reviewer access is only available in the Android app.");
  }
  if (typeof code !== "string" || !code.trim()) {
    throw new ReviewerAccessError("Enter your reviewer code.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REVIEWER_ACCESS_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(REVIEWER_ACCESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (cause) {
      if (timedOut) {
        throw new ReviewerAccessError("Reviewer access request timed out. Check your connection and try again.");
      }
      if (cause instanceof ReviewerAccessError) throw cause;
      throw new ReviewerAccessError("Could not reach reviewer access service. Check your connection and try again.");
    }

    const status = response.status;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      const knownError = statusMessage(status);
      throw new ReviewerAccessError(knownError ?? unreadableResponseMessage, status);
    }

    if (!response.ok) {
      const knownError = statusMessage(status);
      if (knownError) throw new ReviewerAccessError(knownError, status);
      if (typeof body === "object" && body !== null && "ok" in body && (body as { ok?: unknown }).ok === false) {
        const message = safeServerError((body as { error?: unknown }).error, code);
        throw new ReviewerAccessError(message ?? errorFromStatus(status).message, status);
      }
      throw errorFromStatus(status);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      (body as { ok?: unknown }).ok !== true ||
      !isValidReviewerAccessGrant((body as { grant?: unknown }).grant)
    ) {
      if (
        typeof body === "object" &&
        body !== null &&
        (body as { ok?: unknown }).ok === false
      ) {
        const message = safeServerError((body as { error?: unknown }).error, code);
        throw new ReviewerAccessError(message ?? invalidResponseMessage, status);
      }
      throw new ReviewerAccessError(invalidResponseMessage, status);
    }

    // Return only the contract grant. In particular, never return or persist
    // the submitted code after activation.
    return (body as { grant: ReviewerAccessGrant }).grant;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}