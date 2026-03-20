// teardown.js — Maestro teardown script
// Deletes the test user created by setup.js after all E2E flows complete.
// Best-effort: if this fails the VS Code task's shell-level cleanup will still run.
// Requires ENABLE_TEST_ROUTES=true in backend .env.

var apiBase = maestro.platform === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

var response = http.delete(apiBase + '/api/test/delete-user', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: output.testUser.email })
});

if (!response.ok && response.status !== 404) {
    // 404 is fine — user may have been cleaned up by the shell-level cleanup already
    throw new Error('Failed to delete test user (' + response.status + '): ' + response.body);
}
