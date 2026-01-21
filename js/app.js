class QuizApp {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {}; // { questionIndex: 'a' }
        this.pendingQuestions = new Set();
        this.mode = 'quiz'; // 'quiz' or 'study'
        this.score = 0;

        // UI Elements
        this.ui = {
            questionCounter: document.getElementById('question-counter'),
            unitBadge: document.getElementById('unit-badge'),
            scoreVal: document.getElementById('score-val'),
            modeBtn: document.getElementById('btn-mode-toggle'),
            progressBar: document.getElementById('progress-fill'),
            questionText: document.getElementById('question-text'),
            optionsContainer: document.getElementById('options-container'),
            feedbackArea: document.getElementById('feedback-area'),
            feedbackText: document.getElementById('feedback-text'),
            btnPrev: document.getElementById('btn-prev'),
            btnNext: document.getElementById('btn-next'),
            btnPending: document.getElementById('btn-pending'),
            modalPending: document.getElementById('modal-pending'),
            pendingList: document.getElementById('pending-list'),
            btnCloseModal: document.getElementById('btn-close-modal')
        };

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        this.ui.btnNext.addEventListener('click', () => this.nextQuestion());
        this.ui.btnPrev.addEventListener('click', () => this.prevQuestion());
        this.ui.btnPending.addEventListener('click', () => this.togglePending());
        this.ui.modeBtn.addEventListener('click', () => this.toggleMode());

        // Modal logic
        this.ui.btnCloseModal.addEventListener('click', () => {
            this.ui.modalPending.classList.add('hidden');
        });

        // Long press/Right click on pending button to view list
        this.ui.btnPending.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showPendingList();
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.nextQuestion();
            if (e.key === 'ArrowLeft') this.prevQuestion();
            if (e.key === 'p' || e.key === 'P') this.togglePending();
            if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
                this.handleOptionSelect(e.key.toLowerCase());
            }
        });
    }

    async loadData() {
        try {
            // 1. Fetch manifest
            const manifestRes = await fetch('data/questions_index.json');
            const files = await manifestRes.json();

            // 2. Fetch all files
            const promises = files.map(f => fetch(`data/${f}`).then(r => r.json()));
            const results = await Promise.all(promises);

            // 3. Process and flatten
            this.questions = [];
            results.forEach(data => {
                let unit = data.unidad || '?';
                let items = Array.isArray(data) ? data : (data.preguntas || []);

                items.forEach(q => {
                    // Normalize data structure
                    this.questions.push({
                        unidad: q.unidad || unit,
                        numero: q.numero,
                        pregunta: q.pregunta || q.enunciado || q.texto,
                        opciones: q.opciones,
                        respuesta_correcta: (q.respuesta_correcta || q.correcta || '').toLowerCase().trim()
                    });
                });
            });

            console.log(`Loaded ${this.questions.length} questions`);
            this.renderQuestion();

        } catch (err) {
            console.error(err);
            this.ui.questionText.innerText = "Error cargando preguntas. Revisa la consola.";
        }
    }

    renderQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;

        // Header Updates
        this.ui.questionCounter.innerText = `${this.currentQuestionIndex + 1} / ${this.questions.length}`;
        this.ui.unitBadge.innerText = `Unidad ${q.unidad}`;
        this.ui.scoreVal.innerText = this.score;
        this.ui.progressBar.style.width = `${((this.currentQuestionIndex + 1) / this.questions.length) * 100}%`;

        // Question Text
        this.ui.questionText.innerHTML = q.pregunta;

        // Pending Data
        const isPending = this.pendingQuestions.has(this.currentQuestionIndex);
        this.ui.btnPending.innerHTML = isPending ? '✅ Pendiente' : '📝 Pendiente';
        this.ui.btnPending.style.background = isPending ? 'rgba(255, 167, 38, 0.2)' : '';

        // Options
        this.ui.optionsContainer.innerHTML = '';
        this.ui.feedbackArea.className = 'feedback-area hidden';

        // Check if already answered
        const userAnswer = this.userAnswers[this.currentQuestionIndex];

        // Mode logic
        const showCorrect = this.mode === 'study' || (this.mode === 'quiz' && userAnswer);

        Object.entries(q.opciones).forEach(([key, text]) => {
            const btn = document.createElement('div');
            btn.className = 'option-card';
            btn.innerHTML = `<span class="option-letter">${key.toUpperCase()}</span> <span>${text}</span>`;

            const isCorrect = key.toLowerCase() === q.respuesta_correcta;
            const isSelected = userAnswer === key.toLowerCase();

            // Styling based on state
            if (showCorrect) {
                if (isCorrect) {
                    btn.classList.add('correct');
                    // In study mode, keep correct visible.
                } else {
                    if (this.mode === 'study') {
                        btn.style.display = 'none'; // Hide incorrect in study mode
                    } else if (isSelected) {
                        btn.classList.add('incorrect'); // Show error in quiz mode
                    } else {
                        btn.classList.add('disabled');
                    }
                }
                btn.style.pointerEvents = 'none'; // Disable clicks
            }

            if (!showCorrect) {
                btn.onclick = () => this.handleOptionSelect(key);
            }

            this.ui.optionsContainer.appendChild(btn);
        });

        // Feedback Text (Quiz mode only when answered)
        if (this.mode === 'quiz' && userAnswer) {
            const isCorrect = userAnswer === q.respuesta_correcta;
            this.ui.feedbackArea.classList.remove('hidden');
            this.ui.feedbackText.innerText = isCorrect ? "¡Correcto!" : `Incorrecto. La respuesta era ${q.respuesta_correcta.toUpperCase()}`;
            this.ui.feedbackArea.style.borderLeft = `4px solid ${isCorrect ? 'var(--correct-color)' : 'var(--incorrect-color)'}`;
        }
    }

    handleOptionSelect(key) {
        if (this.mode === 'study') return;
        if (this.userAnswers[this.currentQuestionIndex]) return; // Already answered

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
        alert(`Modo cambiado a: ${this.mode === 'quiz' ? 'Quiz' : 'Estudio'}`);
        this.renderQuestion();
    }

    showPendingList() {
        if (this.pendingQuestions.size === 0) {
            alert("No hay pendientes");
            return;
        }

        this.ui.pendingList.innerHTML = '';
        const list = Array.from(this.pendingQuestions).sort((a, b) => a - b);

        list.forEach(idx => {
            const item = document.createElement('div');
            item.className = 'pending-item';
            item.innerText = `Pregunta ${idx + 1} (Unidad ${this.questions[idx].unidad})`;
            item.onclick = () => {
                this.currentQuestionIndex = idx;
                this.renderQuestion();
                this.ui.modalPending.classList.add('hidden');
            };
            this.ui.pendingList.appendChild(item);
        });

        this.ui.modalPending.classList.remove('hidden');
    }
}

// Start App
window.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
