# Contract: Auth API

**Version**: 1.0 | **Date**: 2026-03-05 | **Base path**: `/api/auth`

## Endpoints

---

### POST /api/auth/register

Create a new email/password account.

**Request body**:
```json
{
  "email": "user@example.com",
  "password": "Min8CharsWithUpperAndNumber1"
}
```

**Responses**:
| Status | Meaning |
|--------|---------|
| 201 | Account created; verification email sent |
| 409 | Email already registered |
| 422 | Validation failure (email format, password strength) |

**Response body (201)**:
```json
{ "message": "Verification email sent. Please check your inbox." }
```

---

### POST /api/auth/verify-email

Activate an account using the token from the verification email.

**Request body**:
```json
{ "token": "<verification-token>" }
```

**Responses**:
| Status | Meaning |
|--------|---------|
| 200 | Email verified; session cookie set |
| 400 | Token invalid or already used |
| 410 | Token expired |

---

### POST /api/auth/login

Authenticate with email and password.

**Request body**:
```json
{ "email": "user@example.com", "password": "..." }
```

**Responses**:
| Status | Meaning |
|--------|---------|
| 200 | Authenticated; session cookie set |
| 401 | Invalid credentials |
| 403 | Account not verified |
| 429 | Too many failed attempts; account temporarily locked |

**Response body (200)**:
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "emailVerified": true },
  "hasIntegrations": false
}
```

---

### GET /api/auth/google

Initiate Sign in with Google (OIDC redirect).

**Responses**: Redirects to Google authorization endpoint.

---

### GET /api/auth/google/callback

Handle Google OAuth callback.

**Query params**: `code`, `state`

**Responses**:
| Status | Meaning |
|--------|---------|
| 302 | Redirect to `/onboarding` (new user) or `/feed` (returning user) |
| 400 | Invalid state / CSRF check failed |

---

### GET /api/auth/apple

Initiate Sign in with Apple (OIDC redirect).

**Responses**: Redirects to Apple authorization endpoint.

---

### POST /api/auth/apple/callback

Handle Apple OAuth callback (Apple uses POST for redirect).

**Responses**:
| Status | Meaning |
|--------|---------|
| 302 | Redirect to `/onboarding` or `/feed` |
| 400 | Invalid state / CSRF check failed |

---

### POST /api/auth/logout

Invalidate the current session.

**Auth required**: Yes (session cookie)

**Responses**:
| Status | Meaning |
|--------|---------|
| 204 | Session invalidated; cookie cleared |
| 401 | Not authenticated |

---

### POST /api/auth/forgot-password

Request a password reset email.

**Request body**:
```json
{ "email": "user@example.com" }
```

**Responses**: Always `200` (to prevent email enumeration).

---

### POST /api/auth/reset-password

Set a new password using the reset token.

**Request body**:
```json
{ "token": "<reset-token>", "password": "NewPassword1!" }
```

**Responses**:
| Status | Meaning |
|--------|---------|
| 200 | Password updated; session cookie set |
| 400 | Token invalid |
| 410 | Token expired |
| 422 | Password does not meet strength requirements |
