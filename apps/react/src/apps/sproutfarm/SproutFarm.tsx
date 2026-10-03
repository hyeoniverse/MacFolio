import ProjectApp from '@/apps/project/ProjectApp';

/**
 * 새싹 농장: 배포한 WebGL 게임을 창 안에 그대로 띄운다 (iframe).
 * 게임은 START를 눌러야 불러오므로, 창을 열기만 해서는 무겁지 않다.
 */
const SproutFarm = () => <ProjectApp appName="sproutfarm" projectId="sproutfarm" tone="dark" />;

export default SproutFarm;
