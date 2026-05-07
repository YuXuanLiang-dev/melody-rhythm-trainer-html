# 流行乐节奏训练 HTML 版

这是从微信小程序转换出来的静态 HTML 项目，可直接部署到 GitHub Pages。

功能：

- 单节奏卡点训练
- 音乐节拍播放与跟拍
- 训练打分

资源目录：

- `src/audio/piano-click.wav`：钢琴节拍音
- `src/icons/`：底部导航图标
- `src/music/`：歌曲音频
- `src/music/beat-analysis.json`：每首歌的 BPM、起拍偏移和时长分析结果
- `tools/analyze_beats.py`：本地音频能量峰值分析脚本

页面入口是 `index.html`。
