import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAuth, LeapsomeClient } from "./leapsome-client.js";
import {
  formatCheckinList,
  formatCheckinDetail,
  formatTemplates,
  formatReviewTodos,
  formatReviewForm,
  formatReviewHistory,
  formatFeedback,
  formatUserSearch,
  formatDirectTeam,
  formatGoals,
  formatPastCheckins,
} from "./format.js";

const token = process.env.LEAPSOME_TOKEN;
if (!token) {
  console.error("LEAPSOME_TOKEN environment variable is required");
  process.exit(1);
}

const auth = createAuth(token);
const client = new LeapsomeClient(auth);

const server = new McpServer({
  name: "ghetto-leapsome",
  version: "0.1.0",
});

server.registerTool("list-open-meetings", {
  description: "List all open/upcoming 1:1 meetings (checkins) in Leapsome, grouped by today/upcoming/past",
}, async () => {
  const checkins = await client.getOpenCheckins();
  return { content: [{ type: "text", text: formatCheckinList(checkins) }] };
});

server.registerTool("get-meeting-details", {
  description: "Get full details of a specific meeting (checkin) including all talking points organized by agenda sections, action items, and participant info. Use the meeting ID from list-open-meetings.",
  inputSchema: { meetingId: z.string().describe("The meeting/checkin ID") },
}, async ({ meetingId }) => {
  const detail = await client.getCheckinDetails(meetingId);
  return { content: [{ type: "text", text: formatCheckinDetail(detail) }] };
});

server.registerTool("list-meeting-templates", {
  description: "List available meeting templates with their agenda questions",
}, async () => {
  const { items } = await client.getCheckinTemplates();
  return { content: [{ type: "text", text: formatTemplates(items) }] };
});

server.registerTool("list-pending-reviews", {
  description: "List all pending review tasks grouped by type (my reviews, direct reports, other colleagues). Shows reviewee name, cycle name, next step, and deadline.",
}, async () => {
  const todos = await client.getReviewTodos();
  return { content: [{ type: "text", text: formatReviewTodos(todos) }] };
});

server.registerTool("get-review-form", {
  description: "Get the review form for a specific review cycle and reviewee, including all questions with their requirements, scales, and multiple choice options. Use list-pending-reviews first to get the IDs. Automatically tries reviewee/manager/peer perspectives based on the current user's role.",
  inputSchema: {
    cycleId: z.string().describe("The review cycle ID"),
    revieweeId: z.string().describe("The reviewee's user ID"),
    managerId: z.string().optional().describe("The manager/reviewer user ID. Defaults to the current user."),
    viewAs: z.enum(["reviewee", "manager", "peer"]).optional().describe("Force a specific perspective. If omitted, tries reviewee/manager/peer in order."),
  },
}, async ({ cycleId, revieweeId, managerId, viewAs }) => {
  const effectiveManagerId = managerId ?? auth.userId;
  const detail = viewAs
    ? await client.getReviewDetails(cycleId, revieweeId, effectiveManagerId, viewAs)
    : await client.getReviewDetailsAuto(cycleId, revieweeId, effectiveManagerId);
  return { content: [{ type: "text", text: formatReviewForm(detail) }] };
});

server.registerTool("get-review-history", {
  description: "Get the review history for a specific user, showing past and current review cycles with progress and contributor statuses.",
  inputSchema: {
    userId: z.string().describe("The user ID to get review history for"),
    displayedName: z.string().describe("The user's display name"),
  },
}, async ({ userId, displayedName }) => {
  const progress = await client.getReviewHistory(userId, displayedName);
  return { content: [{ type: "text", text: formatReviewHistory(progress) }] };
});

server.registerTool("get-feedback-for-user", {
  description: "Get all praise and structured feedback received by a specific user. Useful context for writing reviews.",
  inputSchema: {
    userId: z.string().describe("The user ID to get feedback for"),
  },
}, async ({ userId }) => {
  const items = await client.getFeedbackForUser(userId);
  return { content: [{ type: "text", text: formatFeedback(items) }] };
});

server.registerTool("search-users", {
  description: "Search for users by name. Returns matching user names, titles, and IDs. Useful for finding user IDs needed by other tools.",
  inputSchema: {
    query: z.string().describe("Search term (name or partial name)"),
  },
}, async ({ query }) => {
  const results = await client.searchUsers(query);
  return { content: [{ type: "text", text: formatUserSearch(results) }] };
});

server.registerTool("list-direct-team", {
  description: "List your direct team members with their title, level, and email.",
}, async () => {
  const members = await client.getDirectTeam();
  return { content: [{ type: "text", text: formatDirectTeam(members) }] };
});

server.registerTool("get-goals-for-user", {
  description: "Get active goals/OKRs for a specific user. Shows goal name, progress, key results, and cycle. Useful context for reviews.",
  inputSchema: {
    userId: z.string().describe("The user ID to get goals for"),
  },
}, async ({ userId }) => {
  const goals = await client.getGoalsForUser(userId);
  return { content: [{ type: "text", text: formatGoals(goals) }] };
});

server.registerTool("get-past-meetings", {
  description: "Get all past meetings in a recurring 1:1 series using the groupToken from a meeting detail. Returns the history of meetings with dates and IDs so you can fetch details for any past instance.",
  inputSchema: {
    groupToken: z.string().describe("The groupToken from a meeting detail (get-meeting-details returns this)"),
  },
}, async ({ groupToken }) => {
  const checkins = await client.getPastCheckins(groupToken);
  return { content: [{ type: "text", text: formatPastCheckins(checkins) }] };
});

server.registerTool("list-skills-for-user", {
  description: "List the career framework skills/capabilities for a user. Returns the full list of capabilities relevant to their specialization, with level descriptions and 'not there yet' indicators. Use this to understand what current and next level look like for a person when writing reviews or planning growth.",
  inputSchema: {
    userId: z.string().optional().describe("The user ID. Defaults to the current user."),
  },
}, async ({ userId }) => {
  const data = await client.getSkillsForUser(userId ?? auth.userId);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.registerTool("get-skill-history", {
  description: "Get the rating history for a specific skill/capability for a user across review cycles. Skill IDs come from get-review-form (capability question IDs) or list-skills-for-user. Useful for seeing how someone has been rated on a capability over time.",
  inputSchema: {
    skillId: z.string().describe("The skill/capability ID (e.g. from get-review-form question IDs or list-skills-for-user)"),
    userId: z.string().optional().describe("The user ID. Defaults to the current user."),
  },
}, async ({ skillId, userId }) => {
  const data = await client.getSkillHistory(skillId, userId ?? auth.userId);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
