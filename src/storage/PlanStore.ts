import { db, type PlanEntity } from './Database';
import type { RenderPlan } from '@spec/types';

export class PlanStore {
    async savePlan(plan: RenderPlan) {
        await db.plans.put(plan);
    }

    async getPlan(planId: string): Promise<PlanEntity | undefined> {
        return await db.plans.get(planId);
    }

    async getPlansForDocument(docId: string): Promise<PlanEntity[]> {
        return await db.plans.where('docId').equals(docId).toArray();
    }
}

export const planStore = new PlanStore();
