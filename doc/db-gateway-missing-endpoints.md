# DB-gateway additions required

This API (`POST /achievements/validate`) expects DB-gateway to return a clear conflict
status when a user already validated an achievement.

## Required behavior

### Existing endpoint

- `POST /achieved`

### Missing behavior to add

- Return `409 Conflict` when `(achievementId, userId)` already exists in `_Achieved`.
- Keep the existing payload shape:
  - `achievementId`
  - `userId`
  - `count`
  - `finished`
  - `labelActive`
  - `acquiredDate`

## Why this is required

`api-manager` maps DB-gateway `409` to:

```json
{
  "error": "Achievement already validated for this user"
}
```

Without this, duplicates are interpreted as generic `500` responses and the client cannot
distinguish expected business conflicts from real server failures.

## Suggested DB-gateway implementation

In DB-gateway controller/repository flow for `POST /achieved`, catch Prisma unique
constraint errors (`P2002`) and return `409`:

- `code`: `P2002`
- `http status`: `409`
- `json`: `{ "error": "already validated" }` (or equivalent conflict message)

All other errors should continue to return `500`.
