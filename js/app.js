// =====================
// Quiz App - V4 Ultimate Edition
// With Firebase Cloud Sync, Wrong Answers Review & Enhanced UI
// =====================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDonMWKNpK1RDWiWSosN5HebMTCALZ-4Y0",
    authDomain: "quiz-microeconomia.firebaseapp.com",
    databaseURL: "https://quiz-microeconomia-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "quiz-microeconomia",
    storageBucket: "quiz-microeconomia.firebasestorage.app",
    messagingSenderId: "17626414656",
    appId: "1:17626414656:web:a68231ec8be62555e229a5"
};

class QuizApp {
    constructor() {
        this.allQuestions = [];
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.pendingQuestions = new Set();
        this.mode = 'quiz';
        this.score = 0;
        this.selectedUnits = new Set();
        this.unitQuestionCounts = {};
        this.sessionCode = '';
        this.firebaseInitialized = false;
        this.dbRef = null;

        // Touch swipe tracking
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.longPressTimer = null;

        this.ui = {
            // Splash
            splashScreen: document.getElementById('splash-screen'),
            quizApp: document.getElementById('quiz-app'),
            sessionCodeInput: document.getElementById('session-code'),
            btnLoadSession: document.getElementById('btn-load-session'),
            btnExport: document.getElementById('btn-export'),
            btnImport: document.getElementById('btn-import'),
            modeQuiz: document.getElementById('mode-quiz'),
            modeStudy: document.getElementById('mode-study'),
            modeDescription: document.getElementById('mode-description'),
            unitGrid: document.getElementById('unit-grid'),
            btnSelectAll: document.getElementById('btn-select-all'),
            btnSelectNone: document.getElementById('btn-select-none'),
            btnStart: document.getElementById('btn-start'),
            selectedCount: document.getElementById('selected-count'),

            // Quiz
            questionCounter: document.getElementById('question-counter'),
            unitBadge: document.getElementById('unit-badge'),
            scoreVal: document.getElementById('score-val'),
            modeBtn: document.getElementById('btn-mode-toggle'),
            btnRestart: document.getElementById('btn-restart'),
            btnHome: document.getElementById('btn-home'),
            progressBar: document.getElementById('progress-fill'),
            questionText: document.getElementById('question-text'),
            optionsContainer: document.getElementById('options-container'),
            feedbackArea: document.getElementById('feedback-area'),
            feedbackText: document.getElementById('feedback-text'),
            btnPrev: document.getElementById('btn-prev'),
            btnNext: document.getElementById('btn-next'),
            btnPending: document.getElementById('btn-pending'),
            btnWrong: document.getElementById('btn-wrong'),
            pendingCount: document.getElementById('pending-count'),
            wrongCount: document.getElementById('wrong-count'),
            questionArea: document.querySelector('.question-area'),

            // Modals
            modalPending: document.getElementById('modal-pending'),
            pendingList: document.getElementById('pending-list'),
            btnCloseModal: document.getElementById('btn-close-modal'),
            modalWrong: document.getElementById('modal-wrong'),
            wrongList: document.getElementById('wrong-list'),
            btnCloseWrongModal: document.getElementById('btn-close-wrong-modal'),
            modalResults: document.getElementById('modal-results'),
            resultsIcon: document.getElementById('results-icon'),
            resultsTitle: document.getElementById('results-title'),
            statCorrect: document.getElementById('stat-correct'),
            statWrong: document.getElementById('stat-wrong'),
            statScore: document.getElementById('stat-score'),
            btnRestartResults: document.getElementById('btn-restart-results'),
            btnReviewWrong: document.getElementById('btn-review-wrong')
        };

        this.init();
    }

    async init() {
        await this.loadData();
        this.initFirebase();
        this.loadStoredSessionCode();
        this.setupSplash();
        this.bindQuizEvents();
        this.setupSwipe();
    }

    // =====================
    // FIREBASE INTEGRATION
    // =====================
    initFirebase() {
        try {
            if (typeof firebase !== 'undefined') {
                firebase.initializeApp(firebaseConfig);
                this.firebaseInitialized = true;
                console.log('Firebase initialized successfully');
            } else {
                console.log('Firebase not available, using localStorage only');
            }
        } catch (e) {
            console.warn('Firebase init failed:', e);
            this.firebaseInitialized = false;
        }
    }

    getFirebaseRef() {
        if (!this.firebaseInitialized || !this.sessionCode) return null;
        return firebase.database().ref(`sessions/${this.sessionCode}`);
    }

    async syncToCloud() {
        const ref = this.getFirebaseRef();
        if (!ref) return;

        const data = {
            userAnswers: this.userAnswers,
            pendingQuestions: Array.from(this.pendingQuestions),
            currentQuestionIndex: this.currentQuestionIndex,
            score: this.score,
            mode: this.mode,
            selectedUnits: Array.from(this.selectedUnits),
            timestamp: Date.now()
        };

        try {
            await ref.set(data);
            console.log('Synced to cloud');
        } catch (e) {
            console.warn('Cloud sync failed:', e);
        }
    }

    async loadFromCloud() {
        const ref = this.getFirebaseRef();
        if (!ref) return false;

        try {
            const snapshot = await ref.once('value');
            const data = snapshot.val();
            if (data) {
                this.userAnswers = data.userAnswers || {};
                this.pendingQuestions = new Set(data.pendingQuestions || []);
                this.currentQuestionIndex = data.currentQuestionIndex || 0;
                this.score = data.score || 0;
                if (data.mode) this.mode = data.mode;
                if (data.selectedUnits) {
                    this.selectedUnits = new Set(data.selectedUnits);
                }
                console.log(`Loaded from cloud for session: ${this.sessionCode}`);
                return true;
            }
        } catch (e) {
            console.warn('Cloud load failed:', e);
        }
        return false;
    }

    setupCloudListener() {
        const ref = this.getFirebaseRef();
        if (!ref) return;

        ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.timestamp > (this.lastSyncTimestamp || 0)) {
                this.lastSyncTimestamp = data.timestamp;
                // Only update if we're not currently active
                if (document.hidden) {
                    this.userAnswers = data.userAnswers || {};
                    this.pendingQuestions = new Set(data.pendingQuestions || []);
                    this.score = data.score || 0;
                    console.log('Received cloud update');
                }
            }
        });
    }

    // =====================
    // SESSION MANAGEMENT
    // =====================
    loadStoredSessionCode() {
        const stored = localStorage.getItem('quizSessionCode');
        if (stored) {
            this.sessionCode = stored;
            this.ui.sessionCodeInput.value = stored;
            this.loadProgress();
        }
    }

    saveSessionCode() {
        this.sessionCode = this.ui.sessionCodeInput.value.trim().toLowerCase();
        if (this.sessionCode) {
            localStorage.setItem('quizSessionCode', this.sessionCode);
        }
    }

    getStorageKey() {
        return this.sessionCode ? `quizProgress_${this.sessionCode}` : 'quizProgress_default';
    }

    saveProgress() {
        const data = {
            userAnswers: this.userAnswers,
            pendingQuestions: Array.from(this.pendingQuestions),
            currentQuestionIndex: this.currentQuestionIndex,
            score: this.score,
            mode: this.mode,
            selectedUnits: Array.from(this.selectedUnits),
            timestamp: Date.now()
        };
        localStorage.setItem(this.getStorageKey(), JSON.stringify(data));

        // Also sync to cloud
        this.syncToCloud();
    }

    async loadProgress() {
        // Try cloud first
        if (this.firebaseInitialized && this.sessionCode) {
            const cloudLoaded = await this.loadFromCloud();
            if (cloudLoaded) {
                this.setupCloudListener();
                return true;
            }
        }

        // Fallback to localStorage
        const stored = localStorage.getItem(this.getStorageKey());
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.userAnswers = data.userAnswers || {};
                this.pendingQuestions = new Set(data.pendingQuestions || []);
                this.currentQuestionIndex = data.currentQuestionIndex || 0;
                this.score = data.score || 0;
                if (data.mode) this.mode = data.mode;
                if (data.selectedUnits) {
                    this.selectedUnits = new Set(data.selectedUnits);
                }
                console.log(`Loaded progress for session: ${this.sessionCode}`);
                return true;
            } catch (e) {
                console.error('Error loading progress:', e);
            }
        }
        return false;
    }

    exportProgress() {
        this.saveProgress();
        const data = localStorage.getItem(this.getStorageKey());
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz-progress-${this.sessionCode || 'default'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importProgress() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
                    this.loadProgress();
                    alert('✅ Progreso importado correctamente');
                    // Update UI
                    this.updateUnitGridFromSelection();
                    this.setMode(this.mode);
                } catch (err) {
                    alert('❌ Error al importar el archivo');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    updateUnitGridFromSelection() {
        document.querySelectorAll('.unit-chip').forEach(c => {
            const unit = Number(c.dataset.unit);
            if (this.selectedUnits.has(unit)) {
                c.classList.add('selected');
            } else {
                c.classList.remove('selected');
            }
        });
        this.updateSelectedCount();
    }

    // =====================
    // DATA LOADING
    // =====================
    async loadData() {
        try {
            const manifestRes = await fetch('data/questions_index.json');
            const files = await manifestRes.json();

            const promises = files.map(f => fetch(`data/${f}`).then(r => r.json()));
            const results = await Promise.all(promises);

            this.allQuestions = [];
            this.unitQuestionCounts = {};

            results.forEach(data => {
                let unit = data.unidad || '?';
                let items = Array.isArray(data) ? data : (data.preguntas || []);

                items.forEach(q => {
                    const unitNum = q.unidad || unit;
                    this.allQuestions.push({
                        unidad: unitNum,
                        numero: q.numero || '?',
                        pregunta: q.pregunta || q.enunciado || q.texto,
                        opciones: q.opciones,
                        respuesta_correcta: (q.respuesta_correcta || q.correcta || '').toLowerCase().trim()
                    });
                    this.unitQuestionCounts[unitNum] = (this.unitQuestionCounts[unitNum] || 0) + 1;
                });
            });

            console.log(`Loaded ${this.allQuestions.length} questions`);
        } catch (err) {
            console.error('Error loading data:', err);
            this.ui.questionText.innerText = "Error cargando preguntas.";
        }
    }

    // =====================
    // SPLASH SCREEN
    // =====================
    setupSplash() {
        // Session buttons
        this.ui.btnLoadSession.addEventListener('click', async () => {
            this.saveSessionCode();
            if (await this.loadProgress()) {
                this.updateUnitGridFromSelection();
                this.setMode(this.mode);
                alert('✅ Sesión cargada');
            } else {
                alert('No hay progreso guardado para este código');
            }
        });

        this.ui.btnExport.addEventListener('click', () => this.exportProgress());
        this.ui.btnImport.addEventListener('click', () => this.importProgress());

        // Mode buttons
        this.ui.modeQuiz.addEventListener('click', () => this.setMode('quiz'));
        this.ui.modeStudy.addEventListener('click', () => this.setMode('study'));

        // Unit grid
        const units = Object.keys(this.unitQuestionCounts).map(Number).sort((a, b) => a - b);
        units.forEach(u => {
            const chip = document.createElement('div');
            chip.className = 'unit-chip selected';
            chip.textContent = u;
            chip.dataset.unit = u;
            chip.addEventListener('click', () => this.toggleUnit(u, chip));
            this.ui.unitGrid.appendChild(chip);
            this.selectedUnits.add(u);
        });

        // If we loaded progress, update the grid
        if (this.sessionCode) {
            this.updateUnitGridFromSelection();
        }

        this.updateSelectedCount();

        // Select All / None
        this.ui.btnSelectAll.addEventListener('click', () => {
            document.querySelectorAll('.unit-chip').forEach(c => {
                c.classList.add('selected');
                this.selectedUnits.add(Number(c.dataset.unit));
            });
            this.updateSelectedCount();
        });

        this.ui.btnSelectNone.addEventListener('click', () => {
            document.querySelectorAll('.unit-chip').forEach(c => {
                c.classList.remove('selected');
            });
            this.selectedUnits.clear();
            this.updateSelectedCount();
        });

        // Start button
        this.ui.btnStart.addEventListener('click', () => this.startQuiz());
    }

    setMode(mode) {
        this.mode = mode;
        this.ui.modeQuiz.classList.toggle('active', mode === 'quiz');
        this.ui.modeStudy.classList.toggle('active', mode === 'study');
        this.ui.modeDescription.textContent = mode === 'quiz'
            ? 'Responde preguntas y obtén tu puntuación.'
            : 'Ve directamente la respuesta correcta.';
    }

    toggleUnit(unitNum, chip) {
        if (this.selectedUnits.has(unitNum)) {
            this.selectedUnits.delete(unitNum);
            chip.classList.remove('selected');
        } else {
            this.selectedUnits.add(unitNum);
            chip.classList.add('selected');
        }
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        let count = 0;
        this.selectedUnits.forEach(u => {
            count += this.unitQuestionCounts[u] || 0;
        });
        this.ui.selectedCount.textContent = `Preguntas seleccionadas: ${count}`;
        this.ui.btnStart.disabled = count === 0;
        this.ui.btnStart.style.opacity = count === 0 ? '0.5' : '1';
    }

    startQuiz() {
        // Save session code
        this.saveSessionCode();

        // Filter questions
        this.questions = this.allQuestions.filter(q => this.selectedUnits.has(Number(q.unidad)));

        if (this.questions.length === 0) {
            alert('Selecciona al menos una unidad.');
            return;
        }

        // Check if we have saved progress for THIS selection
        const hasProgress = Object.keys(this.userAnswers).length > 0;
        if (!hasProgress) {
            // Fresh start
            this.currentQuestionIndex = 0;
            this.userAnswers = {};
            this.pendingQuestions.clear();
            this.score = 0;
        }

        // Switch screens
        this.ui.splashScreen.classList.add('hidden');
        this.ui.quizApp.classList.remove('hidden');
        this.ui.modeBtn.innerText = this.mode === 'quiz' ? '🎓' : '📖';

        // Setup cloud listener
        this.setupCloudListener();

        this.renderQuestion();
    }

    // =====================
    // SWIPE NAVIGATION
    // =====================
    setupSwipe() {
        const area = this.ui.questionArea;
        if (!area) return;

        area.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        area.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });
    }

    handleSwipe() {
        const diff = this.touchStartX - this.touchEndX;
        const threshold = 80; // Minimum swipe distance

        if (diff > threshold) {
            // Swipe left -> Next
            this.nextQuestion();
        } else if (diff < -threshold) {
            // Swipe right -> Prev
            this.prevQuestion();
        }
    }

    // =====================
    // QUIZ EVENTS
    // =====================
    bindQuizEvents() {
        this.ui.btnNext.addEventListener('click', () => this.nextQuestion());
        this.ui.btnPrev.addEventListener('click', () => this.prevQuestion());
        this.ui.btnPending.addEventListener('click', () => this.showPendingList());
        this.ui.btnWrong.addEventListener('click', () => this.showWrongList());
        this.ui.modeBtn.addEventListener('click', () => this.toggleMode());
        this.ui.btnRestart.addEventListener('click', () => this.showSplash());
        this.ui.btnHome.addEventListener('click', () => this.showSplash());

        this.ui.btnCloseModal.addEventListener('click', () => {
            this.ui.modalPending.classList.add('hidden');
        });

        this.ui.btnCloseWrongModal.addEventListener('click', () => {
            this.ui.modalWrong.classList.add('hidden');
        });

        // Long press on pending button to toggle
        this.ui.btnPending.addEventListener('touchstart', () => {
            this.longPressTimer = setTimeout(() => {
                this.togglePending();
            }, 500);
        });

        this.ui.btnPending.addEventListener('touchend', () => {
            clearTimeout(this.longPressTimer);
        });

        // Right-click to toggle pending
        this.ui.btnPending.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.togglePending();
        });

        this.ui.btnRestartResults.addEventListener('click', () => {
            this.ui.modalResults.classList.add('hidden');
            this.showSplash();
        });

        this.ui.btnReviewWrong.addEventListener('click', () => {
            this.ui.modalResults.classList.add('hidden');
            this.showWrongList();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (!this.ui.splashScreen.classList.contains('hidden')) return;
            if (e.key === 'ArrowRight') this.nextQuestion();
            if (e.key === 'ArrowLeft') this.prevQuestion();
            if (e.key === 'p' || e.key === 'P') this.togglePending();
            if (e.key === 'm' || e.key === 'M') this.showPendingList();
            if (e.key === 'w' || e.key === 'W') this.showWrongList();
            if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
                this.handleOptionSelect(e.key.toLowerCase());
            }
        });
    }

    showSplash() {
        this.ui.quizApp.classList.add('hidden');
        this.ui.splashScreen.classList.remove('hidden');
    }

    // =====================
    // WRONG ANSWERS TRACKING
    // =====================
    getWrongAnswerIndices() {
        const wrongIndices = [];
        for (const [idx, answer] of Object.entries(this.userAnswers)) {
            const q = this.questions[Number(idx)];
            if (q && answer !== q.respuesta_correcta) {
                wrongIndices.push(Number(idx));
            }
        }
        return wrongIndices.sort((a, b) => a - b);
    }

    // =====================
    // QUESTION RENDERING
    // =====================
    renderQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;

        // Header with question number from original unit
        this.ui.questionCounter.innerText = `${this.currentQuestionIndex + 1} / ${this.questions.length}`;
        this.ui.unitBadge.innerText = `Unidad ${q.unidad} · Pregunta ${q.numero}`;
        this.ui.scoreVal.innerText = this.score;
        this.ui.progressBar.style.width = `${((this.currentQuestionIndex + 1) / this.questions.length) * 100}%`;

        // Question
        this.ui.questionText.innerHTML = q.pregunta;

        // Update counts
        this.ui.pendingCount.innerText = this.pendingQuestions.size > 0 ? this.pendingQuestions.size : '';
        const wrongCount = this.getWrongAnswerIndices().length;
        this.ui.wrongCount.innerText = wrongCount > 0 ? wrongCount : '';

        // Pending button style
        const isPending = this.pendingQuestions.has(this.currentQuestionIndex);
        this.ui.btnPending.style.background = isPending ? 'rgba(255, 167, 38, 0.3)' : '';
        this.ui.btnPending.style.borderColor = isPending ? 'var(--pending-color)' : '';

        // Options
        this.ui.optionsContainer.innerHTML = '';
        this.ui.feedbackArea.className = 'feedback-area hidden';

        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        const showCorrect = this.mode === 'study' || (this.mode === 'quiz' && userAnswer);

        Object.entries(q.opciones).forEach(([key, text]) => {
            const btn = document.createElement('div');
            btn.className = 'option-card';
            btn.innerHTML = `<span class="option-letter">${key.toUpperCase()}</span> <span>${text}</span>`;

            const isCorrect = key.toLowerCase() === q.respuesta_correcta;
            const isSelected = userAnswer === key.toLowerCase();

            if (showCorrect) {
                if (isCorrect) {
                    btn.classList.add('correct');
                } else {
                    if (this.mode === 'study') {
                        btn.style.display = 'none';
                    } else if (isSelected) {
                        btn.classList.add('incorrect');
                    } else {
                        btn.classList.add('disabled');
                    }
                }
                btn.style.pointerEvents = 'none';
            }

            if (!showCorrect) {
                btn.onclick = () => this.handleOptionSelect(key);
            }

            this.ui.optionsContainer.appendChild(btn);
        });

        // Feedback
        if (this.mode === 'quiz' && userAnswer) {
            const isCorrect = userAnswer === q.respuesta_correcta;
            this.ui.feedbackArea.classList.remove('hidden');
            this.ui.feedbackText.innerText = isCorrect ? "¡Correcto!" : `Incorrecto. Era ${q.respuesta_correcta.toUpperCase()}`;
            this.ui.feedbackArea.style.borderLeft = `4px solid ${isCorrect ? 'var(--correct-color)' : 'var(--incorrect-color)'}`;
        }

        // Auto-save progress
        this.saveProgress();
    }

    handleOptionSelect(key) {
        if (this.mode === 'study') return;
        if (this.userAnswers[this.currentQuestionIndex]) return;

        this.userAnswers[this.currentQuestionIndex] = key.toLowerCase();

        const q = this.questions[this.currentQuestionIndex];
        if (key.toLowerCase() === q.respuesta_correcta) {
            this.score++;
        }

        this.renderQuestion();
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderQuestion();
        } else {
            this.showResults();
        }
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderQuestion();
        }
    }

    togglePending() {
        if (this.pendingQuestions.has(this.currentQuestionIndex)) {
            this.pendingQuestions.delete(this.currentQuestionIndex);
        } else {
            this.pendingQuestions.add(this.currentQuestionIndex);
        }
        this.renderQuestion();
    }

    toggleMode() {
        this.mode = this.mode === 'quiz' ? 'study' : 'quiz';
        this.ui.modeBtn.innerText = this.mode === 'quiz' ? '🎓' : '📖';
        this.renderQuestion();
    }

    showPendingList() {
        if (this.pendingQuestions.size === 0) {
            alert("No hay preguntas marcadas");
            return;
        }

        this.ui.pendingList.innerHTML = '';
        const list = Array.from(this.pendingQuestions).sort((a, b) => a - b);

        list.forEach(idx => {
            const q = this.questions[idx];
            const item = document.createElement('div');
            item.className = 'pending-item';
            item.innerText = `Pregunta ${idx + 1} (Unidad ${q.unidad} · P${q.numero})`;
            item.onclick = () => {
                this.currentQuestionIndex = idx;
                this.renderQuestion();
                this.ui.modalPending.classList.add('hidden');
            };
            this.ui.pendingList.appendChild(item);
        });

        this.ui.modalPending.classList.remove('hidden');
    }

    showWrongList() {
        const wrongIndices = this.getWrongAnswerIndices();

        if (wrongIndices.length === 0) {
            alert("¡No hay preguntas falladas! 🎉");
            return;
        }

        this.ui.wrongList.innerHTML = '';

        wrongIndices.forEach(idx => {
            const q = this.questions[idx];
            const item = document.createElement('div');
            item.className = 'pending-item';
            item.style.borderLeft = '3px solid var(--incorrect-color)';
            item.innerText = `Pregunta ${idx + 1} (Unidad ${q.unidad} · P${q.numero})`;
            item.onclick = () => {
                this.currentQuestionIndex = idx;
                this.renderQuestion();
                this.ui.modalWrong.classList.add('hidden');
            };
            this.ui.wrongList.appendChild(item);
        });

        this.ui.modalWrong.classList.remove('hidden');
    }

    showResults() {
        const total = this.questions.length;
        const answered = Object.keys(this.userAnswers).length;
        const correct = this.score;
        const wrong = answered - correct;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        this.ui.statCorrect.textContent = correct;
        this.ui.statWrong.textContent = wrong;
        this.ui.statScore.textContent = `${percent}%`;

        if (percent >= 90) {
            this.ui.resultsIcon.textContent = '🏆';
            this.ui.resultsTitle.textContent = '¡Excelente!';
        } else if (percent >= 70) {
            this.ui.resultsIcon.textContent = '🎉';
            this.ui.resultsTitle.textContent = '¡Muy bien!';
        } else if (percent >= 50) {
            this.ui.resultsIcon.textContent = '👍';
            this.ui.resultsTitle.textContent = 'Aprobado';
        } else {
            this.ui.resultsIcon.textContent = '📚';
            this.ui.resultsTitle.textContent = 'Sigue estudiando';
        }

        // Show/hide review button based on wrong answers
        const wrongCount = this.getWrongAnswerIndices().length;
        this.ui.btnReviewWrong.style.display = wrongCount > 0 ? 'block' : 'none';

        this.ui.modalResults.classList.remove('hidden');
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
