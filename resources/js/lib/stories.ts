import type { StoryInput } from '@/types';

export function parseStoryText(text: string): StoryInput[] {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const match = line.match(/^([A-Z]+-\d+)\s+(.+)$/i);

            if (!match) {
                return {
                    key: null,
                    title: line,
                };
            }

            return {
                key: match[1].toUpperCase(),
                title: match[2],
            };
        });
}

export function voteLabel(value: string): string {
    return value === 'coffee' ? 'koffie' : value;
}
