# ghetto-leapsome-mcp

Lightweight MCP server for Leapsome. Uses internal web app API, not the official admin API.

## Architecture

- TypeScript MCP server using `@modelcontextprotocol/sdk`
- Runs as stdio transport
- Auth: Bearer token from Leapsome web app (not admin API)

## Leapsome API

Two API surfaces exist:

### Public API (admin-only, NOT used)
- Base: `https://api.leapsome.com/v1`
- Requires admin-generated API secret
- Swagger UI: https://api.leapsome.com/v1/api-docs/

### Internal Web App API (what we use)
- Base: `https://www.leapsome.com/api`
- Auth requires 3 headers on every request:
  - `Authorization: Bearer {jwt_token}`
  - `x-leapsome-user-id: {user_id}` (from JWT `_id` field)
  - `x-leapsome-tenant-id: {team_id}` (from JWT `teamRole.team` field)
- Token refresh: `POST /users/update/token` with refresh token cookie
- Endpoints use both GET and POST with JSON bodies
- Reference project: https://github.com/yannick-cw/leapfrog

### Known Checkins (Meetings) Endpoints
- `GET /checkins/get/list/open` — list open/upcoming meetings
- `GET /checkins/get/details/_id/{checkinId}` — get meeting detail by ID
- `GET /checkins/get/list/groupToken/{groupToken}` — get all past meetings in a recurring 1:1 series
- `GET /checkins/templates` — get meeting templates

### Known Goals Endpoints
- `POST /goals/list` — get goals for a user. Body: `{"listCustomFilter":{"users":["userId"],"states":["live","draft"]},"output":"list"}`

### Known Review Cycle Endpoints
- `GET /reviewcycles/get/list/toDo/default/none/0` — list pending review tasks
- `GET /reviewcycles/get/details/{cycleId}/reviewee/{revieweeId}/manager/{managerId}/viewAs/manager` — get review form with questions
- `POST /reviewcycles/participantprogress` — get review history for a user (POST body includes userFilter with user ID and displayedName)

### Known Feedback Endpoints
- `POST /feedback/get/user/all/sets/all-filtered` — list all company feedback (praise, instant feedback, private notes). Returns full feed, filter client-side by `thanksNoteReceivers[]._id` or `receiver._id` to get feedback for a specific person.

### Known User Endpoints
- `POST /users/usersAndContent` — search users/content by name. Body: `{"query":"search term"}`. Response `data[]` items have `{ value, label, desc, type, link }`. Filter by `type === "user"` to get only users. `value` = user ID, `label` = name, `desc` = title.
- `POST /users/list` — list users with filters. Body includes `offset` and `userFilter`. Use `{"include":{"admin":[{"_id":"directTeam"}]}}` to get direct team members. Response `data[]` items include `_id`, `displayedName`, `username`, `customRole.name` (level), `teamRole.title`, `teamRole.reportsTo.displayedName`, `workLocation.name`.

## Stack

- Runtime: Node.js
- Language: TypeScript
- Package manager: pnpm
