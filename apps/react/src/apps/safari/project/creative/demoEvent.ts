import type { ProjectPoint } from '@/shared/profile';

/** 데모가 지금 무엇을 하는지 페이지(몽이)에 알리는 이벤트: busy 만드는 중, done 끝, error 실패, play 재생 */
export const DEMO_EVENT = 'cr-demo';
export type DemoKind = NonNullable<ProjectPoint['demo']>;
export type DemoState = 'busy' | 'done' | 'error' | 'play';
export const cheer = (kind: DemoKind, state: DemoState) =>
	window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: { kind, state } }));
