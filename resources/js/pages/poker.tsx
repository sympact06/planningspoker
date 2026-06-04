// ============================================================
// Planning Poker 3D — React UI overlay. Drives the three.js
// PokerScene and animates the UI with motion.
// Ported from the Claude Design prototype (app3d.jsx).
// ============================================================
import { Head } from '@inertiajs/react';
import { animate, stagger } from 'motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/poker-icon';
import { PokerScene } from '@/lib/poker-scene';
import './poker.css';

const FIB = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
const FIB_NUMS = [0, 1, 2, 3, 5, 8, 13, 21];

type Player = {
    id: string;
    name: string;
    color: string;
    host?: boolean;
    you?: boolean;
};

type Story = {
    key: string;
    title: string;
    estimate: number | null;
    done: boolean;
};

type Votes = Record<string, string | undefined>;

type Consensus = { pct: number; label: string; emoji: string };

const PLAYERS: Player[] = [
    { id: 'p1', name: 'Olivier', color: '#2f7bf6', host: true },
    { id: 'p2', name: 'Tim', color: '#16a34a' },
    { id: 'p3', name: 'Sanne', color: '#f59e0b' },
    { id: 'p4', name: 'Maya', color: '#a855f7' },
    { id: 'p5', name: 'Russell', color: '#ef4444', you: true },
];

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function mAnimate(
    target: Element | NodeListOf<Element> | null,
    keyframes: Record<string, unknown>,
    options?: Record<string, unknown>,
) {
    if (!target) {
        return;
    }

    // motion accepts a single element, a NodeList, or an array of elements
    return animate(target as never, keyframes as never, options as never);
}

function fmtTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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

export default function Poker() {
    const [theme, setTheme] = useState<'light' | 'dark'>(
        () =>
            (typeof localStorage !== 'undefined' &&
                (localStorage.getItem('pp-theme') as 'light' | 'dark')) ||
            'dark',
    );

    const [phase, setPhase] = useState<'setup' | 'playing' | 'complete'>(
        'setup',
    );
    const [stage, setStage] = useState<
        'intro' | 'voting' | 'flipping' | 'revealed'
    >('intro');
    const [stories, setStories] = useState<Story[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const activeStory = stories[activeIdx];
    const players = PLAYERS;
    const me = useMemo(() => players.find((p) => p.you)!, [players]);

    const [votes, setVotes] = useState<Votes>({});
    const myVote = votes[me.id];

    const [timerRunning, setTimerRunning] = useState(false);
    const [timerSec, setTimerSec] = useState(0);

    // ---- 3D scene lifecycle ----
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelsRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<InstanceType<typeof PokerScene> | null>(null);

    useEffect(() => {
        localStorage.setItem('pp-theme', theme);

        if (sceneRef.current) {
            sceneRef.current.setTheme(theme);
        }
    }, [theme]);

    useEffect(() => {
        if (!timerRunning) {
            return;
        }

        const id = setInterval(() => setTimerSec((s) => s + 1), 1000);

        return () => clearInterval(id);
    }, [timerRunning]);

    useEffect(() => {
        if (phase !== 'playing' || !canvasRef.current || !labelsRef.current) {
            return;
        }

        const scene = new PokerScene(
            canvasRef.current,
            labelsRef.current,
            theme,
        );
        scene.setPlayers(players);
        sceneRef.current = scene;

        return () => {
            scene.dispose();
            sceneRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // keep scene votes in sync during voting
    useEffect(() => {
        if (phase === 'playing' && sceneRef.current && stage === 'voting') {
            sceneRef.current.syncVotes(votes);
        }
    }, [votes, stage, phase]);

    // bots vote after you do
    useEffect(() => {
        if (phase !== 'playing' || stage !== 'voting' || !myVote) {
            return;
        }

        const others = players.filter((p) => !p.you);
        const timers = others.map((p, i) => {
            if (votes[p.id]) {
                return null;
            }

            return setTimeout(
                () => {
                    setVotes((v) => {
                        if (v[p.id]) {
                            return v;
                        }

                        const yn = parseFloat(myVote);
                        let val: number;

                        if (isNaN(yn)) {
                            val = FIB_NUMS[1 + Math.floor(Math.random() * 4)];
                        } else {
                            const drift = [-1, 0, 0, 1, 2][
                                Math.floor(Math.random() * 5)
                            ];
                            val = FIB_NUMS.reduce(
                                (pr, c) =>
                                    Math.abs(c - (yn + drift)) <
                                    Math.abs(pr - (yn + drift))
                                        ? c
                                        : pr,
                                100,
                            );
                        }

                        return { ...v, [p.id]: String(val) };
                    });
                },
                700 + i * 750 + Math.random() * 500,
            );
        });

        return () => timers.forEach((t) => t && clearTimeout(t));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myVote, stage, phase]);

    const votedCount = players.filter((p) => votes[p.id] != null).length;
    const totalVoters = players.length;

    const castVote = (val: string) => {
        if (stage !== 'voting') {
            return;
        }

        setVotes((v) => ({
            ...v,
            [me.id]: v[me.id] === val ? undefined : val,
        }));

        if (!timerRunning) {
            setTimerRunning(true);
        }
    };

    const handleReveal = () => {
        if (votedCount === 0 || stage === 'flipping') {
            return;
        }

        setTimerRunning(false);
        setStage('flipping');

        if (sceneRef.current) {
            sceneRef.current.reveal(votes);
        }

        setTimeout(() => setStage('revealed'), 950);
    };

    const handleStartVoting = () => {
        setStage('voting');

        if (sceneRef.current) {
            sceneRef.current.setCamera('voting');
        }
    };

    const handleRevote = () => {
        setVotes({});
        setTimerSec(0);
        setTimerRunning(false);
        setStage('voting');

        if (sceneRef.current) {
            sceneRef.current.resetRound();
        }
    };

    const goToItem = useCallback((idx: number, asIntro = true) => {
        setActiveIdx(idx);
        setVotes({});
        setTimerSec(0);
        setTimerRunning(false);
        setStage(asIntro ? 'intro' : 'voting');

        if (sceneRef.current) {
            sceneRef.current.resetRound();
            sceneRef.current.setCamera(asIntro ? 'intro' : 'voting');
        }
    }, []);

    const handleAccept = (estimate: number | null) => {
        setStories((prev) =>
            prev.map((s, i) =>
                i === activeIdx ? { ...s, estimate, done: true } : s,
            ),
        );
        const nextIdx = stories.findIndex((s, i) => i > activeIdx && !s.done);

        if (nextIdx >= 0) {
            goToItem(nextIdx, true);
        } else {
            setVotes({});
            setActiveIdx(stories.length);
        }
    };

    // ---- stats ----
    const numeric = useMemo(
        () =>
            Object.values(votes)
                .filter((v) => v != null && !isNaN(parseFloat(v)))
                .map(Number),
        [votes],
    );
    const avg = numeric.length
        ? numeric.reduce((a, b) => a + b, 0) / numeric.length
        : 0;
    const avgFmt = numeric.length ? avg.toFixed(1) : '—';
    const suggested = numeric.length
        ? FIB_NUMS.reduce(
              (p, c) => (Math.abs(c - avg) < Math.abs(p - avg) ? c : p),
              100,
          )
        : null;
    const dist = useMemo(() => {
        const d: Record<string, number> = {};
        FIB.forEach((v) => (d[v] = 0));
        Object.values(votes).forEach((v) => {
            if (v != null) {
                d[v] = (d[v] || 0) + 1;
            }
        });

        return d;
    }, [votes]);
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

    // ---- setup helpers ----
    const addStories = (items: { key?: string | null; title: string }[]) =>
        setStories((prev) => {
            const start = prev.length;

            return [
                ...prev,
                ...items.map((s, i) => ({
                    key:
                        s.key ||
                        `POK-${String(101 + start + i).padStart(3, '0')}`,
                    title: s.title,
                    estimate: null,
                    done: false,
                })),
            ];
        });
    const startSession = () => {
        if (!stories.length) {
            return;
        }

        const first = stories.findIndex((s) => !s.done);
        setActiveIdx(first >= 0 ? first : 0);
        setStage('intro');
        setPhase('playing');
    };
    const resetAll = () => {
        setStories([]);
        setVotes({});
        setActiveIdx(0);
        setTimerSec(0);
        setTimerRunning(false);
        setStage('intro');
        setPhase('setup');
    };

    const allDone = stories.length > 0 && stories.every((s) => s.done);
    useEffect(() => {
        // Advance to the completion screen once every item has an estimate and
        // the active index has run past the end of the list.
        if (phase === 'playing' && allDone && activeIdx >= stories.length) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPhase('complete');
        }
    }, [activeIdx, allDone, phase, stories.length]);

    const [playersOpen, setPlayersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);

    return (
        <div className="pp3d" data-theme={theme}>
            <Head title="Planning Poker">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin=""
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600;700&display=swap"
                    rel="stylesheet"
                />
            </Head>

            <div className="app">
                <Topbar
                    theme={theme}
                    setTheme={setTheme}
                    phase={phase}
                    timerRunning={timerRunning}
                    timerSec={timerSec}
                    onTimer={() => setTimerRunning((r) => !r)}
                    players={players}
                    votes={votes}
                    revealed={stage === 'revealed'}
                    playersOpen={playersOpen}
                    setPlayersOpen={setPlayersOpen}
                    onInvite={() => setInviteOpen(true)}
                />

                <Sidebar
                    stories={stories}
                    phase={phase}
                    activeIdx={activeIdx}
                    onSelect={(i) => {
                        if (phase === 'playing') {
                            goToItem(i, true);
                        }
                    }}
                    onManage={() => setPhase('setup')}
                />

                <main className="stage">
                    {phase === 'playing' && (
                        <>
                            <canvas id="poker-canvas" ref={canvasRef}></canvas>
                            <div className="scene-labels" ref={labelsRef}></div>
                        </>
                    )}

                    {phase === 'setup' && (
                        <SetupView
                            stories={stories}
                            onAdd={addStories}
                            onRemove={(i) =>
                                setStories((p) => p.filter((_, x) => x !== i))
                            }
                            onStart={startSession}
                        />
                    )}

                    {phase === 'complete' && (
                        <CompleteView stories={stories} onRestart={resetAll} />
                    )}

                    {phase === 'playing' && activeStory && (
                        <PlayHUD
                            stage={stage}
                            activeStory={activeStory}
                            activeIdx={activeIdx}
                            totalStories={stories.length}
                            doneCount={stories.filter((s) => s.done).length}
                            votedCount={votedCount}
                            totalVoters={totalVoters}
                            myVote={myVote}
                            onVote={castVote}
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

            {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
        </div>
    );
}

/* ─── Topbar ─── */
function Topbar({
    theme,
    setTheme,
    phase,
    timerRunning,
    timerSec,
    onTimer,
    players,
    votes,
    revealed,
    playersOpen,
    setPlayersOpen,
    onInvite,
}: {
    theme: 'light' | 'dark';
    setTheme: (t: 'light' | 'dark') => void;
    phase: string;
    timerRunning: boolean;
    timerSec: number;
    onTimer: () => void;
    players: Player[];
    votes: Votes;
    revealed: boolean;
    playersOpen: boolean;
    setPlayersOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onInvite: () => void;
}) {
    return (
        <header className="topbar">
            <div className="brand">
                <div className="brand-mark">
                    <Icon name="cube" size={16} />
                </div>
                <span className="brand-name">Planning Poker</span>
                <span className="brand-sub">Sprint 42 · Grooming</span>
            </div>
            <div className="spacer"></div>

            {phase === 'playing' && (
                <button
                    className={'badge mono' + (timerRunning ? ' primary' : '')}
                    style={{ height: 36, padding: '0 12px', cursor: 'pointer' }}
                    onClick={onTimer}
                >
                    <Icon name={timerRunning ? 'pause' : 'play'} size={12} />
                    {fmtTime(timerSec)}
                </button>
            )}

            <PlayersDropdown
                open={playersOpen}
                setOpen={setPlayersOpen}
                players={players}
                votes={votes}
                revealed={revealed}
                phase={phase}
                onInvite={onInvite}
            />

            <button className="btn btn-primary" onClick={onInvite}>
                <Icon name="invite" size={16} /> Uitnodigen
            </button>

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
    votes,
    revealed,
    phase,
    onInvite,
}: {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    players: Player[];
    votes: Votes;
    revealed: boolean;
    phase: string;
    onInvite: () => void;
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
    const voted = players.filter((p) => votes[p.id] != null).length;

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
                        <span
                            style={{ textTransform: 'none', letterSpacing: 0 }}
                        >
                            {players.length} online
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
                                <span className="name">
                                    {p.name}
                                    {p.you && (
                                        <span className="muted"> (jij)</span>
                                    )}
                                </span>
                                {p.host && (
                                    <span
                                        style={{
                                            color: 'hsl(var(--warning))',
                                            display: 'inline-flex',
                                        }}
                                    >
                                        <Icon name="crown" size={13} />
                                    </span>
                                )}
                                <span className="online-dot"></span>
                                <span
                                    className={
                                        'row-status' +
                                        (phase === 'playing' &&
                                        !revealed &&
                                        votes[p.id]
                                            ? ' voted'
                                            : '')
                                    }
                                >
                                    {phase !== 'playing'
                                        ? 'lobby'
                                        : revealed
                                          ? (votes[p.id] ?? '—')
                                          : votes[p.id]
                                            ? '✓'
                                            : 'denkt…'}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="dropdown-foot">
                        <button
                            className="btn btn-ghost btn-sm"
                            style={{
                                width: '100%',
                                color: 'hsl(var(--primary))',
                            }}
                            onClick={onInvite}
                        >
                            <Icon name="invite" size={14} /> Speler uitnodigen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Sidebar ─── */
function Sidebar({
    stories,
    phase,
    activeIdx,
    onSelect,
    onManage,
}: {
    stories: Story[];
    phase: string;
    activeIdx: number;
    onSelect: (i: number) => void;
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
                        ? `${stories.filter((s) => !s.done).length} open`
                        : 'leeg'}
                </span>
            </div>
            <div className="story-list" ref={listRef}>
                {stories.length === 0 && (
                    <div className="empty-hint">
                        Nog geen items.
                        <br />
                        Voeg items toe om te beginnen.
                    </div>
                )}
                {stories.map((s, i) => (
                    <button
                        key={s.key}
                        className={
                            'story-item' +
                            (phase === 'playing' && i === activeIdx
                                ? ' active'
                                : '') +
                            (s.done ? ' done' : '')
                        }
                        onClick={() => onSelect(i)}
                    >
                        <div className="story-check">
                            {s.done && <Icon name="check" size={11} />}
                        </div>
                        <div className="story-body">
                            <span className="story-key">{s.key}</span>
                            <div className="story-title">{s.title}</div>
                        </div>
                        <div
                            className={
                                'story-est' + (s.estimate != null ? ' has' : '')
                            }
                        >
                            {s.estimate != null ? s.estimate : '—'}
                        </div>
                    </button>
                ))}
            </div>
            {phase === 'playing' && (
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

/* ─── Play HUD (overlays the 3D canvas) ─── */
function PlayHUD({
    stage,
    activeStory,
    activeIdx,
    totalStories,
    doneCount,
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
    activeStory: Story;
    activeIdx: number;
    totalStories: number;
    doneCount: number;
    votedCount: number;
    totalVoters: number;
    myVote: string | undefined;
    onVote: (v: string) => void;
    onReveal: () => void;
    onStartVoting: () => void;
    onRevote: () => void;
    onAccept: (v: number | null) => void;
    avgFmt: string;
    suggested: number | null;
    dist: Record<string, number>;
    maxDist: number;
    consensus: Consensus;
}) {
    const isIntro = stage === 'intro';

    return (
        <>
            {isIntro && (
                <ItemIntro
                    activeStory={activeStory}
                    activeIdx={activeIdx}
                    totalStories={totalStories}
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
                            <span className="key">{activeStory.key}</span>
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
                                    {stage === 'flipping'
                                        ? 'Kaarten draaien om…'
                                        : votedCount === 0
                                          ? 'Kies een kaart'
                                          : `${votedCount} / ${totalVoters} gestemd`}
                                </div>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={onReveal}
                                    disabled={
                                        votedCount === 0 || stage === 'flipping'
                                    }
                                >
                                    <Icon name="eye" size={16} />{' '}
                                    {stage === 'flipping'
                                        ? 'Onthullen…'
                                        : 'Onthul kaarten'}
                                </button>
                            </div>
                        ) : (
                            <ResultsPanel
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
                        <Dock
                            myVote={myVote}
                            onVote={onVote}
                            disabled={stage === 'flipping'}
                        />
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
    onStart,
}: {
    activeStory: Story;
    activeIdx: number;
    totalStories: number;
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
        mAnimate(
            el.querySelectorAll('.intro-card > *'),
            { opacity: [0, 1], y: [10, 0] },
            {
                duration: 0.45,
                delay: stagger(0.06, { startDelay: 0.12 }),
                ease: EASE,
            },
        );
    }, [activeStory.key]);

    return (
        <div className="intro" ref={ref}>
            <div className="intro-card">
                <span className="badge primary">
                    Item {activeIdx + 1} van {totalStories}
                </span>
                <span className="intro-key">{activeStory.key}</span>
                <h1 className="intro-title">{activeStory.title}</h1>
                <div className="intro-divider"></div>
                <button className="btn btn-primary btn-lg" onClick={onStart}>
                    Begin met stemmen <Icon name="chevronRight" size={16} />
                </button>
                <span className="intro-hint">
                    of kies direct een kaart hieronder
                </span>
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
    avgFmt,
    suggested,
    dist,
    maxDist,
    consensus,
    onRevote,
    onAccept,
}: {
    avgFmt: string;
    suggested: number | null;
    dist: Record<string, number>;
    maxDist: number;
    consensus: Consensus;
    onRevote: () => void;
    onAccept: (v: number | null) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const avgRef = useRef<HTMLDivElement>(null);
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
            el.querySelectorAll('.stat, .dist, .results-actions'),
            { opacity: [0, 1], y: [12, 0] },
            {
                duration: 0.45,
                delay: stagger(0.07, { startDelay: 0.15 }),
                ease: EASE,
            },
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
        // count-up average
        const num = parseFloat(avgFmt);

        if (avgRef.current && !isNaN(num)) {
            animate(0, num, {
                duration: 0.7,
                ease: 'easeOut',
                onUpdate: (v: number) => {
                    if (avgRef.current) {
                        avgRef.current.textContent = v.toFixed(1);
                    }
                },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="results-panel card" ref={ref}>
            <div className="results-stats">
                <div className="stat">
                    <div className="stat-label">Gemiddelde</div>
                    <div className="stat-value" ref={avgRef}>
                        {avgFmt}
                    </div>
                </div>
                <div className="stat">
                    <div className="stat-label">Suggestie</div>
                    <div className="stat-value accent">{suggested}</div>
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
                                className={
                                    'dist-bar' + (c === 0 ? ' zero' : '')
                                }
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
            <div className="results-actions">
                <button className="btn btn-outline" onClick={onRevote}>
                    <Icon name="rotate" size={14} /> Opnieuw stemmen
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => onAccept(suggested)}
                >
                    Accepteer {suggested} <Icon name="chevronRight" size={14} />
                </button>
            </div>
        </div>
    );
}

/* ─── Setup ─── */
function SetupView({
    stories,
    onAdd,
    onRemove,
    onStart,
}: {
    stories: Story[];
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
                <span className="badge primary">Stap 1 van 2</span>
                <h1>Welke items ga je vandaag inschatten?</h1>
                <p>
                    Voeg items handmatig toe of importeer een CSV. Daarna start
                    je de sessie en komen ze één voor één op de 3D-tafel.
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
                                    {
                                        key: 'POK-204',
                                        title: 'Slack: dagelijkse summary van closed items',
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
                        <button className="btn btn-primary" onClick={onStart}>
                            Start sessie <Icon name="chevronRight" size={16} />
                        </button>
                    </div>
                    <ol className="pending-list">
                        {stories.map((s, i) => (
                            <li key={s.key}>
                                <span className="pending-key">{s.key}</span>
                                <span className="pending-title">{s.title}</span>
                                {s.estimate != null && (
                                    <span className="story-est has">
                                        {s.estimate}
                                    </span>
                                )}
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

function CompleteView({
    stories,
    onRestart,
}: {
    stories: Story[];
    onRestart: () => void;
}) {
    const total = stories.reduce((a, s) => a + (s.estimate || 0), 0);
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
                    <div className="complete-row" key={s.key}>
                        <span className="story-key">{s.key}</span>
                        <span className="complete-title">{s.title}</span>
                        <span className="story-est has">
                            {s.estimate ?? '—'}
                        </span>
                    </div>
                ))}
            </div>
            <div
                className="complete-actions"
                style={{ display: 'flex', gap: 9 }}
            >
                <button className="btn btn-outline">
                    <Icon name="upload" size={14} /> Exporteer CSV
                </button>
                <button className="btn btn-primary" onClick={onRestart}>
                    Nieuwe sessie
                </button>
            </div>
        </div>
    );
}

function InviteModal({ onClose }: { onClose: () => void }) {
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

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal"
                ref={ref}
                onClick={(e) => e.stopPropagation()}
            >
                <h2>Spelers uitnodigen</h2>
                <div className="sub">
                    Iedereen met de link kan stemmen. Geen account nodig.
                </div>
                <div className="link-row">
                    <input
                        className="input"
                        readOnly
                        value="poker.app/r/sprint-42-grooming"
                    />
                    <button
                        className={
                            'btn ' + (copied ? 'btn-secondary' : 'btn-primary')
                        }
                        onClick={() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1600);
                        }}
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
                <div className="share-row">
                    <button className="btn btn-outline">
                        <Icon name="mail" size={15} /> E-mail
                    </button>
                    <button className="btn btn-outline">
                        <Icon name="link" size={15} /> Slack
                    </button>
                    <button className="btn btn-outline">
                        <Icon name="qr" size={15} /> QR
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
