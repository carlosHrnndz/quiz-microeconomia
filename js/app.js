// =====================
// Quiz App - V6 Ultimate Edition
// With V6 Features: Confetti, Search, Theme, PWA
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

        // V5 Global Stats
        this.globalStats = {
            totalAttempts: 0,
            totalCorrect: 0,
            unitStats: {},
            questionHistory: {}
        };

        // Swipe vars
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

            // Header Buttons
            btnTheme: document.getElementById('btn-theme'),
            btnSearch: document.getElementById('btn-search'),

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

            // Search Modal
            modalSearch: document.getElementById('modal-search'),
            searchInput: document.getElementById('search-input'),
            searchResults: document.getElementById('search-results'),
            btnCloseSearch: document.getElementById('btn-close-search'),

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
            explanationContainer: document.getElementById('explanation-container'),
            explanationText: document.getElementById('explanation-text'),
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
        this.setupTheme(); // V6
        await this.loadData();
        this.initFirebase();
        this.loadStoredSessionCode();
        this.setupSplash();
        this.bindQuizEvents();
        this.setupSwipe();
    }

    // =====================
    // V6: THEME & SEARCH
    // =====================
    setupTheme() {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light') {
            document.body.classList.add('light-theme');
            this.ui.btnTheme.innerText = '☀️';
        }

        this.ui.btnTheme.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            this.ui.btnTheme.innerText = isLight ? '☀️' : '🌙';
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });
    }

    setupSplash() {
        // ... existing setup ...
        this.ui.btnLoadSession.addEventListener('click', async () => {
            this.saveSessionCode();
            if (await this.loadProgress()) {
                this.updateUnitGridFromSelection();
                alert('✅ Sesión cargada');
            } else {
                alert('No hay progreso guardado.');
            }
        });

        // Search Setup
        this.ui.btnSearch.addEventListener('click', () => {
            this.ui.modalSearch.classList.remove('hidden');
            this.ui.searchInput.focus();
        });

        this.ui.btnCloseSearch.addEventListener('click', () => {
            this.ui.modalSearch.classList.add('hidden');
        });

        this.ui.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

        // ... existing listeners ...
        this.ui.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
        });

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
        this.ui.btnCloseStats.addEventListener('click', () => this.ui.modalStats.classList.add('hidden'));

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

    handleSearch(query) {
        query = query.toLowerCase().trim();
        const container = this.ui.searchResults;
        container.innerHTML = '';

        if (query.length < 3) {
            container.innerHTML = '<div class="empty-state">Escribe al menos 3 caracteres...</div>';
            return;
        }

        const matches = this.allQuestions.filter(q =>
            q.pregunta.toLowerCase().includes(query)
        ).slice(0, 50); // Limit results

        if (matches.length === 0) {
            container.innerHTML = '<div class="empty-state">No se encontraron resultados.</div>';
            return;
        }

        matches.forEach(q => {
            const el = document.createElement('div');
            el.className = 'search-item';
            el.innerHTML = `
                <span class="search-item-unit">Unidad ${q.unidad} · Pregunta ${q.numero}</span>
                <div>${q.pregunta}</div>
            `;
            // Optional: Click to jump to question? 
            // For now, just searching is useful. Jumping is complex if query not in current set.
            container.appendChild(el);
        });
    }

    // =====================
    // CORE LOGIC (V5/V6 Integration)
    // =====================

    // ... Firebase methods same as V5 ...
    initFirebase() {
        try {
            if (typeof firebase !== 'undefined') {
                firebase.initializeApp(firebaseConfig);
                this.firebaseInitialized = true;
                console.log('Firebase initialized');
            }
        } catch (e) { console.warn(e); }
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
            globalStats: this.globalStats,
            timestamp: Date.now()
        };
        try { await ref.set(data); } catch (e) { }
    }

    async loadFromCloud() {
        const ref = this.getFirebaseRef();
        if (!ref) return false;
        try {
            const snapshot = await ref.once('value');
            const data = snapshot.val();
            if (data) { this.applyData(data); return true; }
        } catch (e) { }
        return false;
    }

    setupCloudListener() {
        const ref = this.getFirebaseRef();
        if (!ref) return;
        ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.timestamp > (this.lastSyncTimestamp || 0)) {
                this.lastSyncTimestamp = data.timestamp;
                if (document.hidden) this.applyData(data);
            }
        });
    }

    applyData(data) {
        this.userAnswers = data.userAnswers || {};
        this.pendingQuestions = new Set(data.pendingQuestions || []);
        this.currentQuestionIndex = data.currentQuestionIndex || 0;
        this.score = data.score || 0;
        if (data.mode) this.setMode(data.mode);
        if (data.selectedUnits) this.selectedUnits = new Set(data.selectedUnits);
        if (data.globalStats) this.globalStats = data.globalStats;
    }

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
        if (this.sessionCode) localStorage.setItem('quizSessionCode', this.sessionCode);
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
            const cloud = await this.loadFromCloud();
            if (cloud) {
                this.setupCloudListener();
                return true;
            }
        }
        const stored = localStorage.getItem(this.getStorageKey());
        if (stored) {
            this.applyData(JSON.parse(stored));
            return true;
        }
        return false;
    }

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
                        id: `u${unitNum}_q${qNum}`,
                        explicacion: q.explicacion
                    });
                    this.unitQuestionCounts[unitNum] = (this.unitQuestionCounts[unitNum] || 0) + 1;
                });
            });

            this.allQuestions.sort((a, b) => a.unidad - b.unidad || a.numero - b.numero);
        } catch (err) { console.error(err); }
    }

    setMode(mode) {
        this.mode = mode;
        this.ui.modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        const d = {
            'quiz': 'Responde preguntas y obtén tu puntuación.',
            'exam': '40 preguntas aleatorias. Simulación real.',
            'smart': 'Repaso inteligente de tus fallos más frecuentes.',
            'study': 'Ve directamente la respuesta correcta.'
        };
        this.ui.modeDescription.textContent = d[mode] || d['quiz'];
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
            const u = Number(c.dataset.unit);
            if (this.selectedUnits.has(u)) c.classList.add('selected');
            else c.classList.remove('selected');
        });
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        let count = 0;
        this.selectedUnits.forEach(u => count += this.unitQuestionCounts[u] || 0);
        this.ui.selectedCount.textContent = `Preguntas seleccionadas: ${count}`;
        this.ui.btnStart.disabled = count === 0;
        this.ui.btnStart.style.opacity = count === 0 ? '0.5' : '1';
    }

    showSplash() {
        this.ui.quizApp.classList.add('hidden');
        this.ui.splashScreen.classList.remove('hidden');
        this.ui.modalResults.classList.add('hidden');
        this.ui.modalPending.classList.add('hidden');
        this.ui.modalWrong.classList.add('hidden');
        this.ui.modalStats.classList.add('hidden');
        this.ui.modalSearch.classList.add('hidden');

        // Update selection if needed (e.g. if we want to refresh grid)
        this.updateSelectedCount();
    }

    startQuiz() {
        this.saveSessionCode();
        let filtered = this.allQuestions.filter(q => this.selectedUnits.has(Number(q.unidad)));
        if (filtered.length === 0) { alert('Selecciona al menos una unidad.'); return; }

        if (this.mode === 'exam') {
            if (filtered.length > 40) {
                const s = filtered.sort(() => 0.5 - Math.random());
                filtered = s.slice(0, 40);
            }
            filtered.sort((a, b) => a.unidad - b.unidad || a.numero - b.numero);
        } else if (this.mode === 'smart') {
            filtered.sort((a, b) => {
                const sA = this.globalStats.questionHistory[a.id] || { wrong: 0 };
                const sB = this.globalStats.questionHistory[b.id] || { wrong: 0 };
                return sB.wrong - sA.wrong;
            });
            if (filtered.length > 50) filtered = filtered.slice(0, 50);
        }

        this.questions = filtered;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.pendingQuestions.clear();
        this.score = 0;

        this.ui.splashScreen.classList.add('hidden');
        this.ui.quizApp.classList.remove('hidden');
        const icons = { quiz: '🎓', exam: '⏱️', smart: '🧠', study: '📖' };
        this.ui.modeBtn.innerText = icons[this.mode] || '🎓';

        this.setupCloudListener();
        this.renderQuestion();
    }

    renderQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;

        this.ui.questionCounter.innerText = `${this.currentQuestionIndex + 1} / ${this.questions.length}`;
        this.ui.unitBadge.innerText = `Unidad ${q.unidad} · Pregunta ${q.numero}`;
        this.ui.scoreVal.innerText = this.score;
        this.ui.progressBar.style.width = `${((this.currentQuestionIndex + 1) / this.questions.length) * 100}%`;

        this.ui.questionText.innerHTML = q.pregunta;

        const isPending = this.pendingQuestions.has(this.currentQuestionIndex);
        this.ui.btnPending.style.background = isPending ? 'rgba(255, 167, 38, 0.3)' : '';
        this.ui.pendingCount.innerText = this.pendingQuestions.size || '';
        this.ui.wrongCount.innerText = this.getWrongAnswerIndices().length || '';

        this.ui.optionsContainer.innerHTML = '';
        this.ui.feedbackArea.className = 'feedback-area hidden';

        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        const showCorrect = this.mode === 'study' || (userAnswer);

        Object.entries(q.opciones).forEach(([key, text]) => {
            const btn = document.createElement('div');
            btn.className = 'option-card';
            btn.innerHTML = `<span class="option-letter">${key.toUpperCase()}</span> <span>${text}</span>`;

            const isCorrect = key.toLowerCase() === q.respuesta_correcta;
            const isSelected = userAnswer === key.toLowerCase();

            if (showCorrect) {
                if (isCorrect) btn.classList.add('correct');
                else {
                    if (this.mode === 'study') btn.style.display = 'none';
                    else if (isSelected) btn.classList.add('incorrect');
                    else btn.classList.add('disabled');
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

        // Show explanation if available and appropriate
        if (showCorrect && q.explicacion) {
            this.ui.explanationContainer.classList.remove('hidden');
            this.ui.explanationText.innerText = q.explicacion;
            // Ensure feedback area is visible if in Study mode (where userAnswer might be null)
            if (this.mode === 'study' && !userAnswer) {
                this.ui.feedbackArea.classList.remove('hidden');
                this.ui.feedbackText.innerText = "Modo Estudio: Ver explicación abajo";
                this.ui.feedbackArea.style.borderLeft = "4px solid var(--accent-color)";
            }
        } else {
            this.ui.explanationContainer.classList.add('hidden');
        }
        this.saveProgress();
    }

    handleOptionSelect(key) {
        if (this.userAnswers[this.currentQuestionIndex]) return;
        const q = this.questions[this.currentQuestionIndex];
        const isCorrect = key.toLowerCase() === q.respuesta_correcta;
        this.userAnswers[this.currentQuestionIndex] = key.toLowerCase();
        if (isCorrect) this.score++;
        this.updateGlobalStats(q, isCorrect);
        this.renderQuestion();
    }

    updateGlobalStats(q, isCorrect) {
        if (!this.globalStats.unitStats) this.globalStats.unitStats = {};
        if (!this.globalStats.questionHistory) this.globalStats.questionHistory = {};

        this.globalStats.totalAttempts = (this.globalStats.totalAttempts || 0) + 1;
        if (isCorrect) this.globalStats.totalCorrect = (this.globalStats.totalCorrect || 0) + 1;

        const u = q.unidad;
        if (!this.globalStats.unitStats[u]) this.globalStats.unitStats[u] = { correct: 0, attempts: 0 };
        this.globalStats.unitStats[u].attempts++;
        if (isCorrect) this.globalStats.unitStats[u].correct++;

        const qid = q.id;
        if (!this.globalStats.questionHistory[qid]) this.globalStats.questionHistory[qid] = { correct: 0, wrong: 0 };
        if (isCorrect) this.globalStats.questionHistory[qid].correct++;
        else this.globalStats.questionHistory[qid].wrong++;

        this.saveProgress();
    }

    showStats() {
        const stats = this.globalStats;
        const total = stats.totalAttempts || 0;
        const correct = stats.totalCorrect || 0;
        const acc = total > 0 ? Math.round((correct / total) * 100) : 0;

        this.ui.statGlobalAccuracy.innerText = `${acc}%`;
        this.ui.statTotalAnswered.innerText = total;

        const units = [];
        if (stats.unitStats) {
            for (const [u, data] of Object.entries(stats.unitStats)) {
                const rate = data.attempts > 0 ? (data.correct / data.attempts) : 1;
                units.push({ u, rate, attempts: data.attempts });
            }
        }
        units.sort((a, b) => a.rate - b.rate);

        this.ui.weakUnitsList.innerHTML = '';
        if (units.length === 0) this.ui.weakUnitsList.innerHTML = '<div class="empty-state">No hay datos suficientes aún.</div>';
        else {
            units.slice(0, 5).forEach(item => {
                const p = Math.round(item.rate * 100);
                const d = document.createElement('div');
                d.className = 'weak-item';
                d.innerHTML = `<span>Unidad ${item.u} (${item.attempts} pregs)</span><span class="weak-score">${p}%</span>`;
                this.ui.weakUnitsList.appendChild(d);
            });
        }
        this.ui.modalStats.classList.remove('hidden');
    }

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

        const togglePending = () => {
            if (this.pendingQuestions.has(this.currentQuestionIndex)) this.pendingQuestions.delete(this.currentQuestionIndex);
            else this.pendingQuestions.add(this.currentQuestionIndex);
            this.renderQuestion();
        };
        this.ui.btnPending.addEventListener('contextmenu', (e) => { e.preventDefault(); togglePending(); });
        this.ui.btnPending.addEventListener('touchstart', () => { this.longPressTimer = setTimeout(togglePending, 500); });
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
        const ids = [];
        for (const [idx, ans] of Object.entries(this.userAnswers)) {
            const q = this.questions[Number(idx)];
            if (q && ans !== q.respuesta_correcta) ids.push(Number(idx));
        }
        return ids.sort((a, b) => a - b);
    }

    showList(indices, modal, container) {
        if (indices.length === 0) { alert("Lista vacía"); return; }
        container.innerHTML = '';
        indices.forEach(idx => {
            const q = this.questions[idx];
            const d = document.createElement('div');
            d.className = 'pending-item';
            d.innerText = `U${q.unidad} · P${q.numero} - ${q.pregunta.substring(0, 40)}...`;
            d.onclick = () => {
                this.currentQuestionIndex = idx;
                this.renderQuestion();
                modal.classList.add('hidden');
            };
            container.appendChild(d);
        });
        modal.classList.remove('hidden');
    }

    showPendingList() { this.showList(Array.from(this.pendingQuestions).sort((a, b) => a - b), this.ui.modalPending, this.ui.pendingList); }
    showWrongList() { this.showList(this.getWrongAnswerIndices(), this.ui.modalWrong, this.ui.wrongList); }

    showResults() {
        const total = this.questions.length;
        const correct = this.score;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        this.ui.statCorrect.innerText = correct;
        this.ui.statWrong.innerText = Object.keys(this.userAnswers).length - correct;
        this.ui.statScore.innerText = percent + "%";
        this.ui.modalResults.classList.remove('hidden');
        this.ui.btnReviewWrong.style.display = (this.getWrongAnswerIndices().length > 0) ? 'block' : 'none';

        // V6 Confetti
        if (percent >= 50 && typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }

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
