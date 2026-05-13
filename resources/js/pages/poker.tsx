import { Head, Link as InertiaLink, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Check,
    ChevronDown,
    Copy,
    Crown,
    FileUp,
    Link as LinkIcon,
    Mail,
    Pause,
    Play,
    Plus,
    QrCode,
    RotateCcw,
    Sparkles,
    Trash2,
    Users,
    WandSparkles,
} from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { dashboard, login, register } from '@/routes';

const FIB = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'] as const;
type CardValue = (typeof FIB)[number];

const FIB_NUMS = [0, 1, 2, 3, 5, 8, 13, 21] as const;

interface Player {
    id: string;
    name: string;
    color: string;
    host?: boolean;
    you?: boolean;
}

interface Story {
    key: string;
    title: string;
    estimate: number | null;
    done: boolean;
}

interface NewStory {
    key?: string | null;
    title: string;
}

interface Consensus {
    pct: number;
    label: string;
    emoji: string;
}

const INITIAL_PLAYERS: Player[] = [
    { id: 'p1', name: 'Olivier', color: 'bg-sky-500', host: true },
    { id: 'p2', name: 'Tim', color: 'bg-emerald-500' },
    { id: 'p3', name: 'Sanne', color: 'bg-amber-500' },
    { id: 'p4', name: 'Maya', color: 'bg-violet-500' },
    { id: 'p5', name: 'Russell', color: 'bg-sky-500', you: true },
];

function fmtTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
    const rest = (seconds % 60).toString().padStart(2, '0');

    return `${minutes}:${rest}`;
}

function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuote = false;

    for (let index = 0; index < line.length; index++) {
        const character = line[index];

        if (inQuote) {
            if (character === '"') {
                if (line[index + 1] === '"') {
                    current += '"';
                    index++;
                } else {
                    inQuote = false;
                }
            } else {
                current += character;
            }
        } else if (character === '"') {
            inQuote = true;
        } else if (character === ',' || character === ';') {
            fields.push(current);
            current = '';
        } else {
            current += character;
        }
    }

    fields.push(current);

    return fields.map((field) => field.trim());
}

const TITLE_HEADERS = ['title', 'name', 'summary', 'subject', 'titel'];
const KEY_HEADER_ORDER = ['iid', 'key', 'number', 'id'];

function parseCsv(text: string): NewStory[] {
    const rawLines = text.split(/\r?\n/);
    const lines: string[] = [];
    let buffer = '';
    let openQuotes = 0;

    for (const raw of rawLines) {
        buffer = buffer ? `${buffer}\n${raw}` : raw;
        openQuotes += (raw.match(/"/g) || []).length;

        if (openQuotes % 2 === 0) {
            if (buffer.trim()) {
                lines.push(buffer);
            }

            buffer = '';
            openQuotes = 0;
        }
    }

    if (buffer.trim()) {
        lines.push(buffer);
    }

    if (!lines.length) {
        return [];
    }

    const headerFields = parseCsvLine(lines[0]).map((field) =>
        field.toLowerCase(),
    );
    const titleIndex = headerFields.findIndex((header) =>
        TITLE_HEADERS.includes(header),
    );

    if (titleIndex >= 0) {
        let keyIndex = -1;

        for (const candidate of KEY_HEADER_ORDER) {
            const found = headerFields.indexOf(candidate);

            if (found >= 0) {
                keyIndex = found;
                break;
            }
        }

        return lines
            .slice(1)
            .map<NewStory>((line) => {
                const fields = parseCsvLine(line);
                const title = fields[titleIndex] || '';
                const rawKey = keyIndex >= 0 ? fields[keyIndex] : '';
                const key = rawKey
                    ? /^\d+$/.test(rawKey)
                        ? `#${rawKey}`
                        : rawKey
                    : null;

                return { key, title };
            })
            .filter((story) => story.title);
    }

    return lines
        .map<NewStory>((line) => {
            const match = line.match(/^([A-Z]{2,}-\d+)[,;\s]+(.+)$/);

            if (match) {
                return {
                    key: match[1],
                    title: match[2].replace(/^["']|["']$/g, '').trim(),
                };
            }

            const fields = parseCsvLine(line);
            const title = (fields[0] || '').replace(/^["']|["']$/g, '');

            return { key: null, title };
        })
        .filter((story) => story.title);
}

type Phase = 'setup' | 'playing';
type PlayStage = 'intro' | 'voting' | 'flipping' | 'revealed';

export default function PokerPage() {
    const { auth } = usePage().props;
    const [phase, setPhase] = useState<Phase>('setup');
    const [stories, setStories] = useState<Story[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeStory = stories[activeIndex];

    const [players] = useState<Player[]>(INITIAL_PLAYERS);
    const me = players.find((player) => player.you) ?? players[0];

    const [votes, setVotes] = useState<Record<string, CardValue | undefined>>(
        {},
    );
    const [playStage, setPlayStage] = useState<PlayStage>('intro');
    const revealed = playStage === 'revealed';
    const flipping = playStage === 'flipping' || playStage === 'revealed';
    const myVote = votes[me.id];

    const [timerRunning, setTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [playersOpen, setPlayersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!timerRunning) {
            return;
        }

        const id = window.setInterval(
            () => setTimerSeconds((seconds) => seconds + 1),
            1000,
        );

        return () => window.clearInterval(id);
    }, [timerRunning]);

    useEffect(() => {
        if (phase !== 'playing' || playStage !== 'voting' || !myVote) {
            return;
        }

        const seedFor = (): CardValue => {
            const yourNumber = Number.parseFloat(myVote);

            if (Number.isNaN(yourNumber)) {
                return String(
                    FIB_NUMS[Math.floor(Math.random() * 5) + 1],
                ) as CardValue;
            }

            const drift = [-1, 0, 0, 1, 2][Math.floor(Math.random() * 5)];
            const target = yourNumber + drift;
            const closest = FIB_NUMS.reduce((previous, current) =>
                Math.abs(current - target) < Math.abs(previous - target)
                    ? current
                    : previous,
            );

            return String(closest) as CardValue;
        };

        const timers = players
            .filter((player) => !player.you)
            .map((player, index) => {
                if (votes[player.id]) {
                    return null;
                }

                return window.setTimeout(
                    () =>
                        setVotes((currentVotes) => ({
                            ...currentVotes,
                            [player.id]: seedFor(),
                        })),
                    600 + index * 700 + Math.random() * 400,
                );
            });

        return () => {
            timers.forEach((timer) => {
                if (timer) {
                    window.clearTimeout(timer);
                }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myVote, phase, playStage]);

    const votedCount = players.filter(
        (player) => votes[player.id] != null,
    ).length;
    const totalVoters = players.length;
    const allDone = stories.length > 0 && stories.every((story) => story.done);
    const doneCount = stories.filter((story) => story.done).length;

    const castVote = (value: CardValue): void => {
        if (playStage !== 'voting') {
            return;
        }

        setVotes((currentVotes) => ({
            ...currentVotes,
            [me.id]: currentVotes[me.id] === value ? undefined : value,
        }));

        if (!timerRunning) {
            setTimerRunning(true);
        }
    };

    const handleReveal = (): void => {
        if (votedCount === 0) {
            return;
        }

        setTimerRunning(false);
        setPlayStage('flipping');
        window.setTimeout(() => setPlayStage('revealed'), 650);
    };

    const handleRevote = useCallback((): void => {
        setPlayStage('voting');
        setVotes({});
        setTimerSeconds(0);
        setTimerRunning(false);
    }, []);

    const handleAccept = (estimate: number | null): void => {
        setStories((currentStories) =>
            currentStories.map((story, index) =>
                index === activeIndex
                    ? { ...story, estimate, done: true }
                    : story,
            ),
        );

        const nextIndex = stories.findIndex(
            (story, index) => index > activeIndex && !story.done,
        );

        setVotes({});
        setTimerSeconds(0);
        setTimerRunning(false);

        if (nextIndex >= 0) {
            setActiveIndex(nextIndex);
            setPlayStage('intro');
        } else {
            setActiveIndex(stories.length);
            setPlayStage('intro');
        }
    };

    const numericVotes = useMemo(
        () =>
            Object.values(votes)
                .filter(
                    (vote): vote is CardValue =>
                        vote != null && !Number.isNaN(Number.parseFloat(vote)),
                )
                .map((vote) => Number.parseFloat(vote)),
        [votes],
    );
    const average = numericVotes.length
        ? numericVotes.reduce((total, vote) => total + vote, 0) /
          numericVotes.length
        : 0;
    const averageFormatted = numericVotes.length ? average.toFixed(1) : '-';
    const suggested = numericVotes.length
        ? FIB_NUMS.reduce((previous, current) =>
              Math.abs(current - average) < Math.abs(previous - average)
                  ? current
                  : previous,
          )
        : null;

    const distribution = useMemo(() => {
        const result: Record<string, number> = {};
        FIB.forEach((value) => {
            result[value] = 0;
        });
        Object.values(votes).forEach((vote) => {
            if (vote != null) {
                result[vote] = (result[vote] || 0) + 1;
            }
        });

        return result;
    }, [votes]);
    const maxDistribution = Math.max(1, ...Object.values(distribution));

    const consensus: Consensus = useMemo(() => {
        if (!numericVotes.length) {
            return { pct: 0, label: '-', emoji: '🤔' };
        }

        const range = Math.max(...numericVotes) - Math.min(...numericVotes);
        const pct = Math.max(0, Math.min(1, 1 - range / 13));

        if (pct >= 0.95) {
            return { pct, label: 'Perfect', emoji: '🎯' };
        }

        if (pct >= 0.75) {
            return { pct, label: 'Sterk akkoord', emoji: '🙌' };
        }

        if (pct >= 0.5) {
            return { pct, label: 'Redelijk', emoji: '👍' };
        }

        if (pct >= 0.25) {
            return { pct, label: 'Discussie', emoji: '🤔' };
        }

        return { pct, label: 'Geen consensus', emoji: '😬' };
    }, [numericVotes]);

    const handleAddStories = useCallback((newStories: NewStory[]) => {
        setStories((currentStories) => {
            const startIndex = currentStories.length;
            const padded = newStories.map<Story>((story, index) => ({
                key:
                    story.key ||
                    `POK-${String(101 + startIndex + index).padStart(3, '0')}`,
                title: story.title,
                estimate: null,
                done: false,
            }));

            return [...currentStories, ...padded];
        });
    }, []);

    const handleStart = (): void => {
        if (!stories.length) {
            return;
        }

        const firstUndone = stories.findIndex((story) => !story.done);
        setActiveIndex(firstUndone >= 0 ? firstUndone : 0);
        setPlayStage('intro');
        setPhase('playing');
    };

    const handleBackToSetup = (): void => {
        setPhase('setup');
        handleRevote();
    };

    return (
        <>
            <Head title="Planning Poker" />

            <div className="min-h-svh bg-background text-foreground">
                <div className="mx-auto flex min-h-svh w-full max-w-[1500px] flex-col gap-4 p-3 sm:p-4 lg:p-6">
                    <header className="flex min-h-14 flex-wrap items-center gap-3 rounded-lg border bg-card px-3 shadow-sm sm:px-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
                                <Sparkles className="size-4" />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-auto gap-2 px-2 py-1.5 text-left"
                                    >
                                        <span className="flex flex-col">
                                            <span className="text-sm leading-none font-semibold">
                                                Sprint 42 - Grooming
                                            </span>
                                            <span className="mt-1 text-xs font-normal text-muted-foreground">
                                                Planning Poker
                                            </span>
                                        </span>
                                        <ChevronDown className="size-4 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="w-56"
                                >
                                    <DropdownMenuLabel>
                                        Ruimte
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem>
                                        Sprint 42 - Grooming
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        Mobiele backlog
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        Nieuwe ruimte maken
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {phase === 'playing' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        setTimerRunning((running) => !running)
                                    }
                                    className={cn(
                                        'font-mono',
                                        timerRunning &&
                                            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-2 rounded-full bg-muted-foreground',
                                            timerRunning &&
                                                'bg-emerald-500 ring-4 ring-emerald-500/15',
                                        )}
                                    />
                                    {fmtTime(timerSeconds)}
                                    {timerRunning ? (
                                        <Pause className="size-3.5" />
                                    ) : (
                                        <Play className="size-3.5" />
                                    )}
                                </Button>
                            )}

                            <PlayersDropdown
                                open={playersOpen}
                                setOpen={setPlayersOpen}
                                players={players}
                                votes={votes}
                                revealed={revealed}
                                phase={phase}
                            />

                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setInviteOpen(true)}
                            >
                                <Users className="size-4" />
                                Uitnodigen
                            </Button>

                            {auth.user ? (
                                <Button asChild variant="outline" size="sm">
                                    <InertiaLink href={dashboard()}>
                                        Dashboard
                                    </InertiaLink>
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button asChild variant="ghost" size="sm">
                                        <InertiaLink href={login()}>
                                            Inloggen
                                        </InertiaLink>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                        <InertiaLink href={register()}>
                                            Registreren
                                        </InertiaLink>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                        <StorySidebar
                            stories={stories}
                            phase={phase}
                            activeIndex={activeIndex}
                            onSelect={(index) => {
                                if (phase === 'playing') {
                                    setActiveIndex(index);
                                    handleRevote();
                                }
                            }}
                            onManage={handleBackToSetup}
                        />

                        <main className="min-h-[720px] rounded-lg border bg-muted/30 p-3 sm:p-4">
                            {phase === 'setup' ? (
                                <SetupView
                                    stories={stories}
                                    onAdd={handleAddStories}
                                    onRemove={(index) =>
                                        setStories((currentStories) =>
                                            currentStories.filter(
                                                (_, storyIndex) =>
                                                    storyIndex !== index,
                                            ),
                                        )
                                    }
                                    onStart={handleStart}
                                />
                            ) : allDone ? (
                                <CompleteView
                                    stories={stories}
                                    onRestart={handleBackToSetup}
                                />
                            ) : (
                                activeStory && (
                                    <PlayingView
                                        activeStory={activeStory}
                                        players={players}
                                        votes={votes}
                                        playStage={playStage}
                                        handleStartVoting={() =>
                                            setPlayStage('voting')
                                        }
                                        revealed={revealed}
                                        flipping={flipping}
                                        myVote={myVote}
                                        me={me}
                                        castVote={castVote}
                                        handleReveal={handleReveal}
                                        handleRevote={handleRevote}
                                        handleAccept={handleAccept}
                                        votedCount={votedCount}
                                        totalVoters={totalVoters}
                                        averageFormatted={averageFormatted}
                                        suggested={suggested}
                                        distribution={distribution}
                                        maxDistribution={maxDistribution}
                                        consensus={consensus}
                                        activeIndex={activeIndex}
                                        totalStories={stories.length}
                                        doneCount={doneCount}
                                    />
                                )
                            )}
                        </main>
                    </div>
                </div>
            </div>

            <InviteModal
                open={inviteOpen}
                onOpenChange={setInviteOpen}
                copied={copied}
                setCopied={setCopied}
            />
        </>
    );
}

interface PlayersDropdownProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    players: Player[];
    votes: Record<string, CardValue | undefined>;
    revealed: boolean;
    phase: Phase;
}

function PlayersDropdown({
    open,
    setOpen,
    players,
    votes,
    revealed,
    phase,
}: PlayersDropdownProps) {
    const votedCount = players.filter(
        (player) => votes[player.id] != null,
    ).length;

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <div className="flex -space-x-2">
                        {players.slice(0, 3).map((player) => (
                            <PlayerAvatar key={player.id} player={player} />
                        ))}
                    </div>
                    <span className="hidden sm:inline">
                        {phase === 'playing'
                            ? `${votedCount}/${players.length} gestemd`
                            : `${players.length} spelers`}
                    </span>
                    <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="flex items-center justify-between">
                    Spelers
                    <Badge variant="secondary">{players.length} online</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-1 p-1">
                    {players.map((player) => {
                        const vote = votes[player.id];
                        const hasVoted = vote != null;

                        return (
                            <div
                                key={player.id}
                                className="flex items-center gap-3 rounded-md px-2 py-2"
                            >
                                <PlayerAvatar player={player} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 text-sm font-medium">
                                        <span className="truncate">
                                            {player.name}
                                        </span>
                                        {player.host && (
                                            <Crown className="size-3.5 text-amber-500" />
                                        )}
                                        {player.you && (
                                            <Badge
                                                variant="outline"
                                                className="px-1.5"
                                            >
                                                jij
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {phase === 'setup'
                                            ? 'Wacht in de ruimte'
                                            : hasVoted
                                              ? 'Heeft gestemd'
                                              : 'Nog geen stem'}
                                    </div>
                                </div>
                                <Badge
                                    variant={hasVoted ? 'default' : 'outline'}
                                    className="min-w-10 justify-center"
                                >
                                    {revealed && hasVoted
                                        ? vote
                                        : hasVoted
                                          ? '✓'
                                          : '-'}
                                </Badge>
                            </div>
                        );
                    })}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <Plus className="size-4" />
                    Speler toevoegen
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface StorySidebarProps {
    stories: Story[];
    phase: Phase;
    activeIndex: number;
    onSelect: (index: number) => void;
    onManage: () => void;
}

function StorySidebar({
    stories,
    phase,
    activeIndex,
    onSelect,
    onManage,
}: StorySidebarProps) {
    const openCount = stories.filter((story) => !story.done).length;

    return (
        <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold">Backlog</h2>
                    <p className="text-xs text-muted-foreground">
                        {stories.length
                            ? `${openCount} open van ${stories.length}`
                            : 'Nog leeg'}
                    </p>
                </div>
                <Badge variant={openCount ? 'secondary' : 'outline'}>
                    {openCount || 0}
                </Badge>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {stories.length === 0 && (
                    <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                        <WandSparkles className="mb-3 size-8 text-muted-foreground" />
                        <p className="text-sm font-medium">
                            Voeg items toe om te beginnen.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Plak backlogregels of importeer een CSV.
                        </p>
                    </div>
                )}

                {stories.map((story, index) => (
                    <button
                        type="button"
                        key={story.key}
                        className={cn(
                            'flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left shadow-xs transition hover:bg-accent',
                            phase === 'playing' &&
                                index === activeIndex &&
                                'border-primary bg-primary/5',
                            story.done && 'opacity-70',
                        )}
                        onClick={() => onSelect(index)}
                    >
                        <span
                            className={cn(
                                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                                story.done
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-muted-foreground/30',
                            )}
                        >
                            {story.done && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-muted-foreground">
                                {story.key}
                            </span>
                            <span className="line-clamp-2 text-sm font-medium">
                                {story.title}
                            </span>
                        </span>
                        <Badge
                            variant={
                                story.estimate != null ? 'default' : 'outline'
                            }
                            className="min-w-9 justify-center"
                        >
                            {story.estimate ?? '-'}
                        </Badge>
                    </button>
                ))}
            </div>

            {phase === 'playing' && (
                <div className="border-t p-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={onManage}
                    >
                        <Plus className="size-4" />
                        Items beheren
                    </Button>
                </div>
            )}
        </aside>
    );
}

interface SetupViewProps {
    stories: Story[];
    onAdd: (stories: NewStory[]) => void;
    onRemove: (index: number) => void;
    onStart: () => void;
}

function SetupView({ stories, onAdd, onRemove, onStart }: SetupViewProps) {
    const [text, setText] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);

    const handleTextAdd = (): void => {
        const rows = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map<NewStory>((line) => {
                const match = line.match(/^([A-Z]{2,}-\d+)\s+(.+)$/);

                if (match) {
                    return { key: match[1], title: match[2] };
                }

                return { title: line };
            });

        if (rows.length) {
            onAdd(rows);
            setText('');
        }
    };

    const handleFile = async (
        event: ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setFileName(file.name);
        const csv = await file.text();
        const parsed = parseCsv(csv);

        if (parsed.length) {
            onAdd(parsed);
        }

        event.target.value = '';
    };

    return (
        <div className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-6">
            <div className="space-y-2">
                <Badge variant="outline">Stap 1 van 2</Badge>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Zet je backlog klaar
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Plak losse items of importeer een CSV. De sessie blijft
                    lokaal en is direct klaar om te stemmen.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Plus className="size-5" />
                        </div>
                        <CardTitle>Items plakken</CardTitle>
                        <CardDescription>
                            Een regel per story. Gebruik optioneel een key aan
                            het begin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            placeholder={`POK-101 Login flow afronden\nPOK-102 Betalingsstatus tonen`}
                            className="min-h-44 resize-none"
                        />
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                                {
                                    text
                                        .split(/\r?\n/)
                                        .filter((line) => line.trim()).length
                                }{' '}
                                regels klaar
                            </span>
                            <Button type="button" onClick={handleTextAdd}>
                                Toevoegen
                                <ArrowRight className="size-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                            <FileUp className="size-5" />
                        </div>
                        <CardTitle>CSV importeren</CardTitle>
                        <CardDescription>
                            Ondersteunt kolommen zoals title, name, summary, key
                            en id.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <label
                            htmlFor="story-csv"
                            className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-background p-6 text-center transition hover:bg-accent"
                        >
                            <FileUp className="mb-3 size-8 text-muted-foreground" />
                            <span className="text-sm font-medium">
                                Klik om CSV te kiezen
                            </span>
                            <span className="mt-1 text-xs text-muted-foreground">
                                UTF-8, komma of puntkomma
                            </span>
                            {fileName && (
                                <Badge className="mt-4" variant="secondary">
                                    {fileName}
                                </Badge>
                            )}
                        </label>
                        <Input
                            id="story-csv"
                            type="file"
                            accept=".csv,text/csv,text/plain"
                            className="sr-only"
                            onChange={handleFile}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                onAdd([
                                    {
                                        key: 'POK-101',
                                        title: 'Checkout toont betaalstatus in real time',
                                    },
                                    {
                                        key: 'POK-102',
                                        title: 'Teamleden kunnen sessielink delen',
                                    },
                                    {
                                        key: 'POK-103',
                                        title: 'Facilitator accepteert consensuswaarde',
                                    },
                                ])
                            }
                        >
                            <Sparkles className="size-4" />
                            Voorbeeld gebruiken
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {stories.length > 0 && (
                <Card>
                    <CardHeader className="flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle>
                                {stories.length}{' '}
                                {stories.length === 1 ? 'item' : 'items'} klaar
                            </CardTitle>
                            <CardDescription>
                                Controleer de volgorde voordat je start.
                            </CardDescription>
                        </div>
                        <Button type="button" size="lg" onClick={onStart}>
                            Start sessie
                            <ArrowRight className="size-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ol className="divide-y rounded-md border">
                            {stories.map((story, index) => (
                                <li
                                    key={story.key}
                                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3"
                                >
                                    <Badge variant="outline">{story.key}</Badge>
                                    <span className="min-w-0 truncate text-sm font-medium">
                                        {story.title}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onRemove(index)}
                                        aria-label="Verwijderen"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

interface PlayingViewProps {
    activeStory: Story;
    players: Player[];
    votes: Record<string, CardValue | undefined>;
    playStage: PlayStage;
    handleStartVoting: () => void;
    revealed: boolean;
    flipping: boolean;
    myVote: CardValue | undefined;
    me: Player;
    castVote: (value: CardValue) => void;
    handleReveal: () => void;
    handleRevote: () => void;
    handleAccept: (estimate: number | null) => void;
    votedCount: number;
    totalVoters: number;
    averageFormatted: string;
    suggested: number | null;
    distribution: Record<string, number>;
    maxDistribution: number;
    consensus: Consensus;
    activeIndex: number;
    totalStories: number;
    doneCount: number;
}

function PlayingView({
    activeStory,
    players,
    votes,
    playStage,
    handleStartVoting,
    revealed,
    flipping,
    myVote,
    me,
    castVote,
    handleReveal,
    handleRevote,
    handleAccept,
    votedCount,
    totalVoters,
    averageFormatted,
    suggested,
    distribution,
    maxDistribution,
    consensus,
    activeIndex,
    totalStories,
    doneCount,
}: PlayingViewProps) {
    const isIntro = playStage === 'intro';

    return (
        <div className="flex h-full min-h-[680px] flex-col">
            {!isIntro && (
                <div className="mb-4 rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">
                            Item {activeIndex + 1} van {totalStories}
                        </Badge>
                        <Badge variant="outline">{activeStory.key}</Badge>
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                        {activeStory.title}
                    </h1>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                    width: `${(doneCount / totalStories) * 100}%`,
                                }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {doneCount}/{totalStories} ingeschat
                        </span>
                    </div>
                </div>
            )}

            {isIntro ? (
                <StoryIntro
                    activeStory={activeStory}
                    activeIndex={activeIndex}
                    totalStories={totalStories}
                    onStart={handleStartVoting}
                />
            ) : (
                <div className="flex flex-1 flex-col justify-between gap-6">
                    <div className="grid gap-3 md:grid-cols-4">
                        {players
                            .filter((player) => !player.you)
                            .map((player) => (
                                <Seat
                                    key={player.id}
                                    player={player}
                                    vote={votes[player.id]}
                                    revealed={revealed}
                                    flipping={flipping}
                                />
                            ))}
                    </div>

                    <Card className="mx-auto w-full max-w-3xl border-primary/10 bg-background/80 shadow-md">
                        <CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
                            {playStage !== 'revealed' ? (
                                <>
                                    <Badge
                                        variant="outline"
                                        className="mb-4 gap-2 px-3 py-1"
                                    >
                                        <span className="size-2 rounded-full bg-primary" />
                                        {playStage === 'flipping'
                                            ? 'Kaarten draaien om'
                                            : votedCount === 0
                                              ? 'Kies een kaart om te beginnen'
                                              : `${votedCount} van ${totalVoters} gestemd`}
                                    </Badge>
                                    <h2 className="text-3xl font-semibold tracking-tight">
                                        Planningtafel
                                    </h2>
                                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                        Stemmen blijven verborgen tot de
                                        facilitator de kaarten onthult.
                                    </p>
                                    <Button
                                        type="button"
                                        size="lg"
                                        className="mt-6"
                                        onClick={handleReveal}
                                        disabled={
                                            votedCount === 0 ||
                                            playStage === 'flipping'
                                        }
                                    >
                                        {playStage === 'flipping'
                                            ? 'Onthullen...'
                                            : 'Onthul kaarten'}
                                        <Sparkles className="size-4" />
                                    </Button>
                                </>
                            ) : (
                                <RevealPanel
                                    averageFormatted={averageFormatted}
                                    suggested={suggested}
                                    consensus={consensus}
                                    distribution={distribution}
                                    maxDistribution={maxDistribution}
                                    handleRevote={handleRevote}
                                    handleAccept={handleAccept}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <div className="mx-auto w-full max-w-sm">
                        <Seat
                            player={me}
                            vote={votes[me.id]}
                            revealed={revealed}
                            flipping={flipping}
                            isYou
                        />
                    </div>
                </div>
            )}

            {!isIntro && playStage !== 'revealed' && (
                <div className="sticky bottom-3 mt-6 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur">
                    <div className="mb-3 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Gooi je kaart op tafel
                    </div>
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                        {FIB.map((value) => (
                            <button
                                type="button"
                                key={value}
                                className={cn(
                                    'flex aspect-[3/4] min-h-20 items-center justify-center rounded-lg border bg-background text-2xl font-semibold shadow-xs transition hover:-translate-y-1 hover:border-primary hover:shadow-md disabled:pointer-events-none disabled:opacity-60',
                                    myVote === value &&
                                        'border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15',
                                    value === '☕' && 'text-xl',
                                )}
                                onClick={() => castVote(value)}
                                disabled={playStage === 'flipping'}
                                aria-pressed={myVote === value}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface StoryIntroProps {
    activeStory: Story;
    activeIndex: number;
    totalStories: number;
    onStart: () => void;
}

function StoryIntro({
    activeStory,
    activeIndex,
    totalStories,
    onStart,
}: StoryIntroProps) {
    return (
        <div className="flex h-full min-h-[650px] items-center justify-center">
            <Card className="relative w-full max-w-3xl overflow-hidden text-center">
                <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
                <CardHeader className="items-center px-8 pt-12">
                    <Badge variant="secondary">
                        Item {activeIndex + 1} van {totalStories}
                    </Badge>
                    <Badge variant="outline" className="mt-4 text-sm">
                        {activeStory.key}
                    </Badge>
                    <CardTitle className="mt-4 max-w-2xl text-4xl leading-tight">
                        {activeStory.title}
                    </CardTitle>
                    <CardDescription className="max-w-md">
                        Lees het item kort voor en start daarna de stemronde.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 px-8 pb-12">
                    <Button type="button" size="lg" onClick={onStart}>
                        Begin met stemmen
                        <ArrowRight className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        De kaarten verschijnen onderaan zodra de ronde loopt.
                    </span>
                </CardContent>
            </Card>
        </div>
    );
}

function RevealValue({ value }: { value: CardValue }) {
    const numericValue = Number.parseFloat(value);

    if (Number.isNaN(numericValue)) {
        return <>{value}</>;
    }

    return <AnimatedRevealValue value={numericValue} />;
}

function AnimatedRevealValue({ value }: { value: number }) {
    const [shown, setShown] = useState(0);

    useEffect(() => {
        const duration = 420;
        const start = performance.now();
        let raf = 0;

        const tick = (now: number): void => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setShown(Math.round(value * eased));

            if (t < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                setShown(value);
            }
        };

        raf = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(raf);
    }, [value]);

    return <>{shown}</>;
}

interface SeatProps {
    player: Player;
    vote: CardValue | undefined;
    revealed: boolean;
    flipping: boolean;
    isYou?: boolean;
}

function Seat({ player, vote, revealed, flipping, isYou }: SeatProps) {
    const [justThrown, setJustThrown] = useState(false);
    const previous = useRef<CardValue | undefined>(vote);

    useEffect(() => {
        if (vote != null && previous.current == null) {
            setJustThrown(true);
            const timeout = window.setTimeout(() => setJustThrown(false), 480);
            previous.current = vote;

            return () => window.clearTimeout(timeout);
        }

        previous.current = vote;
    }, [vote]);

    const hasVoted = vote != null;
    const cardFlipped = hasVoted && (revealed || flipping);

    return (
        <div
            className={cn(
                'rounded-lg border bg-card p-3 shadow-sm',
                isYou && 'border-primary/40 bg-primary/5',
            )}
        >
            <div className="flex items-center gap-3">
                <div className="h-20 w-14 [perspective:900px]">
                    <div
                        className={cn(
                            'relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]',
                            cardFlipped && '[transform:rotateY(180deg)]',
                            justThrown && '-translate-y-1',
                        )}
                    >
                        <div className="absolute inset-0 flex items-center justify-center rounded-md border bg-secondary text-lg font-semibold [backface-visibility:hidden]">
                            {hasVoted ? (
                                <span className="size-2 rounded-full bg-primary" />
                            ) : (
                                <span className="text-muted-foreground">?</span>
                            )}
                        </div>
                        <div className="absolute inset-0 flex [transform:rotateY(180deg)] items-center justify-center rounded-md border border-primary/30 bg-background text-2xl font-semibold shadow-sm [backface-visibility:hidden]">
                            {hasVoted && revealed ? (
                                <RevealValue value={vote} />
                            ) : hasVoted ? (
                                vote
                            ) : (
                                ''
                            )}
                        </div>
                    </div>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <PlayerAvatar player={player} />
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                                {player.name}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {isYou
                                    ? 'Jij'
                                    : player.host
                                      ? 'Host'
                                      : 'Speler'}
                            </div>
                        </div>
                    </div>
                </div>
                <Badge
                    className="ml-auto"
                    variant={hasVoted ? 'default' : 'outline'}
                >
                    {revealed && hasVoted ? vote : hasVoted ? 'klaar' : 'open'}
                </Badge>
            </div>
        </div>
    );
}

interface RevealPanelProps {
    averageFormatted: string;
    suggested: number | null;
    consensus: Consensus;
    distribution: Record<string, number>;
    maxDistribution: number;
    handleRevote: () => void;
    handleAccept: (estimate: number | null) => void;
}

function RevealPanel({
    averageFormatted,
    suggested,
    consensus,
    distribution,
    maxDistribution,
    handleRevote,
    handleAccept,
}: RevealPanelProps) {
    return (
        <div className="w-full space-y-6 text-left">
            <div className="grid gap-3 sm:grid-cols-3">
                <ResultStat label="Gemiddelde" value={averageFormatted} />
                <ResultStat
                    label="Suggestie"
                    value={suggested?.toString() ?? '-'}
                    accent
                />
                <ResultStat
                    label="Akkoord"
                    value={consensus.emoji}
                    subValue={consensus.label}
                />
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium">Verdeling</div>
                    <Badge variant="secondary">
                        {Math.round(consensus.pct * 100)}% consensus
                    </Badge>
                </div>
                <div className="grid h-36 grid-cols-10 items-end gap-2">
                    {FIB.map((value) => {
                        const count = distribution[value] || 0;
                        const height = Math.max(
                            count ? 12 : 4,
                            (count / maxDistribution) * 100,
                        );

                        return (
                            <div
                                className="flex h-full flex-col items-center justify-end gap-2"
                                key={value}
                            >
                                <div
                                    className={cn(
                                        'flex w-full items-start justify-center rounded-md bg-primary/70 pt-1 text-[10px] font-medium text-primary-foreground transition-all',
                                        count === 0 && 'bg-muted-foreground/20',
                                    )}
                                    style={{ height: `${height}%` }}
                                >
                                    {count > 0 && count}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {value}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleRevote}>
                    <RotateCcw className="size-4" />
                    Opnieuw stemmen
                </Button>
                <Button type="button" onClick={() => handleAccept(suggested)}>
                    Accepteer {suggested ?? '-'}
                    <ArrowRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function ResultStat({
    label,
    value,
    subValue,
    accent = false,
}: {
    label: string;
    value: string;
    subValue?: string;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                'rounded-lg border bg-background p-4 text-center',
                accent && 'border-primary/40 bg-primary/5',
            )}
        >
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
            {subValue && (
                <div className="mt-1 text-xs text-muted-foreground">
                    {subValue}
                </div>
            )}
        </div>
    );
}

interface CompleteViewProps {
    stories: Story[];
    onRestart: () => void;
}

function CompleteView({ stories, onRestart }: CompleteViewProps) {
    const total = stories.reduce(
        (sum, story) => sum + (story.estimate || 0),
        0,
    );

    return (
        <div className="flex h-full min-h-[650px] items-center justify-center">
            <Card className="w-full max-w-3xl">
                <CardHeader className="items-center text-center">
                    <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <Check className="size-6" />
                    </div>
                    <CardTitle className="text-3xl">Sessie afgerond</CardTitle>
                    <CardDescription>
                        {stories.length} items ingeschat met totaal {total}{' '}
                        punten.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="divide-y rounded-md border">
                        {stories.map((story) => (
                            <div
                                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3"
                                key={story.key}
                            >
                                <Badge variant="outline">{story.key}</Badge>
                                <span className="truncate text-sm font-medium">
                                    {story.title}
                                </span>
                                <Badge>{story.estimate ?? '-'}</Badge>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline">
                            <FileUp className="size-4" />
                            Exporteer CSV
                        </Button>
                        <Button type="button" onClick={onRestart}>
                            Nieuwe sessie
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

interface InviteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    copied: boolean;
    setCopied: (copied: boolean) => void;
}

function InviteModal({
    open,
    onOpenChange,
    copied,
    setCopied,
}: InviteModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Spelers uitnodigen</DialogTitle>
                    <DialogDescription>
                        Iedereen met de link kan stemmen. Geen account nodig.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value="poker.app/r/sprint-42-grooming"
                            aria-label="Uitnodigingslink"
                        />
                        <Button
                            type="button"
                            variant={copied ? 'secondary' : 'default'}
                            onClick={() => {
                                setCopied(true);
                                window.setTimeout(() => setCopied(false), 1600);
                            }}
                        >
                            {copied ? (
                                <Check className="size-4" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                            {copied ? 'Gekopieerd' : 'Kopieer'}
                        </Button>
                    </div>

                    <Separator />

                    <div className="grid gap-2 sm:grid-cols-3">
                        <Button type="button" variant="outline">
                            <Mail className="size-4" />
                            E-mail
                        </Button>
                        <Button type="button" variant="outline">
                            <LinkIcon className="size-4" />
                            Slack
                        </Button>
                        <Button type="button" variant="outline">
                            <QrCode className="size-4" />
                            QR code
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PlayerAvatar({ player }: { player: Player }) {
    return (
        <Avatar className="size-7 border-2 border-background">
            <AvatarFallback
                className={cn('text-xs font-semibold text-white', player.color)}
            >
                {player.name[0]}
            </AvatarFallback>
        </Avatar>
    );
}
