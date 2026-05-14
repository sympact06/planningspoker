import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import {
    create as createSession,
    store as storeSession,
} from '@/actions/App/Http/Controllers/PlanningSessionController';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseStoryText } from '@/lib/stories';
import { dashboard } from '@/routes';
import type { StoryInput, TeamSummary } from '@/types';

type CreateSessionProps = {
    teams: Pick<TeamSummary, 'id' | 'name' | 'role'>[];
};

type CreateSessionForm = {
    team_id: number;
    name: string;
    stories: StoryInput[];
};

const initialStories = `POK-101 Login flow afronden
POK-102 Realtime stemmen tonen
POK-103 Estimates bewaren`;

export default function CreateSession({ teams }: CreateSessionProps) {
    const [storyText, setStoryText] = useState(initialStories);
    const parsedStories = useMemo(() => parseStoryText(storyText), [storyText]);
    const form = useForm<CreateSessionForm>({
        team_id: teams[0]?.id ?? 0,
        name: '',
        stories: parsedStories,
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.transform((data) => ({
            ...data,
            stories: parsedStories,
        }));
        form.post(storeSession().url, {
            preserveScroll: true,
        });
    }

    return (
        <>
            <Head title="Nieuwe sessie" />

            <div className="flex flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6">
                <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end">
                    <div>
                        <Badge variant="outline">Planning Poker</Badge>
                        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                            Nieuwe sessie
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Maak een sessie voor je team en zet de eerste
                            stories klaar.
                        </p>
                    </div>

                    <Button asChild variant="outline">
                        <Link href={dashboard()}>
                            <ArrowLeft className="size-4" />
                            Dashboard
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sessiegegevens</CardTitle>
                            <CardDescription>
                                Team, naam en backlog voor de refinement.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="team_id">Team</Label>
                                    <Select
                                        value={String(form.data.team_id)}
                                        onValueChange={(value) =>
                                            form.setData(
                                                'team_id',
                                                Number(value),
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            id="team_id"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teams.map((team) => (
                                                <SelectItem
                                                    key={team.id}
                                                    value={String(team.id)}
                                                >
                                                    {team.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={form.errors.team_id} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="name">Sessienaam</Label>
                                    <Input
                                        id="name"
                                        value={form.data.name}
                                        onChange={(event) =>
                                            form.setData(
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Sprint refinement"
                                    />
                                    <InputError message={form.errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="stories">Stories</Label>
                                    <Textarea
                                        id="stories"
                                        value={storyText}
                                        onChange={(event) =>
                                            setStoryText(event.target.value)
                                        }
                                        className="min-h-44 font-mono text-sm"
                                    />
                                    <InputError message={form.errors.stories} />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={
                                        form.processing ||
                                        form.data.team_id === 0 ||
                                        form.data.name.trim() === ''
                                    }
                                >
                                    Sessie maken
                                    <PlusCircle className="size-4" />
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Preview</CardTitle>
                            <CardDescription>
                                {parsedStories.length} stories klaar voor
                                import.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {parsedStories.map((story, index) => (
                                <div
                                    key={`${story.key ?? story.title}-${index}`}
                                    className="rounded-md border p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">
                                                {story.title}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Positie {index + 1}
                                            </div>
                                        </div>
                                        {story.key && (
                                            <Badge variant="outline">
                                                {story.key}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

CreateSession.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Nieuwe sessie',
            href: createSession(),
        },
    ],
};
