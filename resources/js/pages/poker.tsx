import { Head } from '@inertiajs/react';
import {
    type ChangeEvent,
    type Dispatch,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import '../../css/poker.css';
import { Icon } from '@/components/poker/icon';

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
    { id: 'p1', name: 'Olivier', color: 'oklch(0.78 0.13 230)', host: true },
    { id: 'p2', name: 'Tim', color: 'oklch(0.78 0.13 160)' },
    { id: 'p3', name: 'Sanne', color: 'oklch(0.82 0.14 75)' },
    { id: 'p4', name: 'Maya', color: 'oklch(0.74 0.16 295)' },
    { id: 'p5', name: 'Russell', color: 'oklch(0.78 0.13 230)', you: true },
];

function fmtTime(s: number) {
    const m = Math.floor(s / 60)
        .toString()
        .padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
}

function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuote = true;
        } else if (ch === ',' || ch === ';') {
            fields.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    fields.push(cur);
    return fields.map((f) => f.trim());
}

const TITLE_HEADERS = ['title', 'name', 'summary', 'subject', 'titel'];
const KEY_HEADER_ORDER = ['iid', 'key', 'number', 'id'];

function parseCsv(text: string): NewStory[] {
    const rawLines = text.split(/\r?\n/);
    // Re-join lines that were split inside a quoted field
    const lines: string[] = [];
    let buf = '';
    let openQuotes = 0;
    for (const raw of rawLines) {
        buf = buf ? `${buf}\n${raw}` : raw;
        openQuotes += (raw.match(/"/g) || []).length;
        if (openQuotes % 2 === 0) {
            if (buf.trim()) lines.push(buf);
            buf = '';
            openQuotes = 0;
        }
    }
    if (buf.trim()) lines.push(buf);
    if (!lines.length) return [];

    const headerFields = parseCsvLine(lines[0]).map((f) => f.toLowerCase());
    const titleIdx = headerFields.findIndex((h) => TITLE_HEADERS.includes(h));

    if (titleIdx >= 0) {
        let keyIdx = -1;
        for (const cand of KEY_HEADER_ORDER) {
            const found = headerFields.indexOf(cand);
            if (found >= 0) {
                keyIdx = found;
                break;
            }
        }
        return lines
            .slice(1)
            .map<NewStory>((line) => {
                const fields = parseCsvLine(line);
                const title = fields[titleIdx] || '';
                const rawKey = keyIdx >= 0 ? fields[keyIdx] : '';
                let key: string | null = null;
                if (rawKey) {
                    key = /^\d+$/.test(rawKey) ? `#${rawKey}` : rawKey;
                }
                return { key, title };
            })
            .filter((s) => s.title);
    }

    // No header — fall back to single-line heuristics
    return lines
        .map<NewStory>((line) => {
            const m = line.match(/^([A-Z]{2,}-\d+)[,;\s]+(.+)$/);
            if (m) {
                return {
                    key: m[1],
                    title: m[2].replace(/^["']|["']$/g, '').trim(),
                };
            }
            const fields = parseCsvLine(line);
            const title = (fields[0] || '').replace(/^["']|["']$/g, '');
            return { key: null, title };
        })
        .filter((s) => s.title);
}

type Phase = 'setup' | 'playing';
type PlayStage = 'intro' | 'voting' | 'flipping' | 'revealed';

export default function PokerPage() {
    const [phase, setPhase] = useState<Phase>('setup');
    const [stories, setStories] = useState<Story[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const activeStory = stories[activeIdx];

    const [players] = useState<Player[]>(INITIAL_PLAYERS);
    const me = players.find((p) => p.you)!;

    const [votes, setVotes] = useState<Record<string, CardValue | undefined>>({});
    const [playStage, setPlayStage] = useState<PlayStage>('intro');
    const revealed = playStage === 'revealed';
    const flipping = playStage === 'flipping' || playStage === 'revealed';
    const myVote = votes[me.id];

    const [timerRunning, setTimerRunning] = useState(false);
    const [timerSec, setTimerSec] = useState(0);
    useEffect(() => {
        if (!timerRunning) return;
        const id = setInterval(() => setTimerSec((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [timerRunning]);

    useEffect(() => {
        if (phase !== 'playing' || playStage !== 'voting') return;
        if (!myVote) return;
        const others = players.filter((p) => !p.you);
        const seedFor = (): CardValue => {
            const yourNum = parseFloat(myVote);
            if (isNaN(yourNum)) {
                return String(FIB_NUMS[Math.floor(Math.random() * 5) + 1]) as CardValue;
            }
            const drift = [-1, 0, 0, 1, 2][Math.floor(Math.random() * 5)];
            const target = yourNum + drift;
            const closest = FIB_NUMS.reduce(
                (p, c) => (Math.abs(c - target) < Math.abs(p - target) ? c : p),
                100,
            );
            return String(closest) as CardValue;
        };
        const timers = others.map((p, i) => {
            if (votes[p.id]) return null;
            return setTimeout(
                () =>
                    setVotes((v) => ({ ...v, [p.id]: seedFor() })),
                600 + i * 700 + Math.random() * 400,
            );
        });
        return () => {
            timers.forEach((tm) => {
                if (tm) clearTimeout(tm);
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myVote, phase, playStage]);

    const votedCount = players.filter((p) => votes[p.id] != null).length;
    const totalVoters = players.length;

    const castVote = (val: CardValue) => {
        if (playStage !== 'voting') return;
        setVotes((v) => ({ ...v, [me.id]: v[me.id] === val ? undefined : val }));
        if (!timerRunning) setTimerRunning(true);
    };

    const handleReveal = () => {
        if (votedCount === 0) return;
        setTimerRunning(false);
        setPlayStage('flipping');
        setTimeout(() => setPlayStage('revealed'), 650);
    };

    const handleStartVoting = () => setPlayStage('voting');

    const handleRevote = useCallback(() => {
        setPlayStage('voting');
        setVotes({});
        setTimerSec(0);
        setTimerRunning(false);
    }, []);

    const handleAccept = (estimate: number | null) => {
        setStories((prev) =>
            prev.map((s, i) => (i === activeIdx ? { ...s, estimate, done: true } : s)),
        );
        const nextIdx = stories.findIndex((s, i) => i > activeIdx && !s.done);
        setVotes({});
        setTimerSec(0);
        setTimerRunning(false);
        if (nextIdx >= 0) {
            setActiveIdx(nextIdx);
            setPlayStage('intro');
        } else {
            setActiveIdx(stories.length);
            setPlayStage('intro');
        }
    };

    const numericVotes = useMemo(
        () =>
            Object.values(votes)
                .filter((v): v is CardValue => v != null && !isNaN(parseFloat(v)))
                .map((v) => parseFloat(v)),
        [votes],
    );
    const avg = numericVotes.length
        ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
        : 0;
    const avgFmt = numericVotes.length ? avg.toFixed(1) : '—';
    const suggested = numericVotes.length
        ? FIB_NUMS.reduce(
              (p, c) => (Math.abs(c - avg) < Math.abs(p - avg) ? c : p),
              100,
          )
        : null;

    const dist = useMemo(() => {
        const d: Record<string, number> = {};
        FIB.forEach((v) => (d[v] = 0));
        Object.values(votes).forEach((v) => {
            if (v != null) d[v] = (d[v] || 0) + 1;
        });
        return d;
    }, [votes]);
    const maxDist = Math.max(1, ...Object.values(dist));

    const consensus: Consensus = useMemo(() => {
        if (!numericVotes.length) return { pct: 0, label: '—', emoji: '🤔' };
        const range = Math.max(...numericVotes) - Math.min(...numericVotes);
        const pct = Math.max(0, Math.min(1, 1 - range / 13));
        let label = 'Geen consensus';
        let emoji = '😬';
        if (pct >= 0.95) {
            label = 'Perfect!';
            emoji = '🎯';
        } else if (pct >= 0.75) {
            label = 'Sterk akkoord';
            emoji = '🙌';
        } else if (pct >= 0.5) {
            label = 'Redelijk';
            emoji = '👍';
        } else if (pct >= 0.25) {
            label = 'Discussie';
            emoji = '🤔';
        }
        return { pct, label, emoji };
    }, [numericVotes]);

    const [playersOpen, setPlayersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleAddStories = useCallback((newOnes: NewStory[]) => {
        setStories((prev) => {
            const startIdx = prev.length;
            const padded: Story[] = newOnes.map((s, i) => ({
                key:
                    s.key ||
                    `POK-${String(101 + startIdx + i).padStart(3, '0')}`,
                title: s.title,
                estimate: null,
                done: false,
            }));
            return [...prev, ...padded];
        });
    }, []);

    const handleStart = () => {
        if (!stories.length) return;
        const firstUndone = stories.findIndex((s) => !s.done);
        setActiveIdx(firstUndone >= 0 ? firstUndone : 0);
        setPlayStage('intro');
        setPhase('playing');
    };

    const handleBackToSetup = () => {
        setPhase('setup');
        handleRevote();
    };

    const allDone = stories.length > 0 && stories.every((s) => s.done);
    const doneCount = stories.filter((s) => s.done).length;

    return (
        <>
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
            <div className="poker-app">
                <div className="app">
                    <header className="topbar">
                        <div className="brand">
                            <div className="brand-mark">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M12 2 L4 12 L9 12 L9 22 L15 22 L15 12 L20 12 Z" />
                                </svg>
                            </div>
                            <button className="room-name" type="button">
                                <span>Sprint 42 — Grooming</span>
                                <Icon
                                    name="chevronDown"
                                    size={14}
                                    className="chev"
                                />
                            </button>
                        </div>
                        <div className="spacer" />

                        {phase === 'playing' && (
                            <div
                                className={`timer-chip ${timerRunning ? 'running' : ''}`}
                                onClick={() => setTimerRunning((r) => !r)}
                                role="button"
                                tabIndex={0}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="dot" />
                                <span>{fmtTime(timerSec)}</span>
                                <Icon
                                    name={timerRunning ? 'pause' : 'play'}
                                    size={12}
                                />
                            </div>
                        )}

                        <PlayersDropdown
                            open={playersOpen}
                            setOpen={setPlayersOpen}
                            players={players}
                            votes={votes}
                            revealed={revealed}
                            phase={phase}
                        />

                        <button
                            className="invite-btn"
                            type="button"
                            onClick={() => setInviteOpen(true)}
                        >
                            <Icon name="invite" size={16} />
                            <span>Uitnodigen</span>
                        </button>
                    </header>

                    <aside className="sidebar">
                        <div className="sidebar-head">
                            <h3>Backlog</h3>
                            <span className="story-counter">
                                {stories.length
                                    ? `${stories.filter((s) => !s.done).length} open`
                                    : 'leeg'}
                            </span>
                        </div>
                        <div className="story-list">
                            {stories.length === 0 && (
                                <div
                                    style={{
                                        padding: '20px 12px',
                                        color: 'var(--ink-3)',
                                        fontSize: 13,
                                        lineHeight: 1.5,
                                        textAlign: 'center',
                                    }}
                                >
                                    Voeg items toe om te beginnen.
                                </div>
                            )}
                            {stories.map((s, i) => (
                                <button
                                    type="button"
                                    key={s.key}
                                    className={`story-item ${
                                        phase === 'playing' && i === activeIdx
                                            ? 'active '
                                            : ''
                                    }${s.done ? 'done' : ''}`}
                                    onClick={() => {
                                        if (phase === 'playing') {
                                            setActiveIdx(i);
                                            handleRevote();
                                        }
                                    }}
                                >
                                    <div className="story-status">
                                        {s.done && (
                                            <Icon name="check" size={11} />
                                        )}
                                    </div>
                                    <div className="story-body">
                                        <span className="story-key">{s.key}</span>
                                        <div className="story-title">
                                            {s.title}
                                        </div>
                                    </div>
                                    <div
                                        className={`story-estimate ${
                                            s.estimate != null ? 'has' : ''
                                        }`}
                                    >
                                        {s.estimate != null ? s.estimate : '—'}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {phase === 'playing' && (
                            <button
                                type="button"
                                className="add-story"
                                onClick={handleBackToSetup}
                            >
                                <Icon name="plus" size={14} />
                                <span>Items beheren</span>
                            </button>
                        )}
                    </aside>

                    <main className="stage stage-full">
                        {phase === 'setup' ? (
                            <SetupView
                                stories={stories}
                                onAdd={handleAddStories}
                                onRemove={(i) =>
                                    setStories((prev) =>
                                        prev.filter((_, ix) => ix !== i),
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
                            <PlayingView
                                activeStory={activeStory}
                                players={players}
                                votes={votes}
                                playStage={playStage}
                                handleStartVoting={handleStartVoting}
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
                                avgFmt={avgFmt}
                                suggested={suggested}
                                dist={dist}
                                maxDist={maxDist}
                                consensus={consensus}
                                activeIdx={activeIdx}
                                totalStories={stories.length}
                                doneCount={doneCount}
                            />
                        )}
                    </main>

                    {inviteOpen && (
                        <InviteModal
                            onClose={() => setInviteOpen(false)}
                            copied={copied}
                            setCopied={setCopied}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

PokerPage.layout = null;

/* ─── Players dropdown ─────────────────────────────────────────── */
interface PlayersDropdownProps {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
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
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open, setOpen]);
    const votedCount = players.filter((p) => votes[p.id] != null).length;
    return (
        <div className="dropdown-host" ref={ref}>
            <button
                type="button"
                className={`players-btn ${open ? 'open' : ''}`}
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
                <span className="players-btn-text">
                    Spelers <b>{players.length}</b>
                    {phase === 'playing' && !revealed && (
                        <span className="vote-counter">
                            {' '}
                            · {votedCount}/{players.length}
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
                            style={{
                                color: 'var(--ink-3)',
                                fontWeight: 500,
                                fontSize: 11,
                            }}
                        >
                            {players.length} online
                        </span>
                    </div>
                    <div className="players-list">
                        {players.map((p) => (
                            <div className="player-row" key={p.id}>
                                <div
                                    className="avatar xs"
                                    style={{ background: p.color }}
                                >
                                    {p.name[0]}
                                </div>
                                <span className="name">
                                    {p.name}
                                    {p.you && (
                                        <span
                                            style={{
                                                color: 'var(--ink-3)',
                                                fontWeight: 400,
                                            }}
                                        >
                                            {' '}
                                            (jij)
                                        </span>
                                    )}
                                </span>
                                {p.host && (
                                    <span title="Host">
                                        <Icon
                                            name="crown"
                                            size={12}
                                            style={{ color: 'var(--warn)' }}
                                        />
                                    </span>
                                )}
                                <span className="online-dot" />
                                <span
                                    className={`status ${
                                        phase === 'playing'
                                            ? revealed
                                                ? ''
                                                : votes[p.id]
                                                  ? 'voted'
                                                  : ''
                                            : 'observer'
                                    }`}
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
                        <button type="button" className="dropdown-foot-btn">
                            <Icon name="invite" size={14} />
                            <span>Speler uitnodigen</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Setup view ─────────────────────────────────────────── */
interface SetupViewProps {
    stories: Story[];
    onAdd: (items: NewStory[]) => void;
    onRemove: (i: number) => void;
    onStart: () => void;
}

function SetupView({ stories, onAdd, onRemove, onStart }: SetupViewProps) {
    const [draft, setDraft] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const submitDraft = () => {
        const items: NewStory[] = draft
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((title) => ({ title }));
        if (!items.length) return;
        onAdd(items);
        setDraft('');
    };

    const onFile = (e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            const parsed = parseCsv(String(reader.result));
            if (parsed.length) onAdd(parsed);
        };
        reader.readAsText(f);
        e.target.value = '';
    };

    return (
        <div className="setup-wrap">
            <div className="setup-head">
                <span className="step-chip">Stap 1 van 2</span>
                <h1>Welke items ga je vandaag inschatten?</h1>
                <p>
                    Voeg items toe om de sessie te starten. Eén per regel, of
                    importeer een CSV.
                </p>
            </div>

            <div className="setup-grid">
                <div className="setup-card">
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
                        className="story-textarea"
                        placeholder={
                            'Login flow vernieuwen\nDashboard performance audit\nSlack notificaties opnieuw bekijken'
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
                            type="button"
                            className="btn-primary"
                            onClick={submitDraft}
                            disabled={!draft.trim()}
                        >
                            <Icon name="plus" size={14} />
                            Toevoegen
                        </button>
                    </div>
                </div>

                <div className="setup-card">
                    <div className="setup-card-head">
                        <div className="setup-icon">
                            <Icon name="link" size={16} />
                        </div>
                        <div>
                            <h3>CSV importeren</h3>
                            <p>
                                Eén item per regel. <code>POK-101, Title</code>{' '}
                                of alleen titel.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="dropzone"
                        onClick={() => fileRef.current?.click()}
                    >
                        <Icon name="link" size={24} />
                        <div className="dz-title">Klik om CSV te kiezen</div>
                        <div className="dz-sub">
                            of sleep een .csv bestand hierheen
                        </div>
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv,text/plain"
                        style={{ display: 'none' }}
                        onChange={onFile}
                    />
                    <div className="setup-card-foot">
                        <span className="hint">UTF-8 · comma/semicolon</span>
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() =>
                                onAdd([
                                    {
                                        key: 'POK-201',
                                        title: 'Voorbeeld: zoekfilter onthouden tussen sessies',
                                    },
                                    {
                                        key: 'POK-202',
                                        title: 'Voorbeeld: bulk archiveren van afgeronde tickets',
                                    },
                                    {
                                        key: 'POK-203',
                                        title: 'Voorbeeld: dark mode voor admin dashboard',
                                    },
                                ])
                            }
                        >
                            <Icon name="sparkle" size={14} />
                            Voorbeeld
                        </button>
                    </div>
                </div>
            </div>

            {stories.length > 0 && (
                <div className="pending">
                    <div className="pending-head">
                        <h3>
                            {stories.length}{' '}
                            {stories.length === 1 ? 'item' : 'items'} klaar
                        </h3>
                        <button
                            type="button"
                            className="btn-primary big"
                            onClick={onStart}
                        >
                            Start sessie
                            <Icon name="chevronRight" size={16} />
                        </button>
                    </div>
                    <ol className="pending-list">
                        {stories.map((s, i) => (
                            <li key={s.key}>
                                <span className="pending-key">{s.key}</span>
                                <span className="pending-title">{s.title}</span>
                                {s.estimate != null && (
                                    <span className="story-estimate has">
                                        {s.estimate}
                                    </span>
                                )}
                                <button
                                    type="button"
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

/* ─── Playing view ─────────────────────────────────────────── */
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
    castVote: (val: CardValue) => void;
    handleReveal: () => void;
    handleRevote: () => void;
    handleAccept: (estimate: number | null) => void;
    votedCount: number;
    totalVoters: number;
    avgFmt: string;
    suggested: number | null;
    dist: Record<string, number>;
    maxDist: number;
    consensus: Consensus;
    activeIdx: number;
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
    avgFmt,
    suggested,
    dist,
    maxDist,
    consensus,
    activeIdx,
    totalStories,
    doneCount,
}: PlayingViewProps) {
    const isIntro = playStage === 'intro';
    return (
        <>
            {!isIntro && (
                <div className="play-header" key={activeStory.key}>
                    <div className="play-meta">
                        <span className="step-chip small">
                            Item {activeIdx + 1} van {totalStories}
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
                            />
                        </div>
                        <span className="play-progress-text">
                            {doneCount} / {totalStories} ingeschat
                        </span>
                    </div>
                </div>
            )}

            {isIntro ? (
                <StoryIntro
                    activeStory={activeStory}
                    activeIdx={activeIdx}
                    totalStories={totalStories}
                    onStart={handleStartVoting}
                />
            ) : (
                <div className="table-area-clean">
                    <div className="seat-row top">
                        {players
                            .filter((p) => !p.you)
                            .map((p) => (
                                <Seat
                                    key={p.id}
                                    player={p}
                                    vote={votes[p.id]}
                                    revealed={revealed}
                                    flipping={flipping}
                                />
                            ))}
                    </div>

                    <div className="table-clean">
                        {playStage !== 'revealed' ? (
                            <>
                                <div className="table-status">
                                    <span className="table-status-dot" />
                                    {playStage === 'flipping'
                                        ? 'Kaarten draaien om…'
                                        : votedCount === 0
                                          ? 'Kies een kaart om te beginnen'
                                          : `${votedCount} van ${totalVoters} gestemd`}
                                </div>
                                <button
                                    type="button"
                                    className="reveal-btn"
                                    onClick={handleReveal}
                                    disabled={
                                        votedCount === 0 ||
                                        playStage === 'flipping'
                                    }
                                >
                                    {playStage === 'flipping'
                                        ? 'Onthullen…'
                                        : 'Onthul kaarten'}
                                </button>
                            </>
                        ) : (
                            <RevealPanel
                                key={`reveal-${activeStory.key}`}
                                avgFmt={avgFmt}
                                suggested={suggested}
                                consensus={consensus}
                                dist={dist}
                                maxDist={maxDist}
                                handleRevote={handleRevote}
                                handleAccept={handleAccept}
                            />
                        )}
                    </div>

                    <div className="seat-row bottom">
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
                <div className="dock">
                    <div className="dock-label">Gooi je kaart op tafel</div>
                    <div className="cards">
                        {FIB.map((v) => (
                            <button
                                type="button"
                                key={v}
                                className={`vote-card ${myVote === v ? 'selected ' : ''}${v === '☕' ? 'coffee' : ''}`}
                                onClick={() => castVote(v)}
                                disabled={playStage === 'flipping'}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

interface StoryIntroProps {
    activeStory: Story;
    activeIdx: number;
    totalStories: number;
    onStart: () => void;
}

function StoryIntro({
    activeStory,
    activeIdx,
    totalStories,
    onStart,
}: StoryIntroProps) {
    return (
        <div className="story-intro">
            <div className="intro-glow" />
            <div className="intro-step">
                Item {activeIdx + 1} van {totalStories}
            </div>
            <div className="intro-key">{activeStory.key}</div>
            <h1 className="intro-title">{activeStory.title}</h1>
            <div className="intro-divider">
                <span />
            </div>
            <button
                type="button"
                className="btn-primary big intro-start"
                onClick={onStart}
            >
                Begin met stemmen
                <Icon name="chevronRight" size={16} />
            </button>
            <div className="intro-hint">of druk op een kaart</div>
        </div>
    );
}

function RevealValue({ value }: { value: CardValue }) {
    const num = parseFloat(value);
    const [shown, setShown] = useState<number | string>(
        isNaN(num) ? value : 0,
    );
    useEffect(() => {
        if (isNaN(num)) {
            setShown(value);
            return;
        }
        const dur = 420;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const e = 1 - Math.pow(1 - t, 3);
            setShown(Math.round(num * e));
            if (t < 1) raf = requestAnimationFrame(tick);
            else setShown(num);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, num]);
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
    const prev = useRef<CardValue | undefined>(vote);
    useEffect(() => {
        if (vote != null && prev.current == null) {
            setJustThrown(true);
            const t = setTimeout(() => setJustThrown(false), 480);
            prev.current = vote;
            return () => clearTimeout(t);
        }
        prev.current = vote;
    }, [vote]);

    if (!player) return null;
    const hasVoted = vote != null;

    let wrapCls = 'pcard';
    if (!hasVoted) wrapCls += ' empty';
    if (hasVoted && (revealed || flipping)) wrapCls += ' flipped';
    if (justThrown && !revealed && !flipping) wrapCls += ' thrown';
    if (isYou) wrapCls += ' you';

    return (
        <div className="seat-inline">
            <div className={wrapCls}>
                <div className="pcard-face pcard-back">
                    {!hasVoted ? (
                        <span className="q">?</span>
                    ) : (
                        <span className="dot-back" />
                    )}
                </div>
                <div className="pcard-face pcard-front">
                    {hasVoted && revealed ? (
                        <RevealValue value={vote} />
                    ) : hasVoted ? (
                        vote
                    ) : (
                        ''
                    )}
                </div>
            </div>
            <div className="seat-name">
                <div
                    className="avatar xs"
                    style={{ background: player.color }}
                >
                    {player.name[0]}
                </div>
                <span>{player.name}</span>
                {isYou && <span className="you-tag">jij</span>}
            </div>
        </div>
    );
}

interface RevealPanelProps {
    avgFmt: string;
    suggested: number | null;
    consensus: Consensus;
    dist: Record<string, number>;
    maxDist: number;
    handleRevote: () => void;
    handleAccept: (estimate: number | null) => void;
}

function RevealPanel({
    avgFmt,
    suggested,
    consensus,
    dist,
    maxDist,
    handleRevote,
    handleAccept,
}: RevealPanelProps) {
    return (
        <div className="reveal-panel">
            <div className="reveal-stats">
                <div className="stat-block">
                    <div className="stat-label">Gemiddelde</div>
                    <div className="stat-value">{avgFmt}</div>
                </div>
                <div className="stat-divider" />
                <div className="stat-block accent">
                    <div className="stat-label">Suggestie</div>
                    <div className="stat-value">{suggested ?? '—'}</div>
                </div>
                <div className="stat-divider" />
                <div className="stat-block">
                    <div className="stat-label">Akkoord</div>
                    <div className="stat-value">
                        <span className="emoji">{consensus.emoji}</span>
                    </div>
                    <div className="stat-sub">{consensus.label}</div>
                </div>
            </div>

            <div className="dist mini">
                {FIB.map((v) => {
                    const c = dist[v] || 0;
                    const h = (c / maxDist) * 100;
                    return (
                        <div className="dist-col" key={v}>
                            <div
                                className={`dist-bar ${c === 0 ? 'zero' : ''}`}
                                style={{ height: c ? `${h}%` : '4px' }}
                            >
                                {c > 0 && <span className="count">{c}</span>}
                            </div>
                            <span className="lbl">{v}</span>
                        </div>
                    );
                })}
            </div>

            <div className="reveal-actions">
                <button
                    type="button"
                    className="next-btn"
                    onClick={handleRevote}
                >
                    <Icon name="rotate" size={14} />
                    Opnieuw stemmen
                </button>
                <button
                    type="button"
                    className="next-btn primary"
                    onClick={() => handleAccept(suggested)}
                >
                    Accepteer {suggested ?? '—'} → volgende
                    <Icon name="chevronRight" size={14} />
                </button>
            </div>
        </div>
    );
}

/* ─── Complete view ─────────────────────────────────────────── */
interface CompleteViewProps {
    stories: Story[];
    onRestart: () => void;
}

function CompleteView({ stories, onRestart }: CompleteViewProps) {
    const total = stories.reduce((a, s) => a + (s.estimate || 0), 0);
    return (
        <div className="complete-wrap">
            <div className="complete-icon">🎉</div>
            <h1>Sessie afgerond</h1>
            <p>
                {stories.length} items ingeschat · totaal <b>{total}</b> punten
            </p>
            <div className="complete-list">
                {stories.map((s) => (
                    <div className="complete-row" key={s.key}>
                        <span className="story-key">{s.key}</span>
                        <span className="complete-title">{s.title}</span>
                        <span className="story-estimate has">
                            {s.estimate ?? '—'}
                        </span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-ghost">
                    <Icon name="link" size={14} /> Exporteer CSV
                </button>
                <button
                    type="button"
                    className="btn-primary"
                    onClick={onRestart}
                >
                    Nieuwe sessie
                </button>
            </div>
        </div>
    );
}

/* ─── Invite modal ─────────────────────────────────────────── */
interface InviteModalProps {
    onClose: () => void;
    copied: boolean;
    setCopied: Dispatch<SetStateAction<boolean>>;
}

function InviteModal({ onClose, copied, setCopied }: InviteModalProps) {
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Spelers uitnodigen</h2>
                <div className="subtitle">
                    Iedereen met de link kan stemmen. Geen account nodig.
                </div>
                <div className="link-row">
                    <input
                        className="link-input"
                        readOnly
                        value="poker.app/r/sprint-42-grooming"
                    />
                    <button
                        type="button"
                        className={`btn-copy ${copied ? 'copied' : ''}`}
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
                    <button type="button" className="share-btn">
                        <Icon name="mail" size={15} />
                        E-mail
                    </button>
                    <button type="button" className="share-btn">
                        <Icon name="link" size={15} />
                        Slack
                    </button>
                    <button type="button" className="share-btn">
                        <Icon name="qr" size={15} />
                        QR code
                    </button>
                </div>
                <button
                    type="button"
                    className="modal-close"
                    onClick={onClose}
                >
                    Sluiten
                </button>
            </div>
        </div>
    );
}
