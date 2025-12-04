// ========== LUYỆN NÓI (SPEAKING PRACTICE) ==========

// Global variables
let currentSpeakingMode = null;
let currentPronunciationWord = null;
let currentTopicQuestion = '';
let isRecording = false;
let recognition = null;
let recordingTimer = null;
let recordingSeconds = 0;
let conversationHistory = [];

// Khởi tạo Speech Recognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        return true;
    } else {
        showNotification('Trình duyệt không hỗ trợ nhận diện giọng nói', 'error');
        return false;
    }
}

// Chọn chế độ luyện nói
function selectSpeakingMode(event, mode) {
    currentSpeakingMode = mode;
    
    // Ẩn tất cả các khu vực
    document.getElementById('pronunciationArea').style.display = 'none';
    document.getElementById('topicSpeakingArea').style.display = 'none';
    document.getElementById('conversationArea').style.display = 'none';
    
    // Highlight card được chọn
    document.querySelectorAll('.speaking-mode-card').forEach(card => {
        card.style.borderColor = 'transparent';
        card.classList.remove('selected');
    });
    
    const selectedCard = event.target.closest('.speaking-mode-card');
    if (selectedCard) {
        if (mode === 'pronunciation') {
            selectedCard.style.borderColor = '#667eea';
        } else if (mode === 'topic') {
            selectedCard.style.borderColor = '#52c41a';
        } else if (mode === 'conversation') {
            selectedCard.style.borderColor = '#ff9500';
        }
        selectedCard.classList.add('selected');
    }
    
    // Hiển thị khu vực tương ứng với animation
    if (mode === 'pronunciation') {
        document.getElementById('pronunciationArea').style.display = 'block';
        getNextPronunciationWord();
    } else if (mode === 'topic') {
        document.getElementById('topicSpeakingArea').style.display = 'block';
    } else if (mode === 'conversation') {
        document.getElementById('conversationArea').style.display = 'block';
    }
    
    // Load statistics
    loadSpeakingStatistics();
}

// ========== PHÁT ÂM TỪ VỰNG ==========

async function getNextPronunciationWord() {
    try {
        showNotification('🔍 Đang tìm từ vựng...', 'info');
        
        const response = await fetch('/api/speaking/get-pronunciation-word');
        const data = await response.json();
        
        if (data.success && data.word) {
            currentPronunciationWord = data.word;
            document.getElementById('currentWord').textContent = data.word.word;
            document.getElementById('currentPhonetic').textContent = data.word.phonetic || '';
            document.getElementById('currentMeaning').textContent = data.word.meaning_vi || '';
            document.getElementById('pronunciationResult').style.display = 'none';
            
            // Hiển thị thông báo nếu là từ mẫu
            if (data.is_sample) {
                showNotification('💡 Đang dùng từ mẫu. Thêm từ vựng của bạn để luyện tập tốt hơn!', 'info');
            } else {
                showNotification('✅ Sẵn sàng luyện phát âm!', 'success');
            }
        } else {
            // Hiển thị thông báo không có từ vựng
            document.getElementById('currentWord').innerHTML = `
                <div style="font-size: 24px; color: #64748b;">
                    <i class="fas fa-inbox" style="font-size: 64px; display: block; margin-bottom: 20px; opacity: 0.5;"></i>
                    <div style="margin-bottom: 15px;">Chưa có từ vựng để luyện tập</div>
                    <div style="font-size: 16px; line-height: 1.6; color: #94a3b8;">
                        Hãy vào mục <strong style="color: #667eea;">Học từ vựng</strong> để thêm từ mới<br>
                        hoặc học các từ từ AI tạo
                    </div>
                    <button onclick="switchToVocabulary()" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 10px; color: white; cursor: pointer; font-size: 15px; font-weight: 600;">
                        <i class="fas fa-book"></i> Đi học từ vựng
                    </button>
                </div>
            `;
            document.getElementById('currentPhonetic').textContent = '';
            document.getElementById('currentMeaning').textContent = '';
            showNotification(data.error || '⚠️ Bạn chưa có từ vựng nào. Hãy thêm từ mới trước!', 'warning');
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('currentWord').innerHTML = `
            <div style="font-size: 20px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; display: block; margin-bottom: 15px;"></i>
                Lỗi kết nối server
            </div>
        `;
        showNotification('❌ Lỗi kết nối server', 'error');
    }
}

// Helper function to switch to vocabulary section
function switchToVocabulary() {
    document.querySelector('[data-mode="vocabulary"]').click();
}

function playWordAudio() {
    if (!currentPronunciationWord || !currentPronunciationWord.word) {
        showNotification('Không có từ để phát âm!', 'warning');
        return;
    }
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(currentPronunciationWord.word);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        window.speechSynthesis.speak(utterance);
        showNotification('🔊 Đang phát âm...', 'info');
    } else {
        showNotification('Trình duyệt không hỗ trợ phát âm', 'error');
    }
}

async function startPronunciationRecording() {
    if (!currentPronunciationWord) {
        showNotification('Vui lòng chọn từ trước!', 'warning');
        return;
    }
    
    if (!recognition && !initSpeechRecognition()) {
        return;
    }
    
    const btn = document.getElementById('recordPronunciationBtn');
    const waveDiv = document.getElementById('recordingWave');
    
    if (isRecording) {
        recognition.stop();
        btn.innerHTML = '<i class="fas fa-microphone"></i> Bắt đầu nói';
        btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        waveDiv.style.display = 'none';
        isRecording = false;
        return;
    }
    
    isRecording = true;
    btn.innerHTML = '<i class="fas fa-stop"></i> Dừng ghi';
    btn.style.background = 'linear-gradient(135deg, #ff9500 0%, #ffb340 100%)';
    waveDiv.style.display = 'block';
    
    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        const targetWord = currentPronunciationWord.word.toLowerCase();
        
        waveDiv.style.display = 'none';
        
        // Gửi lên server để AI đánh giá
        try {
            showNotification('🤖 AI đang phân tích phát âm...', 'info');
            
            const response = await fetch('/api/speaking/check-pronunciation', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    word: currentPronunciationWord.word,
                    transcript: transcript,
                    phonetic: currentPronunciationWord.phonetic || ''
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayPronunciationResult(data);
                loadSpeakingStatistics();
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Lỗi khi đánh giá', 'error');
        }
        
        isRecording = false;
        btn.innerHTML = '<i class="fas fa-microphone"></i> Bắt đầu nói';
        btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    };
    
    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        showNotification('Lỗi nhận diện giọng nói: ' + event.error, 'error');
        isRecording = false;
        waveDiv.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-microphone"></i> Bắt đầu nói';
        btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    };
    
    recognition.start();
    showNotification('🎤 Đang nghe... Hãy phát âm từ!', 'info');
}

function displayPronunciationResult(data) {
    const resultDiv = document.getElementById('pronunciationResult');
    const score = data.score || 0;
    const feedback = data.feedback || '';
    const transcript = data.transcript || '';
    
    let scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    let scoreEmoji = score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪';
    let scoreBg = score >= 80 ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : score >= 60 ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
    
    resultDiv.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 16px; border: 3px solid ${scoreColor}; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: ${scoreBg}; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <div style="font-size: 52px; margin-bottom: 10px;">${scoreEmoji}</div>
                <div style="font-size: 48px; font-weight: 900; color: ${scoreColor}; margin-bottom: 5px;">${score}<span style="font-size: 24px;">/100</span></div>
                <div style="font-size: 14px; color: #64748b; font-weight: 600;">ĐIỂM PHÁT ÂM</div>
            </div>
            
            ${transcript ? `
                <div style="background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #667eea;">
                    <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 5px;">BẠN ĐÃ NÓI:</div>
                    <div style="font-size: 18px; color: #1e293b; font-weight: 600;">"${transcript}"</div>
                </div>
            ` : ''}
            
            <div style="background: #f8fafc; padding: 18px; border-radius: 10px; line-height: 1.8; color: #475569;">
                <div style="font-size: 13px; color: #667eea; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-robot"></i> PHÂN TÍCH TỪ AI:
                </div>
                ${feedback.replace(/\n/g, '<br>')}
            </div>
            
            ${score < 80 ? `
                <div style="margin-top: 15px; padding: 15px; background: #fff7ed; border-radius: 10px; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 13px; color: #c2410c; font-weight: 600; margin-bottom: 8px;"><i class="fas fa-lightbulb"></i> MẸO:</div>
                    <div style="font-size: 14px; color: #78350f; line-height: 1.6;">Nghe lại phát âm mẫu và luyện tập nhiều lần. Chú ý đến các âm khó như /th/, /r/, /l/.</div>
                </div>
            ` : ''}
        </div>
    `;
    resultDiv.style.display = 'block';
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ========== NÓI THEO CHỦ ĐỀ ==========

async function getTopicQuestion() {
    const topic = document.getElementById('speakingTopic').value;
    
    try {
        showNotification('🤖 Đang tạo câu hỏi...', 'info');
        
        const response = await fetch(`/api/speaking/get-topic-question?topic=${topic}`);
        const data = await response.json();
        
        if (data.success) {
            currentTopicQuestion = data.question;
            document.getElementById('questionText').textContent = data.question;
            document.getElementById('topicQuestion').style.display = 'block';
            document.getElementById('recordTopicBtn').disabled = false;
            document.getElementById('topicSpeakingResult').style.display = 'none';
            showNotification('✅ Đã tạo câu hỏi!', 'success');
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

async function startTopicRecording() {
    if (!currentTopicQuestion) {
        showNotification('Vui lòng tạo câu hỏi trước!', 'warning');
        return;
    }
    
    if (!recognition && !initSpeechRecognition()) {
        return;
    }
    
    const btn = document.getElementById('recordTopicBtn');
    
    if (isRecording) {
        recognition.stop();
        clearInterval(recordingTimer);
        btn.innerHTML = '<i class="fas fa-microphone"></i> Bắt đầu nói';
        btn.style.background = 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)';
        document.getElementById('recordingTimer').style.display = 'none';
        isRecording = false;
        return;
    }
    
    isRecording = true;
    recordingSeconds = 0;
    btn.innerHTML = '<i class="fas fa-stop"></i> Dừng ghi';
    btn.style.background = 'linear-gradient(135deg, #ff9500 0%, #ffb340 100%)';
    document.getElementById('recordingTimer').style.display = 'block';
    document.getElementById('recordingTimer').textContent = '00:00';
    
    // Bắt đầu đếm thời gian
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;
        document.getElementById('recordingTimer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Tự động dừng sau 90 giây
        if (recordingSeconds >= 90) {
            recognition.stop();
        }
    }, 1000);
    
    // Cấu hình recognition cho đoạn dài
    recognition.continuous = true;
    recognition.interimResults = false;
    
    let fullTranscript = '';
    
    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                fullTranscript += event.results[i][0].transcript + ' ';
            }
        }
    };
    
    recognition.onend = async () => {
        clearInterval(recordingTimer);
        isRecording = false;
        btn.innerHTML = '<i class="fas fa-microphone"></i> Bắt đầu nói';
        btn.style.background = 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)';
        document.getElementById('recordingTimer').style.display = 'none';
        
        if (fullTranscript.trim()) {
            // Gửi lên server để AI đánh giá
            try {
                showNotification('🤖 AI đang đánh giá...', 'info');
                
                const response = await fetch('/api/speaking/check-topic-answer', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        topic: document.getElementById('speakingTopic').value,
                        question: currentTopicQuestion,
                        transcript: fullTranscript.trim(),
                        duration: recordingSeconds
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    displayTopicResult(data);
                    loadSpeakingStatistics();
                } else {
                    showNotification('Lỗi: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Lỗi kết nối server', 'error');
            }
        } else {
            showNotification('Không nhận được âm thanh. Vui lòng thử lại!', 'warning');
        }
        
        recognition.continuous = false;
    };
    
    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        clearInterval(recordingTimer);
        showNotification('Lỗi nhận diện giọng nói: ' + event.error, 'error');
        isRecording = false;
        btn.innerHTML = '<i class="fas fa-microphone"></i> Bắt đầu nói';
        btn.style.background = 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)';
        document.getElementById('recordingTimer').style.display = 'none';
        recognition.continuous = false;
    };
    
    recognition.start();
    showNotification('🎤 Đang nghe... Hãy trả lời câu hỏi!', 'info');
}

function displayTopicResult(data) {
    const resultDiv = document.getElementById('topicSpeakingResult');
    const overall = data.overall_score || 0;
    
    let scoreColor = overall >= 80 ? '#52c41a' : overall >= 60 ? '#ff9500' : '#ff3b30';
    let scoreEmoji = overall >= 80 ? '🎉' : overall >= 60 ? '👍' : '💪';
    
    resultDiv.innerHTML = `
        <div style="background: rgba(255,255,255,0.08); padding: 20px; border-radius: 10px; border-left: 4px solid ${scoreColor};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0;">Kết quả đánh giá</h4>
                <div style="font-size: 32px; font-weight: 700; color: ${scoreColor};">${scoreEmoji} ${overall}/100</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-secondary);">Phát âm</div>
                    <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${data.pronunciation_score || 0}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-secondary);">Ngữ pháp</div>
                    <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${data.grammar_score || 0}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-secondary);">Từ vựng</div>
                    <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${data.vocabulary_score || 0}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-secondary);">Trôi chảy</div>
                    <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${data.fluency_score || 0}</div>
                </div>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <strong>Bạn đã nói:</strong>
                <p style="margin: 5px 0 0 0; font-style: italic;">"${data.transcript}"</p>
            </div>
            <div style="line-height: 1.7;">${data.feedback.replace(/\n/g, '<br>')}</div>
        </div>
    `;
    resultDiv.style.display = 'block';
}

// ========== HỘI THOẠI ==========

async function startConversation() {
    const role = document.getElementById('conversationRole').value;
    conversationHistory = [];
    
    try {
        showNotification('🤖 Đang bắt đầu hội thoại...', 'info');
        
        const response = await fetch('/api/speaking/start-conversation', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ role: role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            conversationHistory.push({
                speaker: 'AI',
                text: data.greeting
            });
            
            displayConversation();
            document.getElementById('conversationBox').style.display = 'block';
            document.getElementById('recordConversationBtn').disabled = false;
            
            // Đọc lời chào
            speakText(data.greeting);
            showNotification('✅ Hội thoại đã bắt đầu!', 'success');
        } else {
            showNotification('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Lỗi kết nối server', 'error');
    }
}

function displayConversation() {
    const box = document.getElementById('conversationBox');
    let html = '';
    
    conversationHistory.forEach(msg => {
        const isAI = msg.speaker === 'AI';
        html += `
            <div style="margin-bottom: 12px; text-align: ${isAI ? 'left' : 'right'};">
                <div style="display: inline-block; max-width: 80%; padding: 10px 15px; border-radius: 12px; background: ${isAI ? 'rgba(103,126,234,0.2)' : 'rgba(52,199,89,0.2)'}; text-align: left;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">${isAI ? '🤖 AI' : '👤 Bạn'}</div>
                    <div>${msg.text}</div>
                </div>
            </div>
        `;
    });
    
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

async function recordConversationReply() {
    if (!recognition && !initSpeechRecognition()) {
        return;
    }
    
    const btn = document.getElementById('recordConversationBtn');
    
    if (isRecording) {
        recognition.stop();
        btn.innerHTML = '<i class="fas fa-microphone"></i> Nói';
        btn.style.background = 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)';
        isRecording = false;
        return;
    }
    
    isRecording = true;
    btn.innerHTML = '<i class="fas fa-stop"></i> Dừng';
    btn.style.background = 'linear-gradient(135deg, #ff9500 0%, #ffb340 100%)';
    
    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        
        conversationHistory.push({
            speaker: 'User',
            text: transcript
        });
        displayConversation();
        
        // Gửi lên server để AI phản hồi
        try {
            const response = await fetch('/api/speaking/conversation-reply', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    role: document.getElementById('conversationRole').value,
                    history: conversationHistory,
                    user_message: transcript
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                conversationHistory.push({
                    speaker: 'AI',
                    text: data.reply
                });
                displayConversation();
                speakText(data.reply);
                
                if (data.feedback) {
                    setTimeout(() => {
                        showNotification('💡 ' + data.feedback, 'info');
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Lỗi kết nối server', 'error');
        }
        
        isRecording = false;
        btn.innerHTML = '<i class="fas fa-microphone"></i> Nói';
        btn.style.background = 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)';
    };
    
    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        showNotification('Lỗi nhận diện giọng nói: ' + event.error, 'error');
        isRecording = false;
        btn.innerHTML = '<i class="fas fa-microphone"></i> Nói';
        btn.style.background = 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100())';
    };
    
    recognition.start();
    showNotification('🎤 Đang nghe...', 'info');
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
    }
}

// ========== LỊCH SỬ VÀ THỐNG KÊ ==========

async function loadSpeakingHistory() {
    try {
        const response = await fetch('/api/speaking/history?limit=10');
        const data = await response.json();
        
        if (data.success && data.history.length > 0) {
            let html = '<div style="display: grid; gap: 10px;">';
            data.history.forEach(item => {
                const date = new Date(item.created_at).toLocaleDateString('vi-VN');
                const time = new Date(item.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
                
                let scoreColor = item.overall_score >= 80 ? '#52c41a' : item.overall_score >= 60 ? '#ff9500' : '#ff3b30';
                let typeIcon = item.practice_type === 'pronunciation' ? '🔊' : item.practice_type === 'topic' ? '💬' : '🗣️';
                
                html += `
                    <div style="padding: 12px 15px; background: rgba(255,255,255,0.05); border-radius: 10px; border-left: 3px solid ${scoreColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 20px;">${typeIcon}</span>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px;">${item.topic || item.practice_type}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${date} ${time}</div>
                                </div>
                            </div>
                            <span style="font-weight: 700; font-size: 16px; color: ${scoreColor};">${item.overall_score || 0}</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            document.getElementById('speakingHistoryList').innerHTML = html;
        } else {
            document.getElementById('speakingHistoryList').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Chưa có bài luyện nói nào</p>';
        }
    } catch (error) {
        console.error('Error loading speaking history:', error);
    }
}

async function loadSpeakingStatistics() {
    try {
        const response = await fetch('/api/speaking/history?limit=100');
        const data = await response.json();
        
        if (data.success && data.history.length > 0) {
            const total = data.history.length;
            const avgScore = Math.round(data.history.reduce((sum, item) => sum + (item.overall_score || 0), 0) / total);
            
            document.getElementById('totalSpeaking').textContent = total;
            document.getElementById('avgSpeakingScore').textContent = avgScore + '/100';
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Load statistics on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSpeakingStatistics();
    loadSpeakingHistory();
});

// Expose functions to window for HTML onclick handlers
window.getNextPronunciationWord = getNextPronunciationWord;
window.playWordAudio = playWordAudio;
window.startPronunciationRecording = startPronunciationRecording;
window.getTopicQuestion = getTopicQuestion;
window.startTopicRecording = startTopicRecording;
window.startConversation = startConversation;
window.recordConversationReply = recordConversationReply;
window.loadSpeakingHistory = loadSpeakingHistory;
window.switchToVocabulary = switchToVocabulary;
