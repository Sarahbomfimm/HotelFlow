/**
 * Reproduz um acorde de sino agradável usando Web Audio API.
 * Não requer arquivos externos de áudio.
 */
export function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [
            { freq: 523.25, delay: 0 },    // C5
            { freq: 659.25, delay: 0.18 },  // E5
            { freq: 783.99, delay: 0.35 },  // G5
        ];
        notes.forEach(({ freq, delay }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + delay;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
            osc.start(t);
            osc.stop(t + 0.65);
        });
        setTimeout(() => ctx.close(), 1500);
    } catch {
        // AudioContext indisponível — falha silenciosa
    }
}
