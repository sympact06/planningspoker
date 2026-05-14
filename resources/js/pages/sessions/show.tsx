import { Head, Link, router, useForm } from '@inertiajs/react';
import { useConnectionStatus, useEchoPresence } from '@laravel/echo-react';
import {
    ArrowLeft,
    Check,
    Circle,
    Flag,
    PlusCircle,
    Radio,
    RefreshCcw,
    Send,
    Users,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { complete as completeSession } from '@/actions/App/Http/Controllers/PlanningSessionController';
import { store as storeStory } from '@/actions/App/Http/Controllers/SessionStoryController';
import { store as castVote } from '@/actions/App/Http/Controllers/VoteController';
import {
    accept as acceptRound,
    reveal as revealRound,
    revote as revoteRound,
    store as startRound,
} from '@/actions/App/Http/Controllers/VotingRoundController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { parseStoryText, voteLabel } from '@/lib/stories';
import { dashboard } from '@/routes';
import type {
    CurrentRound,
    PlanningPlayer,
    PlanningSessionDetail,
    StoryInput,
    StorySummary,
} from '@/types';

type ShowSessionProps = {
    session: PlanningSessionDetail;
};

type PresenceUser = {
    id: number | string;
    name: string;
};

export default function ShowSession({ session }: ShowSessionProps) {
    const connectionStatus = useConnectionStatus();
    const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
    const [storyText, setStoryText] = useState('');

    const currentStory = useMemo(
        () =>
            session.stories.find(
                (story) => story.id === session.current_story_id,
            ) ??
            session.stories.find((story) => story.status === 'pending') ??
            session.stories[0] ??
            null,
        [session.current_story_id, session.stories],
    );

    const completionPercentage =
        session.stats.total_stories > 0
            ? Math.round(
                  (session.stats.estimated_stories /
                      session.stats.total_stories) *
                      100,
              )
            : 0;

    const { channel } = useEchoPresence<{ planningSessionId: number }>(
        `planning-session.${session.id}`,
        '.session.updated',
        () => {
            router.reload({
                only: ['session'],
            });
        },
        [session.id],
    );

    useEffect(() => {
        const presenceChannel = channel();

        presenceChannel.here((users: PresenceUser[]) => {
            setOnlineUserIds(new Set(users.map((user) => Number(user.id))));
        });
        presenceChannel.joining((user: PresenceUser) => {
            setOnlineUserIds((current) => {
                const next = new Set(current);
                next.add(Number(user.id));

                return next;
            });
        });
        presenceChannel.leaving((user: PresenceUser) => {
            setOnlineUserIds((current) => {
                const next = new Set(current);
                next.delete(Number(user.id));

                return next;
            });
        });
    }, [channel, session.id]);

    const startRoundForm = useForm<{ story_id: number }>({ story_id: 0 });
    const voteForm = useForm<{ value: string }>({ value: '' });
    const emptyForm = useForm({});
    const acceptForm = useForm<{ estimate: string | null }>({
        estimate: null,
    });
    const storyForm = useForm<{ stories: StoryInput[] }>({
        stories: [],
    });

    function submitStories(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const stories = parseStoryText(storyText);

        if (stories.length === 0) {
            return;
        }

        storyForm.transform(() => ({ stories }));
        storyForm.post(storeStory.url(session.id), {
            preserveScroll: true,
            onSuccess: () => setStoryText(''),
        });
    }

    function startStoryRound(storyId: number) {
        startRoundForm.transform(() => ({ story_id: storyId }));
        startRoundForm.post(startRound.url(session.id), {
            preserveScroll: true,
        });
    }

    function vote(value: string) {
        voteForm.transform(() => ({ value }));
        voteForm.post(castVote.url(session.id), {
            preserveScroll: true,
        });
    }

    function reveal(currentRound: CurrentRound) {
        emptyForm.post(
            revealRound.url({
                planningSession: session.id,
                votingRound: currentRound.id,
            }),
            { preserveScroll: true },
        );
    }

    function revote(currentRound: CurrentRound) {
        emptyForm.post(
            revoteRound.url({
                planningSession: session.id,
                votingRound: currentRound.id,
            }),
            { preserveScroll: true },
        );
    }

    function accept(currentRound: CurrentRound) {
        acceptForm.transform(() => ({
            estimate: currentRound.suggested_estimate,
        }));
        acceptForm.post(
            acceptRound.url({
                planningSession: session.id,
                votingRound: currentRound.id,
            }),
            { preserveScroll: true },
        );
    }

    function complete() {
        emptyForm.post(completeSession.url(session.id), {
            preserveScroll: true,
        });
    }

    return (
        <>
            <Head title={session.name} />

            <div className="flex flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6">
                <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="gap-2">
                                <span className="size-2 rounded-full bg-emerald-500" />
                                {session.team.name}
                            </Badge>
                            <Badge variant="secondary">
                                {connectionStatus}
                            </Badge>
                        </div>
                        <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight md:text-3xl">
                            {session.name}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Facilitator:{' '}
                            {session.facilitator.name ?? 'onbekend'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="outline">
                            <Link href={dashboard()}>
                                <ArrowLeft className="size-4" />
                                Dashboard
                            </Link>
                        </Button>
                        {session.can.facilitate && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={complete}
                                disabled={emptyForm.processing}
                            >
                                Afronden
                                <Flag className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stories</CardTitle>
                            <CardDescription>
                                {session.stats.estimated_stories} van{' '}
                                {session.stats.total_stories} ingeschat.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full bg-primary transition-all"
                                    style={{
                                        width: `${completionPercentage}%`,
                                    }}
                                />
                            </div>

                            <div className="space-y-2">
                                {session.stories.map((story) => (
                                    <StoryRow
                                        key={story.id}
                                        story={story}
                                        active={story.id === currentStory?.id}
                                        canStart={session.can.facilitate}
                                        onStart={() =>
                                            startStoryRound(story.id)
                                        }
                                        processing={startRoundForm.processing}
                                    />
                                ))}
                            </div>

                            {session.can.facilitate && (
                                <form
                                    onSubmit={submitStories}
                                    className="space-y-3 border-t pt-4"
                                >
                                    <Textarea
                                        value={storyText}
                                        onChange={(event) =>
                                            setStoryText(event.target.value)
                                        }
                                        placeholder="POK-104 Nieuwe story"
                                        className="min-h-24 font-mono text-sm"
                                    />
                                    <InputError
                                        message={storyForm.errors.stories}
                                    />
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        disabled={
                                            storyForm.processing ||
                                            parseStoryText(storyText).length ===
                                                0
                                        }
                                    >
                                        Toevoegen
                                        <PlusCircle className="size-4" />
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                    </Card>

                    <CurrentStoryPanel
                        session={session}
                        story={currentStory}
                        onStart={() =>
                            currentStory && startStoryRound(currentStory.id)
                        }
                        onVote={vote}
                        onReveal={reveal}
                        onAccept={accept}
                        onRevote={revote}
                        startProcessing={startRoundForm.processing}
                        voteProcessing={voteForm.processing}
                        actionProcessing={
                            emptyForm.processing || acceptForm.processing
                        }
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="size-4" />
                                Team
                            </CardTitle>
                            <CardDescription>
                                {onlineUserIds.size} online in deze sessie.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {session.players.map((player) => (
                                <PlayerRow
                                    key={player.id}
                                    player={player}
                                    online={onlineUserIds.has(player.id)}
                                    round={session.current_round}
                                />
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

function CurrentStoryPanel({
    session,
    story,
    onStart,
    onVote,
    onReveal,
    onAccept,
    onRevote,
    startProcessing,
    voteProcessing,
    actionProcessing,
}: {
    session: PlanningSessionDetail;
    story: StorySummary | null;
    onStart: () => void;
    onVote: (value: string) => void;
    onReveal: (round: CurrentRound) => void;
    onAccept: (round: CurrentRound) => void;
    onRevote: (round: CurrentRound) => void;
    startProcessing: boolean;
    voteProcessing: boolean;
    actionProcessing: boolean;
}) {
    const currentRound = session.current_round;
    const roundBelongsToStory =
        currentRound !== null && currentRound.story_id === story?.id;
    const canVote = roundBelongsToStory && currentRound.status === 'voting';
    const canReveal =
        session.can.facilitate &&
        roundBelongsToStory &&
        currentRound.status === 'voting';
    const canAccept =
        session.can.facilitate &&
        roundBelongsToStory &&
        currentRound.status === 'revealed';
    const canRevote =
        session.can.facilitate &&
        roundBelongsToStory &&
        currentRound.status !== 'voting';
    const canStart =
        session.can.facilitate &&
        story?.status === 'pending' &&
        (!roundBelongsToStory || currentRound === null);

    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                    <CardTitle className="truncate">
                        {story?.key
                            ? `${story.key} - ${story.title}`
                            : (story?.title ?? 'Geen story')}
                    </CardTitle>
                    <CardDescription>
                        {currentRound
                            ? `Ronde ${currentRound.status}`
                            : 'Nog geen actieve ronde'}
                    </CardDescription>
                </div>
                {story?.final_estimate && <Badge>{story.final_estimate}</Badge>}
            </CardHeader>
            <CardContent className="space-y-5">
                {story === null ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Voeg stories toe om te starten.
                    </div>
                ) : (
                    <>
                        {canStart && (
                            <Button
                                type="button"
                                onClick={onStart}
                                disabled={startProcessing}
                            >
                                Start ronde
                                <Radio className="size-4" />
                            </Button>
                        )}

                        {canVote && (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                {session.vote_values.map((value) => (
                                    <Button
                                        key={value}
                                        type="button"
                                        variant="outline"
                                        className="h-14 text-base"
                                        onClick={() => onVote(value)}
                                        disabled={voteProcessing}
                                    >
                                        {voteLabel(value)}
                                    </Button>
                                ))}
                            </div>
                        )}

                        {currentRound && (
                            <RoundStatus
                                round={currentRound}
                                players={session.players}
                            />
                        )}

                        {(canReveal || canAccept || canRevote) &&
                            currentRound && (
                                <div className="flex flex-wrap gap-2 border-t pt-4">
                                    {canReveal && (
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                onReveal(currentRound)
                                            }
                                            disabled={actionProcessing}
                                        >
                                            Reveal
                                            <Send className="size-4" />
                                        </Button>
                                    )}
                                    {canAccept && (
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                onAccept(currentRound)
                                            }
                                            disabled={actionProcessing}
                                        >
                                            Accepteer{' '}
                                            {currentRound.suggested_estimate ??
                                                'estimate'}
                                            <Check className="size-4" />
                                        </Button>
                                    )}
                                    {canRevote && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                onRevote(currentRound)
                                            }
                                            disabled={actionProcessing}
                                        >
                                            Revote
                                            <RefreshCcw className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function StoryRow({
    story,
    active,
    canStart,
    onStart,
    processing,
}: {
    story: StorySummary;
    active: boolean;
    canStart: boolean;
    onStart: () => void;
    processing: boolean;
}) {
    return (
        <div
            className={`rounded-md border p-3 ${active ? 'bg-muted/50 ring-1 ring-ring/30' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                        {story.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {story.key && <span>{story.key}</span>}
                        <Badge
                            variant={
                                story.status === 'estimated'
                                    ? 'default'
                                    : 'secondary'
                            }
                        >
                            {story.final_estimate ?? story.status}
                        </Badge>
                    </div>
                </div>
                {canStart && story.status === 'pending' && (
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={onStart}
                        disabled={processing}
                        aria-label="Start ronde"
                    >
                        <Radio className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function PlayerRow({
    player,
    online,
    round,
}: {
    player: PlanningPlayer;
    online: boolean;
    round: CurrentRound | null;
}) {
    const revealed =
        round?.status === 'revealed' || round?.status === 'accepted';

    return (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={`size-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                    />
                    <span className="truncate text-sm font-medium">
                        {player.name}
                    </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                    {player.is_facilitator ? 'facilitator' : player.role}
                </div>
            </div>
            <Badge variant={player.has_voted ? 'default' : 'outline'}>
                {revealed
                    ? (player.vote ?? '-')
                    : player.has_voted
                      ? 'gestemd'
                      : 'wacht'}
            </Badge>
        </div>
    );
}

function RoundStatus({
    round,
    players,
}: {
    round: CurrentRound;
    players: PlanningPlayer[];
}) {
    const voted = players.filter((player) => player.has_voted).length;
    const revealed = round.status === 'revealed' || round.status === 'accepted';

    return (
        <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">
                        {voted} van {players.length} stemmen
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        Status: {round.status}
                    </div>
                </div>
                <Badge variant={revealed ? 'default' : 'outline'}>
                    {revealed ? 'zichtbaar' : 'verborgen'}
                </Badge>
            </div>

            {revealed && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {Object.entries(round.distribution).map(
                        ([value, count]) => (
                            <div
                                key={value}
                                className="flex items-center justify-between rounded-md border bg-background p-3"
                            >
                                <span className="text-sm font-medium">
                                    {value}
                                </span>
                                <Badge variant="secondary">{count}</Badge>
                            </div>
                        ),
                    )}
                    {Object.keys(round.distribution).length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Circle className="size-4" />
                            Geen stemmen.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

ShowSession.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Sessie',
            href: dashboard(),
        },
    ],
};
