class SoundManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isMuted = false;
        
        // Set up mute button handler
        const muteButton = document.getElementById('muteButton');
        if (muteButton) {
            muteButton.addEventListener('click', () => this.toggleMute());
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const muteButton = document.getElementById('muteButton');
        const soundIcon = document.getElementById('soundIcon');
        
        if (muteButton) {
            muteButton.classList.toggle('muted');
            soundIcon.textContent = this.isMuted ? '🔇' : '🔊';
        }
    }

    createOscillator(type, frequency, duration, gainValue = 0.3, sweep = null) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        if (sweep) {
            oscillator.frequency.exponentialRampToValueAtTime(
                sweep.frequency,
                this.audioContext.currentTime + sweep.duration
            );
        }
        
        gainNode.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        return oscillator;
    }

    playWater() {
        // Water splash sound - bubbling effect
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const osc = this.createOscillator('sine', 800 + Math.random() * 500, 0.1, 0.1);
                osc.start();
                osc.stop(this.audioContext.currentTime + 0.1);
            }, i * 60);
        }
    }

    playPickup() {
        // Rising pitch sound
        const osc = this.createOscillator('sine', 220, 0.15, 0.2, {
            frequency: 440,
            duration: 0.15
        });
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);
    }

    playDrop() {
        // Falling pitch sound
        const osc = this.createOscillator('sine', 440, 0.15, 0.2, {
            frequency: 220,
            duration: 0.15
        });
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);
    }

    playSell() {
        // Coin collection sound
        const osc1 = this.createOscillator('sine', 880, 0.1, 0.2);
        const osc2 = this.createOscillator('sine', 1320, 0.1, 0.15);
        
        osc1.start();
        osc2.start(this.audioContext.currentTime + 0.08);
        
        osc1.stop(this.audioContext.currentTime + 0.1);
        osc2.stop(this.audioContext.currentTime + 0.18);
    }

    playMerge() {
        // Magical merge sound
        const duration = 0.3;
        
        // Base tone
        const osc1 = this.createOscillator('sine', 440, duration, 0.2, {
            frequency: 880,
            duration: duration
        });
        
        // Harmony
        const osc2 = this.createOscillator('triangle', 554.37, duration, 0.1, {
            frequency: 1108.74,
            duration: duration
        });
        
        // Sparkle effect
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const osc3 = this.createOscillator('sine', 1760 + Math.random() * 500, 0.1, 0.05);
                osc3.start();
                osc3.stop(this.audioContext.currentTime + 0.1);
            }, i * 100);
        }
        
        osc1.start();
        osc2.start();
        osc1.stop(this.audioContext.currentTime + duration);
        osc2.stop(this.audioContext.currentTime + duration);
    }

    play(soundName) {
        // Don't play sounds if muted
        if (this.isMuted) return;

        // Ensure context is running (needed due to autoplay policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Map sound names to their respective play functions
        const soundMap = {
            'water': () => this.playWater(),
            'pickup': () => this.playPickup(),
            'drop': () => this.playDrop(),
            'sell': () => this.playSell(),
            'merge': () => this.playMerge()
        };

        if (soundMap[soundName]) {
            soundMap[soundName]();
        }
    }
}

// Create global instance
window.soundManager = new SoundManager();
