class PrintoCSAssistant {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.loadHistory();
    }

    initializeElements() {
        this.questionInput = document.getElementById('customerQuestion');
        this.responseArea = document.getElementById('responseArea');
        this.getResponseBtn = document.getElementById('getResponse');
        this.clearAllBtn = document.getElementById('clearAll');
        this.copyBtn = document.getElementById('copyResponse');
        this.buttonText = document.getElementById('buttonText');
        this.loading = document.getElementById('loading');
        this.historyContainer = document.getElementById('historyContainer');
        this.notification = document.getElementById('notification');
    }

    bindEvents() {
        this.getResponseBtn.addEventListener('click', () => this.getAIResponse());
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.copyBtn.addEventListener('click', () => this.copyResponse());

        // Allow Enter + Ctrl/Cmd to submit
        this.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.getAIResponse();
            }
        });
    }

    async getAIResponse() {
        const question = this.questionInput.value.trim();

        if (!question) {
            this.showNotification('Please enter a customer question', 'error');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question })
            });

            const data = await response.json();

            if (data.success) {
                this.displayResponse(data.response);
                this.saveToHistory(question, data.response);
                this.showNotification('Response generated successfully!');
            } else {
                throw new Error(data.error || 'Failed to get response');
            }

        } catch (error) {
            console.error('Error:', error);
            this.displayError('Failed to get AI response. Please try again.');
            this.showNotification('Error getting response', 'error');
        }

        this.setLoading(false);
    }

    displayResponse(response) {
        this.responseArea.innerHTML = response;
        this.responseArea.style.color = '#495057';
        this.copyBtn.classList.remove('hidden');

        // Scroll response into view
        this.responseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    displayError(error) {
        this.responseArea.innerHTML = `❌ ${error}`;
        this.responseArea.style.color = '#dc3545';
        this.copyBtn.classList.add('hidden');
    }

    setLoading(isLoading) {
        this.getResponseBtn.disabled = isLoading;

        if (isLoading) {
            this.buttonText.textContent = 'Getting Response...';
            this.loading.classList.remove('hidden');
        } else {
            this.buttonText.textContent = 'Get AI Response';
            this.loading.classList.add('hidden');
        }
    }

    clearAll() {
        this.questionInput.value = '';
        this.responseArea.innerHTML = '<div class="placeholder">AI response will appear here...</div>';
        this.responseArea.style.color = '';
        this.copyBtn.classList.add('hidden');
        this.questionInput.focus();
    }

    copyResponse() {
        const responseText = this.responseArea.textContent;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(responseText).then(() => {
                this.showNotification('Response copied to clipboard!');
                this.copyBtn.textContent = '✅ Copied';
                setTimeout(() => {
                    this.copyBtn.textContent = '📋 Copy';
                }, 2000);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = responseText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Response copied to clipboard!');
        }
    }

    saveToHistory(question, response) {
        let history = this.getHistory();

        const historyItem = {
            id: Date.now(),
            question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
            response: response,
            timestamp: new Date().toISOString(),
            fullQuestion: question
        };

        history.unshift(historyItem);

        // Keep only last 10 items
        if (history.length > 10) {
            history = history.slice(0, 10);
        }

        localStorage.setItem('printo_cs_history', JSON.stringify(history));
        this.renderHistory(history);
    }

    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('printo_cs_history')) || [];
        } catch {
            return [];
        }
    }

    loadHistory() {
        const history = this.getHistory();
        this.renderHistory(history);
    }

    renderHistory(history) {
        if (history.length === 0) {
            this.historyContainer.innerHTML = '<div class="no-history">No queries yet</div>';
            return;
        }

        const historyHTML = history.map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleString();

            return `
                <div class="history-item" onclick="app.loadHistoryItem(${item.id})">
                    <div class="history-question">${item.question}</div>
                    <div class="history-time">${timeStr}</div>
                </div>
            `;
        }).join('');

        this.historyContainer.innerHTML = historyHTML;
    }

    loadHistoryItem(id) {
        const history = this.getHistory();
        const item = history.find(h => h.id === id);

        if (item) {
            this.questionInput.value = item.fullQuestion;
            this.displayResponse(item.response);
            this.showNotification('History item loaded');
        }
    }

    showNotification(message, type = 'success') {
        this.notification.textContent = message;
        this.notification.className = `notification ${type}`;
        this.notification.classList.remove('hidden');

        setTimeout(() => {
            this.notification.classList.add('hidden');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PrintoCSAssistant();

    // Focus on the input field
    document.getElementById('customerQuestion').focus();

    console.log('🚀 Printo CS Assistant loaded successfully!');
});