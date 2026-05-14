export type TeamSummary = {
    id: number;
    name: string;
    role: 'owner' | 'member';
    users_count: number;
    planning_sessions_count: number;
};

export type SessionSummary = {
    id: number;
    name: string;
    status: 'setup' | 'active' | 'completed';
    team: string;
    facilitator: string | null;
    current_story: string | null;
    stories_count: number | null;
    updated_at: string | null;
};

export type LatestEstimate = {
    id: number;
    key: string | null;
    title: string;
    estimate: string;
    session: {
        id: number;
        name: string;
        team: string;
    };
};

export type DashboardStats = {
    teams: number;
    active_sessions: number;
    total_stories: number;
    estimated_stories: number;
    completion_percentage: number;
};

export type StorySummary = {
    id: number;
    key: string | null;
    title: string;
    position: number;
    status: 'pending' | 'estimated';
    final_estimate: string | null;
};

export type PlanningPlayer = {
    id: number;
    name: string;
    role: 'owner' | 'member';
    is_facilitator: boolean;
    has_voted: boolean;
    vote: string | null;
};

export type CurrentRound = {
    id: number;
    story_id: number;
    status: 'intro' | 'voting' | 'revealed' | 'accepted';
    suggested_estimate: string | null;
    distribution: Record<string, number>;
    votes: {
        user_id: number;
        has_voted: boolean;
        value: string | null;
        label: string | null;
    }[];
};

export type PlanningSessionDetail = {
    id: number;
    name: string;
    status: 'setup' | 'active' | 'completed';
    team: {
        id: number;
        name: string;
    };
    facilitator: {
        id: number | null;
        name: string | null;
    };
    current_story_id: number | null;
    stories: StorySummary[];
    players: PlanningPlayer[];
    current_round: CurrentRound | null;
    stats: {
        total_stories: number;
        estimated_stories: number;
    };
    can: {
        facilitate: boolean;
    };
    vote_values: string[];
};

export type StoryInput = {
    key: string | null;
    title: string;
};
