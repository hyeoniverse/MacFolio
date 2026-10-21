import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/shared/lib/storage';
import { DESKTOP_STEPS, PHONE_STEPS, tipSteps } from './tourSteps';
import { endTour, hasSeenTour, startTour, stepTour } from './tourStore';

const store = new Map<string, string>();
beforeEach(() => {
	store.clear();
	globalThis.localStorage = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
	} as Storage;
});
afterEach(() => endTour());

describe('둘러보기 단계', () => {
	it('단계 id는 겹치지 않고, 환영으로 시작해 마무리로 끝난다', () => {
		for (const steps of [DESKTOP_STEPS, PHONE_STEPS]) {
			expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
			expect(steps[0].target).toBeUndefined();
			expect(steps.at(-1)!.target).toBeUndefined();
		}
	});

	it('팁 앱에는 비추는 단계만 (환영·마무리는 빼고)', () => {
		expect(tipSteps(false).every((step) => step.target)).toBe(true);
		expect(tipSteps(false)).toHaveLength(DESKTOP_STEPS.length - 2);
	});
});

describe('둘러보기 상태', () => {
	it('끝까지 가거나 닫으면 본 것으로 남긴다 (다음 방문에 띄우지 않는다)', () => {
		expect(hasSeenTour()).toBe(false);
		startTour(DESKTOP_STEPS.slice(0, 2));
		stepTour(-1);
		stepTour(1);
		expect(hasSeenTour()).toBe(false);
		stepTour(1);
		expect(hasSeenTour()).toBe(true);
		expect(store.get(STORAGE_KEYS.tour)).toBe('done');
	});

	it('팁 하나만 보여 주고 닫아도 본 것으로 남긴다', () => {
		startTour([DESKTOP_STEPS[1]], true);
		endTour();
		expect(hasSeenTour()).toBe(true);
	});
});
