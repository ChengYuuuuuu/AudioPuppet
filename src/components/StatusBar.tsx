import { type PlaybackState, type RenderMode } from '../types/index';

interface StatusBarProps {
  renderMode: RenderMode;
  playbackState: PlaybackState;
}

export default function StatusBar({ renderMode, playbackState }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span>层级: {renderMode}</span>
      <span>|</span>
      <span>状态: {playbackState.isPlaying ? '▶ 播放中' : '⏸ 暂停'}</span>
      <span>|</span>
      <span>能量: {Math.round(playbackState.energy)}</span>
      <span>|</span>
      <span>低频: {Math.round(playbackState.bassEnergy)}</span>
    </div>
  );
}
