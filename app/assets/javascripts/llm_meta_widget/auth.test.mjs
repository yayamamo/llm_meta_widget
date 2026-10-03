import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthUrl, authenticationFailed } from './auth.js';

test('login links allow HTTP(S), resolve relative paths, and reject executable URLs', () => {
  assert.equal(safeAuthUrl('/users/sign_in', 'https://hub.example'), 'https://hub.example/users/sign_in');
  assert.equal(safeAuthUrl(null, 'https://hub.example'), 'https://hub.example/');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test']) {
    assert.equal(safeAuthUrl(url, 'https://hub.example'), null);
  }
});
test('auth failure detection covers hub token errors without misclassifying rate limits or outages', () => {
  for (const message of ['singleLlmCall: HTTP 401 Unauthorized', 'Token has expired', 'Invalid token', 'param is missing: Token is missing']) {
    assert.equal(authenticationFailed(new Error(message)), true);
  }
  for (const message of ['HTTP 429 Too Many Requests', 'HTTP 502 Bad Gateway', 'Anonymous execution has been stopped']) {
    assert.equal(authenticationFailed(new Error(message)), false);
  }
});
