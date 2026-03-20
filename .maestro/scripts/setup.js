// setup.js — Maestro setup script
// Creates a fresh test user via the backend test API before E2E flows run.
// Stores credentials in output.testUser so all sub-flows can reference them.
// Requires ENABLE_TEST_ROUTES=true in backend .env.

var apiBase = maestro.platform === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
var email = 'e2e-' + Date.now() + '@ordrctrl.test';
var password = 'TestPass1!';

var response = http.post(apiBase + '/api/test/create-user', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
});

if (!response.ok) {
    throw new Error('Failed to create test user (' + response.status + '): ' + response.body);
}

output.testUser = { email: email, password: password };
