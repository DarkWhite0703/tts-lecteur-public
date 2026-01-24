/**
 * TTSReader Class PRO
 */
class TTSReader {
    constructor() {
        if (!('speechSynthesis' in window)) {
            document.body.innerHTML = '<div class="container"><h1>❌ API non supportée</h1></div>';
            return;
        }

        this.synth = window.speechSynthesis;
        this.wakeLock = null;
        
        // Création du lecteur de silence pour le background mobile
        this.silentPlayer = new Audio('https://github.com/anars/blank-audio/raw/master/10-seconds-of-silence.mp3');
        this.silentPlayer.loop = true;

        this.dom = {
            textInput: document.getElementById('text-input'),
            readView: document.getElementById('read-view'),
            playBtn: document.getElementById('play-btn'),
            stopBtn: document.getElementById('stop-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            voiceSelect: document.getElementById('voice-select'),
            fileInput: document.getElementById('file-input'),
            statusDiv: document.getElementById('status'),
            // Musique
            musicInput: document.getElementById('music-input'),
            bgAudio: document.getElementById('bg-audio'),
            musicVolume: document.getElementById('music-volume'),
            // Thème et Modal
            themeCheckbox: document.getElementById('theme-checkbox'),
            saveBtn: document.getElementById('save-btn'),
            loadBtn: document.getElementById('load-btn'),
            ebookModal: document.getElementById('ebook-modal'),
            closeBtn: document.querySelector('.close-btn')
        };

        this.state = {
            utterance: null,
            sentences: [],
            currentSentenceIndex: 0,
            isPaused: false,
            isPlaying: false
        };

        this.init();
    }

    init() {
        this.loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoices();
        }
        this.initEventListeners();
    }

    // --- GESTION DU MODE VEILLE (WAKE LOCK) ---
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log("Wake Lock activé : l'écran ne s'éteindra pas.");
            }
        } catch (err) {
            console.error(`Erreur Wake Lock: ${err.message}`);
        }
    }

    releaseWakeLock() {
        if (this.wakeLock !== null) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    // --- LECTURE ---
    play() {
        if (this.state.isPaused) {
            this.synth.resume();
            this.state.isPaused = false;
            return;
        }

        const text = this.dom.textInput.value.trim();
        if (!text) return;

        this.requestWakeLock(); // Empêche la mise en veille
        this.silentPlayer.play(); // Force le flux audio mobile
        
        this.state.isPlaying = true;
        this.state.sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
        this.state.currentSentenceIndex = 0;
        
        this.dom.textInput.classList.add('hidden');
        this.dom.readView.classList.remove('hidden');
        
        this.readNextSegment();
        this.updateControlState();
    }

    readNextSegment() {
        if (this.state.currentSentenceIndex >= this.state.sentences.length) {
            this.stop();
            return;
        }

        const text = this.state.sentences[this.state.currentSentenceIndex];
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Appliquer les réglages
        const selectedVoice = this.dom.voiceSelect.selectedOptions[0]?.getAttribute('data-name');
        utterance.voice = this.synth.getVoices().find(v => v.name === selectedVoice);
        utterance.rate = document.getElementById('rate').value / 10;
        utterance.pitch = document.getElementById('pitch').value / 10;
        utterance.volume = document.getElementById('volume').value / 10;

        utterance.onstart = () => {
            this.highlightText(this.state.currentSentenceIndex);
        };

        utterance.onend = () => {
            if (this.state.isPlaying && !this.state.isPaused) {
                this.state.currentSentenceIndex++;
                this.readNextSegment();
            }
        };

        this.synth.speak(utterance);
    }

    stop() {
        this.synth.cancel();
        this.silentPlayer.pause();
        this.releaseWakeLock(); // Relance la mise en veille normale
        
        this.state.isPlaying = false;
        this.state.isPaused = false;
        this.dom.readView.classList.add('hidden');
        this.dom.textInput.classList.remove('hidden');
        this.updateControlState();
    }

    // --- INTERFACE & EVENTS ---
    initEventListeners() {
        this.dom.playBtn.addEventListener('click', () => this.play());
        this.dom.stopBtn.addEventListener('click', () => this.stop());
        
        this.dom.pauseBtn.addEventListener('click', () => {
            if (this.synth.speaking && !this.state.isPaused) {
                this.synth.pause();
                this.state.isPaused = true;
            } else if (this.state.isPaused) {
                this.play();
            }
        });

        // Custom File Input : Afficher le nom du fichier
        this.dom.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const label = document.querySelector('.custom-file-upload');
                label.innerHTML = `<i class="fas fa-file-alt"></i> ${file.name}`;
                this.handleFileImport(file);
            }
        });

        // Musique d'ambiance
        this.dom.musicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.dom.bgAudio.src = URL.createObjectURL(file);
                this.dom.bgAudio.play();
            }
        });

        this.dom.musicVolume.addEventListener('input', (e) => {
            this.dom.bgAudio.volume = e.target.value;
        });

        // Switch Thème
        this.dom.themeCheckbox.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode');
        });
    }

    loadVoices() {
        const voices = this.synth.getVoices();
        this.dom.voiceSelect.innerHTML = voices
            .map(v => `<option data-name="${v.name}">${v.name} (${v.lang})</option>`)
            .join('');
    }

    updateControlState() {
        const hasText = this.dom.textInput.value.length > 0;
        this.dom.playBtn.disabled = !hasText;
        this.dom.stopBtn.disabled = !this.state.isPlaying;
        this.dom.pauseBtn.disabled = !this.state.isPlaying;
    }

    highlightText(index) {
        this.dom.readView.innerHTML = this.state.sentences
            .map((s, i) => i === index ? `<span class="highlight">${s}</span>` : s)
            .join(' ');
    }
}

// Lancement
const reader = new TTSReader();