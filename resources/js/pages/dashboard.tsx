import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    PlusCircle,
    Radio,
    Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import {
    create as createSession,
    show as showSession,
} from '@/actions/App/Http/Controllers/PlanningSessionController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';
import type {
    DashboardStats,
    LatestEstimate,
    SessionSummary,
    TeamSummary,
} from '@/types';

type DashboardProps = {
    teams: TeamSummary[];
    activeSessions: SessionSummary[];
    recentSessions: SessionSummary[];
    stats: DashboardStats;
    latestEstimates: LatestEstimate[];
};

export default function Dashboard({
    teams,
    activeSessions,
    recentSessions,
    stats,
    latestEstimates,
}: DashboardProps) {
    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6">
                <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end">
                    <div className="max-w-2xl">
                        <Badge variant="outline" className="gap-2">
                            <span className="size-2 rounded-full bg-emerald-500" />
                            Realtime planning poker
                        </Badge>
                        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                            Teamdashboard
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Werk vanuit teams, start rondes en houd estimates
                            per sessie bij.
                        </p>
                    </div>

                    <Button asChild>
                        <Link href={createSession()}>
                            Nieuwe sessie
                            <PlusCircle className="size-4" />
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    <MetricCard
                        label="Teams"
                        value={String(stats.teams)}
                        detail={`${teamMemberCount(teams)} teamleden`}
                        icon={Users}
                    />
                    <MetricCard
                        label="Actief"
                        value={String(stats.active_sessions)}
                        detail="Live sessies"
                        icon={Radio}
                    />
                    <MetricCard
                        label="Stories"
                        value={`${stats.estimated_stories}/${stats.total_stories}`}
                        detail="Ingeschat"
                        icon={CheckCircle2}
                    />
                    <MetricCard
                        label="Afronding"
                        value={`${stats.completion_percentage}%`}
                        detail="Over alle teams"
                        icon={BarChart3}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader className="flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle>Actieve sessies</CardTitle>
                                <CardDescription>
                                    Sessies die nu klaarstaan voor refinement.
                                </CardDescription>
                            </div>
                            <Badge variant="secondary">
                                {activeSessions.length}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            {activeSessions.length > 0 ? (
                                <div className="divide-y rounded-md border">
                                    {activeSessions.map((session) => (
                                        <SessionRow
                                            key={session.id}
                                            session={session}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    title="Geen actieve sessies"
                                    action="Sessie starten"
                                />
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Teams</CardTitle>
                                <CardDescription>
                                    Jouw werkruimtes en rollen.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {teams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="rounded-md border p-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium">
                                                    {team.name}
                                                </div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {team.users_count} leden,{' '}
                                                    {
                                                        team.planning_sessions_count
                                                    }{' '}
                                                    sessies
                                                </div>
                                            </div>
                                            <Badge variant="outline">
                                                {team.role}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Laatste estimates</CardTitle>
                                <CardDescription>
                                    Recent geaccepteerde storypunten.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {latestEstimates.length > 0 ? (
                                    latestEstimates.map((story) => (
                                        <Link
                                            key={story.id}
                                            href={showSession(story.session.id)}
                                            className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium">
                                                    {story.key
                                                        ? `${story.key} - ${story.title}`
                                                        : story.title}
                                                </div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {story.session.name}
                                                </div>
                                            </div>
                                            <Badge>{story.estimate}</Badge>
                                        </Link>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Nog geen estimates.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recente sessies</CardTitle>
                        <CardDescription>
                            Laatste activiteit over je teams.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y rounded-md border">
                            {recentSessions.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    compact
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function MetricCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: string;
    value: string;
    detail: string;
    icon: ComponentType<{ className?: string }>;
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">{label}</div>
                    <div className="mt-1 text-2xl font-semibold">{value}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                        {detail}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function SessionRow({
    session,
    compact = false,
}: {
    session: SessionSummary;
    compact?: boolean;
}) {
    return (
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                        href={showSession(session.id)}
                        className="truncate text-sm font-medium hover:underline"
                    >
                        {session.name}
                    </Link>
                    <Badge
                        variant={
                            session.status === 'active'
                                ? 'default'
                                : 'secondary'
                        }
                    >
                        {statusLabel(session.status)}
                    </Badge>
                </div>
                {!compact && (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                        {session.current_story ?? 'Geen actieve story'} -{' '}
                        {session.team}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:justify-self-end">
                <Clock3 className="size-3.5" />
                {session.updated_at
                    ? new Intl.DateTimeFormat('nl-NL', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                      }).format(new Date(session.updated_at))
                    : 'net aangemaakt'}
            </div>

            <Button
                asChild
                variant="ghost"
                className="w-fit sm:justify-self-end"
            >
                <Link href={showSession(session.id)}>
                    Open
                    <ArrowRight className="size-4" />
                </Link>
            </Button>
        </div>
    );
}

function EmptyState({ title, action }: { title: string; action: string }) {
    return (
        <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">{title}</p>
            <Button asChild variant="outline">
                <Link href={createSession()}>
                    {action}
                    <PlusCircle className="size-4" />
                </Link>
            </Button>
        </div>
    );
}

function statusLabel(status: SessionSummary['status']): string {
    return {
        setup: 'setup',
        active: 'actief',
        completed: 'klaar',
    }[status];
}

function teamMemberCount(teams: TeamSummary[]): number {
    return teams.reduce((total, team) => total + team.users_count, 0);
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
