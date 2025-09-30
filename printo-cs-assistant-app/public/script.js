class PrintoCSAssistant {
    constructor() {
        this.sessionId = localStorage.getItem('printo_session_id') || null;
        this.initializeElements();
        this.bindEvents();
        this.loadHistory();
        this.setupCharCounter();
        this.setupAnimations();
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
        this.charCount = document.getElementById('charCount');
    }

    setupCharCounter() {
        if (this.questionInput && this.charCount) {
            const updateCount = () => {
                const count = this.questionInput.value.length;
                this.charCount.textContent = count;

                // Color coding for character count
                if (count > 1000) {
                    this.charCount.style.color = 'var(--color-warning-600)';
                } else if (count > 1500) {
                    this.charCount.style.color = 'var(--color-error-600)';
                } else {
                    this.charCount.style.color = 'var(--color-gray-400)';
                }
            };

            this.questionInput.addEventListener('input', updateCount);
            updateCount(); // Initial count
        }
    }

    setupAnimations() {
        // Add entrance animations to panels
        const panels = document.querySelectorAll('.panel');
        panels.forEach((panel, index) => {
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(20px)';

            setTimeout(() => {
                panel.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                panel.style.opacity = '1';
                panel.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        });
    }

    bindEvents() {
        this.getResponseBtn.addEventListener('click', () => this.getAIResponse());
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.copyBtn.addEventListener('click', () => this.copyResponse());

        // Allow Enter + Ctrl/Cmd to submit, or just Enter
        this.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.getAIResponse();
            } else if (e.key === 'Enter' && !e.shiftKey) {
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
                body: JSON.stringify({
                    question,
                    customerId: 'default-customer',
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            if (data.success) {
                // Store session ID for future requests
                if (data.sessionId) {
                    this.sessionId = data.sessionId;
                    localStorage.setItem('printo_session_id', this.sessionId);
                }

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
        // Store the original response for copying
        this.lastResponse = response;

        // Convert Markdown-style formatting to HTML
        const formattedResponse = response
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')              // Italic text
            .replace(/\n/g, '<br>');                           // Line breaks

        // Create response content container
        const responseContent = document.createElement('div');
        responseContent.className = 'response-content';
        responseContent.innerHTML = formattedResponse;

        // Clear and update response area with smooth animation
        this.responseArea.style.opacity = '0';
        this.responseArea.style.transform = 'translateY(10px)';

        setTimeout(() => {
            this.responseArea.innerHTML = '';
            this.responseArea.appendChild(responseContent);
            this.copyBtn.classList.remove('hidden');

            this.responseArea.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            this.responseArea.style.opacity = '1';
            this.responseArea.style.transform = 'translateY(0)';

            // Scroll response into view
            this.responseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
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
        // Animate clear action
        this.questionInput.style.transition = 'opacity 0.2s ease';
        this.responseArea.style.transition = 'opacity 0.2s ease';

        this.questionInput.style.opacity = '0.5';
        this.responseArea.style.opacity = '0.5';

        setTimeout(() => {
            this.questionInput.value = '';
            this.responseArea.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M8 9h8M8 13h6" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </div>
                    <h4>Ready to assist</h4>
                    <p>Enter a customer question to generate a professional response</p>
                </div>
            `;
            this.copyBtn.classList.add('hidden');

            // Update character count
            if (this.charCount) {
                this.charCount.textContent = '0';
                this.charCount.style.color = 'var(--color-gray-400)';
            }

            // Clear session
            this.clearSession();

            // Restore opacity
            this.questionInput.style.opacity = '1';
            this.responseArea.style.opacity = '1';
            this.questionInput.focus();
        }, 200);
    }

    clearSession() {
        this.sessionId = null;
        localStorage.removeItem('printo_session_id');
    }

    copyResponse() {
        // Get the original response and remove ALL markdown formatting
        let cleanText = this.lastResponse || this.responseArea.textContent;

        // Remove markdown formatting thoroughly
        cleanText = cleanText
            .replace(/\*\*(.*?)\*\*/g, '$1')    // Remove **bold**
            .replace(/\*(.*?)\*/g, '$1')        // Remove *italic*
            .replace(/__(.*?)__/g, '$1')        // Remove __bold__
            .replace(/_(.*?)_/g, '$1')          // Remove _italic_
            .replace(/`(.*?)`/g, '$1')          // Remove `code`
            .replace(/#{1,6}\s*/g, '')          // Remove headers
            .replace(/^\s*[-*+]\s+/gm, '• ')    // Convert list markers to bullets
            .replace(/^\s*\d+\.\s+/gm, '')      // Remove numbered lists
            .trim();

        console.log('Copying text:', cleanText); // Debug log

        if (navigator.clipboard) {
            navigator.clipboard.writeText(cleanText).then(() => {
                this.showNotification('Response copied to clipboard!');
                this.copyBtn.textContent = '✅ Copied';
                setTimeout(() => {
                    this.copyBtn.textContent = '📋 Copy';
                }, 2000);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = cleanText;
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
            this.historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <path d="M12 8v4l3 3M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </div>
                    <p>No recent queries</p>
                </div>
            `;
            return;
        }

        const historyHTML = history.map((item, index) => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="history-item" onclick="app.loadHistoryItem(${item.id})" style="animation-delay: ${index * 50}ms">
                    <div class="history-question">${item.question}</div>
                    <div class="history-time">${timeStr}</div>
                </div>
            `;
        }).join('');

        this.historyContainer.innerHTML = historyHTML;

        // Add stagger animation to history items
        setTimeout(() => {
            const items = this.historyContainer.querySelectorAll('.history-item');
            items.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-10px)';

                setTimeout(() => {
                    item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    item.style.opacity = '1';
                    item.style.transform = 'translateX(0)';
                }, index * 50);
            });
        }, 50);
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
        this.notification.className = `toast ${type}`;
        this.notification.classList.remove('hidden');

        // Animate in
        setTimeout(() => {
            this.notification.style.transform = 'translateX(0)';
        }, 10);

        // Animate out
        setTimeout(() => {
            this.notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                this.notification.classList.add('hidden');
            }, 250);
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