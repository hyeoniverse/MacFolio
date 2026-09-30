import { env } from '@/shared/config/env';
import { settingsStore } from '@/shared/settings/settingsStore';
import { CLICK_SOUND_FILES, shouldPlayClick, type ClickPhase } from '@/shared/sound/clickRules';

/** 딸깍 소리 크기 (0~1). 음악을 방해하지 않게 작게 */
const VOLUME = 0.4;

type AudioContextClass = typeof AudioContext;

let context: AudioContext | null = null;
let gain: GainNode | null = null;
const buffers: Partial<Record<ClickPhase, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

/**
 * 소리를 처음 낼 때 한 번 불러와 디코딩해 둔다.
 * <audio>는 누를 때마다 파일을 다시 준비해서 늦게 나거나, 빨리 연달아 누르면 앞 소리가 끊긴다.
 * 디코딩해 둔 버퍼는 누를 때마다 새로 틀어서 겹쳐도 바로 난다.
 */
function load(Context: AudioContextClass) {
	if (loading) return loading;
	context = new Context();
	gain = context.createGain();
	gain.gain.value = VOLUME;
	gain.connect(context.destination);
	loading = Promise.all(
		(Object.keys(CLICK_SOUND_FILES) as ClickPhase[]).map(async (phase) => {
			const response = await fetch(`${env.sfxUrl}/${CLICK_SOUND_FILES[phase]}`);
			buffers[phase] = await context!.decodeAudioData(await response.arrayBuffer());
		})
	).then(() => undefined);
	// 못 불러오면 다음에 다시 시도한다
	loading.catch(() => {
		loading = null;
	});
	return loading;
}

function play(phase: ClickPhase) {
	const Context: AudioContextClass | undefined =
		window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
	if (!Context) {
		// Web Audio가 없는 브라우저: 그때그때 <audio>로
		void new Audio(`${env.sfxUrl}/${CLICK_SOUND_FILES[phase]}`).play().catch(() => {});
		return;
	}
	void load(Context)
		.then(() => {
			const buffer = buffers[phase];
			if (!context || !gain || !buffer) return;
			// 탭이 백그라운드에 갔다 오면 멈춰 있을 수 있다 (사용자가 누른 순간이라 다시 켤 수 있다)
			if (context.state === 'suspended') void context.resume();
			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(gain);
			source.start();
		})
		.catch(() => {
			// 소리를 못 내도 클릭은 그대로 동작해야 한다
		});
}

/** 로딩 화면을 누를 때 미리 불러와서, 데스크톱에서 처음 누를 때부터 바로 소리가 나게 한다 */
function warmUp() {
	const Context: AudioContextClass | undefined = window.AudioContext;
	if (Context) void load(Context).catch(() => {});
}

function handle(phase: ClickPhase) {
	return (event: PointerEvent) => {
		const target = event.target instanceof Element ? event.target : null;
		const input = {
			pointerType: event.pointerType,
			button: event.button,
			onLoadingScreen: Boolean(target?.closest('.loading-container')),
			enabled: settingsStore.getState().clickSound,
		};
		if (shouldPlayClick(input)) play(phase);
		else if (input.onLoadingScreen && input.enabled && phase === 'down') warmUp();
	};
}

/** 앱 시작 시 한 번 호출한다. 어디를 누르든 누를 때·뗄 때 딸깍 소리를 낸다 */
export function initClickSound() {
	// capture: 앱이 이벤트 전파를 막아도 소리는 난다
	window.addEventListener('pointerdown', handle('down'), { capture: true, passive: true });
	window.addEventListener('pointerup', handle('up'), { capture: true, passive: true });
}
