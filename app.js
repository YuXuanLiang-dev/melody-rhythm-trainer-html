const songs = [
  { title: '晴天', artist: '周杰伦', bpm: 93, meter: '4/4', firstBeatOffset: 0.267, duration: 269.7, src: './src/music/jay-chou-qing-tian.mp3' },
  { title: '稻香', artist: '周杰伦', bpm: 85, meter: '4/4', firstBeatOffset: 0.334, duration: 223.5, src: './src/music/jay-chou-dao-xiang.mp3' },
  { title: '江南', artist: '林俊杰', bpm: 79, meter: '4/4', firstBeatOffset: 0.757, duration: 267.9, src: './src/music/jj-lin-jiang-nan.mp3' },
  { title: '修炼爱情', artist: '林俊杰', bpm: 69, meter: '4/4', firstBeatOffset: 0.402, duration: 287.0, src: './src/music/jj-lin-xiu-lian-ai-qing.mp3' },
  { title: '光年之外', artist: '邓紫棋', bpm: 88, meter: '4/4', firstBeatOffset: 0.680, duration: 235.5, src: './src/music/gem-guang-nian-zhi-wai.mp3' },
  { title: '泡沫', artist: '邓紫棋', bpm: 68, meter: '4/4', firstBeatOffset: 0.511, duration: 258.9, src: './src/music/gem-pao-mo.mp3' },
  { title: '带我去找夜生活', artist: '告五人', bpm: 128, meter: '4/4', firstBeatOffset: 0.173, duration: 299.7, src: './src/music/accusefive-night-life.mp3' },
  { title: '披星戴月的想你', artist: '告五人', bpm: 100, meter: '4/4', firstBeatOffset: 0.172, duration: 349.0, src: './src/music/accusefive-missing-you.mp3' },
  { title: 'Love Story', artist: 'Taylor Swift', bpm: 119, meter: '4/4', firstBeatOffset: 0.421, duration: 236.3, src: './src/music/taylor-swift-love-story.mp3' },
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
  musicContextStartedAt: 0,
  musicNextBeatNumber: 0,
  musicPreviewing: false,
  musicPlaying: false,
  scoreTimer: null,
  scoreStartTimer: null,
  scoreGuideStartTimer: null,
  scoreNextBeatNumber: 0,
  scoreMode: 'rhythm',
  scoreStartAt: 0,
  scoreRunning: false,
  audioContext: null,
  clickBuffer: null,
  clickBufferLoading: null,
  taps: []
}

function intervalFromBpm(bpm) {
  return 60000 / Number(bpm)
}

function intervalSeconds(song) {
  return 60 / getSongBpm(song)
}

function songOffsetKey(song) {
  return `beat-offset-v2:${song.src}`
}

function songAnalysisKey(song) {
  return `beat-analysis-v1:${song.src}`
}

function normalizeOffset(value, interval) {
  return ((value % interval) + interval) % interval
}

function getStoredAnalysis(song) {
  try {
    const raw = localStorage.getItem(songAnalysisKey(song))
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && Number.isFinite(parsed.bpm) && Number.isFinite(parsed.offset)) {
      return parsed
    }
  } catch (error) {
    return null
  }
  return null
}

function getSongBpm(song) {
  return getStoredAnalysis(song)?.bpm || song.bpm
}

function getBeatOffset(song) {
  const analyzed = getStoredAnalysis(song)
  if (analyzed) return analyzed.offset
  const saved = localStorage.getItem(songOffsetKey(song))
  const parsed = saved === null ? NaN : Number(saved)
  return Number.isFinite(parsed) ? parsed : song.firstBeatOffset
}

function setBeatOffset(song, value) {
  const offset = normalizeOffset(value, intervalSeconds(song))
  localStorage.setItem(songOffsetKey(song), String(offset))
  const analyzed = getStoredAnalysis(song)
  if (analyzed) {
    localStorage.setItem(songAnalysisKey(song), JSON.stringify({ ...analyzed, offset }))
  }
  renderMusicSong()
  renderScoreSong()
  return offset
}

function setSongAnalysis(song, bpm, offset, source = 'web-audio-beat-detector') {
  const normalizedBpm = Math.round(Number(bpm))
  const normalizedOffset = normalizeOffset(Number(offset), 60 / normalizedBpm)
  localStorage.setItem(songAnalysisKey(song), JSON.stringify({
    bpm: normalizedBpm,
    offset: normalizedOffset,
    source,
    savedAt: new Date().toISOString()
  }))
  localStorage.setItem(songOffsetKey(song), String(normalizedOffset))
  refreshSongSelects()
  renderMusicSong()
  renderScoreSong()
}

async function ensureAudioEngine() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!state.audioContext && AudioContextClass) {
    state.audioContext = new AudioContextClass()
  }
  if (state.audioContext && state.audioContext.state === 'suspended') {
    await state.audioContext.resume()
  }
  if (state.audioContext && !state.clickBuffer) {
    if (!state.clickBufferLoading) {
      state.clickBufferLoading = fetch('./src/audio/piano-click.wav')
        .then(response => response.arrayBuffer())
        .then(buffer => state.audioContext.decodeAudioData(buffer))
        .then(decoded => {
          state.clickBuffer = decoded
          return decoded
        })
        .catch(() => null)
    }
    await state.clickBufferLoading
  }
}

function scheduleClickAt(contextTime, gainValue = 0.9) {
  if (!state.audioContext || !state.clickBuffer) {
    clickAudio.currentTime = 0
    clickAudio.play().catch(() => {})
    return
  }
  const source = state.audioContext.createBufferSource()
  const gain = state.audioContext.createGain()
  source.buffer = state.clickBuffer
  gain.gain.value = gainValue
  source.connect(gain)
  gain.connect(state.audioContext.destination)
  source.start(Math.max(contextTime, state.audioContext.currentTime + 0.002))
}

function playClick() {
  ensureAudioEngine().then(() => {
    if (state.audioContext) {
      scheduleClickAt(state.audioContext.currentTime + 0.004)
    } else {
      clickAudio.currentTime = 0
      clickAudio.play().catch(() => {})
    }
  })
  if (navigator.vibrate) navigator.vibrate(28)
}

function fillSongSelect(select) {
  select.innerHTML = songs.map((song, index) => (
    `<option value="${index}">${song.artist}《${song.title}》 - ${getSongBpm(song)} BPM</option>`
  )).join('')
}

fillSongSelect($('#musicSong'))
fillSongSelect($('#scoreSong'))

function refreshSongSelects() {
  const musicIndex = $('#musicSong').value
  const scoreIndex = $('#scoreSong').value
  fillSongSelect($('#musicSong'))
  fillSongSelect($('#scoreSong'))
  $('#musicSong').value = musicIndex
  $('#scoreSong').value = scoreIndex
}

function currentMusicSong() {
  return songs[Number($('#musicSong').value || 0)]
}

function currentScoreSong() {
  return songs[Number($('#scoreSong').value || 0)]
}

function renderMusicSong() {
  const song = currentMusicSong()
  const offset = getBeatOffset(song)
  const analysis = getStoredAnalysis(song)
  $('#musicMeta').textContent = `${song.artist} · ${getSongBpm(song)} BPM · ${song.meter}`
  $('#musicAnalysis').textContent = `${analysis ? '专业分析' : '内置初值'}：BPM ${getSongBpm(song)} · 起拍 ${offset.toFixed(3)} 秒 · 时长 ${song.duration.toFixed(1)} 秒`
  $('#musicOffsetValue').textContent = `${Math.round(offset * 1000)}ms`
  $('#musicPath').textContent = `文件路径：${song.src}`
  if (!state.musicPlaying && !state.scoreRunning) {
    musicAudio.src = song.src
  }
  renderBeatGrid(song.meter, -1)
}

function renderScoreSong() {
  const song = currentScoreSong()
  const offset = getBeatOffset(song)
  const analysis = getStoredAnalysis(song)
  $('#scoreMeta').textContent = `${song.artist} · ${getSongBpm(song)} BPM · ${song.meter}`
  $('#scoreAnalysis').textContent = `${analysis ? '专业分析' : '内置初值'}：BPM ${getSongBpm(song)} · 起拍 ${offset.toFixed(3)} 秒`
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

function nextBeatNumber(song) {
  const interval = intervalSeconds(song)
  const offset = getBeatOffset(song)
  const current = musicAudio.currentTime
  return Math.max(0, Math.ceil((current - offset + 0.025) / interval))
}

function contextTimeForAudioTime(audioTime) {
  return state.musicContextStartedAt + audioTime
}

function scheduleMusicVisual(song, beatNumber, contextTime) {
  const delay = Math.max(0, (contextTime - state.audioContext.currentTime) * 1000)
  setTimeout(() => {
    if (state.musicPlaying) {
      renderBeatGrid(song.meter, beatNumber % Number(song.meter.split('/')[0]))
    }
  }, delay)
}

function scheduleMusicGuide(song) {
  if (!state.musicPlaying) return
  const interval = intervalSeconds(song)
  const scheduleAhead = 0.14

  while (state.musicPlaying) {
    const beatTime = getBeatOffset(song) + state.musicNextBeatNumber * interval
    const contextTime = contextTimeForAudioTime(beatTime)
    if (!state.audioContext || contextTime > state.audioContext.currentTime + scheduleAhead) break
    if (contextTime >= state.audioContext.currentTime - 0.03) {
      if ($('#musicGuide').checked) scheduleClickAt(contextTime)
      scheduleMusicVisual(song, state.musicNextBeatNumber, contextTime)
    }
    state.musicNextBeatNumber += 1
  }
}

function scheduleScoreMusicGuide(song) {
  if (!state.scoreRunning) return
  const interval = intervalSeconds(song)
  const scheduleAhead = 0.14

  while (state.scoreRunning) {
    const beatTime = getBeatOffset(song) + state.scoreNextBeatNumber * interval
    const contextTime = contextTimeForAudioTime(beatTime)
    if (!state.audioContext || contextTime > state.audioContext.currentTime + scheduleAhead) break
    if (contextTime >= state.audioContext.currentTime - 0.03) {
      scheduleClickAt(contextTime)
    }
    state.scoreNextBeatNumber += 1
  }
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
  }, intervalFromBpm(getSongBpm(song)))
}

async function startMusic() {
  stopMusic()
  await ensureAudioEngine()
  const song = currentMusicSong()
  state.musicPlaying = true
  $('#musicToggle').textContent = '停止'
  $('#musicToggle').classList.add('danger')

  musicAudio.src = song.src
  musicAudio.currentTime = 0
  musicAudio.onplaying = () => {
    if (!state.musicPlaying) return
    state.musicContextStartedAt = state.audioContext.currentTime - musicAudio.currentTime
    state.musicNextBeatNumber = nextBeatNumber(song)
    clearInterval(state.musicGuideTimer)
    scheduleMusicGuide(song)
    state.musicGuideTimer = setInterval(() => scheduleMusicGuide(song), 25)
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

async function startScoreMusic(song, interval) {
  await ensureAudioEngine()
  musicAudio.src = song.src
  musicAudio.currentTime = 0
  state.scoreStartAt = 0
  musicAudio.onplaying = () => {
    if (!state.scoreRunning) return
    state.scoreStartAt = 1
    state.musicContextStartedAt = state.audioContext.currentTime - musicAudio.currentTime
    state.scoreNextBeatNumber = nextBeatNumber(song)
    clearInterval(state.scoreTimer)
    scheduleScoreMusicGuide(song)
    state.scoreTimer = setInterval(() => scheduleScoreMusicGuide(song), 25)
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
  clearTimeout(state.musicGuideTimer)
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
$('#offsetEarlier').addEventListener('click', () => {
  const song = currentMusicSong()
  setBeatOffset(song, getBeatOffset(song) - 0.05)
  if (state.musicPlaying) {
    clearTimeout(state.musicGuideTimer)
    scheduleMusicGuide(song)
  }
})
$('#offsetLater').addEventListener('click', () => {
  const song = currentMusicSong()
  setBeatOffset(song, getBeatOffset(song) + 0.05)
  if (state.musicPlaying) {
    clearTimeout(state.musicGuideTimer)
    scheduleMusicGuide(song)
  }
})
$('#markFirstBeat').addEventListener('click', () => {
  const song = currentMusicSong()
  if (musicAudio.paused) {
    $('#musicPath').textContent = '先播放音乐，听到第一拍时再点“此刻是第一拍”。'
    return
  }
  setBeatOffset(song, musicAudio.currentTime)
  clearTimeout(state.musicGuideTimer)
  if (state.musicPlaying) scheduleMusicGuide(song)
})
$('#analyzeBeat').addEventListener('click', async () => {
  const song = currentMusicSong()
  const button = $('#analyzeBeat')
  const previousText = button.textContent
  try {
    button.textContent = '分析中...'
    button.disabled = true
    await ensureAudioEngine()
    const [{ guess }, response] = await Promise.all([
      import('https://esm.sh/web-audio-beat-detector@8.2.36?bundle'),
      fetch(song.src)
    ])
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer)
    const result = await guess(audioBuffer, { minTempo: 55, maxTempo: 180 })
    const detectedBpm = result.tempo || result.bpm
    const detectedOffset = result.offset ?? song.firstBeatOffset
    setSongAnalysis(song, detectedBpm, detectedOffset)
    $('#musicPath').textContent = `已应用分析结果：${Math.round(detectedBpm)} BPM，起拍 ${detectedOffset.toFixed(3)} 秒。`
    if (state.musicPlaying) {
      clearInterval(state.musicGuideTimer)
      state.musicNextBeatNumber = nextBeatNumber(song)
      scheduleMusicGuide(song)
      state.musicGuideTimer = setInterval(() => scheduleMusicGuide(song), 25)
    }
  } catch (error) {
    $('#musicPath').textContent = '分析失败，请检查网络或稍后再试。'
  } finally {
    button.disabled = false
    button.textContent = previousText
  }
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
  return state.scoreMode === 'music' ? getSongBpm(currentScoreSong()) : Number($('#scoreBpm').value)
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
  clearTimeout(state.scoreTimer)
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
  if (state.scoreMode === 'music') {
    const song = currentScoreSong()
    const beatInterval = intervalSeconds(song)
    const offset = getBeatOffset(song)
    const elapsedAudio = musicAudio.currentTime - offset
    const nearestBeat = Math.round(elapsedAudio / beatInterval)
    const hitOffset = Math.abs(musicAudio.currentTime - (offset + nearestBeat * beatInterval)) * 1000
    state.taps.push(hitOffset)
    updateScore()
    return
  }
  const elapsed = now - state.scoreStartAt
  const nearestBeat = Math.round(elapsed / interval)
  const offset = Math.abs(now - (state.scoreStartAt + nearestBeat * interval))
  state.taps.push(offset)
  updateScore()
}

function updateScore() {
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
