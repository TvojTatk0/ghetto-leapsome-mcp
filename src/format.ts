import type {
  CheckinListItem,
  CheckinDetail,
  CheckinTemplate,
  ReviewTodoItem,
  ReviewDetail,
  ReviewAnswer,
  ReviewQuestion,
  ReviewParticipantProgress,
  FeedbackItem,
  UserSearchResult,
  DirectTeamMember,
  GoalItem,
  PastCheckin,
} from './leapsome-client.js';

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value || 'unknown';
  return d.toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

function formatPct(value: number): string {
  const pct = value > 1 ? Math.round(value) : Math.round(value * 100);
  return `${pct}%`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatCheckinList(checkins: CheckinListItem[]): string {
  if (checkins.length === 0) return 'No open meetings found.';

  const groups = {
    today: [] as string[],
    later: [] as string[],
    past: [] as string[],
  };

  for (const c of checkins) {
    const when = c.gCalEvent
      ? new Date(c.gCalEvent.start.dateTime).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : new Date(c.cycle.nextTime).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

    const line = `- **${c.title}** [${c.status}] (id: ${c._id})\n  ${when} | ${c.cycle.duration}min ${c.cycle.frequency} | with: ${c.participantNames || 'just you'}`;
    (groups[c.relativeTime] ?? groups.past).push(line);
  }

  const sections: string[] = [];
  if (groups.today.length)
    sections.push(`### Today\n${groups.today.join('\n')}`);
  if (groups.later.length)
    sections.push(`### Upcoming\n${groups.later.join('\n')}`);
  if (groups.past.length)
    sections.push(`### Past (still open)\n${groups.past.join('\n')}`);

  return sections.join('\n\n');
}

export function formatCheckinDetail(d: CheckinDetail): string {
  const lines: string[] = [];

  const participantList = d.participants
    .map((p) => `${p.displayedName} (${p.teamRole.title})`)
    .join(', ');

  lines.push(`# ${d.title}`);
  lines.push(
    `Status: ${d.status} | Next: ${d.cycle.nextTime} | ${d.cycle.duration}min ${d.cycle.frequency}`,
  );
  lines.push(`Participants: ${participantList}`);
  if (d.groupToken) {
    lines.push(`groupToken: ${d.groupToken} (use with get-past-meetings)`);
  }
  lines.push('');

  for (const section of d.sections) {
    if (section._id === 'actionItems') continue;
    if (section.items.length === 0) continue;
    lines.push(`## ${section.name}`);
    for (const item of section.items) {
      const owner = item.owners.map((o) => o.displayedName).join(', ');
      const content = stripHtml(item.content);
      lines.push(`- [${owner}] ${content}`);
    }
    lines.push('');
  }

  const actionItemSection = d.sections.find((s) => s._id === 'actionItems');
  if (actionItemSection && actionItemSection.items.length > 0) {
    lines.push('## Action Items');
    for (const item of actionItemSection.items) {
      const owner = item.owners.map((o) => o.displayedName).join(', ');
      const status = item.status === 'open' ? '[ ]' : '[x]';
      lines.push(`- ${status} [${owner}] ${stripHtml(item.content)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatTemplates(templates: CheckinTemplate[]): string {
  return templates
    .map((t) => {
      const questions = t.sections.map((s) => `  - ${s.name}`).join('\n');
      return `### ${t.title} (id: ${t._id})\n${questions}`;
    })
    .join('\n\n');
}

export function formatReviewTodos(todos: ReviewTodoItem[]): string {
  if (todos.length === 0) return 'No pending reviews.';

  const groups: Record<string, string[]> = {
    myReviews: [],
    directReports: [],
    otherColleagues: [],
  };

  for (const t of todos) {
    const next = t.nextAssessmentStep;
    const deadline = next?.date ? formatDate(next.date) : 'no deadline';
    const step = next ? `${next.type} (${next.status})` : 'none';
    const line = `- **${t.reviewee.displayedName}** — ${t.reviewCycle.name}\n  Next step: ${step} | Due: ${deadline} | cycleId: ${t.reviewCycle._id} | revieweeId: ${t.reviewee._id}`;
    (groups[t.type] ?? groups.myReviews).push(line);
  }

  const labels: Record<string, string> = {
    myReviews: 'My Reviews',
    directReports: 'Direct Reports',
    otherColleagues: 'Other Colleagues',
  };

  const sections: string[] = [];
  for (const [key, items] of Object.entries(groups)) {
    if (items.length > 0) {
      sections.push(`### ${labels[key]}\n${items.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

interface AnsweringContributor {
  role: string;
  name: string;
  status: string;
  answers: Record<string, ReviewAnswer>;
}

function collectContributors(detail: ReviewDetail): AnsweringContributor[] {
  const seen = new Set<string>();
  const out: AnsweringContributor[] = [];

  const add = (
    role: string,
    status: string,
    user: { _id?: string; displayedName?: string } | undefined,
    answers: Record<string, ReviewAnswer> | undefined,
  ) => {
    if (!answers || Object.keys(answers).length === 0) return;
    const key = `${role}:${user?._id ?? user?.displayedName ?? role}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      role,
      status,
      name: user?.displayedName ?? role,
      answers,
    });
  };

  for (const c of detail.contributors?.all ?? []) {
    add(c.role, c.status, c.user, c.answers);
  }

  const cd = detail.contributorDetails;
  if (cd?.answers && Object.keys(cd.answers).length > 0) {
    const selfUser =
      cd.role === 'manager'
        ? detail.managerUser
        : cd.role === 'reviewee'
          ? detail.revieweeUser
          : undefined;
    add(cd.role, cd.status, selfUser, cd.answers);
  }

  return out;
}

function formatAnswer(answer: ReviewAnswer, q: ReviewQuestion): string[] {
  const parts: string[] = [];

  if (
    typeof answer.amount === 'number' &&
    q.ratingRequirement !== 'hidden' &&
    q.scale?.length
  ) {
    const match = q.scale.find((s) => s.value === answer.amount);
    parts.push(
      `Rating: ${answer.amount}${match ? ` — ${match.label}` : ''}`,
    );
  }

  if (answer.answers?.length && q.multipleChoiceOptions?.length) {
    const titles = answer.answers.map(
      (id) =>
        q.multipleChoiceOptions?.find((o) => o._id === id)?.title ?? id,
    );
    parts.push(`Selected: ${titles.join(', ')}`);
  }

  if (answer.content) {
    const text = stripHtml(answer.content);
    if (text) parts.push(text);
  }

  return parts;
}

export function formatReviewForm(detail: ReviewDetail): string {
  const lines: string[] = [];
  const contributors = collectContributors(detail);

  lines.push(`# ${detail.name}`);
  lines.push(
    `Reviewee: **${detail.revieweeUser.displayedName}** (${detail.revieweeUser.teamRole.title})`,
  );
  lines.push(`Manager: **${detail.managerUser.displayedName}**`);
  lines.push(
    `Status: ${detail.status.globalStatus} | Your role: ${detail.contributorDetails.role} (${detail.contributorDetails.status})`,
  );
  if (contributors.length > 0) {
    const labels = contributors
      .map((c) => `${c.name} [${c.role}, ${c.status}]`)
      .join(', ');
    lines.push(`Contributors with submitted answers: ${labels}`);
  }
  lines.push('');

  for (const q of detail.questions.skills) {
    if (q.type === 'reviewSection') {
      lines.push(`## ${q.name}`);
      if (q.description) {
        lines.push(stripHtml(q.description));
      }
      lines.push('');
      continue;
    }

    lines.push(`### ${q.name}`);
    if (q.description) {
      lines.push(stripHtml(q.description));
    }

    const reqs: string[] = [];
    if (q.ratingRequirement !== 'hidden')
      reqs.push(`rating: ${q.ratingRequirement}`);
    if (q.commentRequirement !== 'hidden')
      reqs.push(`comment: ${q.commentRequirement}`);
    if (reqs.length) lines.push(`Requirements: ${reqs.join(', ')}`);

    if (q.answerType === 'multipleChoice' && q.multipleChoiceOptions?.length) {
      lines.push('Options:');
      for (const opt of q.multipleChoiceOptions) {
        lines.push(`  - ${opt.title}`);
      }
    } else if (q.scale?.length) {
      const scaleLabels = q.scale
        .map((s) => `${s.value}: ${s.label}`)
        .join(' | ');
      lines.push(`Scale: ${scaleLabels}`);
    }

    lines.push(`(id: ${q._id})`);

    const answered = contributors
      .map((c) => ({ c, a: c.answers[q._id] }))
      .filter((x): x is { c: AnsweringContributor; a: ReviewAnswer } => !!x.a);

    if (answered.length > 0) {
      lines.push('');
      lines.push('#### Submitted answers');
      for (const { c, a } of answered) {
        lines.push(`**${c.name}** [${c.role}]`);
        const parts = formatAnswer(a, q);
        if (parts.length === 0) {
          lines.push('(no content)');
        } else {
          for (const p of parts) lines.push(p);
        }
        lines.push('');
      }
    } else {
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function formatReviewHistory(
  progress: ReviewParticipantProgress,
): string {
  const participants = progress.participantProgress;
  if (participants.length === 0) return 'No review history found.';

  const lines: string[] = [];

  for (const p of participants) {
    lines.push(`# ${p.user.displayedName} (${p.user.teamRole.title})`);

    if (p.instances.length === 0) {
      lines.push('No review cycles.');
      continue;
    }

    for (const inst of p.instances) {
      const date = formatDate(inst.date);
      const status = inst.inProgress ? 'In Progress' : 'Completed';
      lines.push(
        `## ${inst.name}\n${date} | ${status} | Progress: ${formatPct(inst.progress ?? 0)} | cycleId: ${inst._id}`,
      );

      if (inst.contributors.length > 0) {
        lines.push('Contributors:');
        for (const c of inst.contributors) {
          const modified = c.lastModified?.time
            ? ` | last modified: ${formatDate(c.lastModified.time)}`
            : '';
          lines.push(
            `  - ${c.user.displayedName} — ${c.role} (${c.status})${modified}`,
          );
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function formatFeedback(items: FeedbackItem[]): string {
  if (items.length === 0) return 'No feedback found.';

  return items
    .map((f) => {
      const date = formatDate(f.date);
      const receivers = f.thanksNoteReceivers
        .map((r) => r.displayedName)
        .join(', ');
      const badge = f.badge ? ` [${f.badge.name}]` : '';
      const label = f.type === 'thanks-note' ? 'Praise' : 'Feedback';
      const content = stripHtml(f.content);

      return `### ${label} from ${f.sender.displayedName} to ${receivers}${badge}\n${date} | ${f.visibility} | ${f.likes} likes\n${content}`;
    })
    .join('\n\n');
}

export function formatUserSearch(results: UserSearchResult[]): string {
  if (results.length === 0) return 'No users found.';
  return results
    .map((r) => `- ${r.name} (${r.title}) — id: ${r.id}`)
    .join('\n');
}

export function formatDirectTeam(members: DirectTeamMember[]): string {
  if (members.length === 0) return 'No direct team members found.';
  return members
    .map(
      (m) =>
        `- **${m.displayedName}** — ${m.title} | Level: ${m.level} | ${m.username}`,
    )
    .join('\n');
}

export function formatGoals(goals: GoalItem[]): string {
  if (goals.length === 0) return 'No goals found.';
  return goals
    .map((g) => {
      const krs = g.keyResults?.length
        ? g.keyResults
            .map((kr) => `  - ${kr.name} (${formatPct(kr.progress ?? 0)})`)
            .join('\n')
        : '  (no key results)';
      const cycle = g.cycle?.name ? ` | Cycle: ${g.cycle.name}` : '';
      return `### ${g.name}\nState: ${g.state} | Progress: ${formatPct(g.progress ?? 0)}${cycle}\nOwner: ${g.owner?.displayedName ?? 'unknown'}\nKey Results:\n${krs}`;
    })
    .join('\n\n');
}

export function formatPastCheckins(checkins: PastCheckin[]): string {
  if (checkins.length === 0) return 'No past meetings found.';
  return checkins
    .map((c) => {
      const date = formatDate(c.cycle.nextTime);
      return `- ${date} — ${c.title} [${c.status}] (id: ${c._id})`;
    })
    .join('\n');
}
