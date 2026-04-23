<p align="center">
  <img src="./logo.png" alt="ghetto-leapsome-mcp" width="300">
</p>

# ghetto-leapsome-mcp

Because your company bought a fancy HR platform but forgot to give you API access.

This is an MCP server for [Leapsome](https://www.leapsome.com) that uses the internal web app API -- the same endpoints your browser hits when you click around the UI. Reverse-engineered from DevTools like civilized adults who just want to automate their quarterly reviews before the deadline hits.

## Why does this exist?

Leapsome has an official API. It requires admin-generated secrets. You are not an admin. You asked IT. IT said they'd "look into it." That was three quarters ago.

So here we are. Scraping your own data from a platform you pay for, using a Bearer token you manually copy from your browser every few hours. The future is now.

## What it does

Connects Claude to your Leapsome data so you can pull context for writing performance reviews without 47 browser tabs open.

| Category | Tool | What it fetches |
|----------|------|-----------------|
| Users | `search-users` | Find anyone by name |
| Users | `list-direct-team` | Your people, their levels, titles |
| Meetings | `list-open-meetings` | All your checkins |
| Meetings | `get-meeting-details` | The actual 1:1 notes you forgot you wrote |
| Meetings | `get-past-meetings` | Full history of a recurring 1:1 series |
| Meetings | `list-meeting-templates` | Meeting templates |
| Reviews | `list-pending-reviews` | The reviews haunting your to-do list |
| Reviews | `get-review-form` | Questions, rating scales, the whole form |
| Reviews | `get-review-history` | Past review cycles for trajectory context |
| Feedback | `get-feedback-for-user` | Praise and structured feedback they received |
| Goals | `get-goals-for-user` | OKRs and how they're tracking |
| Career | `list-skills-for-user` | Full career framework for their specialization (all capabilities, level descriptions, which level they're currently at via a `highlighted` flag) |
| Career | `get-skill-history` | Full history of manager + self feedback on one capability across all past cycles, plus the rating timeline |

Read-only. Can't submit reviews, send feedback, or do anything destructive. Just reads.

## Setup

### Step 1: Steal your own token

1. Open [Leapsome](https://www.leapsome.com) and log in
2. Open DevTools (`F12` / `Cmd+Shift+I`)
3. Go to **Network** tab
4. Click any request to `www.leapsome.com/api/...`
5. Find the `Authorization` header. Copy everything after `Bearer `

That's your JWT. It expires in a few hours because apparently session management peaked in 2003.

### Step 2: Build the Docker image

```bash
docker build -t ghetto-leapsome-mcp .
```

### Step 3: Register with Claude Code

```bash
claude mcp add --scope project leapsome -- \
  docker run -i --rm -e "LEAPSOME_TOKEN=<your-token>" ghetto-leapsome-mcp
```

### Step 4: Restart Claude Code

New session picks up the MCP. You now have superpowers (that expire in 3 hours).

### When the token expires

You'll see 401 errors. Go steal a fresh token and re-register:

```bash
claude mcp remove leapsome
claude mcp add --scope project leapsome -- \
  docker run -i --rm -e "LEAPSOME_TOKEN=<fresh-token>" ghetto-leapsome-mcp
```

Yes, every time. No, we can't automate it without admin access. See paragraph two.

## The review workflow

The whole point of this thing. When review season arrives and you need to write thoughtful, evidence-based reviews for 6 people by Friday:

1. `list-direct-team` -- remember who reports to you
2. `list-pending-reviews` -- see what's due
3. `get-review-form` -- see what questions you need to answer
4. `list-skills-for-user` -- framework context: current level, next level, expectations per capability
5. `get-skill-history` -- per-capability feedback timeline across past cycles (useful when you need to show growth on a specific skill)
6. `get-past-meetings` + `get-meeting-details` -- pull 3 months of 1:1 notes
7. `get-feedback-for-user` -- see what praise they got from peers
8. `get-review-history` -- check last quarter's review for continuity
9. `get-goals-for-user` -- see if they hit their OKRs

Hand all of that to Claude and ask it to draft the review. Edit for accuracy and your voice. Submit. Repeat for the next 5 people. Go home at a reasonable hour for once.

## Development

### Local setup

```bash
pnpm install
cp .env.example .env
# Paste your token in .env
pnpm build
```

### Debug CLI

For testing API calls without the MCP ceremony:

```bash
pnpm debug team                                         # your direct reports
pnpm debug reviews                                      # pending reviews
pnpm debug detail <meetingId>                           # meeting notes
pnpm debug past-meetings <groupToken>                   # meeting history
pnpm debug review-form <cycleId> <revieweeId>           # review questions
pnpm debug review-history <userId> <displayedName>      # past reviews
pnpm debug feedback <userId>                            # feedback received
pnpm debug goals <userId>                               # OKRs
pnpm debug search <query>                               # find users
pnpm debug list                                         # open meetings
pnpm debug templates                                    # meeting templates
pnpm debug skills [userId]                              # career framework for user
pnpm debug skill-history <skillId> [userId]             # per-capability feedback timeline
```

### Rebuild after changes

```bash
pnpm build                           # TypeScript
docker build -t ghetto-leapsome-mcp . # Docker image
```

## Security

- Your token is your Leapsome session. Treat it like a password. Don't commit it.
- `.env` and `.mcp.json` are gitignored. If you override this and leak your token, that's on you.
- Tokens expire in a few hours. This is annoying but also means a leaked token has a short shelf life.
- This MCP only reads data. It cannot modify, submit, or delete anything.

## Contributing

PRs welcome. If you reverse-engineer more endpoints, even better. The HAR file in `.claude/` (gitignored) has examples of request/response shapes.

If you somehow get admin API access, please build a proper version and put this thing out of its misery.
