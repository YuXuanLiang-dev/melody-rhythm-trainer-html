const songs = [
  { title: '晴天', artist: '周杰伦', bpm: 92, meter: '4/4', firstBeatOffset: 0.221, duration: 269.7, src: './src/music/jay-chou-qing-tian.mp3' },
  { title: '稻香', artist: '周杰伦', bpm: 86, meter: '4/4', firstBeatOffset: 0.449, duration: 223.5, src: './src/music/jay-chou-dao-xiang.mp3' },
  { title: '江南', artist: '林俊杰', bpm: 78, meter: '4/4', firstBeatOffset: 0.632, duration: 267.9, src: './src/music/jj-lin-jiang-nan.mp3' },
  { title: '修炼爱情', artist: '林俊杰', bpm: 70, meter: '4/4', firstBeatOffset: 0.328, duration: 287.0, src: './src/music/jj-lin-xiu-lian-ai-qing.mp3' },
  { title: '光年之外', artist: '邓紫棋', bpm: 88, meter: '4/4', firstBeatOffset: 0.680, duration: 235.5, src: './src/music/gem-guang-nian-zhi-wai.mp3' },
  { title: '泡沫', artist: '邓紫棋', bpm: 82, meter: '4/4', firstBeatOffset: 0.534, duration: 258.9, src: './src/music/gem-pao-mo.mp3' },
  { title: '带我去找夜生活', artist: '告五人', bpm: 122, meter: '4/4', firstBeatOffset: 0.490, duration: 299.7, src: './src/music/accusefive-night-life.mp3' },
  { title: '披星戴月的想你', artist: '告五人', bpm: 94, meter: '4/4', firstBeatOffset: 0.536, duration: 349.0, src: './src/music/accusefive-missing-you.mp3' },
  { title: 'Love Story', artist: 'Taylor Swift', bpm: 120, meter: '4/4', firstBeatOffset: 0.485, duration: 236.3, src: './src/music/taylor-swift-love-story.mp3' },
  { title: 'Shake It Off', artist: 'Taylor Swift', bpm: 160, meter: '4/4', firstBeatOffset: 0.092, duration: 281.3, src: './src/music/taylor-swift-shake-it-off.mp3' }
]

const $ = selector => document.querySelector(selector)
const $$ = selector => Array.from(document.querySelectorAll(selector))

const clickAudio = $('#clickAudio')
const musicAudio = $('#musicAudio')

const state = {
  rhythmTimer: null,
  rhythmBeat: 1,
  musicGuideTimer: null,
  musicCountTimer: null,
  musicGuideStartTimer: null,
  musicPreviewing: false,
  musicPlaying: false,
  scoreTimer: null,
  scoreStartTimer: null,
  scoreGuideStartTimer: null,
  scoreMode: 'rhythm',
  scoreStartAt: 0,
  scoreRunning: false,
  taps: []
}

function intervalFromBpm(bpm) {
  return 60000 / Number(bpm)
}

function playClick() {
  clickAudio.currentTime = 0
  clickAudio.play().catch(() => {})
  if (navigator.vibrate) navigator.vibrate(28)
}

function fillSongSelect(select) {
  select.innerHTML = songs.map((song, index) => (
    `<option value="${index}">${song.artist}《${song.title}》 - ${song.bpm} BPM</option>`
  )).join('')
}

fillSongSelect($('#musicSong'))
fillSongSelect($('#scoreSong'))

function currentMusicSong() {
  return songs[Number($('#musicSong').value || 0)]
}

function currentScoreSong() {
  return songs[Number($('#scoreSong').value || 0)]
}

function renderMusicSong() {
  const song = currentMusicSong()
  $('#musicMeta').textContent = `${song.artist} · ${song.bpm} BPM · ${song.meter}`
  $('#musicAnalysis').textContent = `音谱分析：起拍偏移 ${song.firstBeatOffset.toFixed(3)} 秒 · 时长 ${song.duration.toFixed(1)} 秒`
  $('#musicPath').textContent = `文件路径：${song.src}`
  musicAudio.src = song.src
  renderBeatGrid(song.meter, -1)
}

function renderScoreSong() {
  const song = currentScoreSong()
  $('#scoreMeta').textContent = `${song.artist} · ${song.bpm} BPM · ${song.meter}`
  $('#scoreAnalysis').textContent = `音谱分析：起拍偏移 ${song.firstBeatOffset.toFixed(3)} 秒 · 时长 ${song.duration.toFixed(1)} 秒`
}

function renderBeatGrid(meter, activeIndex) {
  const beats = Number(meter.split('/')[0])
  $('#musicBeatGrid').innerHTML = Array.from({ length: beats }, (_, index) => (
    `<div class="meter-cell ${index === activeIndex ? 'active' : ''}">${index + 1}</div>`
  )).join('')
}

function switchView(name) {
  stopRhythm()
  stopMusic()
  stopScore()
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`))
  $$('.tab').forEach(tab => {
    const active = tab.dataset.view === name
    tab.classList.toggle('active', active)
    const img = tab.querySelector('img')
    img.src = `./src/icons/${tab.dataset.view}${active ? '-active' : ''}.png`
  })
}

$$('.tab').forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)))

function rhythmMeterParts() {
  const [beats, note] = $('#rhythmMeter').value.split('/').map(Number)
  return { beats, note }
}

function renderRhythm() {
  const { note } = rhythmMeterParts()
  $('#rhythmBeat').textContent = state.rhythmBeat
  $('#rhythmCaption').textContent = `${$('#rhythmMeter').value} · 第 ${state.rhythmBeat} 拍`
  $('#rhythmBpmBadge').textContent = $('#rhythmBpm').value
  $('#rhythmBpmValue').textContent = $('#rhythmBpm').value
  void note
}

function rhythmTick() {
  const { beats } = rhythmMeterParts()
  playClick()
  $('#rhythmPulse').classList.add('playing')
  setTimeout(() => $('#rhythmPulse').classList.remove('playing'), 120)
  state.rhythmBeat = state.rhythmBeat >= beats ? 1 : state.rhythmBeat + 1
  renderRhythm()
}

function startRhythm() {
  stopRhythm()
  state.rhythmBeat = 1
  $('#rhythmToggle').textContent = '停止'
  $('#rhythmToggle').classList.add('danger')
  rhythmTick()
  state.rhythmTimer = setInterval(rhythmTick, intervalFromBpm($('#rhythmBpm').value))
}

function stopRhythm() {
  clearInterval(state.rhythmTimer)
  state.rhythmTimer = null
  $('#rhythmToggle').textContent = '开始'
  $('#rhythmToggle').classList.remove('danger')
  $('#rhythmPulse').classList.remove('playing')
}

$('#rhythmToggle').addEventListener('click', () => state.rhythmTimer ? stopRhythm() : startRhythm())
$('#rhythmReset').addEventListener('click', () => {
  stopRhythm()
  state.rhythmBeat = 1
  renderRhythm()
})
$('#rhythmBpm').addEventListener('input', () => {
  renderRhythm()
  if (state.rhythmTimer) startRhythm()
})
$('#rhythmMeter').addEventListener('change', () => {
  state.rhythmBeat = 1
  renderRhythm()
  if (state.rhythmTimer) startRhythm()
})

function musicPulse(beat) {
  const song = currentMusicSong()
  const beats = Number(song.meter.split('/')[0])
  renderBeatGrid(song.meter, beat % beats)
  if ($('#musicGuide').checked) playClick()
}

function previewMusicBeat() {
  if (state.musicPreviewing) {
    stopMusic()
    return
  }
  stopMusic()
  state.musicPreviewing = true
  $('#previewBeat').textContent = '停止试听'
  const song = currentMusicSong()
  let beat = 0
  musicPulse(0)
  state.musicGuideTimer = setInterval(() => {
    beat += 1
    musicPulse(beat)
    if (beat >= Number(song.meter.split('/')[0]) * 2) stopMusic()
  }, intervalFromBpm(song.bpm))
}

function startMusic() {
  stopMusic()
  const song = currentMusicSong()
  const interval = intervalFromBpm(song.bpm)
  state.musicPlaying = true
  $('#musicToggle').textContent = '停止'
  $('#musicToggle').classList.add('danger')

  const beginGuide = () => {
    if (!state.musicPlaying) return
    let beat = 0
    musicPulse(beat)
    state.musicGuideTimer = setInterval(() => {
      beat += 1
      musicPulse(beat)
    }, interval)
  }

  musicAudio.src = song.src
  musicAudio.currentTime = 0
  musicAudio.onplaying = () => {
    if (!state.musicPlaying) return
    clearTimeout(state.musicGuideStartTimer)
    state.musicGuideStartTimer = setTimeout(beginGuide, song.firstBeatOffset * 1000)
  }
  musicAudio.play().catch(() => {
    stopMusic()
    $('#musicPath').textContent = '浏览器阻止了自动播放，请再次点击播放。'
  })
}

function startScoreGuide(interval) {
  let beat = 0
  playClick()
  state.scoreTimer = setInterval(() => {
    beat += 1
    playClick()
  }, interval)
}

function startScoreMusic(song, interval) {
  musicAudio.src = song.src
  musicAudio.currentTime = 0
  state.scoreStartAt = 0
  musicAudio.onplaying = () => {
    if (!state.scoreRunning) return
    const offsetMs = song.firstBeatOffset * 1000
    state.scoreStartAt = Date.now() + offsetMs
    clearTimeout(state.scoreGuideStartTimer)
    state.scoreGuideStartTimer = setTimeout(() => startScoreGuide(interval), offsetMs)
  }
  musicAudio.play().catch(() => {
    stopScore()
    $('#scoreStatus').textContent = '浏览器阻止了自动播放，请再次点击开始。'
  })
}

function startScoreRhythm(interval) {
  const countInBeats = 4
  state.scoreStartAt = Date.now() + interval * countInBeats
  state.scoreGuideStartTimer = setTimeout(() => {
    if (state.scoreStartAt) startScoreGuide(interval)
  }, interval * countInBeats)
  let remaining = countInBeats
  state.scoreStartTimer = setInterval(() => {
    remaining -= 1
    playClick()
    if (remaining <= 0) {
      clearInterval(state.scoreStartTimer)
      state.scoreStartTimer = null
    }
  }, interval)
}

function stopMusic() {
  clearInterval(state.musicGuideTimer)
  clearInterval(state.musicCountTimer)
  clearTimeout(state.musicGuideStartTimer)
  state.musicGuideTimer = null
  state.musicCountTimer = null
  state.musicGuideStartTimer = null
  state.musicPreviewing = false
  state.musicPlaying = false
  musicAudio.onplaying = null
  musicAudio.pause()
  musicAudio.currentTime = 0
  $('#previewBeat').textContent = '试听节拍'
  $('#musicToggle').textContent = '播放'
  $('#musicToggle').classList.remove('danger')
  renderBeatGrid(currentMusicSong().meter, -1)
}

$('#previewBeat').addEventListener('click', previewMusicBeat)
$('#musicToggle').addEventListener('click', () => state.musicPlaying ? stopMusic() : startMusic())
$('#musicSong').addEventListener('change', () => {
  stopMusic()
  renderMusicSong()
})
musicAudio.addEventListener('ended', () => {
  if (state.scoreRunning) {
    stopScore()
  } else {
    stopMusic()
  }
})

function setScoreMode(mode) {
  stopScore()
  state.scoreMode = mode
  $$('[data-score-mode]').forEach(button => button.classList.toggle('active', button.dataset.scoreMode === mode))
  $('#scoreRhythmSettings').hidden = mode !== 'rhythm'
  $('#scoreMusicSettings').hidden = mode !== 'music'
  resetScore()
}

function currentScoreBpm() {
  return state.scoreMode === 'music' ? currentScoreSong().bpm : Number($('#scoreBpm').value)
}

function startScore() {
  stopScore()
  state.taps = []
  const interval = intervalFromBpm(currentScoreBpm())
  state.scoreRunning = true
  state.scoreStartAt = state.scoreMode === 'music' ? 0 : Date.now()
  $('#scoreNumber').textContent = '0'
  $('#scoreStatus').textContent = state.scoreMode === 'music' ? '音乐开始后自动对齐第一拍' : '预备 4 拍后开始，保持稳定点击'
  $('#tapCount').textContent = '0'
  $('#avgOffset').textContent = '--'
  $('#bestOffset').textContent = '--'
  $('#tapPad').textContent = '点击卡点'
  $('#tapPad').classList.add('active')
  $('#scoreToggle').textContent = '结束'
  $('#scoreToggle').classList.add('danger')

  if (state.scoreMode === 'music') {
    startScoreMusic(currentScoreSong(), interval)
  } else {
    startScoreRhythm(interval)
  }
}

function stopScore() {
  clearInterval(state.scoreTimer)
  clearInterval(state.scoreStartTimer)
  clearTimeout(state.scoreGuideStartTimer)
  state.scoreTimer = null
  state.scoreStartTimer = null
  state.scoreGuideStartTimer = null
  state.scoreStartAt = 0
  state.scoreRunning = false
  musicAudio.onplaying = null
  musicAudio.pause()
  $('#tapPad').textContent = '准备开始'
  $('#tapPad').classList.remove('active')
  $('#scoreToggle').textContent = '开始'
  $('#scoreToggle').classList.remove('danger')
}

function resetScore() {
  stopScore()
  state.taps = []
  $('#scoreNumber').textContent = '--'
  $('#scoreStatus').textContent = '开始后跟随提示点击打分区'
  $('#tapCount').textContent = '0'
  $('#avgOffset').textContent = '--'
  $('#bestOffset').textContent = '--'
}

function recordTap() {
  if (!state.scoreRunning) {
    $('#scoreStatus').textContent = '请先开始训练'
    return
  }
  if (!state.scoreStartAt) {
    $('#scoreStatus').textContent = '等待音乐开始'
    return
  }
  const now = Date.now()
  if (now < state.scoreStartAt) {
    $('#scoreStatus').textContent = '还在预备拍'
    return
  }
  const interval = intervalFromBpm(currentScoreBpm())
  const elapsed = now - state.scoreStartAt
  const nearestBeat = Math.round(elapsed / interval)
  const offset = Math.abs(now - (state.scoreStartAt + nearestBeat * interval))
  state.taps.push(offset)
  const avg = state.taps.reduce((sum, item) => sum + item, 0) / state.taps.length
  const best = Math.min(...state.taps)
  const score = Math.max(0, Math.round(100 - avg / 2))
  $('#scoreNumber').textContent = score
  $('#scoreStatus').textContent = score >= 90 ? '很稳，继续保持' : score >= 75 ? '节奏基本稳定' : '注意提前或拖后的幅度'
  $('#tapCount').textContent = state.taps.length
  $('#avgOffset').textContent = `${Math.round(avg)}ms`
  $('#bestOffset').textContent = `${Math.round(best)}ms`
}

$$('[data-score-mode]').forEach(button => button.addEventListener('click', () => setScoreMode(button.dataset.scoreMode)))
$('#scoreBpm').addEventListener('input', () => $('#scoreBpmValue').textContent = $('#scoreBpm').value)
$('#scoreSong').addEventListener('change', renderScoreSong)
$('#scoreToggle').addEventListener('click', () => state.scoreRunning ? stopScore() : startScore())
$('#scoreReset').addEventListener('click', resetScore)
$('#tapPad').addEventListener('click', recordTap)

renderRhythm()
renderMusicSong()
renderScoreSong()
