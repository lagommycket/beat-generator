const state = {
  tempo: 100,
  complexity: 1,
  feel: 'straight',
  pauseBars: 1,
  repeatCount: 1,
  metronome: true,
  playing: false,
  rhythm: [],
};

const rhythmGenerator = {
  generate(level, feel) {
    const hits = new Array(16).fill(false);
    const chance = (value) => Math.random() < value;

    if (level === 1) {
      for (let beat = 0; beat < 4; beat += 1) hits[beat * 4] = chance(0.7);
      if (hits.filter(Boolean).length < 2) {
        hits[0] = true;
        hits[8] = true;
      }
    } else {
      const downbeatChance = level === 2 ? 0.72 : level === 3 ? 0.66 : 0.62;
      const eighthChance = level === 2 ? 0.22 : level === 3 ? 0.38 : level === 4 ? 0.31 : 0.4;
      const sixteenthChance = level === 4 ? 0.13 : level === 5 ? 0.2 : 0;

      for (let beat = 0; beat < 4; beat += 1) {
        const base = beat * 4;
        hits[base] = chance(downbeatChance);
        hits[base + 2] = chance(eighthChance);
        if (sixteenthChance) {
          hits[base + 1] = chance(sixteenthChance);
          hits[base + 3] = chance(sixteenthChance);
        }
      }

      if (level >= 3 && !hits.some((hit, index) => hit && index % 4 !== 0)) {
        hits[level === 3 ? 6 : 5] = true;
      }
      if (hits.filter(Boolean).length < 2) {
        hits[0] = true;
        hits[8] = true;
      }
      if (level === 5 && hits.filter(Boolean).length > 11) {
        const onsets = hits.map((hit, index) => hit ? index : -1).filter((index) => index >= 0);
        for (const index of onsets.slice(10)) hits[index] = false;
      }
    }

    const offbeatPositions = [2, 6, 10, 14];
    if (!offbeatPositions.some((position) => hits[position])) {
      if (level === 5 && hits.filter(Boolean).length >= 11) {
        const removable = hits.findIndex((hit, index) => hit && index % 4 !== 0);
        if (removable >= 0) hits[removable] = false;
      }
      const position = offbeatPositions[Math.floor(Math.random() * offbeatPositions.length)];
      hits[position] = true;
    }

    const swingRatio = feel === 'swing' ? 0.6 : feel === 'shuffle' ? 2 / 3 : null;
    const positions = hits.flatMap((hit, subdivision) => {
      if (!hit) return [];
      const beat = Math.floor(subdivision / 4);
      const part = subdivision % 4;
      return [part === 2 && swingRatio !== null ? beat + swingRatio : subdivision / 4];
    });
    return positions.map((position, index) => {
      const nextPosition = positions[index + 1] ?? 4;
      return {
        position,
        duration: Math.min(1, nextPosition - position),
        scheduledAudioTime: null,
        soundDuration: 0,
      };
    });
  },
};

const audioEngine = {
  context: null,
  unlocked: false,
  activeSources: new Set(),

  diagnose(action, error) {
    console.info('[Pulse audio]', {
      action,
      browser: navigator.userAgent,
      contextState: this.context?.state ?? 'not-created',
      sessionType: navigator.audioSession?.type ?? 'unsupported',
      unlocked: this.unlocked,
      schedulerActive: scheduler.intervalId !== null,
      playing: state.playing,
      error,
    });
  },

  async resume() {
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (error) { this.diagnose('audio-session-unavailable', error); }
    }
    if (this.context?.state === 'closed') {
      this.context = null;
      this.unlocked = false;
    }
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is not supported in this browser.');
      this.context = new AudioContextClass();
      this.context.addEventListener('statechange', () => {
        this.diagnose('context-statechange');
        if (this.context.state !== 'running' && state.playing) {
          controls.stopPlayback('Audio paused. Tap PLAY to continue.');
        }
      });
    }
    const context = this.context;
    this.diagnose('resume-requested');
    const resumeResult = context.resume();
    if (!this.unlocked || context.state !== 'running') {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      source.addEventListener('ended', () => source.disconnect(), { once: true });
      source.start(0);
    }
    await resumeResult;
    if (context.state !== 'running') throw new Error('AudioContext could not be resumed.');
    this.unlocked = true;
    this.diagnose('resume-succeeded');
    return context;
  },

  tone(time, frequency, volume, type, duration) {
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener('ended', () => {
      this.activeSources.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    this.activeSources.add(oscillator);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.01);
  },

  click(time, accented) {
    this.tone(time, accented ? 1250 : 930, accented ? 0.035 : 0.021, 'sine', 0.045);
  },

  hit(time, duration) {
    this.tone(time, 620, 0.13, 'triangle', duration);
  },

  stopAll() {
    for (const source of this.activeSources) {
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    this.activeSources.clear();
  },
};

const scheduler = {
  intervalId: null,
  nextBeatTime: 0,
  segment: null,
  segments: [],
  lookahead: 0.12,

  start(startTime) {
    this.stop();
    this.segments = [];
    this.segment = null;
    this.nextBeatTime = startTime;
    this.startBar(startTime, 'countin', 1, 1, state.rhythm, 1, state.repeatCount, state.pauseBars);
    this.intervalId = window.setInterval(() => this.tick(), 25);
    this.tick();
  },

  stop() {
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
    this.intervalId = null;
    this.segment = null;
    this.segments = [];
  },

  startBar(startTime, kind, bar, total, rhythm, cycle, cycleTotal, turnTotal) {
    this.segment = {
      kind,
      bar,
      total,
      rhythm,
      cycle,
      cycleTotal,
      turnTotal,
      startTime,
      endTime: null,
      beatTimes: [startTime],
      beat: 0,
    };
    this.segments.push(this.segment);
    if (this.segments.length > 64) this.segments.shift();
  },

  tick() {
    if (!state.playing || !audioEngine.context) return;
    const horizon = audioEngine.context.currentTime + this.lookahead;
    while (this.nextBeatTime < horizon) this.scheduleBeat(this.nextBeatTime);
  },

  scheduleBeat(time) {
    const segment = this.segment;
    if (!segment) return;
    const beat = segment.beat;
    const beatDuration = 60 / state.tempo;
    segment.beatTimes[beat + 1] = time + beatDuration;

    if (state.metronome) audioEngine.click(time, beat === 0);
    if (segment.kind === 'listen') {
      for (const event of segment.rhythm) {
        if (event.position < beat || event.position >= beat + 1) continue;
        const eventTime = time + (event.position - beat) * beatDuration;
        event.scheduledAudioTime = eventTime;
        event.soundDuration = Math.min(0.12, event.duration * beatDuration * 0.8);
        audioEngine.hit(eventTime, event.soundDuration);
      }
    }

    segment.beat += 1;
    this.nextBeatTime = time + beatDuration;
    if (segment.beat === 4) this.advance(segment, this.nextBeatTime);
  },

  advance(segment, nextStart) {
    segment.endTime = nextStart;
    if (segment.kind === 'countin') {
      this.startBar(nextStart, 'listen', 1, 1, segment.rhythm, segment.cycle, segment.cycleTotal, segment.turnTotal);
    } else if (segment.kind === 'listen') {
      this.startBar(nextStart, 'turn', 1, segment.turnTotal, segment.rhythm, segment.cycle, segment.cycleTotal, segment.turnTotal);
    } else if (segment.bar < segment.total) {
      this.startBar(nextStart, 'turn', segment.bar + 1, segment.total, segment.rhythm, segment.cycle, segment.cycleTotal, segment.turnTotal);
    } else if (segment.cycle < segment.cycleTotal) {
      this.startBar(nextStart, 'listen', 1, 1, segment.rhythm, segment.cycle + 1, segment.cycleTotal, segment.turnTotal);
    } else {
      this.startBar(nextStart, 'listen', 1, 1, rhythmGenerator.generate(state.complexity, state.feel), 1, state.repeatCount, state.pauseBars);
    }
  },

  segmentAt(time) {
    for (let index = this.segments.length - 1; index >= 0; index -= 1) {
      const segment = this.segments[index];
      if (time >= segment.startTime && (segment.endTime === null || time < segment.endTime)) return segment;
    }
    return null;
  },
};

const visualizer = {
  cells: [],
  playhead: null,
  animationId: null,

  init() {
    const timeline = document.getElementById('timeline');
    this.playhead = document.createElement('span');
    this.playhead.className = 'playhead';
    this.playhead.setAttribute('aria-hidden', 'true');
    this.cells = [];
    for (let beat = 0; beat < 4; beat += 1) {
      const group = document.createElement('div');
      group.className = 'beat-group';
      for (let part = 0; part < 4; part += 1) {
        const cell = document.createElement('div');
        cell.className = 'subdivision';
        const marker = document.createElement('span');
        marker.className = 'note-marker';
        marker.setAttribute('aria-hidden', 'true');
        cell.append(marker);
        group.append(cell);
        this.cells.push(cell);
      }
      timeline.append(group);
    }
    timeline.append(this.playhead);
    this.renderRhythm();
    this.animationId = window.requestAnimationFrame(() => this.frame());
  },

  renderRhythm(rhythm = state.rhythm) {
    const labels = document.getElementById('grid-labels');
    const stepCount = state.complexity === 1 ? 4 : state.complexity <= 3 ? 8 : 16;
    const partsPerBeat = stepCount / 4;
    labels.replaceChildren();
    labels.style.setProperty('--step-count', stepCount);

    for (let step = 0; step < stepCount; step += 1) {
      const label = document.createElement('span');
      const beat = Math.floor(step / partsPerBeat) + 1;
      const part = step % partsPerBeat;
      label.textContent = partsPerBeat === 1 ? String(beat) : partsPerBeat === 2 ? (part === 0 ? String(beat) : '&') : ['','e','&','a'][part] || String(beat);
      if (partsPerBeat === 4 && part === 0) label.textContent = String(beat);
      labels.append(label);
    }

    this.cells.forEach((cell) => {
      cell.rhythmEvent = null;
      cell.classList.remove('is-hit', 'is-sounding');
    });
    rhythm.forEach((event) => {
      const cell = this.cells[Math.round(event.position * 4)];
      if (!cell) return;
      cell.rhythmEvent = event;
      cell.classList.add('is-hit');
    });
  },

  frame() {
    const now = audioEngine.context?.currentTime ?? 0;
    const segment = state.playing ? scheduler.segmentAt(now) : null;
    const rhythm = segment?.rhythm ?? state.rhythm;
    if (rhythm !== state.rhythm) {
      state.rhythm = rhythm;
      this.renderRhythm(rhythm);
    }
    document.getElementById('phase-indicator').classList.toggle('your-turn', segment?.kind === 'turn');
    document.getElementById('timeline-wrap').classList.toggle('your-turn-mode', segment?.kind === 'turn');
    const listening = segment?.kind === 'listen';
    this.cells.forEach((cell) => {
      const event = cell.rhythmEvent;
      const sounding = listening && event?.scheduledAudioTime !== null && event?.scheduledAudioTime !== undefined && now >= event.scheduledAudioTime && now < event.scheduledAudioTime + event.soundDuration;
      cell.classList.toggle('is-sounding', sounding);
    });

    if (segment) {
      document.getElementById('phase-name').textContent = segment.kind === 'turn' ? 'YOUR TURN' : 'LISTEN';
      const repeatLabel = segment.cycleTotal > 1 ? `Repeat ${segment.cycle} / ${segment.cycleTotal} · ` : '';
      document.getElementById('bar-position').textContent = `${repeatLabel}Bar ${segment.bar} / ${segment.total}`;
      let beat = 0;
      while (beat < 3 && now >= (segment.beatTimes[beat + 1] ?? Infinity)) beat += 1;
      const beatStart = segment.beatTimes[beat] ?? segment.startTime;
      const beatEnd = segment.beatTimes[beat + 1] ?? beatStart + 60 / state.tempo;
      const fraction = Math.min(0.999, Math.max(0, (now - beatStart) / (beatEnd - beatStart)));
      this.playhead.style.left = `${((beat + fraction) / 4) * 100}%`;
      this.playhead.style.opacity = '1';
    } else {
      document.getElementById('phase-name').textContent = 'LISTEN';
      document.getElementById('bar-position').textContent = 'Bar 1 / 1';
      this.playhead.style.opacity = '0';
    }

    this.animationId = window.requestAnimationFrame(() => this.frame());
  },
};

const controls = {
  starting: false,
  startAttempt: 0,

  init() {
    const audioStatus = document.createElement('p');
    audioStatus.id = 'audio-status';
    audioStatus.className = 'keyboard-hint';
    audioStatus.setAttribute('role', 'status');
    audioStatus.hidden = true;
    audioStatus.style.display = 'none';
    document.getElementById('play-button').after(audioStatus);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (state.playing || this.starting)) {
        this.stopPlayback('Audio paused. Tap PLAY to continue.');
      }
    });
    window.addEventListener('pagehide', () => {
      if (state.playing || this.starting) this.stopPlayback('Audio paused. Tap PLAY to continue.');
    });
    document.querySelectorAll('[data-control]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.control;
        const delta = Number(button.dataset.delta);
        const limits = { complexity: [1, 5], pauseBars: [1, 8], repeatCount: [1, 8], tempo: [40, 220] };
        state[key] = Math.min(limits[key][1], Math.max(limits[key][0], state[key] + delta));
        if (key === 'complexity' && !state.playing) {
          state.rhythm = rhythmGenerator.generate(state.complexity, state.feel);
          visualizer.renderRhythm();
        }
        this.render();
      });
    });

    document.querySelectorAll('[data-feel]').forEach((button) => {
      button.addEventListener('click', () => {
        state.feel = button.dataset.feel;
        if (!state.playing) {
          state.rhythm = rhythmGenerator.generate(state.complexity, state.feel);
          visualizer.renderRhythm();
        }
        this.render();
      });
    });

    document.getElementById('metronome-toggle').addEventListener('click', (event) => {
      state.metronome = !state.metronome;
      event.currentTarget.setAttribute('aria-pressed', String(state.metronome));
      document.getElementById('metronome-value').textContent = state.metronome ? 'ON' : 'OFF';
    });

    document.getElementById('play-button').addEventListener('click', () => this.togglePlayback());
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isInteractive = target instanceof HTMLElement && (target.isContentEditable || /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(target.tagName));
      if (event.code === 'Space' && !isInteractive) {
        event.preventDefault();
        this.togglePlayback();
      } else if (!isInteractive && event.key === 'ArrowUp') {
        event.preventDefault();
        state.tempo = Math.min(220, state.tempo + 5);
        this.render();
      } else if (!isInteractive && event.key === 'ArrowDown') {
        event.preventDefault();
        state.tempo = Math.max(40, state.tempo - 5);
        this.render();
      }
    });
    this.render();
  },

  render() {
    document.getElementById('complexity-value').textContent = state.complexity;
    document.getElementById('pause-bars-value').textContent = state.pauseBars;
    document.getElementById('repeat-count-value').textContent = state.repeatCount;
    document.getElementById('tempo-value').innerHTML = `${state.tempo} <small>BPM</small>`;
    document.querySelectorAll('[data-feel]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.feel === state.feel));
    });
    document.querySelectorAll('[data-control]').forEach((button) => {
      const [minimum, maximum] = ({ complexity: [1, 5], pauseBars: [1, 8], repeatCount: [1, 8], tempo: [40, 220] })[button.dataset.control];
      const value = state[button.dataset.control];
      const delta = Number(button.dataset.delta);
      button.disabled = delta < 0 ? value <= minimum : value >= maximum;
    });
  },

  stopPlayback(message = '') {
    this.startAttempt += 1;
    this.starting = false;
    state.playing = false;
    scheduler.stop();
    audioEngine.stopAll();
    this.showPlaybackState(false);
    document.getElementById('play-button').disabled = false;
    const status = document.getElementById('audio-status');
    status.textContent = message;
    status.hidden = !message;
    status.style.display = message ? '' : 'none';
    audioEngine.diagnose('playback-stopped');
  },

  async togglePlayback() {
    if (this.starting) return;
    if (state.playing) {
      this.stopPlayback();
      return;
    }

    const button = document.getElementById('play-button');
    const attempt = ++this.startAttempt;
    this.starting = true;
    button.disabled = true;
    document.getElementById('audio-status').hidden = true;
    document.getElementById('audio-status').style.display = 'none';
    try {
      const context = await audioEngine.resume();
      if (attempt !== this.startAttempt) return;
      if (document.hidden) {
        this.stopPlayback('Audio paused. Tap PLAY to continue.');
        return;
      }
      state.playing = true;
      scheduler.start(context.currentTime + 0.12);
      visualizer.renderRhythm();
      this.showPlaybackState(true);
      audioEngine.diagnose('playback-started');
    } catch (error) {
      if (attempt !== this.startAttempt) return;
      audioEngine.diagnose('playback-failed', error);
      this.stopPlayback('Sound could not start. Tap PLAY to try again. Check Silent Mode and volume.');
    } finally {
      if (attempt === this.startAttempt) {
        this.starting = false;
        button.disabled = false;
      }
    }
  },

  showPlaybackState(playing) {
    const button = document.getElementById('play-button');
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? 'Pause rhythm training' : 'Start rhythm training');
    document.getElementById('play-label').textContent = playing ? 'PAUSE' : 'PLAY';
  },
};

state.rhythm = rhythmGenerator.generate(state.complexity, state.feel);
visualizer.init();
controls.init();