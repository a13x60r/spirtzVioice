import { db, type TimelineEntity } from './Database';
import type { Timeline } from '@spec/types';

export class TimelineStore {
    async saveTimeline(timeline: Timeline) {
        await db.timelines.put(timeline);
    }

    async getTimeline(planId: string): Promise<TimelineEntity | undefined> {
        return await db.timelines.get(planId);
    }
}

export const timelineStore = new TimelineStore();
