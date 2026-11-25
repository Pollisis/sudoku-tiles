// Soft wooden clicks and chimes, all synthesized with WebAudio. No sound files.
(function (root) {
  let ac = null, master = null, muted = false, noiseBuf = null;

  function ensure() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.7;
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { /* no audio */ }
    return ac;
  }
  function ok() { return ac && !muted && ac.state === 'running'; }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, dur, peak, delay) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    env(g, t, 0.008, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(f0, f1, q, dur, peak, delay, type) {
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(), b = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    b.type = type || 'bandpass';
    b.Q.value = q;
    b.frequency.setValueAtTime(f0, t);
    b.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(b); b.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  const A = {
    unlock() { ensure(); },
    setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.7; },
    tap() {
      if (!ensure() || !ok()) return;
      noise(900, 400, 1.2, 0.045, 0.18, 0, 'lowpass');
      tone('sine', 240, 150, 0.07, 0.16);
    },
    place() {
      if (!ensure() || !ok()) return;
      noise(700, 280, 1.1, 0.07, 0.22, 0, 'lowpass');
      tone('sine', 210, 120, 0.1, 0.22);
      tone('triangle', 420, 200, 0.06, 0.06);
    },
    pencil() {
      if (!ensure() || !ok()) return;
      noise(1800, 2400, 0.8, 0.06, 0.1);
      tone('sine', 720, 500, 0.04, 0.05);
    },
    error() {
      if (!ensure() || !ok()) return;
      tone('triangle', 180, 110, 0.16, 0.22);
      tone('sine', 140, 90, 0.18, 0.14);
      noise(200, 120, 0.7, 0.12, 0.1, 0, 'lowpass');
    },
    undo() {
      if (!ensure() || !ok()) return;
      tone('sine', 280, 360, 0.08, 0.1);
      noise(500, 800, 0.8, 0.06, 0.08, 0, 'lowpass');
    },
    click() {
      if (!ensure() || !ok()) return;
      tone('sine', 520, 400, 0.05, 0.1);
    },
    win() {
      if (!ensure() || !ok()) return;
      const notes = [392, 494, 587, 784, 988];
      notes.forEach((f, i) => {
        tone('sine', f, 0, 0.45, 0.14, i * 0.1);
        tone('triangle', f * 2, 0, 0.22, 0.04, i * 0.1);
      });
    }
  };
  root.ST_AUDIO = A;
})(this);
