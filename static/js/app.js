// Global variables
let currentMode = 'chat';
let currentLevel = 'A1';
let isRecording = false;
let recognition = null;
let currentAudio = null;

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('messageInput').value = transcript;
        stopRecording();
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        stopRecording();
        showNotification('Lỗi nhận diện giọng nói. Vui lòng thử lại.', 'error');
    };
    
    recognition.onend = function() {
        stopRecording();
    };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Setup event listeners
    setupModeButtons();
    // Removed setupLevelSelector() - no longer using levels
    loadProgress();
    
    // Welcome message
    console.log('🚀 Language Learning Chatbot initialized');
});

// Setup mode buttons
function setupModeButtons() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            modeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentMode = this.dataset.mode;
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            
            // Show selected section
            if (currentMode === 'chat') {
                document.getElementById('chatSection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Chat với AI Assistant';
                document.getElementById('chatInputContainer').style.display = 'flex';
                document.getElementById('quickSuggestions').style.display = 'flex';
            } else if (currentMode === 'history') {
                document.getElementById('historySection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Lịch sử Chat';
                document.getElementById('chatInputContainer').style.display = 'none';
                document.getElementById('quickSuggestions').style.display = 'none';
                loadChatHistory();
            } else if (currentMode === 'vocabulary') {
                document.getElementById('vocabularySection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Học từ vựng';
                document.getElementById('chatInputContainer').style.display = 'none';
                document.getElementById('quickSuggestions').style.display = 'none';
                loadVocabulary();
            } else if (currentMode === 'writing') {
                document.getElementById('writingSection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Luyện viết';
                document.getElementById('chatInputContainer').style.display = 'none';
                document.getElementById('quickSuggestions').style.display = 'none';
                loadWritingHistory();
            } else if (currentMode === 'listening') {
                document.getElementById('listeningSection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Luyện nghe';
                document.getElementById('chatInputContainer').style.display = 'none';
                document.getElementById('quickSuggestions').style.display = 'none';
            } else if (currentMode === 'quiz') {
                document.getElementById('quizSection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Trắc nghiệm từ vựng';
                document.getElementById('chatInputContainer').style.display = 'none';
                document.getElementById('quickSuggestions').style.display = 'none';
            } else if (currentMode === 'game') {
                document.getElementById('gameSection').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Game từ vựng';
                document.getElementById('chatInputContainer').style.display = 'none';
                document.getElementById('quickSuggestions').style.display = 'none';
            }
        });
    });
}

// Setup level selector - REMOVED (no longer using levels)

// Get mode label in Vietnamese
function getModeLabel(mode) {
    const labels = {
        'conversation': '💬 Hội thoại',
        'grammar': '📚 Ngữ pháp',
        'vocabulary': '📖 Từ vựng',
        'pronunciation': '🎤 Phát âm'
    };
    return labels[mode] || mode;
}

// Handle key press in input
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) {
        showNotification('Vui lòng nhập tin nhắn', 'warning');
        return;
    }
    
    // Clear input
    input.value = '';
    
    // Add user message
    addMessage('user', message, null);
    
    // Show loading
    const loadingId = showLoading();
    
    try {
        // Send to API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                mode: currentMode,
                level: currentLevel
            })
        });
        
        const data = await response.json();
        
        // Remove loading
        removeLoading(loadingId);
        
        if (data.error) {
            addMessage('bot', `❌ Lỗi: ${data.error}`, null);
            return;
        }
        
        // Add bot response (không có audio nữa)
        addMessage('bot', data.response, null);
        
        // Update progress
        updateProgress(data.progress);
        
    } catch (error) {
        removeLoading(loadingId);
        addMessage('bot', `❌ Lỗi kết nối: ${error.message}`, null);
        console.error('Error:', error);
    }
}

// Quick message
function quickMessage(text) {
    document.getElementById('messageInput').value = text;
    sendMessage();
}

// Add message to chat
function addMessage(sender, text, audioBase64) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format text (support markdown-like formatting)
    const formattedText = formatText(text);
    contentDiv.innerHTML = formattedText;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    // Add audio player if available
    if (audioBase64 && sender === 'bot') {
        const audioPlayer = createAudioPlayer(audioBase64);
        contentDiv.appendChild(audioPlayer);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format text with basic markdown support
function formatText(text) {
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Highlights for corrections
    text = text.replace(/\[Sửa lỗi:(.*?)\]/g, '<span style="color: #f59e0b;">💡 Sửa lỗi:$1</span>');
    text = text.replace(/\[Từ vựng:(.*?)\]/g, '<span style="color: #10b981;">📚 Từ vựng:$1</span>');
    text = text.replace(/\[Gợi ý:(.*?)\]/g, '<span style="color: #667eea;">💭 Gợi ý:$1</span>');
    
    return text;
}

// Create audio player
function createAudioPlayer(audioBase64) {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'audio-player';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'play-audio-btn';
    playBtn.innerHTML = '<i class="fas fa-play"></i> Nghe phát âm';
    playBtn.onclick = function() {
        playAudioBase64(audioBase64);
    };
    
    playerDiv.appendChild(playBtn);
    return playerDiv;
}

// Play audio from base64
function playAudioBase64(audioBase64) {
    if (currentAudio) {
        currentAudio.pause();
    }
    
    const audio = new Audio('data:audio/mp3;base64,' + audioBase64);
    currentAudio = audio;
    audio.play();
}

// Show analysis
function showAnalysis(analysis) {
    const chatMessages = document.getElementById('chatMessages');
    const analysisDiv = document.createElement('div');
    analysisDiv.className = 'message bot-message';
    
    let analysisHTML = '<div class="message-avatar"><i class="fas fa-lightbulb"></i></div>';
    analysisHTML += '<div class="message-content"><div class="analysis-box">';
    analysisHTML += '<h4>📊 Phân tích</h4>';
    
    if (analysis.grammar_errors.length > 0) {
        analysisHTML += '<p><strong>Lỗi ngữ pháp:</strong></p><ul>';
        analysis.grammar_errors.forEach(error => {
            analysisHTML += `<li>${error}</li>`;
        });
        analysisHTML += '</ul>';
    }
    
    if (analysis.new_vocabulary.length > 0) {
        analysisHTML += '<p><strong>Từ vựng mới:</strong> ';
        analysisHTML += analysis.new_vocabulary.join(', ');
        analysisHTML += '</p>';
    }
    
    if (analysis.complexity) {
        analysisHTML += `<p><strong>Độ phức tạp:</strong> ${analysis.complexity}</p>`;
    }
    
    analysisHTML += '</div></div>';
    analysisDiv.innerHTML = analysisHTML;
    
    chatMessages.appendChild(analysisDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show loading
function showLoading() {
    const loadingId = 'loading-' + Date.now();
    const chatMessages = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'message bot-message';
    loadingDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-robot"></i></div>
        <div class="message-content">
            <div class="loading"></div>
            <span style="margin-left: 8px;">Đang suy nghĩ...</span>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return loadingId;
}

// Remove loading
function removeLoading(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Toggle speech recognition
function toggleSpeechRecognition() {
    if (!recognition) {
        showNotification('Trình duyệt không hỗ trợ nhận diện giọng nói', 'error');
        return;
    }
    
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// Start recording
function startRecording() {
    isRecording = true;
    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('recording');
    micBtn.innerHTML = '<i class="fas fa-stop"></i>';
    
    recognition.start();
    showNotification('🎤 Đang nghe... Hãy nói tiếng Anh', 'info');
}

// Stop recording
function stopRecording() {
    isRecording = false;
    const micBtn = document.getElementById('micBtn');
    micBtn.classList.remove('recording');
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    
    if (recognition) {
        recognition.stop();
    }
}

// Load progress
async function loadProgress() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        updateProgress({
            total_conversations: data.total_conversations,
            vocabulary_count: data.vocabulary_learned.length,
            grammar_corrections: data.grammar_corrections
        });
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Update progress
function updateProgress(progress) {
    // Check if elements exist before updating (they may not exist if progress section is removed)
    const totalConversationsEl = document.getElementById('totalConversations');
    if (totalConversationsEl && progress.total_conversations !== undefined) {
        totalConversationsEl.textContent = progress.total_conversations;
    }
    
    const vocabularyCountEl = document.getElementById('vocabularyCount');
    if (vocabularyCountEl && progress.vocabulary_count !== undefined) {
        vocabularyCountEl.textContent = progress.vocabulary_count;
    }
    
    const grammarCorrectionsEl = document.getElementById('grammarCorrections');
    if (grammarCorrectionsEl && progress.grammar_corrections !== undefined) {
        grammarCorrectionsEl.textContent = progress.grammar_corrections;
    }
}

// View progress details
async function viewProgress() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        
        let html = '<div style="padding: 20px;">';
        html += `<h3>📊 Tổng quan</h3>`;
        html += `<p>🗣️ Số cuộc hội thoại: <strong>${data.total_conversations}</strong></p>`;
        html += `<p>📚 Từ vựng đã học: <strong>${data.vocabulary_learned.length}</strong></p>`;
        html += `<p>✏️ Lỗi đã sửa: <strong>${data.grammar_corrections}</strong></p>`;
        html += `<p>🎯 Cấp độ hiện tại: <strong>${data.level}</strong></p>`;
        
        if (data.vocabulary_learned.length > 0) {
            html += '<h3 style="margin-top: 20px;">📖 Từ vựng gần đây</h3>';
            html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
            data.vocabulary_learned.slice(-20).forEach(word => {
                html += `<span style="background: var(--bg-tertiary); padding: 6px 12px; border-radius: 16px; font-size: 14px;">${word}</span>`;
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        document.getElementById('progressDetails').innerHTML = html;
        document.getElementById('progressModal').style.display = 'block';
    } catch (error) {
        showNotification('Lỗi khi tải tiến trình', 'error');
    }
}

// Show grammar tips
async function showGrammarTips() {
    try {
        const response = await fetch(`/api/grammar-tips?level=${currentLevel}`);
        const data = await response.json();
        
        let html = '<div style="padding: 20px;">';
        html += `<h3>Cấp độ ${data.level}</h3>`;
        html += '<ul style="padding-left: 20px; line-height: 2;">';
        data.tips.forEach(tip => {
            html += `<li>${tip}</li>`;
        });
        html += '</ul>';
        html += '</div>';
        
        document.getElementById('grammarTips').innerHTML = html;
        document.getElementById('grammarModal').style.display = 'block';
    } catch (error) {
        showNotification('Lỗi khi tải grammar tips', 'error');
    }
}

// Show vocabulary
async function showVocabulary() {
    try {
        const response = await fetch(`/api/vocabulary?level=${currentLevel}`);
        const data = await response.json();
        
        let html = '<div style="padding: 20px;">';
        html += `<h3>Chủ đề cho cấp độ ${data.level}</h3>`;
        html += '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">';
        data.topics.forEach(topic => {
            html += `<span style="background: var(--primary-color); padding: 8px 16px; border-radius: 20px;">${topic}</span>`;
        });
        html += '</div>';
        
        if (data.learned_vocabulary.length > 0) {
            html += '<h3>Từ vựng đã học</h3>';
            html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
            data.learned_vocabulary.forEach(word => {
                html += `<span style="background: var(--bg-tertiary); padding: 6px 12px; border-radius: 16px;">${word}</span>`;
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        document.getElementById('vocabularyContent').innerHTML = html;
        document.getElementById('vocabularyModal').style.display = 'block';
    } catch (error) {
        showNotification('Lỗi khi tải vocabulary', 'error');
    }
}

// Get practice sentence
async function getPracticeSentence() {
    const loadingId = showLoading();
    
    try {
        const response = await fetch(`/api/practice-sentence?level=${currentLevel}&topic=general`);
        const data = await response.json();
        
        removeLoading(loadingId);
        addMessage('bot', `🎯 **Câu luyện tập:**\n\n${data.sentence}`, null);
    } catch (error) {
        removeLoading(loadingId);
        showNotification('Lỗi khi tải câu luyện tập', 'error');
    }
}

// Show pronunciation practice
function showPronunciationPractice() {
    document.getElementById('pronunciationModal').style.display = 'block';
    // Load a random practice sentence
    loadPronunciationSentence();
}

// Load pronunciation sentence
async function loadPronunciationSentence() {
    try {
        const response = await fetch(`/api/practice-sentence?level=${currentLevel}&topic=pronunciation`);
        const data = await response.json();
        document.getElementById('practiceSentence').innerHTML = data.sentence;
    } catch (error) {
        document.getElementById('practiceSentence').innerHTML = 'Error loading sentence';
    }
}

// Play audio (for pronunciation practice)
function playAudio() {
    const sentence = document.getElementById('practiceSentence').textContent;
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
}

// Record pronunciation
function recordPronunciation() {
    if (!recognition) {
        showNotification('Trình duyệt không hỗ trợ nhận diện giọng nói', 'error');
        return;
    }
    
    const originalSentence = document.getElementById('practiceSentence').textContent.split('\n')[0];
    
    recognition.onresult = async function(event) {
        const spokenText = event.results[0][0].transcript;
        
        try {
            const response = await fetch('/api/pronunciation-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    original: originalSentence,
                    spoken: spokenText
                })
            });
            
            const data = await response.json();
            
            let resultHTML = `<div style="margin-top: 20px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px;">`;
            resultHTML += `<h3>Kết quả đánh giá</h3>`;
            resultHTML += `<p><strong>Điểm số:</strong> ${data.score}/100</p>`;
            resultHTML += `<div style="width: 100%; height: 20px; background: var(--bg-primary); border-radius: 10px; overflow: hidden; margin: 10px 0;">`;
            resultHTML += `<div style="width: ${data.score}%; height: 100%; background: linear-gradient(90deg, var(--primary-color), var(--success-color)); transition: width 0.5s;"></div>`;
            resultHTML += `</div>`;
            resultHTML += `<p><strong>Phản hồi:</strong> ${data.feedback.join(' ')}</p>`;
            resultHTML += `<p><strong>Bạn nói:</strong> "${data.spoken}"</p>`;
            resultHTML += `<p><strong>Câu gốc:</strong> "${data.original}"</p>`;
            resultHTML += `</div>`;
            
            document.getElementById('pronunciationResult').innerHTML = resultHTML;
        } catch (error) {
            showNotification('Lỗi khi đánh giá phát âm', 'error');
        }
    };
    
    recognition.start();
    showNotification('🎤 Đang nghe... Hãy đọc câu trên', 'info');
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Simple console notification (can be replaced with toast library)
    const colors = {
        'info': '#667eea',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444'
    };
    
    console.log(`%c${message}`, `color: ${colors[type]}; font-weight: bold; font-size: 14px;`);
    
    // You can also add a toast notification here
    // For now, we'll just use console
}

// Load Chat History
async function loadChatHistory() {
    try {
        const response = await fetch('/api/chat/history?limit=50');
        const data = await response.json();
        
        let html = '';
        
        if (data.history && data.history.length > 0) {
            // Group by date
            const groupedByDate = {};
            data.history.forEach(chat => {
                const date = new Date(chat.created_at).toLocaleDateString('vi-VN');
                if (!groupedByDate[date]) {
                    groupedByDate[date] = [];
                }
                groupedByDate[date].push(chat);
            });
            
            // Display grouped chats
            Object.keys(groupedByDate).forEach(date => {
                html += `<h4 style="color: var(--primary-color); margin: 20px 0 10px 0; padding-left: 10px; border-left: 4px solid var(--primary-color);">📅 ${date}</h4>`;
                
                groupedByDate[date].forEach(chat => {
                    const time = new Date(chat.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    
                    html += `
                        <div class="history-item" onclick="viewConversation(${chat.id})">
                            <div class="history-date">🕐 ${time}</div>
                            <div class="history-user">👤 Bạn: ${chat.user_message.substring(0, 80)}${chat.user_message.length > 80 ? '...' : ''}</div>
                            <div class="history-bot">🤖 Bot: ${chat.bot_response.substring(0, 100)}${chat.bot_response.length > 100 ? '...' : ''}</div>
                        </div>
                    `;
                });
            });
        } else {
            html = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Chưa có lịch sử chat. Hãy bắt đầu trò chuyện!</p>';
        }
        
        document.getElementById('chatHistoryList').innerHTML = html;
    } catch (error) {
        console.error('Error loading chat history:', error);
        document.getElementById('chatHistoryList').innerHTML = '<p style="text-align: center; color: var(--danger-color);">Lỗi tải lịch sử chat</p>';
    }
}

// View specific conversation in chat
async function viewConversation(chatId) {
    try {
        // Get full history
        const response = await fetch('/api/chat/history?limit=100');
        const data = await response.json();
        
        // Find the conversation
        const chat = data.history.find(c => c.id === chatId);
        
        if (chat) {
            // Switch to chat section
            document.querySelector('[data-mode="chat"]').click();
            
            // Clear current chat
            document.getElementById('chatMessages').innerHTML = '';
            
            // Add the conversation
            addMessage('user', chat.user_message, null);
            addMessage('bot', chat.bot_response, null);
            
            showNotification('Đã tải lại đoạn hội thoại', 'success');
        }
    } catch (error) {
        console.error('Error viewing conversation:', error);
        showNotification('Lỗi tải hội thoại', 'error');
    }
}

// Load specific conversation (deprecated - use viewConversation)
function loadConversation(chatId) {
    viewConversation(chatId);
}

// Load Vocabulary
// Biến lưu toàn bộ từ vựng
let allVocabulary = [];

async function loadVocabulary() {
    try {
        const response = await fetch('/api/user-vocabulary');
        const data = await response.json();
        
        // Lưu dữ liệu gốc
        allVocabulary = data.vocabulary || [];
        
        // Cập nhật số lượng từ
        document.getElementById('totalVocabCount').textContent = data.count || 0;
        
        // Cập nhật filter topics
        updateTopicFilter();
        
        // Hiển thị từ vựng
        displayVocabulary(allVocabulary);
    } catch (error) {
        console.error('Error loading vocabulary:', error);
        document.getElementById('vocabularyList').innerHTML = '<p style="text-align: center; color: var(--danger-color);">Lỗi tải từ vựng</p>';
    }
}

function updateTopicFilter() {
    const topicFilter = document.getElementById('topicFilter');
    if (!topicFilter) return;
    
    // Lấy danh sách topic duy nhất
    const topics = [...new Set(allVocabulary.map(v => v.topic || 'general'))];
    
    const topicEmojis = {
        'technology': '💻', 'food': '🍔', 'business': '💼', 'education': '📚',
        'health': '🏥', 'travel': '✈️', 'sports': '⚽', 'music': '🎵',
        'art': '🎨', 'science': '🔬', 'general': '📖', 'nature': '🌿',
        'animals': '🐾', 'weather': '🌤️', 'family': '👨‍👩‍👧', 'emotions': '😊',
        'custom': '⭐', 'user_added': '✨'
    };
    
    let options = '<option value="all">📚 Tất cả chủ đề</option>';
    topics.sort().forEach(topic => {
        const emoji = topicEmojis[topic] || '📌';
        const name = topic.replace('_', ' ');
        options += `<option value="${topic}">${emoji} ${name}</option>`;
    });
    
    topicFilter.innerHTML = options;
}

function displayVocabulary(vocabList) {
    const vocabularyList = document.getElementById('vocabularyList');
    
    if (!vocabList || vocabList.length === 0) {
        vocabularyList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Không tìm thấy từ vựng nào.</p>';
        return;
    }
    
    // Hiển thị dạng lưới gọn gàng
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">';
    
    vocabList.forEach(vocab => {
        const topicEmojis = {
            'technology': '💻', 'food': '🍔', 'business': '💼', 'education': '📚',
            'health': '🏥', 'travel': '✈️', 'sports': '⚽', 'music': '🎵',
            'art': '🎨', 'science': '🔬', 'general': '📖', 'nature': '🌿',
            'animals': '🐾', 'weather': '🌤️', 'family': '👨‍👩‍👧', 'emotions': '😊',
            'custom': '⭐', 'user_added': '✨'
        };
        const topicEmoji = topicEmojis[vocab.topic] || '📌';
        
        html += `
            <div class="vocab-card" data-word="${vocab.word.toLowerCase()}" data-meaning="${vocab.meaning_vi?.toLowerCase() || ''}" data-topic="${vocab.topic || 'general'}" style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; transition: all 0.3s; cursor: pointer; position: relative; overflow: hidden;" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.transform='translateY(0)';">
                <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
                    <button onclick="event.stopPropagation(); speakWord('${vocab.word}')" style="background: rgba(103,126,234,0.3); color: var(--primary-color); border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 12px;" title="Phát âm">
                        <i class="fas fa-volume-up"></i>
                    </button>
                    <button onclick="event.stopPropagation(); deleteVocabulary(${vocab.id})" style="background: rgba(255,59,48,0.3); color: #ff3b30; border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 12px;" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">${topicEmoji} ${(vocab.topic || 'general').replace('_', ' ')}</div>
                    <h4 style="font-size: 20px; color: var(--primary-color); margin: 0 0 4px 0; padding-right: 60px;">${vocab.word}</h4>
                    ${vocab.phonetic ? `<p style="color: var(--text-secondary); font-style: italic; font-size: 12px; margin: 0 0 8px 0;">${vocab.phonetic}</p>` : ''}
                </div>
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.4;"><strong>📌</strong> ${vocab.meaning_vi || 'Chưa có nghĩa'}</p>
                ${vocab.example ? `<p style="color: var(--text-secondary); font-size: 12px; font-style: italic; line-height: 1.4; margin: 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; border-left: 2px solid var(--primary-color);">💬 ${vocab.example}</p>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    vocabularyList.innerHTML = html;
}

function filterVocabulary() {
    const searchText = document.getElementById('searchVocab').value.toLowerCase();
    const topicFilter = document.getElementById('topicFilter').value;
    const sortOption = document.getElementById('sortVocab').value;
    
    // Lọc theo search và topic
    let filtered = allVocabulary.filter(vocab => {
        const matchSearch = !searchText || 
            vocab.word.toLowerCase().includes(searchText) || 
            (vocab.meaning_vi && vocab.meaning_vi.toLowerCase().includes(searchText));
        const matchTopic = topicFilter === 'all' || vocab.topic === topicFilter;
        return matchSearch && matchTopic;
    });
    
    // Sắp xếp
    switch(sortOption) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'az':
            filtered.sort((a, b) => a.word.localeCompare(b.word));
            break;
        case 'za':
            filtered.sort((a, b) => b.word.localeCompare(a.word));
            break;
    }
    
    displayVocabulary(filtered);
}

function toggleAddVocabForm() {
    const formContent = document.getElementById('addVocabFormContent');
    const toggleBtn = document.getElementById('toggleAddBtn');
    
    if (formContent.style.display === 'none') {
        formContent.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-minus"></i> Thu gọn';
    } else {
        formContent.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fas fa-plus"></i> Thêm từ mới';
    }
}

// Load topic vocabulary
async function loadTopicVocab(topic) {
    const prompt = `Cho tôi 10 từ vựng tiếng Anh quan trọng về chủ đề "${topic}" cho cấp độ ${currentLevel}. 
Với mỗi từ, cung cấp:
1. Từ tiếng Anh
2. Phiên âm IPA
3. Nghĩa tiếng Việt
4. Ví dụ câu

Format: 
**Từ** /phiên âm/
Nghĩa: ...
Ví dụ: ...`;

    const loadingId = showLoading();
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: prompt,
                mode: 'vocabulary',
                level: currentLevel
            })
        });
        
        const data = await response.json();
        removeLoading(loadingId);
        
        const vocabHtml = `
            <button onclick="loadVocabulary()" style="margin-bottom: 20px; padding: 10px 20px; background: var(--primary-color); border: none; border-radius: 8px; color: white; cursor: pointer;">
                <i class="fas fa-arrow-left"></i> Quay lại
            </button>
            <h3>📚 ${topic.replace('_', ' ')}</h3>
            <div class="vocabulary-list">
                <div class="vocab-item">
                    <div style="white-space: pre-wrap;">${data.response}</div>
                </div>
            </div>
        `;
        
        document.getElementById('vocabularySection').innerHTML = vocabHtml;
    } catch (error) {
        removeLoading(loadingId);
        console.error('Error:', error);
    }
}

// Load Practice
async function loadPractice() {
    const prompt = `Tạo 5 câu hỏi trắc nghiệm tiếng Anh cho cấp độ ${currentLevel}. 
Mỗi câu hỏi có 4 đáp án A, B, C, D và chỉ rõ đáp án đúng.
Format:
Câu 1: ...
A. ...
B. ...
C. ...
D. ...
Đáp án: ...`;

    const loadingId = showLoading();
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: prompt,
                mode: 'conversation',
                level: currentLevel
            })
        });
        
        const data = await response.json();
        removeLoading(loadingId);
        
        const practiceHtml = `
            <div class="practice-card">
                <h4>💪 Bài luyện tập - Cấp độ ${currentLevel}</h4>
                <div style="white-space: pre-wrap; line-height: 1.8;">${data.response}</div>
                <button class="btn-primary" style="margin-top: 20px;" onclick="loadPractice()">
                    <i class="fas fa-redo"></i> Làm bài mới
                </button>
            </div>
        `;
        
        document.getElementById('practiceSection').innerHTML = practiceHtml;
    } catch (error) {
        removeLoading(loadingId);
        console.error('Error:', error);
    }
}

// Show help
function showHelp() {
    const helpText = `
📚 HƯỚNG DẪN SỬ DỤNG

1. CHAT: Trò chuyện với AI bằng tiếng Anh để luyện tập
2. TỪ VỰNG: Thêm và quản lý từ vựng của bạn
3. NGỮ PHÁP: Xem các quy tắc ngữ pháp quan trọng
4. LUYỆN TẬP: Khu vực dành cho luyện tập

💡 Mẹo: Hãy luôn viết bằng tiếng Anh khi chat để AI có thể sửa lỗi và giúp bạn cải thiện!
    `;
    alert(helpText);
}

// Add new vocabulary
async function addNewVocabulary() {
    const word = document.getElementById('newWord').value.trim();
    const meaningVi = document.getElementById('newMeaningVi').value.trim();
    
    if (!word) {
        showNotification('Vui lòng nhập từ tiếng Anh', 'error');
        return;
    }
    
    if (!meaningVi) {
        showNotification('Vui lòng nhập nghĩa tiếng Việt', 'error');
        return;
    }
    
    // Hiển thị loading
    const loadingId = showLoading();
    showNotification('🤖 AI đang xử lý...', 'info');
    
    try {
        const response = await fetch('/api/add-vocabulary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: word,
                meaning_vi: meaningVi
            })
        });
        
        const data = await response.json();
        removeLoading(loadingId);
        
        if (data.success) {
            // Hiển thị thông báo với thông tin AI đã bổ sung
            let message = '✅ Đã thêm từ vựng thành công!\n';
            message += `📌 Lĩnh vực: ${data.topic}\n`;
            if (data.phonetic) {
                message += `🔊 Phiên âm: ${data.phonetic}\n`;
            }
            if (data.example) {
                message += `💬 Ví dụ: ${data.example}\n`;
            }
            
            // Hiển thị cảnh báo nếu AI sửa nghĩa
            if (data.correction_note) {
                showNotification(data.correction_note, 'warning');
                setTimeout(() => {
                    showNotification(message, 'success');
                }, 2000);
            } else {
                showNotification(message, 'success');
            }
            
            // Phát âm từ mới thêm
            if (data.word) {
                setTimeout(() => {
                    speakWord(data.word);
                }, 1000);
            }
            
            // Clear form
            document.getElementById('newWord').value = '';
            document.getElementById('newMeaningVi').value = '';
            
            // Reload vocabulary list
            setTimeout(() => {
                loadVocabulary();
            }, 500);
        } else {
            showNotification('❌ Lỗi: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        removeLoading(loadingId);
        console.error('Error adding vocabulary:', error);
        showNotification('❌ Lỗi kết nối server', 'error');
    }
}

// Speak word using Web Speech API
function speakWord(word) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US'; // English pronunciation
        utterance.rate = 0.8; // Slower for learning
        utterance.pitch = 1;
        utterance.volume = 1;
        
        window.speechSynthesis.speak(utterance);
        showNotification('🔊 Đang phát âm: ' + word, 'info');
    } else {
        showNotification('Trình duyệt không hỗ trợ phát âm', 'error');
    }
}

// Delete vocabulary
async function deleteVocabulary(vocabId) {
    if (!confirm('Bạn có chắc muốn xóa từ này?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/delete-vocabulary/${vocabId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Đã xóa từ vựng', 'success');
            loadVocabulary();
        } else {
            showNotification('Lỗi xóa từ vựng', 'error');
        }
    } catch (error) {
        console.error('Error deleting vocabulary:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

// ========== LUYỆN NGHE (LISTENING PRACTICE) ==========

let currentListeningSentence = '';
let currentListeningDifficulty = 'medium';
let currentListeningTopic = 'daily';
let listeningPlayCount = 0;
let listeningStats = {
    total: 0,
    correct: 0
};
let availableVoices = [];

// Load voices when available
function loadVoices() {
    availableVoices = window.speechSynthesis.getVoices();
    console.log('Loaded voices:', availableVoices.length);
}

// Initialize voices
if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

async function startListening() {
    const difficulty = document.getElementById('listeningDifficulty').value;
    const topic = document.getElementById('listeningTopic').value;
    currentListeningDifficulty = difficulty;
    currentListeningTopic = topic;
    listeningPlayCount = 0;
    
    try {
        showNotification('🤖 AI đang tạo câu luyện nghe...', 'info');
        
        const response = await fetch(`/api/listening/get-sentence?difficulty=${difficulty}&topic=${topic}`);
        const data = await response.json();
        
        if (data.success) {
            currentListeningSentence = data.sentence;
            document.getElementById('listeningExercise').style.display = 'block';
            document.getElementById('listeningAnswer').value = '';
            document.getElementById('listeningResult').style.display = 'none';
            document.getElementById('showHints').checked = false;
            document.getElementById('hintArea').style.display = 'none';
            updatePlayCount();
            showNotification('✅ Sẵn sàng! Nhấn nút Nghe để bắt đầu.', 'success');
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

function updatePlayCount() {
    document.getElementById('playCount').innerHTML = `Đã nghe: <strong>${listeningPlayCount}</strong> lần`;
}

function toggleHints() {
    const showHints = document.getElementById('showHints').checked;
    const hintArea = document.getElementById('hintArea');
    
    if (showHints && currentListeningSentence) {
        const wordCount = currentListeningSentence.split(' ').length;
        const firstLetter = currentListeningSentence.charAt(0);
        const hint = `💡 Gợi ý: Câu có ${wordCount} từ, bắt đầu bằng chữ "${firstLetter}"`;
        hintArea.textContent = hint;
        hintArea.style.display = 'block';
    } else {
        hintArea.style.display = 'none';
    }
}

function playListeningSentence(mode = 'normal') {
    if (!currentListeningSentence) {
        showNotification('Vui lòng bắt đầu luyện tập trước!', 'warning');
        return;
    }
    
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Make sure voices are loaded
        if (availableVoices.length === 0) {
            availableVoices = window.speechSynthesis.getVoices();
        }
        
        const utterance = new SpeechSynthesisUtterance(currentListeningSentence);
        
        // Get custom speed
        const customSpeed = parseFloat(document.getElementById('listeningSpeed').value);
        
        // Apply speed based on mode
        if (mode === 'slow') {
            utterance.rate = customSpeed * 0.6; // Chậm hơn 40%
        } else {
            // Apply difficulty speed
            let baseSpeed = customSpeed;
            if (currentListeningDifficulty === 'easy') {
                baseSpeed = customSpeed * 0.85;
            } else if (currentListeningDifficulty === 'hard') {
                baseSpeed = customSpeed * 1.1;
            }
            utterance.rate = baseSpeed;
        }
        
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to use selected voice
        const voiceType = document.getElementById('listeningVoice').value;
        let selectedVoice = null;
        
        console.log('Selecting voice type:', voiceType);
        console.log('Available voices:', availableVoices.length);
        
        if (voiceType === 'us-female') {
            // Try multiple patterns for US female voice
            selectedVoice = availableVoices.find(v => 
                (v.lang.startsWith('en-US') || v.lang.startsWith('en_US')) && 
                (v.name.toLowerCase().includes('female') || 
                 v.name.toLowerCase().includes('woman') ||
                 v.name.toLowerCase().includes('zira') ||
                 v.name.includes('Google US English') && !v.name.includes('Male'))
            );
        } else if (voiceType === 'us-male') {
            selectedVoice = availableVoices.find(v => 
                (v.lang.startsWith('en-US') || v.lang.startsWith('en_US')) && 
                (v.name.toLowerCase().includes('male') || 
                 v.name.toLowerCase().includes('man') ||
                 v.name.toLowerCase().includes('david') ||
                 v.name.toLowerCase().includes('mark'))
            );
        } else if (voiceType === 'uk-female') {
            selectedVoice = availableVoices.find(v => 
                (v.lang.startsWith('en-GB') || v.lang.startsWith('en_GB')) && 
                (v.name.toLowerCase().includes('female') || 
                 v.name.toLowerCase().includes('woman') ||
                 v.name.toLowerCase().includes('hazel'))
            );
        } else if (voiceType === 'uk-male') {
            selectedVoice = availableVoices.find(v => 
                (v.lang.startsWith('en-GB') || v.lang.startsWith('en_GB')) && 
                (v.name.toLowerCase().includes('male') || 
                 v.name.toLowerCase().includes('man') ||
                 v.name.toLowerCase().includes('george'))
            );
        }
        
        // Fallback to any English voice
        if (!selectedVoice) {
            selectedVoice = availableVoices.find(v => v.lang.startsWith('en'));
            console.log('Using fallback voice:', selectedVoice ? selectedVoice.name : 'default');
        } else {
            console.log('Selected voice:', selectedVoice.name);
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        } else {
            utterance.lang = 'en-US';
            console.log('No suitable voice found, using default');
        }
        
        window.speechSynthesis.speak(utterance);
        listeningPlayCount++;
        updatePlayCount();
        
        const modeText = mode === 'slow' ? '🐢 Chậm' : '🔊 Bình thường';
        const voiceName = selectedVoice ? selectedVoice.name.split(' ')[0] : 'Mặc định';
        showNotification(`${modeText} - ${voiceName}`, 'info');
    } else {
        showNotification('Trình duyệt không hỗ trợ phát âm', 'error');
    }
}

async function checkListeningAnswer() {
    const answer = document.getElementById('listeningAnswer').value.trim();
    
    if (!answer) {
        showNotification('⚠️ Vui lòng nhập câu trả lời!', 'warning');
        return;
    }
    
    try {
        showNotification('🤖 AI đang kiểm tra và phân tích chi tiết...', 'info');
        
        const response = await fetch('/api/listening/check-answer', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                sentence: currentListeningSentence,
                answer: answer,
                difficulty: currentListeningDifficulty,
                topic: currentListeningTopic,
                play_count: listeningPlayCount
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Create detailed result display
            let resultHtml = `
                <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: ${data.is_correct ? 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' : 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)'}; border-radius: 16px;">
                    <div style="font-size: 64px; margin-bottom: 15px;">
                        ${data.is_correct ? '✅' : '❌'}
                    </div>
                    <h3 style="color: ${data.is_correct ? '#155724' : '#721c24'}; font-size: 24px; margin-bottom: 10px;">${data.feedback}</h3>
                    <div style="display: inline-block; padding: 12px 24px; background: white; border-radius: 12px; margin-top: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <span style="font-size: 36px; font-weight: bold; color: ${data.similarity >= 90 ? '#28a745' : data.similarity >= 70 ? '#ffc107' : '#dc3545'};">
                            ${data.similarity}%
                        </span>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">Độ chính xác</div>
                    </div>
                </div>
                
                <div style="display: grid; gap: 15px; margin-bottom: 20px;">
                    <div style="padding: 18px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 12px;">
                        <div style="font-weight: 600; color: #1e40af; margin-bottom: 8px; font-size: 14px;">📝 CÂU GỐC (Đáp án đúng)</div>
                        <div style="font-size: 18px; color: #1e293b; line-height: 1.6;">${data.original_sentence}</div>
                    </div>
                    <div style="padding: 18px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 12px;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; font-size: 14px;">✍️ CÂU BẠN NHẬP</div>
                        <div style="font-size: 18px; color: #1e293b; line-height: 1.6;">${data.user_answer}</div>
                    </div>
                </div>
            `;
            
            // Add detailed AI analysis
            if (data.ai_analysis && data.ai_analysis.trim() !== '') {
                resultHtml += `
                    <div style="padding: 25px; background: linear-gradient(135deg, #ede7f6 0%, #d1c4e9 100%); border: 2px solid #7c4dff; border-radius: 16px; margin-top: 20px;">
                        <h4 style="color: #4527a0; margin-bottom: 18px; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-robot"></i> Phân tích chi tiết từ AI
                        </h4>
                        <div style="white-space: pre-wrap; line-height: 1.9; color: #1e293b; font-size: 15px; background: white; padding: 20px; border-radius: 12px;">
                            ${data.ai_analysis.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                `;
            }
            
            // Add learning tips
            if (data.similarity < 90) {
                resultHtml += `
                    <div style="padding: 20px; background: #fff3e0; border-radius: 12px; margin-top: 15px; border-left: 4px solid #ff9800;">
                        <h4 style="color: #e65100; margin-bottom: 12px; font-size: 16px;">
                            <i class="fas fa-lightbulb"></i> Mẹo học tập
                        </h4>
                        <ul style="margin: 0; padding-left: 20px; color: #424242; line-height: 1.8;">
                            <li>Nghe lại câu nhiều lần, chú ý từng từ riêng lẻ</li>
                            <li>Lưu ý cách phát âm các âm cuối và liên kết âm</li>
                            <li>Viết từng từ một, tránh đoán mò</li>
                            <li>Thực hành thêm với độ khó thấp hơn nếu cần</li>
                        </ul>
                    </div>
                `;
            }
            
            document.getElementById('listeningResultContent').innerHTML = resultHtml;
            document.getElementById('listeningResult').style.display = 'block';
            
            // Scroll to result
            document.getElementById('listeningResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Update stats
            listeningStats.total++;
            if (data.is_correct) listeningStats.correct++;
            
            document.getElementById('listeningTotal').textContent = listeningStats.total;
            document.getElementById('listeningCorrect').textContent = listeningStats.correct;
            const accuracy = Math.round((listeningStats.correct / listeningStats.total) * 100);
            document.getElementById('listeningAccuracy').textContent = `${accuracy}%`;
            
            if (data.is_correct) {
                showNotification('🎉 Hoàn hảo! Bạn nghe rất tốt!', 'success');
            } else if (data.similarity >= 70) {
                showNotification('👍 Khá tốt! Còn một vài chi tiết nhỏ.', 'info');
            }
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

function showListeningSentence() {
    if (!currentListeningSentence) {
        showNotification('Vui lòng bắt đầu luyện tập trước!', 'warning');
        return;
    }
    
    // Show answer in a nice popup style
    const resultHtml = `
        <div style="padding: 25px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 3px solid #3b82f6; border-radius: 16px; text-align: center;">
            <h4 style="color: #1e40af; margin-bottom: 15px; font-size: 18px;">
                <i class="fas fa-eye"></i> Đáp án chính xác
            </h4>
            <div style="font-size: 22px; color: #1e293b; font-weight: 600; line-height: 1.6; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                ${currentListeningSentence}
            </div>
            <p style="color: #64748b; margin-top: 15px; font-size: 14px;">
                💡 Nghe lại câu và so sánh với đáp án của bạn
            </p>
        </div>
    `;
    
    document.getElementById('listeningResultContent').innerHTML = resultHtml;
    document.getElementById('listeningResult').style.display = 'block';
    document.getElementById('listeningResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showNotification('📖 Đã hiển thị đáp án', 'info');
}

// ========== TRẮC NGHIỆM (QUIZ) ==========

let quizQuestions = [];
let currentQuestionIndex = 0;
let quizAnswers = [];
let quizStartTime = 0;
let quizTimer = null;

async function startQuiz() {
    const count = document.getElementById('quizQuestionCount').value;
    const topic = document.getElementById('quizTopic').value;
    
    try {
        const topicText = topic === 'my_vocabulary' ? 'từ vựng đã học' : 'AI tạo theo chủ đề';
        showNotification(`🤖 Đang tạo ${count} câu hỏi từ ${topicText}...`, 'info');
        
        const response = await fetch(`/api/quiz/generate?count=${count}&topic=${topic}`);
        const data = await response.json();
        
        console.log('Quiz data received:', data); // Debug log
        
        if (data.success) {
            quizQuestions = data.questions;
            console.log('First question:', quizQuestions[0]); // Debug log
            currentQuestionIndex = 0;
            quizAnswers = [];
            quizStartTime = Date.now();
            
            document.getElementById('quizStart').style.display = 'none';
            document.getElementById('quizArea').style.display = 'block';
            document.getElementById('totalQuestions').textContent = quizQuestions.length;
            
            // Start timer
            quizTimer = setInterval(updateQuizTimer, 1000);
            
            showQuizQuestion();
            showNotification('✅ Bắt đầu làm bài!', 'success');
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

function updateQuizTimer() {
    const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
    document.getElementById('quizTimer').textContent = `${elapsed}s`;
}

function showQuizQuestion() {
    if (currentQuestionIndex >= quizQuestions.length) {
        finishQuiz();
        return;
    }
    
    const question = quizQuestions[currentQuestionIndex];
    console.log('Current question:', question); // Debug
    
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    
    // Display English word prominently with phonetic
    // Sử dụng question.word hoặc question.question (tùy theo format từ backend)
    const englishWord = question.word || question.question || 'Unknown';
    console.log('English word:', englishWord); // Debug
    
    let questionHtml = `
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 64px; font-weight: 900; color: #6366f1; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">${englishWord}</div>
            ${question.phonetic ? `<div style="font-size: 22px; color: #94a3b8; margin-bottom: 20px; font-style: italic; font-weight: 500;">${question.phonetic}</div>` : ''}
            <div style="font-size: 18px; color: #1e293b; font-weight: 600; margin-top: 15px; background: rgba(99, 102, 241, 0.1); padding: 10px 20px; border-radius: 8px; display: inline-block;">Chọn nghĩa tiếng Việt phù hợp:</div>
        </div>
    `;
    
    document.getElementById('questionText').innerHTML = questionHtml;
    
    // Update progress bar
    const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
    document.getElementById('quizProgressBar').style.width = `${progress}%`;
    
    // Show options
    let optionsHtml = '';
    question.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C, D
        optionsHtml += `
            <div class="quiz-option" onclick="selectQuizOption(${index})">
                <div class="option-letter">${letter}</div>
                <div>${option.text}</div>
            </div>
        `;
    });
    
    document.getElementById('quizOptions').innerHTML = optionsHtml;
    document.getElementById('nextQuizBtn').disabled = true;
}

function selectQuizOption(optionIndex) {
    const question = quizQuestions[currentQuestionIndex];
    const options = document.querySelectorAll('.quiz-option');
    
    // Remove previous selection
    options.forEach(opt => opt.classList.remove('selected', 'correct', 'wrong'));
    
    // Mark selected
    options[optionIndex].classList.add('selected');
    
    // Check answer
    const isCorrect = question.options[optionIndex].is_correct;
    
    // Show correct/wrong
    if (isCorrect) {
        options[optionIndex].classList.add('correct');
    } else {
        options[optionIndex].classList.add('wrong');
        // Show correct answer
        question.options.forEach((opt, idx) => {
            if (opt.is_correct) {
                options[idx].classList.add('correct');
            }
        });
    }
    
    // Save answer
    quizAnswers.push({
        vocab_id: question.id,
        user_answer: question.options[optionIndex].text,
        is_correct: isCorrect,
        time_taken: Math.floor((Date.now() - quizStartTime) / 1000)
    });
    
    // Enable next button
    document.getElementById('nextQuizBtn').disabled = false;
}

function nextQuizQuestion() {
    currentQuestionIndex++;
    document.getElementById('nextQuizBtn').disabled = true;
    showQuizQuestion();
}

async function finishQuiz() {
    clearInterval(quizTimer);
    
    try {
        const response = await fetch('/api/quiz/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                answers: quizAnswers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('quizArea').style.display = 'none';
            document.getElementById('quizResult').style.display = 'block';
            
            document.getElementById('quizScore').textContent = `${data.correct}/${data.total}`;
            
            let message = '';
            if (data.percentage >= 90) {
                message = '🏆 Xuất sắc! Bạn nắm vững từ vựng!';
            } else if (data.percentage >= 70) {
                message = '👍 Tốt lắm! Tiếp tục cố gắng!';
            } else if (data.percentage >= 50) {
                message = '😊 Khá tốt! Hãy ôn thêm nhé!';
            } else {
                message = '💪 Cần cố gắng thêm! Đừng bỏ cuộc!';
            }
            
            document.getElementById('quizMessage').textContent = message;
            showNotification(`✅ Hoàn thành! Điểm: ${data.percentage}%`, 'success');
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

function restartQuiz() {
    document.getElementById('quizResult').style.display = 'none';
    document.getElementById('quizStart').style.display = 'block';
}

// ========== GAME TỪ VỰNG (VOCABULARY GAME) ==========

let gameCards = [];
let selectedCards = [];
let matchedPairs = 0;
let gameScore = 0;
let gameStartTime = 0;
let gameTimerInterval = null;

async function startGame() {
    const pairCount = document.getElementById('gamePairCount').value;
    const topic = document.getElementById('gameTopic').value;
    
    try {
        showNotification('🤖 Đang tạo game...', 'info');
        
        const response = await fetch(`/api/game/start?count=${pairCount}&topic=${topic}`);
        const data = await response.json();
        
        if (data.success) {
            gameCards = data.cards;
            selectedCards = [];
            matchedPairs = 0;
            gameScore = 0;
            gameStartTime = Date.now();
            
            document.getElementById('gameStart').style.display = 'none';
            document.getElementById('gameArea').style.display = 'block';
            
            // Update stats
            document.getElementById('gameScore').textContent = '0';
            document.getElementById('gamePairs').textContent = `0/${data.total_pairs}`;
            document.getElementById('gameTime').textContent = '0s';
            
            // Start timer
            gameTimerInterval = setInterval(updateGameTimer, 1000);
            
            // Render cards
            renderGameCards();
            
            showNotification('✅ Bắt đầu chơi!', 'success');
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

function updateGameTimer() {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('gameTime').textContent = `${elapsed}s`;
}

function renderGameCards() {
    const gameCardsDiv = document.getElementById('gameCards');
    gameCardsDiv.innerHTML = '';
    
    gameCards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `game-card ${card.type}`;
        cardDiv.textContent = card.text;
        cardDiv.dataset.index = index;
        cardDiv.dataset.matchId = card.match_id;
        cardDiv.onclick = () => selectGameCard(index);
        gameCardsDiv.appendChild(cardDiv);
    });
}

function selectGameCard(index) {
    const card = gameCards[index];
    const cardElements = document.querySelectorAll('.game-card');
    const cardElement = cardElements[index];
    
    // Check if already matched or selected
    if (cardElement.classList.contains('matched') || selectedCards.includes(index)) {
        return;
    }
    
    // Select card
    cardElement.classList.add('selected');
    selectedCards.push(index);
    
    // Check if two cards are selected
    if (selectedCards.length === 2) {
        setTimeout(checkGameMatch, 500);
    }
}

function checkGameMatch() {
    const cardElements = document.querySelectorAll('.game-card');
    const [index1, index2] = selectedCards;
    const card1 = gameCards[index1];
    const card2 = gameCards[index2];
    
    if (card1.match_id === card2.match_id && card1.type !== card2.type) {
        // Match!
        cardElements[index1].classList.add('matched');
        cardElements[index2].classList.add('matched');
        cardElements[index1].classList.remove('selected');
        cardElements[index2].classList.remove('selected');
        
        matchedPairs++;
        gameScore += 10;
        
        document.getElementById('gameScore').textContent = gameScore;
        document.getElementById('gamePairs').textContent = `${matchedPairs}/${gameCards.length / 2}`;
        
        showNotification('✅ Đúng rồi! +10 điểm', 'success');
        
        // Check if game is finished
        if (matchedPairs === gameCards.length / 2) {
            setTimeout(finishGame, 1000);
        }
    } else {
        // No match
        cardElements[index1].classList.remove('selected');
        cardElements[index2].classList.remove('selected');
        
        gameScore = Math.max(0, gameScore - 2);
        document.getElementById('gameScore').textContent = gameScore;
    }
    
    selectedCards = [];
}

async function finishGame() {
    clearInterval(gameTimerInterval);
    
    const timeTaken = Math.floor((Date.now() - gameStartTime) / 1000);
    
    // Save score
    try {
        await fetch('/api/game/save-score', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                game_type: 'matching',
                score: gameScore,
                correct_answers: matchedPairs,
                total_questions: gameCards.length / 2,
                time_taken: timeTaken
            })
        });
    } catch (error) {
        console.error('Error saving score:', error);
    }
    
    // Show result
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('gameResult').style.display = 'block';
    
    document.getElementById('finalGameScore').textContent = `${gameScore} điểm`;
    document.getElementById('finalGameTime').textContent = `Hoàn thành trong ${timeTaken} giây`;
    
    showNotification('🏆 Hoàn thành game!', 'success');
    
    // Load leaderboard
    loadGameLeaderboard();
}

function restartGame() {
    document.getElementById('gameResult').style.display = 'none';
    document.getElementById('gameStart').style.display = 'block';
}

async function loadGameLeaderboard() {
    try {
        const response = await fetch('/api/game/leaderboard?game_type=matching');
        const data = await response.json();
        
        if (data.success && data.scores.length > 0) {
            let html = '<table style="width: 100%; text-align: left;">';
            html += '<tr><th>Điểm</th><th>Thời gian</th><th>Ngày</th></tr>';
            
            data.scores.forEach((score, index) => {
                const date = new Date(score.created_at).toLocaleDateString('vi-VN');
                const medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
                html += `<tr><td>${medal} ${score.score}</td><td>${score.time_taken}s</td><td>${date}</td></tr>`;
            });
            
            html += '</table>';
            document.getElementById('leaderboardList').innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}
