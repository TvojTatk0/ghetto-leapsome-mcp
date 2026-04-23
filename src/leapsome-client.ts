const BASE_URL = "https://www.leapsome.com/api";

interface LeapsomeAuth {
  token: string;
  userId: string;
  tenantId: string;
}

export interface CheckinListItem {
  _id: string;
  status: "open" | "complete" | "sent";
  title: string;
  cycle: {
    nextTime: string;
    duration: string;
    frequency: string;
    state: string;
  };
  participants: { _id: string; displayedName: string; username: string }[];
  otherUsers: { _id: string; displayedName: string; username: string }[];
  participantNames: string;
  relativeTime: "past" | "today" | "later";
  isPrevious: boolean;
  gCalEvent: {
    start: { dateTime: string };
    end: { dateTime: string };
    location?: string;
    conferenceData?: { uri: string };
  } | null;
}

export interface CheckinDetail {
  _id: string;
  title: string;
  status: string;
  cycle: { nextTime: string; duration: string; frequency: string };
  participants: {
    _id: string;
    displayedName: string;
    username: string;
    teamRole: { title: string; reportsTo: string };
  }[];
  agendaQuestions: { _id: string; name: string }[];
  sections: {
    _id: string;
    name: string;
    items: {
      _id: string;
      content: string;
      creator: string;
      owners: { _id: string; displayedName: string }[];
      status: string;
      created_at: string;
      updated_at: string;
    }[];
  }[];
  actionItems: {
    _id: string;
    content: string;
    creator: string;
    owners: { _id: string; displayedName: string }[];
    status: string;
    skill: string;
    created_at: string;
  }[];
  notes: Record<string, string>;
  privateNotes: Record<string, { copy: boolean; content: string }>;
  groupToken: string;
  currentUser: string;
}

export interface CheckinTemplate {
  _id: string;
  title: string;
  sections: { _id: string; name: string }[];
}

function parseJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

export function createAuth(token: string): LeapsomeAuth {
  const payload = parseJwt(token);
  const userId = payload._id as string;
  const tenantId = (payload.teamRole as { team: string }).team;
  return { token, userId, tenantId };
}

export interface ReviewTodoItem {
  _id: string;
  reviewee: { _id: string; displayedName: string; firstname: string; lastname: string };
  reviewCycle: { name: string; _id: string };
  timeline: {
    type: string;
    status: string;
    date: string;
    isTaskForYou: boolean;
    unlocked: boolean;
    role: string;
  }[];
  type: "myReviews" | "directReports" | "otherColleagues";
  nextAssessmentStep: {
    type: string;
    status: string;
    date: string;
    isTaskForYou: boolean;
    unlocked: boolean;
    role: string;
  } | null;
}

export interface ReviewQuestion {
  _id: string;
  name: string;
  type: "reviewSection" | "review";
  description: string;
  commentRequirement: "required" | "optional" | "hidden";
  ratingRequirement: "required" | "optional" | "hidden";
  scale: { label: string; value: number }[];
  multipleChoiceOptions?: { _id: string; title: string }[];
  answerType: string | null;
}

export interface ReviewAnswer {
  _id?: string;
  amount?: number;
  content?: string;
  answers?: string[];
}

export interface ReviewContributorAnswers {
  role: string;
  status: string;
  user?: { _id: string; displayedName: string };
  answers?: Record<string, ReviewAnswer>;
}

export interface ReviewDetail {
  _id: string;
  name: string;
  revieweeUser: { _id: string; displayedName: string; teamRole: { title: string } };
  managerUser: { _id: string; displayedName: string };
  questions: { skills: ReviewQuestion[] };
  contributors?: { all?: ReviewContributorAnswers[] };
  contributorDetails: {
    status: string;
    role: string;
    answers?: Record<string, ReviewAnswer>;
  };
  availableSkills: { localTeam: { name: string; _id: string }[] };
  status: {
    globalStatus: string;
    startPlan: string;
    managerReviewsPlan: string;
    conversationsPlan: string;
  };
}

export interface ReviewContributor {
  role: string;
  status: string;
  user: { _id: string; displayedName: string };
  lastModified?: { time: string; by?: { displayedName?: string }; status?: string };
  signature?: unknown;
}

export interface ReviewInstance {
  _id: string;
  name: string;
  inProgress: boolean;
  date: string;
  progress: number;
  contributors: ReviewContributor[];
}

export interface FeedbackItem {
  _id: string;
  visibility: string;
  time: string;
  type: "thanks-note" | "structured";
  content: string;
  sender: { _id: string; displayedName: string };
  receiver: { _id: string; displayedName: string } | null;
  thanksNoteReceivers: { _id: string; displayedName: string }[];
  badge?: { name: string };
  likes: number;
  date: string;
}

export interface ReviewParticipantProgress {
  participantProgress: {
    user: { _id: string; displayedName: string; teamRole: { title: string } };
    instances: ReviewInstance[];
  }[];
}

export interface GoalItem {
  _id: string;
  name: string;
  state: string;
  progress: number;
  owner: { _id: string; displayedName: string };
  keyResults: { _id: string; name: string; progress: number; metric?: string }[];
  cycle?: { name: string };
  dueDate?: string;
}

export interface PastCheckin {
  _id: string;
  title: string;
  status: string;
  cycle: { nextTime: string };
}

export interface UserSearchResult {
  id: string;
  name: string;
  title: string;
}

export interface DirectTeamMember {
  _id: string;
  displayedName: string;
  title: string;
  level: string;
  username: string;
}

export class LeapsomeClient {
  private auth: LeapsomeAuth;

  constructor(auth: LeapsomeAuth) {
    this.auth = auth;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.auth.token}`,
      "x-leapsome-user-id": this.auth.userId,
      "x-leapsome-tenant-id": this.auth.tenantId,
      "Content-Type": "application/json",
    };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(
        `Leapsome API error: ${res.status} ${res.statusText} - ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `Leapsome API error: ${res.status} ${res.statusText} - ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  }

  async getOpenCheckins(): Promise<CheckinListItem[]> {
    return this.get<CheckinListItem[]>("/checkins/get/list/open");
  }

  async getCheckinDetails(checkinId: string): Promise<CheckinDetail> {
    return this.get<CheckinDetail>(`/checkins/get/details/_id/${checkinId}`);
  }

  async getCheckinTemplates(): Promise<{ items: CheckinTemplate[] }> {
    return this.get<{ items: CheckinTemplate[] }>("/checkins/templates");
  }

  async getReviewTodos(): Promise<ReviewTodoItem[]> {
    return this.get<ReviewTodoItem[]>(
      "/reviewcycles/get/list/toDo/default/none/0",
    );
  }

  async getReviewDetails(
    cycleId: string,
    revieweeId: string,
    managerId: string,
    viewAs: "reviewee" | "manager" | "peer" = "reviewee",
  ): Promise<ReviewDetail> {
    return this.get<ReviewDetail>(
      `/reviewcycles/get/details/${cycleId}/reviewee/${revieweeId}/manager/${managerId}/viewAs/${viewAs}`,
    );
  }

  async getReviewDetailsAuto(
    cycleId: string,
    revieweeId: string,
    managerId: string,
  ): Promise<ReviewDetail> {
    const attempts: ("reviewee" | "manager" | "peer")[] = [
      "reviewee",
      "manager",
      "peer",
    ];
    let lastError: unknown;
    for (const viewAs of attempts) {
      try {
        const detail = await this.getReviewDetails(
          cycleId,
          revieweeId,
          managerId,
          viewAs,
        );
        if (detail?.revieweeUser && detail.managerUser) {
          return detail;
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(
      `Could not fetch review details as reviewee, manager, or peer. ` +
        `The current user may not have any role on this review, or the IDs may be wrong. ` +
        (lastError ? `Last error: ${String(lastError)}` : ""),
    );
  }

  async getFeedback(): Promise<FeedbackItem[]> {
    return this.post<FeedbackItem[]>(
      "/feedback/get/user/all/sets/all-filtered",
      {},
    );
  }

  async getFeedbackForUser(userId: string): Promise<FeedbackItem[]> {
    const all = await this.getFeedback();
    return all.filter(
      (f) =>
        f.thanksNoteReceivers.some((r) => r._id === userId) ||
        f.receiver?._id === userId,
    );
  }

  async getReviewHistory(
    userId: string,
    displayedName: string,
  ): Promise<ReviewParticipantProgress> {
    return this.post<ReviewParticipantProgress>(
      "/reviewcycles/participantprogress",
      {
        userFilter: {
          include: { users: [{ _id: userId, displayedName }] },
        },
        reviewStateFilter: "all",
        contributorStatusFilters: [],
        reviewCycleFilter: {},
        offset: 0,
      },
    );
  }

  async getGoalsForUser(userId: string): Promise<GoalItem[]> {
    const data = await this.post<GoalItem[] | { goals?: GoalItem[] } | null>(
      "/goals/list",
      {
        listCustomFilter: {
          users: [userId],
          states: ["live", "draft"],
        },
        output: "list",
      },
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.goals)) return data.goals;
    return [];
  }

  async getPastCheckins(groupToken: string): Promise<PastCheckin[]> {
    return this.get<PastCheckin[]>(
      `/checkins/get/list/groupToken/${groupToken}`,
    );
  }

  async getSkillsForUser(userId: string): Promise<unknown> {
    return this.get<unknown>(
      `/skills/get/skills/list/${userId}/show/goals`,
    );
  }

  async getSkillHistory(skillId: string, userId: string): Promise<unknown> {
    return this.get<unknown>(`/skills/history/${skillId}/${userId}`);
  }

  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const data = await this.post<
      { value: string; label: string; desc: string; type: string; link: string }[]
    >("/users/usersAndContent", { query });
    return data
      .filter((item) => item.type === "user")
      .map((item) => ({ id: item.value, name: item.label, title: item.desc }));
  }

  async getDirectTeam(): Promise<DirectTeamMember[]> {
    const data = await this.post<
      {
        _id: string;
        displayedName: string;
        username: string;
        customRole: { name: string };
        teamRole: { title: string; reportsTo: { displayedName: string } };
        workLocation: { name: string };
      }[]
    >("/users/list", {
      offset: 0,
      userFilter: { include: { admin: [{ _id: "directTeam" }] } },
    });
    return data.map((u) => ({
      _id: u._id,
      displayedName: u.displayedName,
      title: u.teamRole.title,
      level: u.customRole.name,
      username: u.username,
    }));
  }
}
