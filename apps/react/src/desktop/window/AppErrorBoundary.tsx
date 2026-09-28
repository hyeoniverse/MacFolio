import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
	appName: string;
	children: ReactNode;
}

interface State {
	error: Error | null;
}

/**
 * 앱 하나에서 에러가 나도 데스크톱 전체가 사라지지 않게 한다.
 * 에러가 난 앱 자리에 안내와 다시 열기 버튼을 보여준다.
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
			<div className="app-error" role="alert" data-app-error={this.props.appName}>
				<p>
					<strong>{this.props.appName}</strong> 앱에서 문제가 발생했습니다.
				</p>
				<button type="button" onClick={() => this.setState({ error: null })}>
					다시 열기
				</button>
			</div>
		);
	}
}
