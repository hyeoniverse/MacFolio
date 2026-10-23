// 배경 음악을 재생하는 audio 요소 하나. React 밖에서 만들어 로딩 화면과 음악 앱(MusicProvider)이 같은 요소를 사용한다.
//
// iPhone Safari(WebKit)는 소리가 있는 미디어를 요소마다 사용자 제스처(탭) 처리 중에 처음 play()해야 재생을 허용한다.
// 한 번 허용된 요소는 그 뒤 제스처 없이 play()해도 재생된다. 배경 음악은 로딩 화면을 누르고 진행 막대가 찬 뒤
// (약 2.5초 뒤) 시작하므로 그 시각에는 제스처가 이미 지났고, 바탕화면(MusicProvider)도 누른 뒤에야 그린다.
// 그래서 로딩 화면의 탭 처리 안에서 이 요소를 미리 허용(unlockMusicAudio)해 둔다.
import { ALL_SONGS, findPlaylist, findTrack } from './library';

let element: HTMLAudioElement | null = null;

/** 배경 음악 audio 요소. 처음 부르면 만들어 body 끝에 붙인다 (보이지 않는다) */
export function musicAudio(): HTMLAudioElement {
	if (!element) {
		element = document.createElement('audio');
		// 누르기 전에는 받지 않는다 (첫 방문에 곡을 받지 않게). 길이는 그동안 TRACK_SECONDS로 보인다
		element.preload = 'none';
		element.src = findTrack(findPlaylist(ALL_SONGS).trackIds[0]).src;
		document.body.append(element);
	}
	return element;
}

/**
 * 탭·클릭 처리 중에 동기적으로 부른다 (await·setTimeout 뒤면 제스처가 지나 허용되지 않는다).
 * play()를 부르고 곧바로 pause()해 소리 없이 요소만 허용받는다. 데스크톱 브라우저에서는 아무 영향이 없다
 */
export function unlockMusicAudio() {
	const audio = musicAudio();
	if (!audio.paused) return;
	// 바로 멈추므로 play()의 약속은 AbortError로 거절된다. 허용 여부와 상관없으므로 무시한다
	audio.play().catch(() => {});
	audio.pause();
}
