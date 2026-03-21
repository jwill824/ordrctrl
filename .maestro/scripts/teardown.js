// teardown.js — Maestro onFlowComplete hook
// Always runs after a flow completes (pass or fail) via the onFlowComplete hook.
// Deletes the test user created by setup.js.
// Gracefully handles: user already deleted (404), setup never completed (no output.testUser).
// Requires ENABLE_TEST_ROUTES=true in backend .env.

var apiBase = maestro.platform === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

// Guard: if setup.js never completed (e.g. onFlowStart itself failed), skip cleanup.
if (!output.testUser || !output.testUser.email) {
    console.log('[teardown] No test user in output — skipping cleanup');
} else {
    var response = http.delete(apiBase + '/api/test/delete-user', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: output.testUser.email })
    });

    if (!response.ok && response.status !== 404) {
        throw new Error('Failed to delete test user (' + response.status + '): ' + response.body);
    }
}
