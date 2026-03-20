// teardown.js — Maestro teardown script
// Deletes the test user created by setup.js after all E2E flows complete.
// Requires ENABLE_TEST_ROUTES=true in backend .env.

var apiBase = maestro.platform === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

var response = http.delete(apiBase + '/api/test/delete-user', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: output.testUser.email })
});

if (!response.ok) {
    throw new Error('Failed to delete test user (' + response.status + '): ' + response.body);
}
