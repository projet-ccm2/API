# Achievement Validate API

Single-endpoint API used to validate achievements by callback, using Twitch token
verification to identify the user and DB-gateway to persist the validation.

## Installation and Setup

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Compile TypeScript
npm run build

# Start in production
npm start
```

## Configuration

### Environment Variables

1. Copy the example file:

```bash
cp .env.example .env
```

2. Configure your variables in `.env`.

| Variable               | Required    | Description                                                   | Default                           |
| ---------------------- | ----------- | ------------------------------------------------------------- | --------------------------------- |
| `PORT`                 | No          | HTTP server port                                              | `3000`                            |
| `NODE_ENV`             | No          | Environment mode (`development`, `integration`, `production`) | `development`                     |
| `TWITCH_CLIENT_ID`     | Recommended | Twitch app client id (sent during token validate)             | empty                             |
| `TWITCH_API_URL`       | No          | Twitch OAuth base URL                                         | `https://id.twitch.tv/oauth2`     |
| `DB_GATEWAY_BASE_URL`  | Yes         | DB-gateway base URL                                           | `http://localhost:3001`           |
| `AUTH_SERVICE_URL`     | Int/Prod    | User-management URL for VPC token flow                        | `http://localhost:3000`           |
| `JWT_SECRET`           | Int/Prod    | Secret used by VPC token architecture                         | `dev-secret-change-in-production` |
| `RATE_LIMIT_WINDOW_MS` | No          | Rate-limit window per user                                    | `60000`                           |
| `RATE_LIMIT_MAX`       | No          | Max requests in window per user                               | `30`                              |

## API Documentation (Swagger-style)

### Base URL

```text
http://localhost:3000
```

### Endpoints

#### POST /achievements/validate

Validate one achievement for a user identified by Twitch token.

**Request Body:**

```json
{
  "twitch_token": "string",
  "achievement_id": "string"
}
```

**Response 200 - Success:**

```json
{
  "success": true,
  "user_id": "12345678"
}
```

**Response 400 - Validation Error:**

```json
{
  "error": "twitch_token and achievement_id are required"
}
```

**Response 401 - Twitch Token Invalid/Expired:**

```json
{
  "error": "Invalid or expired Twitch token"
}
```

**Response 409 - Already Validated:**

```json
{
  "error": "Achievement already validated for this user"
}
```

**Response 429 - Rate Limited:**

```json
{
  "error": "Rate limit exceeded. Try again later."
}
```

**Response 500 - Internal Server Error:**

```json
{
  "error": "Internal server error"
}
```

#### GET /health

Simple health check endpoint.

**Response 200:**

```json
{
  "status": "healthy",
  "timestamp": "2026-03-31T15:20:00.000Z"
}
```

## Security

- Twitch token validation through `GET /oauth2/validate`
- Per-user rate limiting (`user_id` key)
- Basic security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)

## VPC Access (Bastion architecture)

For integration/production, keep the same double-header pattern used by
user-management:

| Environment      | `Authorization`                     | `X-VPC-Token` |
| ---------------- | ----------------------------------- | ------------- |
| Development      | Not required (or local bearer flow) | Not used      |
| Int / Production | `Bearer <gcp-identity-token>`       | `<app-jwt>`   |

In this service, api-manager acts as the bastion:

1. It calls `POST /tokens` on user-management (`AUTH_SERVICE_URL`) to get a VPC JWT.
2. In development, it calls db-gateway with `Authorization: Bearer <vpc-jwt>`.
3. In int/prod, it calls db-gateway with:
   - `Authorization: Bearer <gcp-identity-token-for-db-gateway>`
   - `X-VPC-Token: <vpc-jwt>`

## Architecture

```text
src/
├── config/
│   └── environment.ts            # Environment parsing and defaults
├── controllers/
│   └── achievementController.ts  # Request validation + Twitch + DB orchestration
├── middlewares/
│   └── rateLimitMiddleware.ts    # In-memory rate limit by user_id
├── routes/
│   └── achievementRoutes.ts      # POST /achievements/validate
├── services/
│   ├── twitchService.ts          # Twitch OAuth token validation
│   ├── vpcTokenService.ts        # user-management token retrieval + header builder
│   └── dbGatewayService.ts       # POST /achieved call + 409 mapping
├── tests/
│   ├── integ/
│   │   └── helloWorld.test.ts    # Integration smoke test (/health)
│   └── unit/
│       ├── controllers/
│       ├── middlewares/
│       └── services/
├── server.ts                     # Express app builder
└── index.ts                      # Runtime entrypoint
```

## Error Codes

| Code | Description                     |
| ---- | ------------------------------- |
| 200  | Success                         |
| 400  | Missing required body fields    |
| 401  | Invalid or expired Twitch token |
| 404  | Route not found                 |
| 409  | Achievement already validated   |
| 429  | Rate limit exceeded             |
| 500  | Internal server error           |

## Testing

```bash
# All tests + coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```
