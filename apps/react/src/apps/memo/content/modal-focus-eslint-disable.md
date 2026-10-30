---
title: eslint-disable 주석이 가린 useEffect의 onClose 의존성
date: 2026-10-21
category: 개발 기록/MacFolio/스타일·컴포넌트
summary: Modal의 초점 effect는 주석에 '열 때 한 번만'이라고 적혀 있었지만 [onClose]에 의존해, 부모가 렌더링마다 새 함수를 넘기면 초점이 처음 칸으로 돌아갔다. exhaustive-deps를 끈 주석이 원인을 가렸고, effect를 둘로 나눠 규칙을 끄지 않고 수정했다.
---

저장소의 `eslint-disable` 주석은 같은 줄에 `-- 이유`를 붙이는 것이 관례다. `apps/react/src`의 `eslint-disable` 7개 가운데 두 곳만 이유가 윗줄 주석으로 분리되어 있었다. 이 두 곳을 관례대로 정리하려고 코드를 읽다가, 그중 공통 모달 컴포넌트 `Modal.tsx`에서 규칙을 끈 탓에 드러나지 않던 버그를 발견해 함께 수정했다([#295](https://github.com/hyeoniverse/MacFolio/pull/295)).

| 파일                | 판정        | 조치                                      |
| ------------------- | ----------- | ----------------------------------------- |
| `Modal.tsx`         | 버그        | effect를 둘로 분리, `eslint-disable` 삭제 |
| `DevCoursePage.tsx` | 의도한 생략 | 동작 유지, 이유를 같은 줄로 이동          |

## 증상

`Modal`은 가운데 뜨는 창의 공통 겉이다([Modal 컴포넌트 추출 글](/memo/ui-modal)). 열리는 시각에 `initialFocus`가 가리키는 요소(확인 버튼, 입력 칸)로 초점을 옮긴다. 이 초점 이동이 창을 여는 시각뿐 아니라 부모 컴포넌트가 다시 렌더링되는 시각마다 반복될 수 있었다.

- 입력 칸이 둘 이상인 창에서 두 번째 칸에 입력하면, 입력할 때마다 초점이 첫 칸(`initialFocus`)으로 이동한다
- 경고창(`AlertDialog`)에서 Tab으로 '취소'로 이동한 뒤 부모가 다시 렌더링되면, 초점이 '확인' 버튼으로 돌아간다

조건은 호출하는 쪽이 `onClose={() => setOpen(false)}`처럼 렌더링마다 새 함수를 넘기는 것이다. 수정 시점의 호출부 가운데 Dock의 Launchpad(`closeLaunchpad`), 휴지통의 사이트 데이터 삭제 경고창(`onCancel={() => setConfirm(false)}`)이 이 형태였다. 입력 칸이 두 개인 `Modal`은 아직 없었고, 사용자 화면에서 신고된 증상이 아니라 코드를 읽다가 발견한 버그다.

![배경화면 이름 바꾸기 창](./images/modal-focus-eslint-disable-rename.jpg 'Modal에 initialFocus로 입력 칸을 넘기는 배경화면 이름 바꾸기 창. 입력 상태는 RenameDialog 안에 있어 입력해도 Modal에 넘기는 onCancel은 바뀌지 않으므로, 이 창에서는 증상이 나타나지 않았다. 부모가 다시 렌더링되며 새 onClose를 넘기는 창에서 초점이 initialFocus로 돌아간다')

## 원인

수정 전 `Modal`은 초점 이동과 Esc 키 처리를 effect 하나에 담고 있었다.

```tsx
useEffect(() => {
	(initialFocus?.current ?? box.current)?.focus(); // 열 때 초점
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		onClose();
	};
	window.addEventListener('keydown', onKeyDown);
	return () => window.removeEventListener('keydown', onKeyDown);
	// 초점은 열 때 한 번만
	// eslint-disable-next-line react-hooks/exhaustive-deps
}, [onClose]);
```

주석은 "초점은 열 때 한 번만"인데, 의존성 배열은 `[onClose]`다. [`useEffect`](https://react.dev/reference/react/useEffect)는 의존성 값이 `Object.is`로 달라지면 정리 함수를 실행하고 effect를 다시 실행한다. 인라인 화살표 함수는 렌더링마다 새 객체이므로, 부모가 렌더링될 때마다 effect 전체가 다시 실행되고 `focus()`도 다시 호출된다.

![수정 전후의 실행 순서](./images/modal-focus-eslint-disable-sequence.svg '수정 전에는 부모가 새 onClose를 넘기면 effect 하나가 통째로 다시 실행되어 initialFocus(첫 칸)로 초점을 옮긴다. 수정 후에는 Esc effect만 리스너를 다시 등록하고, 초점 effect는 initialFocus가 같아 실행되지 않는다')

### `eslint-disable`이 가린 것

[`react-hooks/exhaustive-deps`](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps) 규칙이 이 effect에서 보고한 경고는 "`initialFocus`가 의존성 배열에 없다"였다. `onClose`는 이미 배열에 있었으므로 규칙이 문제 삼은 대상은 `initialFocus` 하나다. 작성 시각의 의도는 "`initialFocus`가 바뀌어도 초점을 다시 옮기지 않는다"였고, 그 의도를 위해 규칙을 껐다. 그런데 실제로 초점 이동을 반복시키는 값은 배열에 남아 있던 `onClose`였다.

이 저장소의 lint는 `--max-warnings 0`이라 경고 하나도 CI 실패다. 규칙을 끄지 않았다면 경고가 남아 "이 effect가 무엇에 의존하는가"를 다시 확인했을 것이다. 끈 주석 한 줄이 경고와 함께 effect가 두 가지 일을 섞고 있다는 신호를 숨겼다. 이유도 윗줄의 별도 주석에 있어서, 무엇을 의도하고 무엇을 생략했는지가 규칙 비활성화 지시문과 분리되어 읽혔다.

## 수정

초점 이동과 Esc 처리를 effect 두 개로 분리했다. 각 effect가 실제로 사용하는 값만 의존성에 두므로 규칙을 끌 필요가 없다.

```tsx
// 초점은 열 때 한 번만 (onClose가 다시 그릴 때마다 새 함수여도 초점이 튀지 않게 Esc 듣기와 나눈다)
useEffect(() => {
	(initialFocus?.current ?? box.current)?.focus();
}, [initialFocus]);

useEffect(() => {
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		onClose();
	};
	window.addEventListener('keydown', onKeyDown);
	return () => window.removeEventListener('keydown', onKeyDown);
}, [onClose]);
```

- 초점 effect: `initialFocus`는 호출부가 `useRef`로 만든 ref 객체라 렌더링 사이에 같은 값이다. 따라서 마운트 시각에 한 번만 실행된다. `box`는 컴포넌트 안의 `useRef`라 규칙이 의존성에서 제외한다
- Esc effect: `onClose`가 바뀌면 `keydown` 리스너를 해제하고 다시 등록한다. 리스너 교체는 초점에 영향이 없고 비용도 작다

### Sheet의 ref 방식과 비교

뒤이어 만든 [`Sheet`](/memo/ui-sheet)는 같은 문제를 다른 방법으로 해결했다. 최신 `onClose`를 ref에 보관하고, 초점·Esc effect는 의존성 없이(`[]`) 열린 시각에 한 번만 실행한다.

```tsx
const close = useRef(onClose);
useEffect(() => {
	close.current = onClose;
}, [onClose]);
```

| 방식        | Esc 리스너                | 추가 코드           |
| ----------- | ------------------------- | ------------------- |
| effect 분리 | `onClose`가 바뀌면 재등록 | 없음                |
| ref 보관    | 열린 동안 하나 유지       | ref와 동기화 effect |

`Sheet`는 재생 위치가 바뀔 때마다 다시 렌더링되는 음악 화면에서 이 문제를 겪었고, 리스너도 열린 동안 하나로 유지하는 ref 방식을 택했다. `Modal`은 두 가지 일을 effect 하나에 섞은 것이 원인이었으므로, 분리만으로 의존성 배열이 실제 사용 값과 일치해 ref를 추가하지 않았다. [Modal 추출 글](/memo/ui-modal)의 남은 과제에 "Sheet와 같은 방식으로 수정할 후보"로 적었던 항목이 이 수정이다.

## `DevCoursePage.tsx`: 의도한 생략

나머지 한 곳(`apps/safari/project/custom/DevCoursePage.tsx`)은 규칙을 끈 것이 의도와 맞았다. 저장소 데이터(`repo`)를 불러오는 동안 입력된 명령을 대기열에 보관했다가, 불러온 시각에 한 번 실행하는 effect다. 이 effect는 현재 디렉터리(`cwd`)를 읽지만, `cwd`는 명령을 실행한 결과로 바뀌는 값이라 의존성에 넣으면 실행이 반복된다. 동작은 그대로 두고 이유를 같은 줄로 옮겼다.

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps -- 저장소가 처음 불러와질 때만 기다리던 명령을 돌린다 (cwd는 그 명령을 친 자리라 바뀌어도 다시 돌리지 않는다)
}, [repo]);
```

두 곳의 차이는 생략한 값이 effect의 반복 조건에 영향을 주는가였다. `DevCoursePage`는 생략한 `cwd`가 반복을 막는 의도 그대로였고, `Modal`은 생략한 `initialFocus`와 무관하게 남아 있는 `onClose`가 반복을 일으켰다.

## 확인

- prettier·eslint·stylelint·tsc 통과, 단위 시험 778개 통과
- 화면 E2E: 로그인·메일·휴지통·Dock(Launchpad)·Finder·바탕화면 46개 통과. `Modal`을 쓰는 창(로그인 결과, 경고창, Launchpad, 이름 바꾸기)이 열 때 초점을 옮기고 Esc로 닫히는지 포함된다
- 단위 시험 환경에 DOM이 없어, 다시 렌더링해도 초점이 유지되는지 직접 검사하는 컴포넌트 시험은 추가하지 못했다

## 남은 것

- 같은 줄에 이유를 붙이는 관례는 아직 사람이 확인한다. [`@eslint-community/eslint-plugin-eslint-comments`](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/require-description.html)의 `require-description` 규칙을 켜면 lint가 확인한다
- `apps/react/src` 밖(`apps/api`, `packages/contracts`, `apps/react/worker`)의 `no-control-regex` 지시문 7개에는 아직 이유가 없다
- 초점 가두기(Tab이 창 밖으로 나가지 않게)는 `Modal`에 아직 없다. [WAI-ARIA 모달 다이얼로그 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)이 요구하는 동작이다

## 관련 글

- [오버레이·포커스·Esc 처리를 공통 Modal 컴포넌트로 추출하기](/memo/ui-modal): 이 effect를 처음 만든 글. 남은 과제에 이 문제를 적어 두었다
- [오버레이·닫기·role을 공통 Sheet 컴포넌트로 추출하고 모양은 variant로 나누기](/memo/ui-sheet): 같은 문제를 ref 보관으로 해결한 컴포넌트

#MacFolio #공통컴포넌트 #React #ESLint #트러블슈팅
