// ============================================================
// Planning Poker 3D — React UI overlay. Drives the three.js
// PokerScene and animates the UI with motion.
//
// Three modes, switched on the optional `room` Inertia prop:
//   1. no room              → create-room view (the "/" landing)
//   2. room without `me`     → join gate (enter your name)
//   3. room with `me`        → the real, Reverb-backed session
// ============================================================
import { Head, router } from '@inertiajs/react';
import { useEchoPresence } from '@laravel/echo-react';
import { animate, stagger } from 'motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    join as joinRoomAction,
    store as createRoom,
} from '@/actions/App/Http/Controllers/RoomController';
import {
    accept as acceptRoundAction,
    reveal as revealRoundAction,
    revote as revoteRoundAction,
    store as startRoundAction,
} from '@/actions/App/Http/Controllers/RoomRoundController';
import { store as storeStoriesAction } from '@/actions/App/Http/Controllers/RoomStoryController';
import { store as castVoteAction } from '@/actions/App/Http/Controllers/RoomVoteController';
import { Icon } from '@/components/poker-icon';
import { PokerScene } from '@/lib/poker-scene';
import './poker.css';

const FIB = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
const FIB_NUMS = [0, 1, 2, 3, 5, 8, 13, 21];

type RoomPlayer = {
    id: number;
    name: string;
    color: string;
    is_host: boolean;
    has_voted: boolean;
    vote: string | null;
};

type RoomStory = {
    id: number;
    key: string | null;
    title: string;
    position: number;
    status: 'pending' | 'estimated';
    final_estimate: string | null;
};

type RoomRound = {
    id: number;
    story_id: number;
    status: 'intro' | 'voting' | 'revealed' | 'accepted';
    shows_votes: boolean;
    suggested_estimate: string | null;
};

type RoomMe = {
    id: number;
    name: string;
    color: string;
    is_host: boolean;
};

type RoomData = {
    code: string;
    name: string;
    status: 'active' | 'completed';
    invite_url: string;
    current_story_id: number | null;
    stories: RoomStory[];
    players: RoomPlayer[];
    current_round: RoomRound | null;
    stats: { total_stories: number; estimated_stories: number };
    me: RoomMe | null;
    vote_values: string[];
};

type Consensus = { pct: number; label: string; emoji: string };

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function mAnimate(
    target: Element | NodeListOf<Element> | null,
    keyframes: Record<string, unknown>,
    options?: Record<string, unknown>,
) {
    if (!target) {
        return;
    }

    return animate(target as never, keyframes as never, options as never);
}

/** Server stores '☕' as 'coffee'. Map both ways for display/submit. */
function displayVote(value: string | null | undefined): string | null {
    if (value == null) {
        return null;
    }

    return value === 'coffee' ? '☕' : value;
}

function toServerValue(card: string): string {
    return card === '☕' ? 'coffee' : card;
}

function parseCsv(text: string): { key: string | null; title: string }[] {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
            const m = line.match(/^([A-Z]{2,}-\d+)[,;\t\s]+(.+)$/);

            if (m) {
                return { key: m[1], title: m[2].replace(/^["']|["']$/g, '') };
            }

            const parts = line.split(/[,;\t]/);

            return {
                key: null,
                title: (parts.length > 1 ? parts[1] : parts[0])
                    .replace(/^["']|["']$/g, '')
                    .trim(),
            };
        })
        .filter((s) => s.title);
}

function useTheme() {
    const [theme, setTheme] = useState<'light' | 'dark'>(
        () =>
            (typeof localStorage !== 'undefined' &&
                (localStorage.getItem('pp-theme') as 'light' | 'dark')) ||
            'dark',
    );

    useEffect(() => {
        localStorage.setItem('pp-theme', theme);
    }, [theme]);

    return [theme, setTheme] as const;
}

export default function Poker({ room }: { room?: RoomData }) {
    if (!room) {
        return <CreateRoomView />;
    }

    if (!room.me) {
        return <JoinRoomView room={room} />;
    }

    return <RoomSession key={room.code} room={room} me={room.me} />;
}

/* ─── Create room (landing on "/") ─── */
function CreateRoomView() {
    const [theme, setTheme] = useTheme();
    const [stories, setStories] = useState<
        { key: string | null; title: string }[]
    >([]);
    const [hostName, setHostName] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const addStories = (items: { key?: string | null; title: string }[]) =>
        setStories((prev) => [
            ...prev,
            ...items.map((s) => ({ key: s.key ?? null, title: s.title })),
        ]);

    const start = () => {
        if (!stories.length || submitting) {
            return;
        }

        setSubmitting(true);
        router.post(
            createRoom().url,
            {
                name: sessionName.trim() || 'Planning Poker',
                host_name: hostName.trim() || 'Host',
                stories,
            },
            { onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div className="pp3d" data-theme={theme}>
            <Head title="Planning Poker" />
            <div className="app">
                <Topbar theme={theme} setTheme={setTheme} phase="setup" />
                <main className="stage">
                    <SetupView
                        stories={stories}
                        hostName={hostName}
                        setHostName={setHostName}
                        sessionName={sessionName}
                        setSessionName={setSessionName}
                        submitting={submitting}
                        onAdd={addStories}
                        onRemove={(i) =>
                            setStories((p) => p.filter((_, x) => x !== i))
                        }
                        onStart={start}
                    />
                </main>
            </div>
        </div>
    );
}

/* ─── Join gate ─── */
function JoinRoomView({ room }: { room: RoomData }) {
    const [theme, setTheme] = useTheme();
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            mAnimate(
                ref.current,
                { opacity: [0, 1], y: [18, 0], scale: [0.96, 1] },
                { duration: 0.5, ease: EASE },
            );
        }
    }, []);

    const submit = () => {
        if (!name.trim() || submitting) {
            return;
        }

        setSubmitting(true);
        router.post(
            joinRoomAction(room.code).url,
            { name: name.trim() },
            { onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div className="pp3d" data-theme={theme}>
            <Head title={`Meedoen · ${room.name}`} />
            <div className="app">
                <Topbar theme={theme} setTheme={setTheme} phase="setup" />
                <main className="stage">
                    <div className="setup">
                        <div className="intro-card" ref={ref} style={{ margin: 'auto' }}>
                            <span className="badge primary">Je bent uitgenodigd</span>
                            <h1 className="intro-title">{room.name}</h1>
                            <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                                {room.players.length} aan tafel · geen account nodig
                            </p>
                            <div className="intro-divider"></div>
                            <input
                                className="input"
                                placeholder="Vul je naam in"
                                value={name}
                                maxLength={50}
                                autoFocus
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        submit();
                                    }
                                }}
                            />
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={submit}
                                disabled={!name.trim() || submitting}
                                style={{ width: '100%' }}
                            >
                                {submitting ? 'Bezig…' : 'Deelnemen'}{' '}
                                <Icon name="chevronRight" size={16} />
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

/* ─── Live session ─── */
function RoomSession({ room, me }: { room: RoomData; me: RoomMe }) {
    const [theme, setTheme] = useTheme();
    const [myVote, setMyVote] = useState<string | undefined>(undefined);
    const [pending, setPending] = useState(false);
    const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
    const [playersOpen, setPlayersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [manageOpen, setManageOpen] = useState(false);

    const { players, stories, current_round: round } = room;
    const isHost = me.is_host;

    const activeStory = useMemo(
        () =>
            stories.find((s) => s.id === room.current_story_id) ??
            stories.find((s) => s.status === 'pending') ??
            stories[stories.length - 1] ??
            null,
        [room.current_story_id, stories],
    );

    const isActiveRound = round != null && round.story_id === activeStory?.id;
    const stage: 'intro' | 'voting' | 'revealed' = !isActiveRound
        ? 'intro'
        : round!.shows_votes
          ? 'revealed'
          : 'voting';

    const phase: 'setup' | 'playing' | 'complete' =
        room.status === 'completed'
            ? 'complete'
            : stories.length === 0
              ? 'setup'
              : 'playing';

    // reset my local pick whenever the active round changes
    const roundId = round?.id ?? null;
    useEffect(() => {
        setMyVote(undefined);
    }, [roundId]);

    // ---- realtime ----
    const { channel } = useEchoPresence<{ code: string }>(
        `room.${room.code}`,
        '.room.updated',
        () => {
            router.reload({ only: ['room'] });
        },
        [room.code],
    );

    useEffect(() => {
        const presence = channel();

        if (!presence) {
            return;
        }

        presence.here((users: { id: number | string }[]) => {
            setOnlineIds(new Set(users.map((u) => Number(u.id))));
        });
        presence.joining((u: { id: number | string }) => {
            setOnlineIds((cur) => new Set(cur).add(Number(u.id)));
        });
        presence.leaving((u: { id: number | string }) => {
            setOnlineIds((cur) => {
                const next = new Set(cur);
                next.delete(Number(u.id));

                return next;
            });
        });
    }, [channel, room.code]);

    // ---- scene votes (face-down during voting, real on reveal) ----
    const sceneVotes = useMemo<Record<number, string>>(() => {
        const out: Record<number, string> = {};
        players.forEach((p) => {
            if (stage === 'revealed') {
                const v = displayVote(p.vote);

                if (v != null) {
                    out[p.id] = v;
                }
            } else if (p.has_voted) {
                out[p.id] =
                    p.id === me.id && myVote ? displayVote(myVote)! : '•';
            }
        });

        return out;
    }, [players, stage, me.id, myVote]);

    // ---- 3D scene lifecycle ----
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelsRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<InstanceType<typeof PokerScene> | null>(null);

    const scenePlayers = useMemo(
        () =>
            players.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                host: p.is_host,
                you: p.id === me.id,
            })),
        [players, me.id],
    );

    useEffect(() => {
        if (sceneRef.current) {
            sceneRef.current.setTheme(theme);
        }
    }, [theme]);

    useEffect(() => {
        if (phase !== 'playing' || !canvasRef.current || !labelsRef.current) {
            return;
        }

        const scene = new PokerScene(
            canvasRef.current,
            labelsRef.current,
            theme,
        );
        scene.setPlayers(scenePlayers);
        sceneRef.current = scene;

        return () => {
            scene.dispose();
            sceneRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // re-seat when the roster changes
    const rosterKey = scenePlayers.map((p) => `${p.id}:${p.name}`).join('|');
    useEffect(() => {
        sceneRef.current?.setPlayers(scenePlayers);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rosterKey]);

    // sync table cards
    useEffect(() => {
        if (!sceneRef.current) {
            return;
        }

        if (stage === 'voting') {
            sceneRef.current.syncVotes(sceneVotes);
        } else if (stage === 'revealed') {
            sceneRef.current.syncVotes(sceneVotes);
            sceneRef.current.reveal(sceneVotes);
        } else {
            sceneRef.current.resetRound();
            sceneRef.current.setCamera('intro');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneVotes, stage, roundId]);

    // ---- stats (revealed only) ----
    const numeric = useMemo(
        () =>
            stage === 'revealed'
                ? players
                      .map((p) => p.vote)
                      .filter((v) => v != null && !isNaN(parseFloat(v!)))
                      .map(Number)
                : [],
        [players, stage],
    );
    const avg = numeric.length
        ? numeric.reduce((a, b) => a + b, 0) / numeric.length
        : 0;
    const avgFmt = numeric.length ? avg.toFixed(1) : '—';
    const suggested = round?.suggested_estimate
        ? Number(round.suggested_estimate)
        : numeric.length
          ? FIB_NUMS.reduce(
                (p, c) => (Math.abs(c - avg) < Math.abs(p - avg) ? c : p),
                100,
            )
          : null;
    const dist = useMemo(() => {
        const d: Record<string, number> = {};
        FIB.forEach((v) => (d[v] = 0));

        if (stage === 'revealed') {
            players.forEach((p) => {
                const v = displayVote(p.vote);

                if (v != null) {
                    d[v] = (d[v] || 0) + 1;
                }
            });
        }

        return d;
    }, [players, stage]);
    const maxDist = Math.max(1, ...Object.values(dist));
    const consensus = useMemo<Consensus>(() => {
        if (!numeric.length) {
            return { pct: 0, label: '—', emoji: '🤔' };
        }

        const range = Math.max(...numeric) - Math.min(...numeric);
        const pct = Math.max(0, Math.min(1, 1 - range / 13));

        if (pct >= 0.95) {
            return { pct, label: 'Perfect!', emoji: '🎯' };
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
    }, [numeric]);

    // ---- actions ----
    const post = useCallback((url: string, data: Record<string, string | number | null> = {}) => {
        router.post(url, data, {
            preserveScroll: true,
            preserveState: true,
            only: ['room'],
            onStart: () => setPending(true),
            onFinish: () => setPending(false),
        });
    }, []);

    const handleVote = (card: string) => {
        if (stage !== 'voting') {
            return;
        }

        setMyVote(card);
        post(castVoteAction(room.code).url, { value: toServerValue(card) });
    };

    const handleStartVoting = () => {
        if (!isHost || !activeStory) {
            return;
        }

        post(startRoundAction(room.code).url, { story_id: activeStory.id });
    };

    const handleReveal = () => {
        if (!isHost || !round) {
            return;
        }

        post(revealRoundAction({ room: room.code, roomRound: round.id }).url);
    };

    const handleRevote = () => {
        if (!isHost || !round) {
            return;
        }

        post(revoteRoundAction({ room: room.code, roomRound: round.id }).url);
    };

    const handleAccept = () => {
        if (!isHost || !round) {
            return;
        }

        post(acceptRoundAction({ room: room.code, roomRound: round.id }).url, {
            estimate: suggested != null ? String(suggested) : null,
        });
    };

    const handleSelectStory = (story: RoomStory) => {
        if (!isHost) {
            return;
        }

        post(startRoundAction(room.code).url, { story_id: story.id });
    };

    const votedCount = players.filter((p) => p.has_voted).length;

    return (
        <div className="pp3d" data-theme={theme}>
            <Head title={`${room.name} · Planning Poker`} />

            <div className="app">
                <Topbar
                    theme={theme}
                    setTheme={setTheme}
                    phase={phase}
                    players={players}
                    onlineIds={onlineIds}
                    sceneVotes={sceneVotes}
                    revealed={stage === 'revealed'}
                    playersOpen={playersOpen}
                    setPlayersOpen={setPlayersOpen}
                    onInvite={() => setInviteOpen(true)}
                />

                <Sidebar
                    stories={stories}
                    currentStoryId={room.current_story_id}
                    phase={phase}
                    isHost={isHost}
                    onSelect={handleSelectStory}
                    onManage={() => setManageOpen(true)}
                />

                <main className="stage">
                    {phase === 'playing' && (
                        <>
                            <canvas id="poker-canvas" ref={canvasRef}></canvas>
                            <div className="scene-labels" ref={labelsRef}></div>
                        </>
                    )}

                    {phase === 'setup' && (
                        <div className="setup">
                            <div className="intro-card" style={{ margin: 'auto' }}>
                                <span className="badge primary">Lobby</span>
                                <h1 className="intro-title">{room.name}</h1>
                                <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                                    {isHost
                                        ? 'Voeg items toe om de sessie te starten.'
                                        : 'Wachten tot de host items toevoegt…'}
                                </p>
                                {isHost && (
                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={() => setManageOpen(true)}
                                    >
                                        <Icon name="plus" size={16} /> Items
                                        toevoegen
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {phase === 'complete' && (
                        <CompleteView stories={stories} />
                    )}

                    {phase === 'playing' && activeStory && (
                        <PlayHUD
                            stage={stage}
                            isHost={isHost}
                            pending={pending}
                            activeStory={activeStory}
                            stories={stories}
                            votedCount={votedCount}
                            totalVoters={players.length}
                            myVote={myVote}
                            onVote={handleVote}
                            onReveal={handleReveal}
                            onStartVoting={handleStartVoting}
                            onRevote={handleRevote}
                            onAccept={handleAccept}
                            avgFmt={avgFmt}
                            suggested={suggested}
                            dist={dist}
                            maxDist={maxDist}
                            consensus={consensus}
                        />
                    )}
                </main>
            </div>

            {inviteOpen && (
                <InviteModal
                    inviteUrl={room.invite_url}
                    onClose={() => setInviteOpen(false)}
                />
            )}

            {manageOpen && (
                <ManageStoriesModal
                    code={room.code}
                    onClose={() => setManageOpen(false)}
                />
            )}
        </div>
    );
}

/* ─── Topbar ─── */
function Topbar({
    theme,
    setTheme,
    phase,
    players,
    onlineIds,
    sceneVotes,
    revealed,
    playersOpen,
    setPlayersOpen,
    onInvite,
}: {
    theme: 'light' | 'dark';
    setTheme: (t: 'light' | 'dark') => void;
    phase: string;
    players?: RoomPlayer[];
    onlineIds?: Set<number>;
    sceneVotes?: Record<number, string>;
    revealed?: boolean;
    playersOpen?: boolean;
    setPlayersOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    onInvite?: () => void;
}) {
    return (
        <header className="topbar">
            <div className="brand">
                <div className="brand-mark">
                    <Icon name="cube" size={16} />
                </div>
                <span className="brand-name">Planning Poker</span>
            </div>
            <div className="spacer"></div>

            {players && setPlayersOpen && (
                <PlayersDropdown
                    open={playersOpen ?? false}
                    setOpen={setPlayersOpen}
                    players={players}
                    onlineIds={onlineIds ?? new Set()}
                    sceneVotes={sceneVotes ?? {}}
                    revealed={revealed ?? false}
                    phase={phase}
                    onInvite={onInvite}
                />
            )}

            {onInvite && (
                <button className="btn btn-primary" onClick={onInvite}>
                    <Icon name="invite" size={16} /> Uitnodigen
                </button>
            )}

            <div className="theme-switch" role="group" aria-label="Thema">
                <button
                    className={theme === 'light' ? 'on' : ''}
                    onClick={() => setTheme('light')}
                    aria-label="Licht"
                >
                    <Icon name="sun" size={15} />
                </button>
                <button
                    className={theme === 'dark' ? 'on' : ''}
                    onClick={() => setTheme('dark')}
                    aria-label="Donker"
                >
                    <Icon name="moon" size={14} />
                </button>
            </div>
        </header>
    );
}

function PlayersDropdown({
    open,
    setOpen,
    players,
    onlineIds,
    sceneVotes,
    revealed,
    phase,
    onInvite,
}: {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    players: RoomPlayer[];
    onlineIds: Set<number>;
    sceneVotes: Record<number, string>;
    revealed: boolean;
    phase: string;
    onInvite?: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) {
            return;
        }

        const onClick = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);

        return () => document.removeEventListener('mousedown', onClick);
    }, [open, setOpen]);
    const voted = players.filter((p) => p.has_voted).length;

    return (
        <div className="dropdown-host" ref={ref}>
            <button
                className={'players-btn' + (open ? ' open' : '')}
                onClick={() => setOpen((o) => !o)}
            >
                <div className="avatar-stack">
                    {players.slice(0, 3).map((p) => (
                        <div
                            className="avatar xs"
                            key={p.id}
                            style={{ background: p.color }}
                        >
                            {p.name[0]}
                        </div>
                    ))}
                </div>
                <span>
                    Spelers <b>{players.length}</b>
                    {phase === 'playing' && !revealed && (
                        <span className="vote-counter">
                            {' '}
                            · {voted}/{players.length}
                        </span>
                    )}
                </span>
                <Icon name="chevronDown" size={14} />
            </button>
            {open && (
                <div className="dropdown-panel">
                    <div className="dropdown-head">
                        <span>Aan tafel</span>
                        <span style={{ textTransform: 'none', letterSpacing: 0 }}>
                            {onlineIds.size} online
                        </span>
                    </div>
                    <div className="players-list">
                        {players.map((p) => (
                            <div className="player-row" key={p.id}>
                                <div
                                    className="avatar sm"
                                    style={{ background: p.color }}
                                >
                                    {p.name[0]}
                                </div>
                                <span className="name">{p.name}</span>
                                {p.is_host && (
                                    <span
                                        style={{
                                            color: 'hsl(var(--warning))',
                                            display: 'inline-flex',
                                        }}
                                    >
                                        <Icon name="crown" size={13} />
                                    </span>
                                )}
                                <span
                                    className="online-dot"
                                    style={{
                                        opacity: onlineIds.has(p.id) ? 1 : 0.25,
                                    }}
                                ></span>
                                <span
                                    className={
                                        'row-status' +
                                        (phase === 'playing' &&
                                        !revealed &&
                                        p.has_voted
                                            ? ' voted'
                                            : '')
                                    }
                                >
                                    {phase !== 'playing'
                                        ? 'lobby'
                                        : revealed
                                          ? (displayVote(p.vote) ?? '—')
                                          : p.has_voted
                                            ? '✓'
                                            : 'denkt…'}
                                </span>
                            </div>
                        ))}
                    </div>
                    {onInvite && (
                        <div className="dropdown-foot">
                            <button
                                className="btn btn-ghost btn-sm"
                                style={{
                                    width: '100%',
                                    color: 'hsl(var(--primary))',
                                }}
                                onClick={onInvite}
                            >
                                <Icon name="invite" size={14} /> Speler
                                uitnodigen
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── Sidebar ─── */
function Sidebar({
    stories,
    currentStoryId,
    phase,
    isHost,
    onSelect,
    onManage,
}: {
    stories: RoomStory[];
    currentStoryId: number | null;
    phase: string;
    isHost: boolean;
    onSelect: (story: RoomStory) => void;
    onManage: () => void;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (listRef.current) {
            mAnimate(
                listRef.current.querySelectorAll('.story-item'),
                { opacity: [0, 1], x: [-8, 0] },
                { duration: 0.35, delay: stagger(0.03), ease: EASE },
            );
        }
    }, [stories.length]);

    return (
        <aside className="sidebar">
            <div className="sidebar-head">
                <h3>Backlog</h3>
                <span className="badge">
                    {stories.length
                        ? `${stories.filter((s) => s.status !== 'estimated').length} open`
                        : 'leeg'}
                </span>
            </div>
            <div className="story-list" ref={listRef}>
                {stories.length === 0 && (
                    <div className="empty-hint">
                        Nog geen items.
                        <br />
                        {isHost
                            ? 'Voeg items toe om te beginnen.'
                            : 'Wachten op de host.'}
                    </div>
                )}
                {stories.map((s) => (
                    <button
                        key={s.id}
                        className={
                            'story-item' +
                            (phase === 'playing' && s.id === currentStoryId
                                ? ' active'
                                : '') +
                            (s.status === 'estimated' ? ' done' : '')
                        }
                        onClick={() => onSelect(s)}
                        disabled={!isHost}
                    >
                        <div className="story-check">
                            {s.status === 'estimated' && (
                                <Icon name="check" size={11} />
                            )}
                        </div>
                        <div className="story-body">
                            {s.key && <span className="story-key">{s.key}</span>}
                            <div className="story-title">{s.title}</div>
                        </div>
                        <div
                            className={
                                'story-est' +
                                (s.final_estimate != null ? ' has' : '')
                            }
                        >
                            {s.final_estimate != null ? s.final_estimate : '—'}
                        </div>
                    </button>
                ))}
            </div>
            {phase === 'playing' && isHost && (
                <div className="sidebar-foot">
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={onManage}
                    >
                        <Icon name="edit" size={13} /> Items beheren
                    </button>
                </div>
            )}
        </aside>
    );
}

/* ─── Play HUD ─── */
function PlayHUD({
    stage,
    isHost,
    pending,
    activeStory,
    stories,
    votedCount,
    totalVoters,
    myVote,
    onVote,
    onReveal,
    onStartVoting,
    onRevote,
    onAccept,
    avgFmt,
    suggested,
    dist,
    maxDist,
    consensus,
}: {
    stage: string;
    isHost: boolean;
    pending: boolean;
    activeStory: RoomStory;
    stories: RoomStory[];
    votedCount: number;
    totalVoters: number;
    myVote: string | undefined;
    onVote: (v: string) => void;
    onReveal: () => void;
    onStartVoting: () => void;
    onRevote: () => void;
    onAccept: () => void;
    avgFmt: string;
    suggested: number | null;
    dist: Record<string, number>;
    maxDist: number;
    consensus: Consensus;
}) {
    const activeIdx = stories.findIndex((s) => s.id === activeStory.id);
    const totalStories = stories.length;
    const doneCount = stories.filter((s) => s.status === 'estimated').length;
    const isIntro = stage === 'intro';

    return (
        <>
            {isIntro && (
                <ItemIntro
                    activeStory={activeStory}
                    activeIdx={activeIdx}
                    totalStories={totalStories}
                    isHost={isHost}
                    onStart={onStartVoting}
                />
            )}

            {!isIntro && (
                <div className="hud">
                    <div className="play-header">
                        <div className="play-meta">
                            <span className="badge primary">
                                Item {activeIdx + 1} / {totalStories}
                            </span>
                            {activeStory.key && (
                                <span className="key">{activeStory.key}</span>
                            )}
                        </div>
                        <h2 className="play-title">{activeStory.title}</h2>
                        <div className="play-progress">
                            <div className="play-progress-bar">
                                <div
                                    className="play-progress-fill"
                                    style={{
                                        width: `${(doneCount / totalStories) * 100}%`,
                                    }}
                                ></div>
                            </div>
                            <span className="play-progress-text">
                                {doneCount} / {totalStories} ingeschat
                            </span>
                        </div>
                    </div>

                    <div className="hud-center">
                        {stage !== 'revealed' ? (
                            <div className="reveal-cta">
                                <div className="table-status">
                                    <span className="dot"></span>
                                    {votedCount === 0
                                        ? 'Kies een kaart'
                                        : `${votedCount} / ${totalVoters} gestemd`}
                                </div>
                                {isHost ? (
                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={onReveal}
                                        disabled={votedCount === 0 || pending}
                                    >
                                        <Icon name="eye" size={16} /> Onthul
                                        kaarten
                                    </button>
                                ) : (
                                    <div className="table-status">
                                        Wachten tot de host onthult…
                                    </div>
                                )}
                            </div>
                        ) : (
                            <ResultsPanel
                                isHost={isHost}
                                pending={pending}
                                avgFmt={avgFmt}
                                suggested={suggested}
                                dist={dist}
                                maxDist={maxDist}
                                consensus={consensus}
                                onRevote={onRevote}
                                onAccept={onAccept}
                            />
                        )}
                    </div>

                    {stage !== 'revealed' && (
                        <Dock myVote={myVote} onVote={onVote} disabled={pending} />
                    )}
                </div>
            )}
        </>
    );
}

function ItemIntro({
    activeStory,
    activeIdx,
    totalStories,
    isHost,
    onStart,
}: {
    activeStory: RoomStory;
    activeIdx: number;
    totalStories: number;
    isHost: boolean;
    onStart: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        mAnimate(
            el.querySelector('.intro-card'),
            { opacity: [0, 1], y: [18, 0], scale: [0.96, 1] },
            { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] },
        );
    }, [activeStory.id]);

    return (
        <div className="intro" ref={ref}>
            <div className="intro-card">
                <span className="badge primary">
                    Item {activeIdx + 1} van {totalStories}
                </span>
                {activeStory.key && (
                    <span className="intro-key">{activeStory.key}</span>
                )}
                <h1 className="intro-title">{activeStory.title}</h1>
                <div className="intro-divider"></div>
                {isHost ? (
                    <button className="btn btn-primary btn-lg" onClick={onStart}>
                        Begin met stemmen <Icon name="chevronRight" size={16} />
                    </button>
                ) : (
                    <span className="intro-hint">
                        Wachten tot de host de stemronde start…
                    </span>
                )}
            </div>
        </div>
    );
}

function Dock({
    myVote,
    onVote,
    disabled,
}: {
    myVote: string | undefined;
    onVote: (v: string) => void;
    disabled: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            mAnimate(
                ref.current.querySelectorAll('.pcard-2d'),
                { opacity: [0, 1], y: [16, 0] },
                { duration: 0.4, delay: stagger(0.035), ease: EASE },
            );
        }
    }, []);

    return (
        <div className="dock">
            <div className="dock-label">Gooi je kaart op tafel</div>
            <div className="cards" ref={ref}>
                {FIB.map((v) => (
                    <button
                        key={v}
                        className={
                            'pcard-2d' +
                            (myVote === v ? ' selected' : '') +
                            (v === '☕' ? ' coffee' : '')
                        }
                        onClick={() => onVote(v)}
                        disabled={disabled}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
}

function ResultsPanel({
    isHost,
    pending,
    avgFmt,
    suggested,
    dist,
    maxDist,
    consensus,
    onRevote,
    onAccept,
}: {
    isHost: boolean;
    pending: boolean;
    avgFmt: string;
    suggested: number | null;
    dist: Record<string, number>;
    maxDist: number;
    consensus: Consensus;
    onRevote: () => void;
    onAccept: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        mAnimate(
            el,
            { opacity: [0, 1], y: [24, 0], scale: [0.95, 1] },
            { duration: 0.5, ease: EASE },
        );
        mAnimate(
            el.querySelectorAll('.dist-bar'),
            { scaleY: [0, 1] },
            {
                duration: 0.5,
                delay: stagger(0.03, { startDelay: 0.25 }),
                ease: EASE,
            },
        );
    }, []);

    return (
        <div className="results-panel card" ref={ref}>
            <div className="results-stats">
                <div className="stat">
                    <div className="stat-label">Gemiddelde</div>
                    <div className="stat-value">{avgFmt}</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Suggestie</div>
                    <div className="stat-value accent">{suggested ?? '—'}</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Akkoord</div>
                    <div className="stat-value">
                        <span className="emoji">{consensus.emoji}</span>
                    </div>
                    <div className="stat-sub">{consensus.label}</div>
                </div>
            </div>
            <div className="dist">
                {FIB.map((v) => {
                    const c = dist[v] || 0;

                    return (
                        <div className="dist-col" key={v}>
                            <div
                                className={'dist-bar' + (c === 0 ? ' zero' : '')}
                                style={{
                                    height: c
                                        ? `${(c / maxDist) * 100}%`
                                        : '4px',
                                }}
                            >
                                {c > 0 && <span className="count">{c}</span>}
                            </div>
                            <span className="dist-lbl">{v}</span>
                        </div>
                    );
                })}
            </div>
            {isHost ? (
                <div className="results-actions">
                    <button
                        className="btn btn-outline"
                        onClick={onRevote}
                        disabled={pending}
                    >
                        <Icon name="rotate" size={14} /> Opnieuw stemmen
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={onAccept}
                        disabled={pending}
                    >
                        Accepteer {suggested ?? '—'}{' '}
                        <Icon name="chevronRight" size={14} />
                    </button>
                </div>
            ) : (
                <div className="results-actions">
                    <span className="intro-hint">
                        Wachten tot de host een schatting accepteert…
                    </span>
                </div>
            )}
        </div>
    );
}

/* ─── Setup (create room) ─── */
function SetupView({
    stories,
    hostName,
    setHostName,
    sessionName,
    setSessionName,
    submitting,
    onAdd,
    onRemove,
    onStart,
}: {
    stories: { key: string | null; title: string }[];
    hostName: string;
    setHostName: (v: string) => void;
    sessionName: string;
    setSessionName: (v: string) => void;
    submitting: boolean;
    onAdd: (items: { key?: string | null; title: string }[]) => void;
    onRemove: (i: number) => void;
    onStart: () => void;
}) {
    const [draft, setDraft] = useState('');
    const [drag, setDrag] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (rootRef.current) {
            mAnimate(
                rootRef.current.querySelectorAll(
                    '.setup-head, .setup-card, .pending',
                ),
                { opacity: [0, 1], y: [16, 0] },
                { duration: 0.5, delay: stagger(0.07), ease: EASE },
            );
        }
    }, []);

    const submit = () => {
        const items = draft
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((title) => ({ title }));

        if (items.length) {
            onAdd(items);
            setDraft('');
        }
    };
    const readFile = (f: File) => {
        const r = new FileReader();
        r.onload = () => {
            const p = parseCsv(String(r.result));

            if (p.length) {
                onAdd(p);
            }
        };
        r.readAsText(f);
    };
    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];

        if (f) {
            readFile(f);
        }

        e.target.value = '';
    };

    return (
        <div
            className="setup"
            ref={rootRef}
            onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];

                if (f) {
                    readFile(f);
                }
            }}
        >
            <div className="setup-head">
                <span className="badge primary">Nieuwe sessie</span>
                <h1>Welke items ga je vandaag inschatten?</h1>
                <p>
                    Voeg items toe of importeer een CSV. Daarna maak je een room
                    aan en deel je de link — niemand hoeft een account.
                </p>
            </div>

            <div className="setup-grid">
                <div className="card setup-card">
                    <div className="setup-card-head">
                        <div className="setup-icon">
                            <Icon name="edit" size={16} />
                        </div>
                        <div>
                            <h3>Handmatig toevoegen</h3>
                            <p>Plak of typ items — één per regel.</p>
                        </div>
                    </div>
                    <textarea
                        className="textarea"
                        placeholder={
                            'Login flow vernieuwen\nDashboard performance audit\nSlack notificaties herzien'
                        }
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="setup-card-foot">
                        <span className="hint">
                            {draft.split(/\n/).filter((l) => l.trim()).length}{' '}
                            regel(s)
                        </span>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={submit}
                            disabled={!draft.trim()}
                        >
                            <Icon name="plus" size={14} /> Toevoegen
                        </button>
                    </div>
                </div>

                <div className="card setup-card">
                    <div className="setup-card-head">
                        <div className="setup-icon">
                            <Icon name="upload" size={16} />
                        </div>
                        <div>
                            <h3>CSV importeren</h3>
                            <p>
                                <code>POK-101, Titel</code> of alleen de titel.
                            </p>
                        </div>
                    </div>
                    <button
                        className={'dropzone' + (drag ? ' drag' : '')}
                        onClick={() => fileRef.current?.click()}
                    >
                        <Icon name="upload" size={22} />
                        <div className="dz-title">Klik of sleep een CSV</div>
                        <div className="dz-sub">comma / semicolon · UTF-8</div>
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv,text/plain"
                        style={{ display: 'none' }}
                        onChange={onFile}
                    />
                    <div className="setup-card-foot">
                        <span className="hint">één item per regel</span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                                onAdd([
                                    {
                                        key: 'POK-201',
                                        title: 'Zoekfilter onthouden tussen sessies',
                                    },
                                    {
                                        key: 'POK-202',
                                        title: 'Bulk archiveren van afgeronde tickets',
                                    },
                                    {
                                        key: 'POK-203',
                                        title: 'Realtime presence in retro board',
                                    },
                                ])
                            }
                        >
                            <Icon name="sparkle" size={14} /> Voorbeeld
                        </button>
                    </div>
                </div>
            </div>

            {stories.length > 0 && (
                <div className="card pending">
                    <div className="pending-head">
                        <h3>
                            {stories.length}{' '}
                            {stories.length === 1 ? 'item' : 'items'} klaar
                        </h3>
                        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                            <input
                                className="input"
                                placeholder="Sessienaam"
                                value={sessionName}
                                maxLength={255}
                                onChange={(e) => setSessionName(e.target.value)}
                            />
                            <input
                                className="input"
                                placeholder="Jouw naam"
                                value={hostName}
                                maxLength={50}
                                onChange={(e) => setHostName(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={onStart}
                                disabled={submitting}
                            >
                                {submitting ? 'Bezig…' : 'Start sessie'}{' '}
                                <Icon name="chevronRight" size={16} />
                            </button>
                        </div>
                    </div>
                    <ol className="pending-list">
                        {stories.map((s, i) => (
                            <li key={`${s.key ?? ''}-${i}`}>
                                {s.key && (
                                    <span className="pending-key">{s.key}</span>
                                )}
                                <span className="pending-title">{s.title}</span>
                                <button
                                    className="row-remove"
                                    onClick={() => onRemove(i)}
                                    aria-label="Verwijderen"
                                >
                                    <Icon name="trash" size={14} />
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}

function CompleteView({ stories }: { stories: RoomStory[] }) {
    const total = stories.reduce(
        (a, s) => a + (Number(s.final_estimate) || 0),
        0,
    );
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            mAnimate(
                ref.current.querySelectorAll(
                    '.complete-emoji, h1, p, .complete-row, .complete-actions',
                ),
                { opacity: [0, 1], y: [14, 0] },
                { duration: 0.45, delay: stagger(0.05), ease: EASE },
            );
        }
    }, []);

    return (
        <div className="complete" ref={ref}>
            <div className="complete-emoji">🎉</div>
            <h1>Sessie afgerond</h1>
            <p>
                {stories.length} items ingeschat · totaal <b>{total}</b> punten
            </p>
            <div className="complete-list">
                {stories.map((s) => (
                    <div className="complete-row" key={s.id}>
                        {s.key && <span className="story-key">{s.key}</span>}
                        <span className="complete-title">{s.title}</span>
                        <span className="story-est has">
                            {s.final_estimate ?? '—'}
                        </span>
                    </div>
                ))}
            </div>
            <div className="complete-actions" style={{ display: 'flex', gap: 9 }}>
                <button
                    className="btn btn-primary"
                    onClick={() => router.visit('/')}
                >
                    Nieuwe sessie
                </button>
            </div>
        </div>
    );
}

function InviteModal({
    inviteUrl,
    onClose,
}: {
    inviteUrl: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            mAnimate(
                ref.current,
                { opacity: [0, 1], y: [12, 0], scale: [0.97, 1] },
                { duration: 0.25, ease: EASE },
            );
        }
    }, []);

    const copy = () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(inviteUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
            });
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" ref={ref} onClick={(e) => e.stopPropagation()}>
                <h2>Spelers uitnodigen</h2>
                <div className="sub">
                    Iedereen met de link kan stemmen. Geen account nodig.
                </div>
                <div className="link-row">
                    <input className="input" readOnly value={inviteUrl} />
                    <button
                        className={'btn ' + (copied ? 'btn-secondary' : 'btn-primary')}
                        onClick={copy}
                    >
                        {copied ? (
                            <>
                                <Icon name="check" size={14} /> Gekopieerd
                            </>
                        ) : (
                            <>
                                <Icon name="copy" size={14} /> Kopieer
                            </>
                        )}
                    </button>
                </div>
                <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: 16 }}
                    onClick={onClose}
                >
                    Sluiten
                </button>
            </div>
        </div>
    );
}

function ManageStoriesModal({
    code,
    onClose,
}: {
    code: string;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            mAnimate(
                ref.current,
                { opacity: [0, 1], y: [12, 0], scale: [0.97, 1] },
                { duration: 0.25, ease: EASE },
            );
        }
    }, []);

    const submit = () => {
        const stories = draft
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((title) => ({ title }));

        if (!stories.length || submitting) {
            return;
        }

        setSubmitting(true);
        router.post(
            storeStoriesAction(code).url,
            { stories },
            {
                preserveScroll: true,
                only: ['room'],
                onSuccess: () => onClose(),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" ref={ref} onClick={(e) => e.stopPropagation()}>
                <h2>Items toevoegen</h2>
                <div className="sub">Eén item per regel.</div>
                <textarea
                    className="textarea"
                    placeholder={'Login flow vernieuwen\nDashboard audit'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{ minHeight: 140 }}
                />
                <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
                    <button
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                        onClick={onClose}
                    >
                        Annuleren
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={submit}
                        disabled={!draft.trim() || submitting}
                    >
                        <Icon name="plus" size={14} /> Toevoegen
                    </button>
                </div>
            </div>
        </div>
    );
}
