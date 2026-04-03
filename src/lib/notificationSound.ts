// Generate a simple notification sound using Web Audio API
let audioContext: AudioContext | null = null;

export const playMessageNotification = () => {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    const ctx = audioContext;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Create a pleasant two-tone notification
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);       // A5
    osc1.frequency.setValueAtTime(1175, now + 0.1); // D6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now);       // E6
    osc2.frequency.setValueAtTime(1760, now + 0.1);  // A6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.25);
    osc2.stop(now + 0.25);
  } catch (e) {
    // Silently fail - audio is non-critical
    console.warn('Could not play notification sound:', e);
  }
};
