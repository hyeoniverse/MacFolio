// 메모 앱과 휴지통이 같은 서버 글(관리자 목록)을 따로 들고 있다. 한쪽에서 지우거나 되살리면 알려서 다른 쪽이 다시 읽게 한다.
// 바꾼 쪽은 이미 자기 목록을 고쳤으므로, 앱마다 따로 세고 상대가 바꾼 횟수만 듣는다
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

type Side = 'memo' | 'bin';

const store = createStore<Record<Side, number>>({ memo: 0, bin: 0 });

/** 서버의 글을 지우거나 되살리거나 영구히 지웠다 */
export const announceMemoPostsChanged = (by: Side) => store.setState((state) => ({ ...state, [by]: state[by] + 1 }));

/** 상대 앱이 바꿀 때마다 커지는 수. effect의 의존성에 넣어 다시 읽는다 */
export const useMemoPostsChangedBy = (other: Side) =>
	useSyncExternalStore(store.subscribe, () => store.getState()[other]);
