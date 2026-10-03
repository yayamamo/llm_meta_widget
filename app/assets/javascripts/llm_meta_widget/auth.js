// Login guidance is UI state only. The hub remains the authority that verifies
// the supplied Google ID token. Never put a token in an HTML attribute or URL.
export function safeAuthUrl(value, baseUrl) {
  try {
    const url = new URL(value || baseUrl, baseUrl);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function authenticationFailed(error) {
  const message = error?.message || "";
  return /HTTP 401\b|Token (?:is missing|has expired)|Invalid token|Audience mismatch/i.test(message);
}
