// 첫 화면이 그려지기 전에 테마를 적용해 깜빡임을 막는다 (shared/settings/settingsStore.ts와 같은 키)
try {
	var theme = (JSON.parse(localStorage.getItem('macfolio:settings')) || {}).theme || 'system';
	if (theme === 'system') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
} catch (e) {}
