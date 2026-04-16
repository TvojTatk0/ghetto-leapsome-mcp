import 'dotenv/config';
import { createAuth, LeapsomeClient } from './leapsome-client.js';

const token = process.env.LEAPSOME_TOKEN;
if (!token) {
  console.error('LEAPSOME_TOKEN is required');
  process.exit(1);
}

const auth = createAuth(token);
const client = new LeapsomeClient(auth);

const [, , command, ...args] = process.argv;

const commands: Record<string, () => Promise<unknown>> = {
  list: () => client.getOpenCheckins(),
  detail: () => client.getCheckinDetails(args[0]),
  templates: () => client.getCheckinTemplates(),
  reviews: () => client.getReviewTodos(),
  'review-form': () =>
    client.getReviewDetails(args[0], args[1], args[2] ?? auth.userId),
  'review-history': () =>
    client.getReviewHistory(args[0], args.slice(1).join(' ')),
  feedback: () => client.getFeedbackForUser(args[0] ?? auth.userId),
  'feedback-all': () => client.getFeedback(),
  search: () => client.searchUsers(args.join(' ')),
  team: () => client.getDirectTeam(),
  goals: () => client.getGoalsForUser(args[0] ?? auth.userId),
  'past-meetings': () => client.getPastCheckins(args[0]),
};

if (!command || !commands[command]) {
  console.log('Usage: debug <command> [args]');
  console.log(
    '  list                                        - list open meetings',
  );
  console.log(
    '  detail <id>                                 - get meeting details',
  );
  console.log('  templates                                   - list templates');
  console.log(
    '  reviews                                     - list pending reviews',
  );
  console.log(
    '  review-form <cycleId> <revieweeId> [managerId] - get review form',
  );
  console.log(
    '  review-history <userId> <displayedName>     - get review history',
  );
  console.log(
    '  feedback [userId]                           - get feedback for user (defaults to you)',
  );
  console.log(
    '  feedback-all                               - get all company feedback',
  );
  console.log(
    '  search <query>                              - search users by name',
  );
  console.log(
    '  team                                        - list direct team members',
  );
  console.log(
    '  goals [userId]                              - get goals for user (defaults to you)',
  );
  console.log(
    '  past-meetings <groupToken>                  - get past meetings in a 1:1 series',
  );
  process.exit(0);
}

const data = await commands[command]();
console.log(JSON.stringify(data, null, 2));
