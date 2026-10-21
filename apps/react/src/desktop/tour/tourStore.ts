// 둘러보기 상태: 지금 보여 주는 단계들과 그 자리. 처음 온 사람에게 한 번 띄우고, 팁 앱·도움말 메뉴에서 다시 연다.
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { STORAGE_KEYS, storageOf } from '@/shared/lib/storage';
import type { TourStep } from './tourSteps';

interface TourState {
	steps: TourStep[];
	index: number;
	/** 팁 앱에서 하나만 보여 줄 때 (이전·다음 없이 확인만) */
	single: boolean;
}

const store = createStore<TourState>({ steps: [], index: 0, single: false });

/** 이 브라우저에서 둘러보기를 끝냈거나 건너뛰었는지 (다음 방문에는 다시 띄우지 않는다). 저장소를 못 쓰면 띄우지 않는다 */
export function hasSeenTour(): boolean {
	try {
		const storage = storageOf('local');
		return !storage || storage.getItem(STORAGE_KEYS.tour) === 'done';
	} catch {
		return true;
	}
}

function markSeen() {
	try {
		storageOf('local')?.setItem(STORAGE_KEYS.tour, 'done');
	} catch {
		// 저장소를 못 쓰면 다음에 또 보일 뿐이다
	}
}

/** 둘러보기를 연다. single이면 그 단계 하나만 */
export const startTour = (steps: TourStep[], single = false) => store.setState({ steps, index: 0, single });

export const stepTour = (delta: number) =>
	store.setState(({ steps, index, single }) => {
		const next = index + delta;
		if (next < 0) return { steps, index, single };
		if (next >= steps.length) {
			markSeen();
			return { steps: [], index: 0, single: false };
		}
		return { steps, index: next, single };
	});

/** 닫는다 (건너뛰기·마치기·Esc). 다음 방문에는 띄우지 않는다 */
export function endTour() {
	markSeen();
	store.setState({ steps: [], index: 0, single: false });
}

export function useTour(): TourState & { step: TourStep | null } {
	const state = useSyncExternalStore(store.subscribe, store.getState);
	return { ...state, step: state.steps[state.index] ?? null };
}
