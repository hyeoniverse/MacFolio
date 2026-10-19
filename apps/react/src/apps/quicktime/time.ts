/** 0:05 → 00:05, 1:02:03 → 1:02:03 (QuickTime처럼) */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
	const s = Math.floor(seconds);
	const two = (n: number) => String(n).padStart(2, '0');
	const h = Math.floor(s / 3600);
	return h > 0
		? `${h}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
		: `${two(Math.floor(s / 60))}:${two(s % 60)}`;
}
