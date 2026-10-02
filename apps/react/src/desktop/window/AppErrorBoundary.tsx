import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/AppStateContext';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { isChunkLoadError } from '@/shared/lib/chunkLoadError';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';

interface Props {
	appName: AppName;
	children: ReactNode;
}

interface State {
	error: Error | null;
}

/**
 * 앱 하나에서 에러가 나도 데스크톱 전체가 사라지지 않게 한다.
 * 에러가 난 앱 대신 OS 경고창을 띄운다 (AppErrorAlert).
 */
export default class AppErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(`[${this.props.appName}] 앱에서 에러가 발생했습니다`, error, info.componentStack);
	}

	render() {
		if (!this.state.error) return this.props.children;

		return (
			<AppErrorAlert
				appName={this.props.appName}
				error={this.state.error}
				onRetry={() => this.setState({ error: null })}
			/>
		);
	}
}

interface AlertProps {
	appName: AppName;
	error: Error;
	onRetry: () => void;
}

/**
 * 화면 한가운데의 경고창. 앱이 화면에 있을 때만 뜬다 (닫거나 최소화하면 숨는다).
 * 앱 코드를 못 불러온 경우(배포로 파일 이름이 바뀜)는 다시 열어도 같으므로 새로고침을 권한다.
 * 닫기는 앱을 완전히 꺼서, 다음에 열면 처음부터 다시 그린다.
 */
const AppErrorAlert = ({ appName, error, onRetry }: AlertProps) => {
	const { apps, quitApp } = useAppState();
	const isMobile = useIsMobile();
	const { isRunning, isMinimized } = apps[appName];
	if (!isRunning || isMinimized) return null;

	const manifest = APP_MANIFEST[appName];
	const label = (isMobile && manifest.mobile?.label) || manifest.label;
	const chunk = isChunkLoadError(error);

	return (
		<div className="app-error" data-app-error={appName}>
			<AlertDialog
				title={chunk ? '새 버전이 있어요' : `${label} 앱에서 문제가 발생했습니다`}
				message={chunk ? `${label} 앱을 열려면 페이지를 새로고침해 주세요.` : '계속 그러면 페이지를 새로고침해 주세요.'}
				cancelLabel="닫기"
				confirmLabel={chunk ? '새로고침' : '다시 열기'}
				onCancel={() => quitApp(appName)}
				onConfirm={chunk ? () => window.location.reload() : onRetry}
			/>
		</div>
	);
};
