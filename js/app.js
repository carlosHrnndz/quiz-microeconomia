// =====================
// Quiz App - V5 Ultimate Edition
// With V5 Features: Stats, Exam Mode, Smart Review & Sorting Fix
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

        // V5: Global Stats Persistence
        this.globalStats = {
            totalAttempts: 0,
            totalCorrect: 0,
            unitStats: {}, // { "1": { correct: 0, attempts: 0 } }
            questionHistory: {} // { "u1_q5": { correct: 0, wrong: 0 } }
        };

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

            // Modes
            modeBtns: document.querySelectorAll('.mode-btn'),
            modeDescription: document.getElementById('mode-description'),

            // Unit Grid
            unitGrid: document.getElementById('unit-grid'),
            btnSelectAll: document.getElementById('btn-select-all'),
            btnSelectNone: document.getElementById('btn-select-none'),
            btnStart: document.getElementById('btn-start'),
            selectedCount: document.getElementById('selected-count'),

            // Stats
            btnStats: document.getElementById('btn-stats'),
            modalStats: document.getElementById('modal-stats'),
            btnCloseStats: document.getElementById('btn-close-stats'),
            statGlobalAccuracy: document.getElementById('global-accuracy'),
            statTotalAnswered: document.getElementById('total-answered'),
            weakUnitsList: document.getElementById('weak-units-list'),

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
            }
        } catch (e) {
            console.warn('Firebase init failed:', e);
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
            globalStats: this.globalStats, // Sync V5 Stats
            timestamp: Date.now()
        };

        try {
            await ref.set(data);
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
                this.applyData(data);
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
                if (document.hidden) {
                    this.applyData(data);
                    console.log('Received cloud update');
                }
            }
        });
    }

    applyData(data) {
        this.userAnswers = data.userAnswers || {};
        this.pendingQuestions = new Set(data.pendingQuestions || []);
        this.currentQuestionIndex = data.currentQuestionIndex || 0;
        this.score = data.score || 0;
        if (data.mode) this.setMode(data.mode);
        if (data.selectedUnits) {
            this.selectedUnits = new Set(data.selectedUnits);
        }
        // V5 Stats
        if (data.globalStats) {
            this.globalStats = data.globalStats;
        }
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
            globalStats: this.globalStats,
            timestamp: Date.now()
        };
        localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
        this.syncToCloud();
    }

    async loadProgress() {
        if (this.firebaseInitialized && this.sessionCode) {
            const cloudLoaded = await this.loadFromCloud();
            if (cloudLoaded) {
                this.setupCloudListener();
                return true;
            }
        }

        const stored = localStorage.getItem(this.getStorageKey());
        if (stored) {
            try {
                this.applyData(JSON.parse(stored));
                return true;
            } catch (e) {
                console.error('Error loading progress:', e);
            }
        }
        return false;
    }

    // =====================
    // DATA LOADING & SORTING (V5 Fix)
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
                    const unitNum = Number(q.unidad || unit);
                    const qNum = Number(q.numero || 0);

                    this.allQuestions.push({
                        unidad: unitNum,
                        numero: qNum,
                        pregunta: q.pregunta || q.enunciado || q.texto,
                        opciones: q.opciones,
                        respuesta_correcta: (q.respuesta_correcta || q.correcta || '').toLowerCase().trim(),
                        id: `u${unitNum}_q${qNum}` // Unique ID for stats
                    });
                    this.unitQuestionCounts[unitNum] = (this.unitQuestionCounts[unitNum] || 0) + 1;
                });
            });

            // V5 FIX: Sort numerically by Unit then Question Number
            this.allQuestions.sort((a, b) => {
                return a.unidad - b.unidad || a.numero - b.numero;
            });

            console.log(`Loaded and sorted ${this.allQuestions.length} questions`);
        } catch (err) {
            console.error('Error loading data:', err);
            this.ui.questionText.innerText = "Error cargando preguntas.";
        }
    }

    // =====================
    // SPLASH & MODES
    // =====================
    setupSplash() {
        this.ui.btnLoadSession.addEventListener('click', async () => {
            this.saveSessionCode();
            if (await this.loadProgress()) {
                this.updateUnitGridFromSelection();
                alert('✅ Sesión cargada');
            } else {
                alert('No hay progreso guardado para este código');
            }
        });

        // Mode Selection
        this.ui.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setMode(mode);
            });
        });

        // Unit Grid
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

        this.ui.btnStart.addEventListener('click', () => this.startQuiz());
        this.ui.btnStats.addEventListener('click', () => this.showStats());

        // Stats Modal
        this.ui.btnCloseStats.addEventListener('click', () => {
            this.ui.modalStats.classList.add('hidden');
        });

        // Select All/None
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

        if (this.sessionCode) this.updateUnitGridFromSelection();
        this.updateSelectedCount();
    }

    setMode(mode) {
        this.mode = mode;
        this.ui.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        const descriptions = {
            'quiz': 'Responde preguntas y obtén tu puntuación.',
            'exam': '40 preguntas aleatorias. Simulación real.',
            'smart': 'Repaso inteligente de tus fallos más frecuentes.',
            'study': 'Ve directamente la respuesta correcta.'
        };
        this.ui.modeDescription.textContent = descriptions[mode] || descriptions['quiz'];
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

    updateSelectedCount() {
        let count = 0;
        this.selectedUnits.forEach(u => {
            count += this.unitQuestionCounts[u] || 0;
        });
        this.ui.selectedCount.textContent = `Preguntas seleccionadas: ${count}`;
        this.ui.btnStart.disabled = count === 0;
        this.ui.btnStart.style.opacity = count === 0 ? '0.5' : '1';
    }

    // =====================
    // START QUIZ LOGIC (V5)
    // =====================
    startQuiz() {
        this.saveSessionCode();

        // Base filter by unit
        let filtered = this.allQuestions.filter(q => this.selectedUnits.has(Number(q.unidad)));

        if (filtered.length === 0) {
            alert('Selecciona al menos una unidad.');
            return;
        }

        // V5 MODES LOGIC
        if (this.mode === 'exam') {
            // Pick 40 random, then sort items
            if (filtered.length > 40) {
                const shuffled = filtered.sort(() => 0.5 - Math.random());
                filtered = shuffled.slice(0, 40);
            }
            // Sort them back to logical order (unit/number) as requested
            filtered.sort((a, b) => a.unidad - b.unidad || a.numero - b.numero);

        } else if (this.mode === 'smart') {
            // Sort by fail count (descending)
            filtered.sort((a, b) => {
                const statA = this.globalStats.questionHistory[a.id] || { wrong: 0 };
                const statB = this.globalStats.questionHistory[b.id] || { wrong: 0 };
                return statB.wrong - statA.wrong;
            });

            // Filter only those with at least 1 wrong answer?
            // User might want to review even if 0 wrong if they selected smart.
            // But let's prioritize failures. If 0 failures, it falls back to normal order or random?
            // Let's keep the sorted list.
            if (filtered.length > 50) {
                filtered = filtered.slice(0, 50); // Limit session size
            }
        }

        this.questions = filtered;

        // Reset session state
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.pendingQuestions.clear();
        this.score = 0;

        // UI Switch
        this.ui.splashScreen.classList.add('hidden');
        this.ui.quizApp.classList.remove('hidden');

        // Update header icon
        const icons = { quiz: '🎓', exam: '⏱️', smart: '🧠', study: '📖' };
        this.ui.modeBtn.innerText = icons[this.mode] || '🎓';

        this.setupCloudListener();
        this.renderQuestion();
    }

    // =====================
    // CORE QUIZ FUNCTIONALITY
    // =====================
    renderQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;

        this.ui.questionCounter.innerText = `${this.currentQuestionIndex + 1} / ${this.questions.length}`;
        this.ui.unitBadge.innerText = `Unidad ${q.unidad} · Pregunta ${q.numero}`;
        this.ui.scoreVal.innerText = this.score;
        this.ui.progressBar.style.width = `${((this.currentQuestionIndex + 1) / this.questions.length) * 100}%`;

        this.ui.questionText.innerHTML = q.pregunta;

        // Pending state
        const isPending = this.pendingQuestions.has(this.currentQuestionIndex);
        this.ui.btnPending.style.background = isPending ? 'rgba(255, 167, 38, 0.3)' : '';
        this.ui.pendingCount.innerText = this.pendingQuestions.size || '';
        this.ui.wrongCount.innerText = this.getWrongAnswerIndices().length || '';

        // Options
        this.ui.optionsContainer.innerHTML = '';
        this.ui.feedbackArea.className = 'feedback-area hidden';

        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        // In exam mode, we generally don't show feedback until the end?
        // User didn't specify, but "Exam" usually means unseen results.
        // For now, let's keep immediate feedback for learning, unless user wants blind.
        // Assuming immediate feedback is preferred for this app style, but let's hide correct answer in Exam if not answered?
        // Actually, let's stick to consistent behavior across modes for now (feedback on answer).

        const showCorrect = this.mode === 'study' || (userAnswer);

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
            } else {
                btn.onclick = () => this.handleOptionSelect(key);
            }
            this.ui.optionsContainer.appendChild(btn);
        });

        if (userAnswer) {
            const isCorrect = userAnswer === q.respuesta_correcta;
            this.ui.feedbackArea.classList.remove('hidden');
            this.ui.feedbackText.innerText = isCorrect ? "¡Correcto!" : `Incorrecto. Era ${q.respuesta_correcta.toUpperCase()}`;
            this.ui.feedbackArea.style.borderLeft = `4px solid ${isCorrect ? 'var(--correct-color)' : 'var(--incorrect-color)'}`;
        }

        this.saveProgress();
    }

    handleOptionSelect(key) {
        if (this.userAnswers[this.currentQuestionIndex]) return;

        const q = this.questions[this.currentQuestionIndex];
        const isCorrect = key.toLowerCase() === q.respuesta_correcta;

        this.userAnswers[this.currentQuestionIndex] = key.toLowerCase();
        if (isCorrect) this.score++;

        // V5: Update Global Stats
        this.updateGlobalStats(q, isCorrect);

        this.renderQuestion();
    }

    updateGlobalStats(question, isCorrect) {
        // Init stats if missing
        if (!this.globalStats.unitStats) this.globalStats.unitStats = {};
        if (!this.globalStats.questionHistory) this.globalStats.questionHistory = {};

        // Total
        this.globalStats.totalAttempts = (this.globalStats.totalAttempts || 0) + 1;
        if (isCorrect) this.globalStats.totalCorrect = (this.globalStats.totalCorrect || 0) + 1;

        // Unit Stats
        const u = question.unidad;
        if (!this.globalStats.unitStats[u]) this.globalStats.unitStats[u] = { correct: 0, attempts: 0 };
        this.globalStats.unitStats[u].attempts++;
        if (isCorrect) this.globalStats.unitStats[u].correct++;

        // Question History (Smart Review)
        const qid = question.id;
        if (!this.globalStats.questionHistory[qid]) this.globalStats.questionHistory[qid] = { correct: 0, wrong: 0 };
        if (isCorrect) {
            this.globalStats.questionHistory[qid].correct++;
        } else {
            this.globalStats.questionHistory[qid].wrong++;
        }

        // Trigger save to persist these new stats immediately (and sync)
        this.saveProgress();
    }

    // =====================
    // STATS DASHBOARD
    // =====================
    showStats() {
        const stats = this.globalStats;
        const total = stats.totalAttempts || 0;
        const correct = stats.totalCorrect || 0;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        this.ui.statGlobalAccuracy.innerText = `${accuracy}%`;
        this.ui.statTotalAnswered.innerText = total;

        // Calculate weak units
        const units = [];
        if (stats.unitStats) {
            for (const [u, data] of Object.entries(stats.unitStats)) {
                const rate = data.attempts > 0 ? (data.correct / data.attempts) : 1;
                units.push({ u, rate, attempts: data.attempts });
            }
        }

        // Sort by accuracy (ascending -> weakest first)
        units.sort((a, b) => a.rate - b.rate);

        this.ui.weakUnitsList.innerHTML = '';
        if (units.length === 0) {
            this.ui.weakUnitsList.innerHTML = '<div class="empty-state">No hay datos suficientes aún.</div>';
        } else {
            units.slice(0, 5).forEach(item => {
                const percent = Math.round(item.rate * 100);
                const div = document.createElement('div');
                div.className = 'weak-item';
                div.innerHTML = `
                    <span>Unidad ${item.u} (${item.attempts} pregs)</span>
                    <span class="weak-score">${percent}%</span>
                `;
                this.ui.weakUnitsList.appendChild(div);
            });
        }

        this.ui.modalStats.classList.remove('hidden');
    }

    // =====================
    // EVENTS & NAVIGATION
    // =====================
    bindQuizEvents() {
        this.ui.btnNext.addEventListener('click', () => this.nextQuestion());
        this.ui.btnPrev.addEventListener('click', () => this.prevQuestion());

        this.ui.btnPending.addEventListener('click', () => this.showPendingList());
        this.ui.btnWrong.addEventListener('click', () => this.showWrongList());

        this.ui.btnRestart.addEventListener('click', () => this.showSplash());
        this.ui.btnHome.addEventListener('click', () => this.showSplash());

        this.ui.btnCloseModal.addEventListener('click', () => this.ui.modalPending.classList.add('hidden'));
        this.ui.btnCloseWrongModal.addEventListener('click', () => this.ui.modalWrong.classList.add('hidden'));

        this.ui.btnReviewWrong.addEventListener('click', () => {
            this.ui.modalResults.classList.add('hidden');
            this.showWrongList();
        });

        this.ui.btnRestartResults.addEventListener('click', () => {
            this.ui.modalResults.classList.add('hidden');
            this.showSplash();
        });

        // Toggle Pending Logic
        const togglePending = () => {
            if (this.pendingQuestions.has(this.currentQuestionIndex)) {
                this.pendingQuestions.delete(this.currentQuestionIndex);
            } else {
                this.pendingQuestions.add(this.currentQuestionIndex);
            }
            this.renderQuestion();
        };

        this.ui.btnPending.addEventListener('contextmenu', (e) => { e.preventDefault(); togglePending(); });
        this.ui.btnPending.addEventListener('touchstart', () => {
            this.longPressTimer = setTimeout(togglePending, 500);
        });
        this.ui.btnPending.addEventListener('touchend', () => clearTimeout(this.longPressTimer));

        document.addEventListener('keydown', (e) => {
            if (!this.ui.splashScreen.classList.contains('hidden')) return;
            if (e.key === 'ArrowRight') this.nextQuestion();
            if (e.key === 'ArrowLeft') this.prevQuestion();
            if (e.key === 'p' || e.key === 'P') togglePending();
            if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) this.handleOptionSelect(e.key.toLowerCase());
        });
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

    getWrongAnswerIndices() {
        const wrongIndices = [];
        for (const [idx, answer] of Object.entries(this.userAnswers)) {
            const q = this.questions[Number(idx)];
            if (q && answer !== q.respuesta_correcta) wrongIndices.push(Number(idx));
        }
        return wrongIndices.sort((a, b) => a - b);
    }

    showPendingList() { this.showList(Array.from(this.pendingQuestions).sort((a, b) => a - b), this.ui.modalPending, this.ui.pendingList); }
    showWrongList() { this.showList(this.getWrongAnswerIndices(), this.ui.modalWrong, this.ui.wrongList); }

    showList(indices, modal, container) {
        if (indices.length === 0) { alert("Lista vacía"); return; }
        container.innerHTML = '';
        indices.forEach(idx => {
            const q = this.questions[idx];
            const div = document.createElement('div');
            div.className = 'pending-item';
            div.innerText = `U${q.unidad} · P${q.numero} - ${q.pregunta.substring(0, 40)}...`;
            div.onclick = () => {
                this.currentQuestionIndex = idx;
                this.renderQuestion();
                modal.classList.add('hidden');
            };
            container.appendChild(div);
        });
        modal.classList.remove('hidden');
    }

    showResults() {
        const total = this.questions.length;
        const correct = this.score;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        this.ui.statCorrect.innerText = correct;
        this.ui.statWrong.innerText = Object.keys(this.userAnswers).length - correct;
        this.ui.statScore.innerText = percent + "%";
        this.ui.modalResults.classList.remove('hidden');

        // Show review wrong button if needed
        this.ui.btnReviewWrong.style.display = (this.getWrongAnswerIndices().length > 0) ? 'block' : 'none';
    }

    // Swipe
    setupSwipe() {
        const area = this.ui.questionArea;
        if (!area) return;
        area.addEventListener('touchstart', e => this.touchStartX = e.changedTouches[0].screenX, { passive: true });
        area.addEventListener('touchend', e => {
            if (this.touchStartX - e.changedTouches[0].screenX > 80) this.nextQuestion();
            if (e.changedTouches[0].screenX - this.touchStartX > 80) this.prevQuestion();
        }, { passive: true });
    }
}

window.addEventListener('DOMContentLoaded', () => { new QuizApp(); });
