// setup.js — Maestro setup script
// Creates a fresh test user, logs in, and seeds a task so the feed is non-empty.
// Stores credentials in output.testUser so all sub-flows can reference them.
// Requires ENABLE_TEST_ROUTES=true in backend .env.

var apiBase = maestro.platform === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
var email = 'e2e-' + Date.now() + '@ordrctrl.test';
var password = 'TestPass1!';

// 1. Create pre-verified test user
var createResp = http.post(apiBase + '/api/test/create-user', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
});
if (!createResp.ok) {
    throw new Error('Failed to create test user (' + createResp.status + '): ' + createResp.body);
}

// 2. Login to obtain a session cookie
var loginResp = http.post(apiBase + '/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
});
if (!loginResp.ok) {
    throw new Error('Failed to login test user (' + loginResp.status + '): ' + loginResp.body);
}

// Extract session cookie (Set-Cookie: sessionId=xxx; Path=/; ...)
var setCookie = loginResp.headers['Set-Cookie'] || loginResp.headers['set-cookie'] || '';
var sessionCookie = setCookie.split(';')[0]; // "sessionId=abc123"

// 3. Seed a task so the feed has at least one item with "Mark complete"
var taskResp = http.post(apiBase + '/api/tasks', {
    headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
    },
    body: JSON.stringify({ title: 'E2E test task' })
});
if (!taskResp.ok) {
    throw new Error('Failed to seed task (' + taskResp.status + '): ' + taskResp.body);
}

output.testUser = { email: email, password: password };
