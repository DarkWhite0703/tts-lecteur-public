/**
 * TTSReader Class
 * Gère toutes les fonctionnalités avancées du lecteur audio (TTS) :
 * - Thèmes, Préférences (Sauvegarde)
 * - Surlignage Synchronisé
 * - Segmentation Intelligente (Fluidité après les points)
 * - Gestion de bibliothèque d'Ebooks (Sauvegarde/Chargement/Suppression)
 * * CORRECTION FINALE: Ajout de gardes isPaused dans utterance.onerror pour empêcher la réinitialisation involontaire
 * * causée par le déclenchement tardif de l'événement d'erreur après un synth.cancel().
 * * CORRECTION PC: Mise à jour de readNextSegment pour nettoyer le surlignage de segment et résoudre le problème de blocage/d'erreur immédiate.
 */
class TTSReader {
    constructor() {
        // Vérification de l'API (Essentiel pour la fiabilité)
        if (!('speechSynthesis' in window)) {
            document.body.innerHTML = '<div class="container"><h1>❌ API non supportée</h1><p>Veuillez utiliser un navigateur moderne.</p></div>';
            return;
        }
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
        this.synth = window.speechSynthesis;
        
        // Références DOM
        this.dom = {
            textInput: document.getElementById('text-input'),
            readView: document.getElementById('read-view'),
            playBtn: document.getElementById('play-btn'),
            stopBtn: document.getElementById('stop-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            statusDiv: document.getElementById('status'),
            voiceSelect: document.getElementById('voice-select'),
            rateInput: document.getElementById('rate'),
            pitchInput: document.getElementById('pitch'),
            volumeInput: document.getElementById('volume'),
            fileInput: document.getElementById('file-input'),
            rateValueSpan: document.getElementById('rate-value'),
            pitchValueSpan: document.getElementById('pitch-value'),
            volumeValueSpan: document.getElementById('volume-value'),
            themeCheckbox: document.getElementById('theme-checkbox'),
            // NOUVEAU: Références Ebook
            saveBtn: document.getElementById('save-btn'),
            loadBtn: document.getElementById('load-btn'),
            ebookModal: document.getElementById('ebook-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalBody: document.getElementById('modal-body'),
            closeBtn: document.querySelector('.close-btn'),
            musicInput: document.getElementById('music-input'),
            bgAudio: document.getElementById('bg-audio'),
            musicVolume: document.getElementById('music-volume')
        };
        // État de l'application
        this.dom.musicInput.addEventListener('change', (e) => this.handleMusicUpload(e));
        this.dom.musicVolume.addEventListener('input', (e) => {
            this.dom.bgAudio.volume = e.target.value;
        });
        this.voices = [];
        this.isSpeaking = false;
        this.isPaused = false;
        this.textSegments = [];
        this.currentSegmentIndex = 0; // Index du segment en cours de lecture
        this.savedEbooks = this.loadEbooks(); // Charge les ebooks au démarrage
        this.preferredVoiceName = null; // Prépare l'application de la voix préférée

        this.init();
    }

    /** Initialisation de l'application */
    init() {
        this.loadTheme();
        this.loadPreferences(); // Charge les préférences de lecture
        
        // L'événement onvoiceschanged est déclenché quand les voix sont prêtes
        if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = this.populateVoiceList;
        this.populateVoiceList(); // Tentative de chargement initial
        
        this.addEventListeners();
        this.updateControlState();
        
        // Afficher l'état initial des sliders
        this.dom.rateValueSpan.textContent = this.dom.rateInput.value;
        this.dom.pitchValueSpan.textContent = this.dom.pitchInput.value;
        this.dom.volumeValueSpan.textContent = this.dom.volumeInput.value;
    }

    /** ------------------------- GESTION DU THÈME ------------------------- */

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            this.dom.themeCheckbox.checked = true;
        }
    }

    toggleDarkMode = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    /** ------------------------- GESTION DES PRÉFÉRENCES ------------------------- */

    savePreferences = () => {
        const preferences = {
            rate: this.dom.rateInput.value,
            pitch: this.dom.pitchInput.value,
            volume: this.dom.volumeInput.value,
            voiceName: this.dom.voiceSelect.selectedOptions[0]?.getAttribute('data-name')
        };
        localStorage.setItem('tts_preferences', JSON.stringify(preferences));
    }

    loadPreferences = () => {
        const savedPrefs = localStorage.getItem('tts_preferences');
        if (savedPrefs) {
            const prefs = JSON.parse(savedPrefs);
            
            this.dom.rateInput.value = prefs.rate || 1;
            this.dom.pitchInput.value = prefs.pitch || 1;
            this.dom.volumeInput.value = prefs.volume || 1;

            this.preferredVoiceName = prefs.voiceName;	
        }
    }

    /** ------------------------- GESTION DE LA VOIX ------------------------- */

    populateVoiceList = () => {
        this.voices = this.synth.getVoices();
        this.dom.voiceSelect.innerHTML = '';
        
        let frenchVoiceFound = false;
        
        this.voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-name', voice.name);
            option.setAttribute('data-lang', voice.lang);
            
            // Appliquer la voix préférée si elle existe
            if (this.preferredVoiceName && voice.name === this.preferredVoiceName) {
                option.selected = true;
                frenchVoiceFound = true; // Pour ne pas écraser si l'utilisateur a sélectionné une autre langue
            }	
            // Sinon, sélectionne la première voix française par défaut
            else if (!frenchVoiceFound && voice.lang.startsWith('fr-')) {
                option.selected = true;
                frenchVoiceFound = true;
            }
            
            this.dom.voiceSelect.appendChild(option);
        });
        
        this.dom.statusDiv.textContent = `✅ ${this.voices.length} voix chargées.`;
        this.savePreferences(); // Sauvegarde la voix par défaut sélectionnée (ou la préférée)
    }

    /** ------------------------- GESTION DE LA LECTURE (TTS) ------------------------- */

    // Segmentation du texte par paragraphes pour une meilleure fluidité
    segmentText(text) {
        // Segmente par doubles retours à la ligne (paragraphe) pour une lecture plus naturelle
        const segments = text.split(/(\n{2,})/g).filter(s => s.trim().length > 0);
        
        // Si le texte est très long et n'a pas beaucoup de paragraphes,
        // on revient à une segmentation par phrases pour éviter la coupure de l'API.
        if (text.length > 500 && segments.length < 2) {
             return text.match(/[^.!?]*[.!?]+/g) || [text];
        }
        return segments;
    }

    /** * Démarre une nouvelle lecture. Réinitialise toujours l'index à 0.
      */
    startReading = () => {
        // Annuler toute lecture ou pause en cours avant de commencer une nouvelle
        if (this.synth.speaking || this.isSpeaking || this.isPaused) {
            this.stopReading();
        }

        const text = this.dom.textInput.value.trim();
        if (!text) {
            this.dom.statusDiv.textContent = "❌ Aucun texte à lire.";
            return;
        }

        // Configuration pour un nouveau départ
        this.textSegments = this.segmentText(text);
        this.currentSegmentIndex = 0;	
        this.isSpeaking = true;
        this.isPaused = false;
        
        this.setupReadView(text); // Prépare le DOM pour le surlignage
        this.readNextSegment();
    }

    /**
     * Lit le segment de texte à l'index actuel, puis passe au suivant.
     */
    readNextSegment = () => {
        // Vérifie si la fin du texte est atteinte
        if (this.currentSegmentIndex >= this.textSegments.length) {
            this.finishReading();
            return;
        }

        // Ne rien faire si on est dans un état de pause forcée
        if (this.isPaused) {
            return;	
        }
        
        // ******************** CORRECTION DÉBUT ********************
        // 1. Nettoyer le surlignage précédent
        this.clearActiveHighlighting(); 
        
        // 2. Appliquer le surlignage du segment en cours (pour le défilement et la mise en évidence)
        const currentSegmentClass = `segment-${this.currentSegmentIndex}`;
        this.dom.readView.querySelectorAll(`.${currentSegmentClass}`).forEach(span => {
            span.classList.add('segment-highlight');
        });
        // ******************** CORRECTION FIN ********************


        let segmentText = this.textSegments[this.currentSegmentIndex].trim();

        // Correction pour la fluidité 
        if (this.currentSegmentIndex < this.textSegments.length - 1) {
             if (segmentText.endsWith('.')) {
                 segmentText = segmentText.slice(0, -1) + ',';	
             }
        }
        
        const utterance = new SpeechSynthesisUtterance(segmentText);

        // Configuration de la voix et des paramètres (utilisant les préférences sauvegardées)
        const selectedVoiceName = this.dom.voiceSelect.selectedOptions[0]?.getAttribute('data-name');
        const selectedVoice = this.voices.find(v => v.name === selectedVoiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        }

        utterance.rate = parseFloat(this.dom.rateInput.value);
        utterance.pitch = parseFloat(this.dom.pitchInput.value);
        utterance.volume = parseFloat(this.dom.volumeInput.value);
        
        // Événement de Surlignage du mot synchronisé
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                this.highlightWord(segmentText, event.charIndex);
            }
        };

        // Quand le segment est terminé, passer au suivant
        utterance.onend = () => {
            // GARDE 1: Si l'application est en pause, on ignore l'événement onend du cancel().
            if (this.isPaused) { 
                return; 
            }
            
            this.currentSegmentIndex++;
            this.readNextSegment();
        };

        utterance.onerror = (e) => {
            console.error('TTS Error:', e);
            
            // GARDE 3: Si nous sommes déjà en pause, l'erreur est due au cancel()
            if (this.isPaused) {
                this.dom.statusDiv.textContent = "pause" ;
                return; 
            }
            
            // Si ce n'est pas en pause, c'est une vraie erreur (l'API ne veut pas démarrer).
            this.dom.statusDiv.textContent = ` ⏹️ Arrêt de la lecture au segment ${this.currentSegmentIndex + 1}`;
            this.stopReading();
        };

        this.synth.speak(utterance);
        this.dom.statusDiv.textContent = `▶️ Lecture du segment ${this.currentSegmentIndex + 1}/${this.textSegments.length}...`;
        this.updateSegmentHighlight();
        this.updateControlState();
    }

    /** * Gère la pause et la reprise de manière fiable sur toutes les plateformes.
      */
    togglePause = () => {
        // Cas 1 : Si la lecture est terminée ou n'a jamais commencé
        if (!this.isSpeaking && this.currentSegmentIndex === 0 && this.textSegments.length > 0) {
            this.startReading();
            return;
        }

        // Cas 2 : PAUSE (si la lecture est en cours et n'est pas déjà en pause)
        if (this.isSpeaking && !this.isPaused) {
            // Utiliser cancel() pour garantir l'arrêt 
            this.synth.cancel();	
            this.isPaused = true;
            this.isSpeaking = false;	
            this.dom.statusDiv.textContent = "⏸️ Lecture en pause.";
            
        }	
        // Cas 3 : REPRENDRE (si l'état est "paused" et qu'il reste des segments à lire)
        else if (this.isPaused && this.currentSegmentIndex < this.textSegments.length) {
            this.isPaused = false;
            this.isSpeaking = true;
            
            // Relancer la lecture à partir du segment sauvegardé
            this.readNextSegment();	
            
            this.dom.statusDiv.textContent = `▶️ Lecture reprise du segment ${this.currentSegmentIndex + 1}.`;
        }
        
        this.updateControlState();
    }

    /**
     * Arrête complètement la lecture et réinitialise l'état.
     */
    stopReading = () => {
        // Annule toutes les lectures en cours (très important pour vider le moteur)
        if (this.synth.speaking || this.isSpeaking || this.isPaused) {
            this.synth.cancel();
        }
        
        // Réinitialisation complète des états
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentSegmentIndex = 0; 
        
        this.clearHighlighting();
        this.dom.statusDiv.textContent = "⏹️ Lecture arrêtée.";
        this.updateControlState();
    }
    
    finishReading() {
        // GARDE 2: Si nous sommes en pause, toute tentative d'appeler finishReading est ignorée.
        if (this.isPaused) { 
            return;
        }

        this.synth.cancel();
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentSegmentIndex = 0;
        this.clearHighlighting();
        this.dom.statusDiv.textContent = "✅ Lecture terminée.";
        this.updateControlState();
    }

    /** ------------------------- GESTION DU SURLIGNAGE ------------------------- */
    
    /**
     * Nettoie tous les surlignages de mots et de segments de la vue de lecture.
     */
    clearActiveHighlighting() {
        this.dom.readView.querySelectorAll('.word-span').forEach(span => {
            span.classList.remove('highlight');
            span.classList.remove('segment-highlight');
        });
    }

    setupReadView(fullText) {
        this.dom.textInput.classList.add('hidden');
        this.dom.readView.classList.remove('hidden');
        
        this.dom.readView.innerHTML = '';
        
        // IMPORTANT: On réutilise la segmentation ici pour garantir les index
        const segments = this.segmentText(fullText);
        this.textSegments = segments; // On s'assure que this.textSegments est à jour
        
        let globalWordIndex = 0;
        
        segments.forEach((segmentText, segmentIndex) => {
            const wordsAndSeparators = segmentText.match(/\S+|\s+/g) || [];
            
            wordsAndSeparators.forEach((part) => {
                if (/\s/.test(part)) {
                    this.dom.readView.insertAdjacentText('beforeend', part);
                } else {
                    const span = document.createElement('span');
                    span.textContent = part;
                    span.classList.add('word-span');
                    // CLASSE CRUCIALE POUR LE SURLIGNAGE DE SEGMENT
                    span.classList.add(`segment-${segmentIndex}`);
                    span.setAttribute('data-word-index', globalWordIndex++);
                    this.dom.readView.appendChild(span);
                }
            });
        });
    }
    
    clearHighlighting() {
        this.dom.readView.innerHTML = '';
        this.dom.textInput.classList.remove('hidden');
        this.dom.readView.classList.add('hidden');
        this.dom.textInput.style.display = 'block';	
    }

    updateSegmentHighlight() {
        const allSpans = this.dom.readView.querySelectorAll('.word-span');
        let totalCharCount = 0;
        let segmentStartWordIndex = 0;

        for (let i = 0; i < this.currentSegmentIndex; i++) {
            totalCharCount += this.textSegments[i].length;
        }

        let charCount = 0;
        for (let i = 0; i < allSpans.length; i++) {
            if (charCount >= totalCharCount) {
                segmentStartWordIndex = i;
                break;
            }
            charCount += allSpans[i].textContent.length;
            if (allSpans[i].nextSibling && !allSpans[i].nextSibling.classList) {
                charCount += allSpans[i].nextSibling.textContent.length;
            }
        }
        
        if (allSpans[segmentStartWordIndex]) {
            allSpans[segmentStartWordIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    highlightWord(segmentText, charIndex) {
        const allSpans = this.dom.readView.querySelectorAll('.word-span');
        
        // Trouver le mot actuel dans le segment (très basique pour l'API Web Speech)
        let substring = segmentText.substring(0, charIndex);
        const lastSpace = substring.lastIndexOf(' ');
        const currentWord = segmentText.substring(lastSpace + 1, charIndex + (segmentText.substring(charIndex).match(/^[^\s]*/) || [''])[0].length);

        // Trouver l'index de départ du segment pour commencer la recherche
        let segmentStartIndex = 0;
        let totalSegmentLength = 0;
        for (let i = 0; i < this.currentSegmentIndex; i++) {
            totalSegmentLength += this.textSegments[i].length;
        }
        
        let charCount = 0;
        for (let i = 0; i < allSpans.length; i++) {
            if (charCount >= totalSegmentLength) {
                segmentStartIndex = i;
                break;
            }
            charCount += allSpans[i].textContent.length;
            if (allSpans[i].nextSibling && !allSpans[i].nextSibling.classList) {
                charCount += allSpans[i].nextSibling.textContent.length;
            }
        }

        let found = false;
        
        for (let i = segmentStartIndex; i < allSpans.length; i++) {
            const span = allSpans[i];
            
            // Effacer l'ancien surlignage
            if (span.classList.contains('highlight')) {
                span.classList.remove('highlight');
            }
            
            // Si on est encore dans le segment et que le mot correspond
            if (this.textSegments[this.currentSegmentIndex].includes(span.textContent) && span.textContent.trim() === currentWord.trim() && !found) {
                span.classList.add('highlight');
                found = true;
                break;	
            }
        }
    }
    
    // La fonction clearActiveHighlighting est maintenant placée correctement juste avant setupReadView
    
    /** ------------------------- GESTION DES EBOOKS ------------------------- */

    loadEbooks() {
        const ebooksJson = localStorage.getItem('tts_ebooks');
        return ebooksJson ? JSON.parse(ebooksJson) : {};
    }

    saveEbooks(ebooks) {
        localStorage.setItem('tts_ebooks', JSON.stringify(ebooks));
    }

    openSaveModal = () => {
        const currentText = this.dom.textInput.value.trim();
        if (currentText.length === 0) {
            this.dom.statusDiv.textContent = "❌ Impossible de sauvegarder un texte vide.";
            return;
        }

        this.dom.modalTitle.textContent = "Sauvegarder l'Ebook";
        
        const content = `
            <p>Donnez un nom à votre Ebook (Max 50 caractères) :</p>
            <input type="text" id="ebook-title-input" placeholder="Titre de l'Ebook" maxlength="50" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid var(--border-color); border-radius: 6px; background-color: var(--bg-card); color: var(--text-dark);">
            <button id="confirm-save-btn" style="padding: 10px 15px; background-color: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">Confirmer la Sauvegarde</button>
        `;
        this.dom.modalBody.innerHTML = content;
        this.dom.ebookModal.classList.remove('hidden');

        document.getElementById('confirm-save-btn').addEventListener('click', this.handleSaveEbook);
    }
    
    handleSaveEbook = () => {
        const titleInput = document.getElementById('ebook-title-input');
        let title = titleInput.value.trim() || 'Sans Titre';
        const currentText = this.dom.textInput.value.trim();
        
        if (this.savedEbooks[title] && !confirm(`Un ebook nommé "${title}" existe déjà. Voulez-vous l'écraser ?`)) {
            return;
        }

        this.savedEbooks[title] = {
            text: currentText,
            date: new Date().toLocaleDateString('fr-FR'),
            preview: currentText.substring(0, 100).replace(/\n/g, ' ') + '...'
        };
        this.saveEbooks(this.savedEbooks);
        this.dom.statusDiv.textContent = `💾 Ebook "${title}" sauvegardé !`;
        this.dom.ebookModal.classList.add('hidden');
    }

    openLoadModal = () => {
        this.dom.modalTitle.textContent = "Charger un Ebook";
        this.dom.modalBody.innerHTML = this.generateEbookListHTML();
        this.dom.ebookModal.classList.remove('hidden');
        
        // Attacher les écouteurs pour charger et supprimer
        this.dom.modalBody.querySelectorAll('.ebook-item').forEach(item => {
            const title = item.getAttribute('data-title');
            item.querySelector('.load-ebook-title').addEventListener('click', () => this.handleLoadEbook(title));
            item.querySelector('.delete-ebook-btn').addEventListener('click', (e) => {
                e.stopPropagation();	
                this.handleDeleteEbook(title);
            });
        });
    }

    generateEbookListHTML() {
        const titles = Object.keys(this.savedEbooks);
        if (titles.length === 0) {
            return "<p>Aucun Ebook sauvegardé pour le moment.</p>";
        }

        return titles.map(title => {
            const ebook = this.savedEbooks[title];
            return `
                <div class="ebook-item" data-title="${title}">
                    <div class="load-ebook-title">
                        <strong>${title}</strong><br>
                        <small>Sauvegardé le ${ebook.date} - Aperçu: ${ebook.preview}</small>
                    </div>
                    <span class="delete-ebook-btn" title="Supprimer">🗑️</span>
                </div>
            `;
        }).join('');
    }

    handleLoadEbook = (title) => {
        const ebook = this.savedEbooks[title];
        if (ebook) {
            this.dom.textInput.value = ebook.text;
            this.dom.statusDiv.textContent = `📖 Ebook "${title}" chargé dans la zone de texte.`;
            this.dom.ebookModal.classList.add('hidden');
            this.updateControlState();
        }
    }

    handleDeleteEbook = (title) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer l'Ebook "${title}" ?`)) {
            delete this.savedEbooks[title];
            this.saveEbooks(this.savedEbooks);
            this.dom.statusDiv.textContent = `🗑️ Ebook "${title}" supprimé.`;
            this.openLoadModal();	
        }
    }
        
    /** ------------------------- GESTION DES ÉTATS ET DES ÉVÉNEMENTS ------------------------- */

    updateControlState() {
        const hasText = this.dom.textInput.value.trim().length > 0;
        const isReadingActive = this.isSpeaking || this.isPaused;
        
        // 1. Bouton Play (Démarrer) : Désactivé si la lecture est déjà active (en cours ou en pause).
        this.dom.playBtn.disabled = !hasText || isReadingActive;
        
        // 2. Bouton Pause/Reprendre : Actif si la lecture est en cours OU en pause.
        this.dom.pauseBtn.disabled = !isReadingActive;
        
        // 3. Bouton Stop : Actif si la lecture est en cours OU en pause.
        this.dom.stopBtn.disabled = !isReadingActive;

        this.dom.saveBtn.disabled = !hasText;
        this.dom.loadBtn.disabled = Object.keys(this.savedEbooks).length === 0;
        
        this.dom.pauseBtn.innerHTML = this.isPaused	
            ? '<i class="fas fa-play"></i> Reprendre'	
            : '<i class="fas fa-pause"></i> Pause';
    }

    addEventListeners() {
        // Contrôles TTS
        this.dom.playBtn.addEventListener('click', this.startReading);
        this.dom.pauseBtn.addEventListener('click', this.togglePause);
        this.dom.stopBtn.addEventListener('click', this.stopReading);

        // Préférences et Sauvegarde
        this.dom.rateInput.addEventListener('input', () => {	
            this.dom.rateValueSpan.textContent = this.dom.rateInput.value;
            this.savePreferences();
        });
        this.dom.pitchInput.addEventListener('input', () => {
            this.dom.pitchValueSpan.textContent = this.dom.pitchInput.value;
            this.savePreferences();
        });
        this.dom.volumeInput.addEventListener('input', () => {
            this.dom.volumeValueSpan.textContent = this.dom.volumeInput.value;
            this.savePreferences();
        });
        this.dom.voiceSelect.addEventListener('change', this.savePreferences);

        // Import TXT
        this.dom.fileInput.addEventListener('change', (event) => this.handleFileInput(event));
        
        // Thème
        this.dom.themeCheckbox.addEventListener('change', this.toggleDarkMode);
        
        // Gestion des Ebooks
        this.dom.saveBtn.addEventListener('click', this.openSaveModal);
        this.dom.loadBtn.addEventListener('click', this.openLoadModal);
        this.dom.closeBtn.addEventListener('click', () => this.dom.ebookModal.classList.add('hidden'));
        window.addEventListener('click', (event) => {
            if (event.target === this.dom.ebookModal) {
                this.dom.ebookModal.classList.add('hidden');
            }
        });
        
        // Mise à jour des états
        this.dom.textInput.addEventListener('input', () => this.updateControlState());
    }

    // ... (Toute la classe TTSReader reste identique jusqu'à handleFileInput) ...
    // Gestion de la musique
handleMusicUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        this.dom.bgAudio.src = url;
        this.dom.statusDiv.textContent = `🎵 Musique "${file.name}" chargée.`;
    }
}
handleFileInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Gestion du PDF
  if (file.type === "application/pdf") {
    this.dom.statusDiv.textContent = "⏳ Analyse du PDF en cours...";
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const typedarray = new Uint8Array(e.target.result);
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      
      try {
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(s => s.str).join(' ');
          fullText += pageText + "\n\n";
        }
        
        this.dom.textInput.value = fullText;
        this.dom.statusDiv.textContent = `📂 PDF "${file.name}" importé (${pdf.numPages} pages).`;
        this.updateControlState();
      } catch (err) {
        console.error(err);
        this.dom.statusDiv.textContent = "❌ Erreur : Impossible de lire ce PDF.";
      }
    };
    reader.readAsArrayBuffer(file);
    
  } else {
    // Logique d'origine pour les fichiers .txt 
    const reader = new FileReader();
    reader.onload = (e) => {
      this.dom.textInput.value = e.target.result;
      this.dom.statusDiv.textContent = `📂 Fichier "${file.name}" importé.`;
      this.updateControlState();
    };
    reader.readAsText(file, 'UTF-8');
  }
}
}

// Lancement de l'application
document.addEventListener('DOMContentLoaded', () => {
  new TTSReader();
});