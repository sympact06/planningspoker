import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Copy,
    Sparkles,
    Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { dashboard, home, login, register } from '@/routes';

export default function Welcome({
    canRegister = true,
}: {
    canRegister?: boolean;
}) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Planning Poker" />

            <main className="min-h-svh bg-background text-foreground">
                <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-6 py-6 lg:px-8">
                    <header className="flex items-center justify-between gap-4">
                        <Link href={home()} className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
                                <Sparkles className="size-4" />
                            </div>
                            <span className="text-sm font-semibold">
                                Planpoker
                            </span>
                        </Link>

                        <nav className="flex items-center gap-2">
                            {auth.user ? (
                                <Button asChild>
                                    <Link href={dashboard()}>
                                        Dashboard
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button asChild variant="ghost">
                                        <Link href={login()}>Inloggen</Link>
                                    </Button>
                                    {canRegister && (
                                        <Button asChild variant="outline">
                                            <Link href={register()}>
                                                Registreren
                                            </Link>
                                        </Button>
                                    )}
                                </>
                            )}
                        </nav>
                    </header>

                    <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(520px,1fr)]">
                        <div className="max-w-2xl space-y-8">
                            <div className="space-y-5">
                                <Badge variant="outline" className="gap-2">
                                    <span className="size-2 rounded-full bg-emerald-500" />
                                    Live scrum estimation
                                </Badge>
                                <div className="space-y-4">
                                    <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                                        Planning Poker zonder rommel eromheen.
                                    </h1>
                                    <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                                        Importeer stories, stem verborgen en
                                        rond consensus direct af in een rustige
                                        shadcn interface.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Button asChild size="lg">
                                    <Link href={home()}>
                                        Start sessie
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                                {auth.user ? (
                                    <Button asChild size="lg" variant="outline">
                                        <Link href={dashboard()}>
                                            Naar dashboard
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button asChild size="lg" variant="outline">
                                        <Link href={login()}>Inloggen</Link>
                                    </Button>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <Metric label="Spelers" value="5" />
                                <Metric label="Stories" value="12" />
                                <Metric label="Consensus" value="84%" />
                            </div>
                        </div>

                        <Card className="overflow-hidden rounded-lg">
                            <CardHeader className="border-b bg-muted/40">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle>Sprint 42</CardTitle>
                                        <CardDescription>
                                            Grooming sessie
                                        </CardDescription>
                                    </div>
                                    <Badge>Voting</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5 p-5">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <PreviewTile
                                        icon={Users}
                                        label="Aanwezig"
                                        value="5/5"
                                    />
                                    <PreviewTile
                                        icon={Clock3}
                                        label="Timer"
                                        value="02:14"
                                    />
                                    <PreviewTile
                                        icon={BarChart3}
                                        label="Gemiddelde"
                                        value="5.4"
                                    />
                                </div>

                                <div className="rounded-lg border bg-background p-5">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <Badge variant="outline">
                                                POK-103
                                            </Badge>
                                            <h2 className="mt-3 text-xl font-semibold">
                                                Facilitator accepteert
                                                consensuswaarde
                                            </h2>
                                        </div>
                                        <Button variant="outline" size="icon">
                                            <Copy className="size-4" />
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className="mt-5 grid grid-cols-5 gap-2">
                                        {['1', '2', '3', '5', '8'].map(
                                            (value) => (
                                                <div
                                                    key={value}
                                                    className="flex aspect-[3/4] items-center justify-center rounded-md border bg-card text-lg font-semibold shadow-xs"
                                                >
                                                    {value}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border bg-background p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <CheckCircle2 className="size-4 text-emerald-500" />
                                            Sterk akkoord
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            De meeste stemmen liggen rond 5
                                            punten.
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-background p-4">
                                        <div className="text-sm font-medium">
                                            Volgende actie
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Accepteer 5 en ga door naar het
                                            volgende item.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </main>
        </>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function PreviewTile({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border bg-background p-4">
            <Icon className="mb-3 size-4 text-muted-foreground" />
            <div className="text-lg font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}
