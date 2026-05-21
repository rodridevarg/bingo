/**
 * BINGO TV - Aplicación completa offline
 * Bingo Tradicional Argentino: 90 bolas, sin letras
 * Lógica, persistencia, audio, voz, bolillero y efectos visuales
 */

/* ============================================
   1. STORAGE MANAGER
   ============================================ */
class StorageManager {
  static KEY = 'bingoState';
  static VERSION = '2.0';

  static save(state) {
    try {
      const payload = {
        ...state,
        version: this.VERSION,
        timestamp: Date.now()
      };
      localStorage.setItem(this.KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== this.VERSION) {
        // Versión incompatible: forzar nueva partida
        return null;
      }
      return data;
    } catch (e) {
      console.warn('Error al cargar localStorage:', e);
      return null;
    }
  }

  static clear() {
    try {
      localStorage.removeItem(this.KEY);
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
  }

  static validate(data) {
    if (!data) return false;
    if (!Array.isArray(data.drawnNumbers)) return false;
    if (!Array.isArray(data.remainingNumbers)) return false;
    if (typeof data.currentNumber !== 'number' && data.currentNumber !== null) return false;
    return true;
  }
}

/* ============================================
   2. AUDIO ENGINE (Procedural)
   ============================================ */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._ensureContext();
  }

  _ensureContext() {
    if (!this.ctx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      } catch (e) {
        console.warn('Web Audio API no disponible');
        this.enabled = false;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _osc(freq, type, duration, startTime, gainVal = 0.15) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  playPop() {
    this._ensureContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc(600, 'sine', 0.15, t, 0.2);
    this._osc(900, 'sine', 0.1, t + 0.02, 0.15);
    this._noise(0.08, t, 0.08);
  }

  playSuspense() {
    this._ensureContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(500, t + 0.3);
    osc.frequency.linearRampToValueAtTime(400, t + 0.5);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  playFanfare() {
    this._ensureContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this._osc(freq, 'sine', 0.4, t + i * 0.12, 0.18);
      this._osc(freq * 2, 'triangle', 0.3, t + i * 0.12, 0.06);
    });
  }

  playClick() {
    this._ensureContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc(800, 'square', 0.05, t, 0.08);
  }

  playRiverito() {
    try {
      const audio = new Audio('riverito.mp3');
      audio.volume = 0.8;
      audio.play();
    } catch (e) {
      console.warn('No se pudo reproducir riverito.mp3:', e);
    }
  }

  _noise(duration, startTime, gainVal) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(startTime);
  }
}

/* ============================================
   3. VOICE ANNOUNCER (Español)
   ============================================ */
class VoiceAnnouncer {
  constructor() {
    this.enabled = true;
    this.voice = null;
    this._loadVoice();
  }

  _loadVoice() {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const spanish = voices.filter(v => v.lang.startsWith('es'));
      this.voice = spanish[0] || voices[0] || null;
    };
    pick();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pick;
    }
  }

  speak(text) {
    if (!this.enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = this.voice;
    utter.lang = this.voice ? this.voice.lang : 'es-ES';
    utter.rate = 0.9;
    utter.pitch = 1.1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  }

  announce(number) {
    const words = this._numberToWords(number);
    this.speak(words);
  }

  _numberToWords(n) {
    const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const veinti = ['', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];

    if (n >= 1 && n <= 9) return unidades[n];
    if (n >= 10 && n <= 19) return especiales[n - 10];
    if (n >= 20 && n <= 29) return veinti[n - 20] || decenas[2];
    if (n >= 30 && n <= 90) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      let res = decenas[d];
      if (u > 0) res += ' y ' + unidades[u];
      return res;
    }
    return String(n);
  }
}

/* ============================================
   4. CONFETTI EFFECT (Canvas)
   ============================================ */
class ConfettiEffect {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.active = false;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start(duration = 4000) {
    this.active = true;
    this.particles = [];
    const colors = ['#ff2e63', '#08d9d6', '#ffd700', '#00e5ff', '#76ff03', '#ff8c00', '#d500f9'];
    for (let i = 0; i < 150; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }
    this._animate();
    setTimeout(() => { this.active = false; }, duration);
  }

  _animate() {
    if (!this.active && this.particles.length === 0) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.003;

      if (p.opacity <= 0 || p.y > this.canvas.height + 20) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    }
    requestAnimationFrame(() => this._animate());
  }
}

/* ============================================
   5. BINGO GAME LOGIC (90 bolas, tradicional argentino)
   ============================================ */
class BingoGame {
  constructor() {
    this.drawnNumbers = [];
    this.remainingNumbers = [];
    this.currentNumber = null;
    this.isAnimating = false;
    this.settings = {
      soundEnabled: true,
      voiceEnabled: true,
      theme: 'theme-default'
    };
  }

  init() {
    const saved = StorageManager.load();
    if (saved && StorageManager.validate(saved)) {
      this.drawnNumbers = saved.drawnNumbers || [];
      this.remainingNumbers = saved.remainingNumbers || [];
      this.currentNumber = saved.currentNumber !== undefined ? saved.currentNumber : null;
      this.settings = { ...this.settings, ...(saved.settings || {}) };
      if (this.remainingNumbers.length === 0 && this.drawnNumbers.length < 90) {
        this._rebuildRemaining();
      }
    } else {
      this.reset(false);
    }
  }

  _rebuildRemaining() {
    const all = Array.from({ length: 90 }, (_, i) => i + 1);
    this.remainingNumbers = all.filter(n => !this.drawnNumbers.includes(n));
  }

  reset(save = true) {
    this.drawnNumbers = [];
    this.remainingNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    this.currentNumber = null;
    this.isAnimating = false;
    if (save) {
      StorageManager.save(this._serialize());
    }
  }

  draw() {
    if (this.isAnimating) return null;
    if (this.remainingNumbers.length === 0) return null;

    this.isAnimating = true;
    const idx = Math.floor(Math.random() * this.remainingNumbers.length);
    const number = this.remainingNumbers[idx];
    this.remainingNumbers.splice(idx, 1);
    this.drawnNumbers.push(number);
    this.currentNumber = number;
    this.isAnimating = false;
    this._save();
    return number;
  }

  canUndo() {
    return this.drawnNumbers.length > 0 && !this.isAnimating;
  }

  undo() {
    if (!this.canUndo()) return null;
    const lastNumber = this.drawnNumbers.pop();
    this.remainingNumbers.push(lastNumber);
    this.currentNumber = this.drawnNumbers.length > 0
      ? this.drawnNumbers[this.drawnNumbers.length - 1]
      : null;
    this._save();
    return lastNumber;
  }

  _save() {
    StorageManager.save(this._serialize());
  }

  _serialize() {
    return {
      drawnNumbers: this.drawnNumbers,
      remainingNumbers: this.remainingNumbers,
      currentNumber: this.currentNumber,
      settings: this.settings
    };
  }

  getRemainingCount() {
    return this.remainingNumbers.length;
  }

  getHistory(limit = 24) {
    return this.drawnNumbers.slice(-limit);
  }
}

/* ============================================
   6. UI RENDERER
   ============================================ */
class UIRenderer {
  constructor(game) {
    this.game = game;
    this.els = {
      ball: document.getElementById('current-ball'),
      ballNumber: document.getElementById('ball-number'),
      displayNumber: document.getElementById('display-number'),
      numberDisplay: document.querySelector('.number-display'),
      drum: document.getElementById('drum'),
      historyGrid: document.getElementById('history-grid'),
      historyTitle: document.getElementById('history-title'),
      remaining: document.getElementById('balls-remaining'),
      btnDraw: document.getElementById('btn-draw'),
      btnUndo: document.getElementById('btn-undo'),
      btnNewGame: document.getElementById('btn-new-game'),
      modal: document.getElementById('modal-confirm'),
      btnCancel: document.getElementById('btn-cancel'),
      btnConfirm: document.getElementById('btn-confirm'),
      status: document.getElementById('status-message')
    };
  }

  renderAll() {
    this.renderCurrentBall();
    this.renderHistory();
    this.renderCounter();
    this.renderButtonState();
  }

  renderCurrentBall() {
    const n = this.game.currentNumber;
    if (n === null) {
      this.els.ballNumber.textContent = '--';
      this.els.displayNumber.textContent = '--';
      return;
    }
    this.els.ballNumber.textContent = n;
    this.els.displayNumber.textContent = n;
  }

  renderHistory() {
    const history = this.game.getHistory(90);
    // Mostrar u ocultar título según haya bolas
    if (this.els.historyTitle) {
      this.els.historyTitle.classList.toggle('hidden', history.length === 0);
    }
    this.els.historyGrid.innerHTML = '';
    history.forEach(num => {
      const div = document.createElement('div');
      div.className = 'history-ball';
      div.innerHTML = `<span class="hb-number">${num}</span>`;
      this.els.historyGrid.appendChild(div);
    });
    // Auto-scroll al final para mostrar la bola más reciente
    this.els.historyGrid.scrollTop = this.els.historyGrid.scrollHeight;
  }

  renderCounter() {
    this.els.remaining.textContent = this.game.getRemainingCount();
  }

  renderButtonState() {
    const empty = this.game.getRemainingCount() === 0;
    this.els.btnDraw.disabled = empty || this.game.isAnimating;
    this.els.btnUndo.disabled = !this.game.canUndo();
    if (empty) {
      this.els.btnDraw.textContent = 'Sin bolas';
    } else {
      this.els.btnDraw.textContent = 'Sacar Bola';
    }
  }

  showDrum() {
    this.els.ball.classList.add('hidden');
    this.els.drum.classList.remove('hidden');
  }

  hideDrum() {
    this.els.drum.classList.add('hidden');
    this.els.ball.classList.remove('hidden');
  }

  async animateDraw(number, onComplete) {
    const finalNumber = number;

    // 1. Mostrar bolillero
    this.showDrum();
    this.els.numberDisplay.classList.add('animating');
    this.els.ball.classList.remove('animate-draw', 'animate-glow');

    // 2. Slot machine rápida en el display mientras gira el drum
    let iterations = 0;
    const maxIterations = 18;
    const interval = setInterval(() => {
      iterations++;
      const fake = Math.floor(Math.random() * 90) + 1;
      this.els.displayNumber.textContent = fake;

      if (iterations >= maxIterations) {
        clearInterval(interval);
        // 3. Ocultar drum y mostrar bola real
        this.hideDrum();
        this._finalizeDraw(finalNumber, onComplete);
      }
    }, 80);
  }

  _finalizeDraw(number, onComplete) {
    this.els.numberDisplay.classList.remove('animating');

    this.els.ballNumber.textContent = number;
    this.els.displayNumber.textContent = number;

    this.els.ball.classList.add('animate-draw');
    setTimeout(() => {
      this.els.ball.classList.remove('animate-draw');
      this.els.ball.classList.add('animate-glow');
    }, 1200);

    this.renderHistory();
    this.renderCounter();
    this.renderButtonState();

    if (onComplete) onComplete();
  }

  showStatus(msg, duration = 2500) {
    this.els.status.textContent = msg;
    this.els.status.classList.add('show');
    setTimeout(() => {
      this.els.status.classList.remove('show');
    }, duration);
  }

  showModal() {
    this.els.modal.classList.remove('hidden');
  }

  hideModal() {
    this.els.modal.classList.add('hidden');
  }
}

/* ============================================
   7. FULLSCREEN HELPER
   ============================================ */
class FullscreenHelper {
  static toggle() {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
      if (doc.requestFullscreen) doc.requestFullscreen();
      else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
      else if (doc.msRequestFullscreen) doc.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    }
  }

  static tryAuto() {
    const handler = () => {
      this.toggle();
      document.removeEventListener('click', handler);
    };
    document.addEventListener('click', handler, { once: true });
  }
}

/* ============================================
   8. APP CONTROLLER
   ============================================ */
class App {
  constructor() {
    this.game = new BingoGame();
    this.audio = new AudioEngine();
    this.voice = new VoiceAnnouncer();
    this.confetti = new ConfettiEffect('confetti-canvas');
    this.ui = new UIRenderer(this.game);
  }

  init() {
    this.game.init();
    this.ui.renderAll();
    this._bindEvents();
    this._applyTheme(this.game.settings.theme || 'theme-default');
    FullscreenHelper.tryAuto();
    console.log('Bingo Tradicional iniciado. Bolas restantes:', this.game.getRemainingCount());
  }

  _bindEvents() {
    this.ui.els.btnDraw.addEventListener('click', () => this._handleDraw());
    this.ui.els.btnUndo.addEventListener('click', () => this._handleUndo());

    this.ui.els.btnNewGame.addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showModal();
    });
    this.ui.els.btnCancel.addEventListener('click', () => {
      this.audio.playClick();
      this.ui.hideModal();
    });
    this.ui.els.btnConfirm.addEventListener('click', () => {
      this.audio.playClick();
      this._handleNewGame();
      this.ui.hideModal();
    });

    document.querySelector('.main-header').addEventListener('dblclick', () => {
      FullscreenHelper.toggle();
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.audio.playClick();
        const theme = e.target.dataset.theme;
        this._applyTheme(theme);
      });
    });
  }

  async _handleDraw() {
    if (this.game.isAnimating) return;
    if (this.game.getRemainingCount() === 0) {
      this.ui.showStatus('¡Todas las bolas han sido sorteadas!');
      return;
    }

    this.audio._ensureContext();
    this.audio.playSuspense();

    const number = this.game.draw();
    if (number === null) return;

    this.ui.renderButtonState();
    this.ui.animateDraw(number, () => {
      this.audio.playPop();

      if (this.game.settings.voiceEnabled) {
        this.voice.announce(number);
      }

      const remaining = this.game.getRemainingCount();
      if (remaining === 0) {
        this.ui.showStatus('¡Bingo completo!');
        this.audio.playFanfare();
        this.confetti.start(6000);
      } else if (remaining <= 5) {
        this.ui.showStatus(`¡Quedan solo ${remaining} bolas!`);
        this.confetti.start(3000);
      }
    });
  }

  _handleUndo() {
    if (!this.game.canUndo()) return;
    this.audio.playClick();
    const undoneNumber = this.game.undo();
    this.ui.renderAll();
    if (undoneNumber !== null) {
      this.ui.showStatus(`Anulado: ${undoneNumber}`);
    }
  }

  _handleNewGame() {
    this.game.reset(true);
    this.ui.renderAll();
    this.ui.showStatus('Nueva partida iniciada');
    this.audio.playRiverito();
  }

  _applyTheme(themeName) {
    document.body.className = themeName;
    this.game.settings.theme = themeName;
    StorageManager.save(this.game._serialize());
  }
}

/* ============================================
   9. INICIALIZACIÓN
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
