import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboard } from '@/routes';

export default function Dashboard() {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Card key={index} className="aspect-video py-0">
                            <CardContent className="flex h-full flex-col justify-end gap-3 p-6">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-8 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card className="min-h-[100vh] flex-1 md:min-h-min">
                    <CardContent className="grid gap-4 p-6">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
