/**
 * TypeEngine Pro
 * No Libraries. Pure Performance.
 */

// --- STATE MANAGEMENT ---
const State = {
    words: [
        "const flow = (a, b) => a + b;",
        "import { useState } from 'react';",
        "document.querySelector('#app');",
        "function optimize() { return true; }",
        "flex-direction: column;",
        "The quick brown fox jumps over.",
        "async function fetchData(url) {}",
        "array.reduce((acc, val) => acc + val);"
    ],
    currentText: "",
    charIndex: 0,
    startTime: null,
    errors: 0,
    streak: 0,
    isTyping: false,
    theme: 'cupertino', // or 'redmond'
    keyMap: {} // Stores DOM elements for keys
};

// --- DOM ELEMENTS ---
const els = {
    body: document.body,
    themeToggle: document.getElementById('theme-toggle'),
    textDisplay: document.getElementById('text-display'),
    caret: document.getElementById('caret'),
    wpm: document.getElementById('wpm-display'),
    acc: document.getElementById('acc-display'),
    flowBar: document.getElementById('flow-bar'),
    arena: document.getElementById('arena'),
    keyboard: document.getElementById('keyboard'),
    canvas: document.getElementById('particle-canvas')
};

// --- AUDIO ENGINE (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playSound = (type) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (State.theme === 'cupertino') {
        // Mac Style: Soft "Thock" (Sine wave, low pitch)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else {
        // Windows/Gamer Style: Clicky "Blue Switch" (Square wave, high pitch)
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }
};

const playErrorSound = () => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = 150;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
};

// --- VISUAL KEYBOARD GENERATOR ---
const layout = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['z','x','c','v','b','n','m']
];

function initKeyboard() {
    els.keyboard.innerHTML = '';
    
    // Rows
    layout.forEach(rowKeys => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';
        rowKeys.forEach(key => {
            const k = document.createElement('div');
            k.className = 'key';
            k.textContent = key;
            k.dataset.key = key;
            rowDiv.appendChild(k);
            State.keyMap[key] = k;
        });
        els.keyboard.appendChild(rowDiv);
    });

    // Spacebar Row
    const spaceRow = document.createElement('div');
    spaceRow.className = 'row';
    const modLeft = document.createElement('div');
    modLeft.className = 'key special';
    modLeft.textContent = State.theme === 'cupertino' ? 'cmd' : 'ctrl';
    
    const space = document.createElement('div');
    space.className = 'key space';
    space.dataset.key = ' ';
    State.keyMap[' '] = space;

    const modRight = document.createElement('div');
    modRight.className = 'key special';
    modRight.textContent = State.theme === 'cupertino' ? 'opt' : 'alt';

    spaceRow.appendChild(modLeft);
    spaceRow.appendChild(space);
    spaceRow.appendChild(modRight);
    els.keyboard.appendChild(spaceRow);
}

// --- CANVAS PARTICLE SYSTEM ---
const ctx = els.canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    els.canvas.width = window.innerWidth * dpr;
    els.canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.03;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Circle for Mac, Square for Windows
        if(State.theme === 'cupertino') {
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        } else {
            ctx.fillRect(this.x, this.y, 4, 4);
        }
        ctx.fill();
    }
}

function spawnParticles(x, y) {
    const color = State.theme === 'cupertino' ? '#007aff' : '#00d4ff';
    for(let i=0; i<5; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function renderLoop() {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Update WPM real-time if typing
    if(State.isTyping) {
        const elapsedMin = (Date.now() - State.startTime) / 60000;
        const wpm = Math.round((State.charIndex / 5) / elapsedMin) || 0;
        els.wpm.textContent = wpm;
    }

    requestAnimationFrame(renderLoop);
}

// --- GAME LOGIC ---

function initGame() {
    // Pick random text
    State.currentText = State.words[Math.floor(Math.random() * State.words.length)];
    els.textDisplay.innerHTML = '';
    
    // Render text span by span
    State.currentText.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        els.textDisplay.appendChild(span);
    });

    State.charIndex = 0;
    State.errors = 0;
    State.streak = 0;
    State.isTyping = false;
    updateCursor();
    initKeyboard(); // Re-render for label changes (cmd/ctrl)
}

function updateCursor() {
    const spans = els.textDisplay.querySelectorAll('span');
    let target;
    
    if (State.charIndex < spans.length) {
        target = spans[State.charIndex];
    } else {
        // End of line, position after last char
        target = spans[spans.length - 1];
    }

    if(target) {
        const rect = target.getBoundingClientRect();
        const arenaRect = els.arena.getBoundingClientRect();
        
        // Calculate relative position within arena
        const top = rect.top - arenaRect.top;
        const left = State.charIndex < spans.length 
            ? rect.left - arenaRect.left 
            : rect.right - arenaRect.left;

        els.caret.style.transform = `translate(${left}px, ${top}px)`;
        
        // Highlight Key
        const char = State.currentText[State.charIndex]?.toLowerCase();
        document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
        if(char && State.keyMap[char]) {
            State.keyMap[char].classList.add('active');
        }
    }
}

function handleInput(e) {
    if(!State.isTyping) {
        State.isTyping = true;
        State.startTime = Date.now();
    }

    const expected = State.currentText[State.charIndex];
    const spans = els.textDisplay.querySelectorAll('span');
    const currentSpan = spans[State.charIndex];

    // Ignore modifiers
    if (e.key.length > 1 && e.key !== 'Backspace') return;

    if (e.key === expected) {
        // Correct
        currentSpan.classList.add('correct');
        State.charIndex++;
        State.streak++;
        playSound('hit');
        
        // Spawn particles at cursor location
        const rect = els.caret.getBoundingClientRect();
        spawnParticles(rect.left, rect.top);

        if (State.charIndex === State.currentText.length) {
            setTimeout(initGame, 200); // Next sentence
        }
    } else {
        // Error
        currentSpan.classList.add('error');
        playErrorSound();
        State.errors++;
        State.streak = 0;
        
        // Shake Effect
        els.arena.classList.remove('shake');
        void els.arena.offsetWidth; // Trigger reflow
        els.arena.classList.add('shake');
    }

    // Update Stats
    const accuracy = Math.round(((State.charIndex - State.errors) / State.charIndex) * 100) || 100;
    els.acc.textContent = Math.max(0, accuracy) + '%';
    
    // Update Flow Bar (Cap at 50 streak)
    const flowPercent = Math.min((State.streak / 50) * 100, 100);
    els.flowBar.style.width = `${flowPercent}%`;

    updateCursor();
}

// --- EVENT LISTENERS ---

document.addEventListener('keydown', (e) => {
    // Prevent default scrolling for space
    if(e.key === ' ') e.preventDefault();
    handleInput(e);
});

els.themeToggle.addEventListener('change', (e) => {
    if(e.target.checked) {
        State.theme = 'redmond';
        els.body.classList.replace('theme-cupertino', 'theme-redmond');
    } else {
        State.theme = 'cupertino';
        els.body.classList.replace('theme-redmond', 'theme-cupertino');
    }
    initKeyboard();
    els.body.focus();
});

// Start
initGame();
renderLoop();