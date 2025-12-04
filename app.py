"""
Chatbot Học Ngoại Ngữ - Language Learning Chatbot
Hỗ trợ học tiếng Anh với AI, Speech-to-Text, Text-to-Speech, đánh giá phát âm
"""

import os
import json
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, session
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import nltk
from gtts import gTTS
import io
import base64
from database import Database, init_database

# Load environment variables
load_dotenv()

# Download NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
    nltk.download('cmudict', quiet=True)
except Exception as e:
    print(f"⚠️ NLTK download warning: {e}")

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-here-change-in-production')
CORS(app)

# Configure Gemini AI
api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyBI23_eFn8ZUZZRIX5iNDWNKBoSI3Roz9I"
if api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

# Khởi tạo database
print("🔧 Đang khởi tạo MySQL database...")
db = init_database()

# Tạo default user nếu chưa có session
def get_current_user():
    """Lấy user hiện tại từ session"""
    if 'user_id' not in session:
        # Tạo user mặc định
        user = db.get_or_create_user("guest_user")
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
        else:
            print("❌ Không thể tạo user!")
            return None
    
    # Verify user_id exists in database
    user_id = session.get('user_id')
    if user_id:
        cursor = db.connection.cursor()
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            print(f"⚠️ User ID {user_id} không tồn tại trong database, tạo lại...")
            session.pop('user_id', None)
            session.pop('username', None)
            cursor.close()
            return get_current_user()  # Recursive call to create new user
        cursor.close()
    
    return user_id

class LanguageLearningBot:
    def __init__(self):
        self.levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
        self.topics = {
            "A1": ["greetings", "family", "food", "colors", "numbers"],
            "A2": ["daily_routine", "hobbies", "shopping", "weather", "travel"],
            "B1": ["work", "education", "health", "technology", "environment"],
            "B2": ["culture", "politics", "economy", "science", "art"],
            "C1": ["philosophy", "literature", "global_issues", "innovation"],
            "C2": ["advanced_topics", "debate", "research", "professional"]
        }
        
    def get_system_prompt(self, user_level, mode="conversation"):
        """Tạo system prompt dựa trên cấp độ và chế độ học"""
        prompts = {
            "conversation": f"""Bạn là một trợ lý AI thân thiện và hữu ích.

NHIỆM VỤ:
- Trả lời câu hỏi một cách rõ ràng, ngắn gọn
- Có thể trả lời bằng tiếng Việt hoặc tiếng Anh
- Giữ thái độ thân thiện, tự nhiên
- Trả lời đúng trọng tâm câu hỏi

Hãy trả lời như một cuộc trò chuyện bình thường, không cần format đặc biệt!""",
            
            "grammar": f"""Bạn là chuyên gia ngữ pháp tiếng Anh.
Phân tích và sửa lỗi ngữ pháp trong câu của học viên (cấp độ {user_level}).

PHÂN TÍCH:
1. Chỉ ra lỗi cụ thể
2. Giải thích tại sao sai
3. Đưa ra câu đúng
4. Ví dụ tương tự

Sử dụng cả tiếng Anh và tiếng Việt để giải thích.""",
            
            "vocabulary": f"""Bạn là trợ lý từ vựng tiếng Anh.
Giúp học viên học từ mới phù hợp với cấp độ {user_level}.

CHI TIẾT TỪ VỰNG:
1. Định nghĩa (tiếng Anh và tiếng Việt)
2. Phiên âm (IPA)
3. Loại từ
4. Ví dụ câu (2-3 câu)
5. Từ đồng nghĩa và trái nghĩa
6. Collocation (từ đi kèm)""",
            
            "pronunciation": f"""Bạn là chuyên gia phát âm tiếng Anh.
Đánh giá phát âm của học viên và đưa ra lời khuyên.

ĐÁNH GIÁ:
1. Các âm phát âm đúng
2. Các âm cần cải thiện
3. Nhấn trọng âm
4. Ngữ điệu
5. Lời khuyên cụ thể để cải thiện"""
        }
        return prompts.get(mode, prompts["conversation"])
    
    def analyze_text(self, text):
        """Phân tích văn bản để trích xuất thông tin"""
        # Phân tích lỗi ngữ pháp
        grammar_errors = self.detect_grammar_errors(text)
        
        # Trích xuất từ vựng mới
        new_vocabulary = self.extract_vocabulary(text)
        
        # Đánh giá độ phức tạp
        complexity = self.assess_complexity(text)
        
        return {
            "grammar_errors": grammar_errors,
            "new_vocabulary": new_vocabulary,
            "complexity": complexity
        }
    
    def detect_grammar_errors(self, text):
        """Phát hiện lỗi ngữ pháp cơ bản"""
        errors = []
        
        # Kiểm tra một số lỗi phổ biến
        patterns = [
            (r'\bi\s+(?!am|was|will|would|can|could|should)', "Chữ 'I' cần viết hoa"),
            (r'\b(he|she|it)\s+(am|are)\b', "Subject-verb agreement: he/she/it + is"),
            (r'\b(I|you|we|they)\s+is\b', "Subject-verb agreement: I/you/we/they + are/am"),
        ]
        
        for pattern, message in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                errors.append(message)
        
        return errors
    
    def extract_vocabulary(self, text):
        """Trích xuất từ vựng từ văn bản"""
        # Tokenize và tag
        tokens = nltk.word_tokenize(text)
        tagged = nltk.pos_tag(tokens)
        
        # Lọc từ vựng quan trọng (danh từ, động từ, tính từ)
        vocabulary = []
        important_pos = ['NN', 'NNS', 'NNP', 'VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ', 'JJ', 'JJR', 'JJS']
        
        for word, pos in tagged:
            if pos in important_pos and len(word) > 3:
                vocabulary.append(word.lower())
        
        return list(set(vocabulary))[:5]  # Trả về tối đa 5 từ
    
    def assess_complexity(self, text):
        """Đánh giá độ phức tạp của văn bản"""
        words = nltk.word_tokenize(text)
        sentences = nltk.sent_tokenize(text)
        
        avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
        avg_sentence_length = len(words) / len(sentences) if sentences else 0
        
        # Đánh giá cấp độ
        if avg_word_length < 4 and avg_sentence_length < 8:
            return "A1-A2"
        elif avg_word_length < 5 and avg_sentence_length < 12:
            return "B1-B2"
        else:
            return "C1-C2"
    
    def get_response(self, user_message, mode="conversation", user_level="A1"):
        """Lấy phản hồi từ Gemini AI"""
        try:
            system_prompt = self.get_system_prompt(user_level, mode)
            
            # Tạo prompt đầy đủ
            full_prompt = f"""{system_prompt}

HỌC VIÊN NÓI: {user_message}

Hãy phản hồi theo format đã định:"""
            
            response = model.generate_content(full_prompt)
            return response.text
            
        except Exception as e:
            return f"⚠️ Lỗi kết nối AI: {str(e)}"
    
    def text_to_speech(self, text, lang='en'):
        """Chuyển văn bản thành giọng nói"""
        try:
            tts = gTTS(text=text, lang=lang, slow=False)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            
            # Convert to base64
            audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
            return audio_base64
        except Exception as e:
            print(f"TTS Error: {e}")
            return None

# Initialize bot
bot = LanguageLearningBot()

@app.route('/')
def index():
    """Trang chủ"""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """API xử lý chat"""
    try:
        user_id = get_current_user()
        
        data = request.json
        user_message = data.get('message', '')
        mode = data.get('mode', 'conversation')
        user_level = data.get('level', 'A1')
        
        if not user_message:
            return jsonify({"error": "Tin nhắn trống"}), 400
        
        # Lấy phản hồi từ AI
        ai_response = bot.get_response(user_message, mode, user_level)
        
        # Lưu chat vào database
        db.save_chat_message(user_id, user_message, ai_response, mode, user_level)
        
        # Không tạo audio nữa (đã bỏ tính năng nghe phát âm trong chat)
        # audio_base64 = bot.text_to_speech(ai_response)
        
        # Cập nhật tiến trình
        db.update_user_progress(
            user_id,
            conversations=1,
            points=5
        )
        
        # Lấy tiến trình hiện tại
        progress = db.get_user_progress(user_id)
        
        return jsonify({
            "response": ai_response,
            # Không trả về audio nữa
            "progress": {
                "total_conversations": progress['total_conversations'] if progress else 0,
                "vocabulary_count": progress['vocabulary_count'] if progress else 0,
                "grammar_corrections": progress['grammar_corrections'] if progress else 0
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """API lấy lịch sử chat"""
    try:
        user_id = get_current_user()
        limit = int(request.args.get('limit', 50))
        
        history = db.get_chat_history(user_id, limit)
        
        return jsonify({
            "history": history,
            "count": len(history)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history_api():
    """API lấy lịch sử chat"""
    try:
        user_id = get_current_user()
        limit = int(request.args.get('limit', 50))
        
        history = db.get_chat_history(user_id, limit)
        
        return jsonify({
            "history": history,
            "count": len(history)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """API chuyển giọng nói thành văn bản"""
    try:
        # Placeholder - cần tích hợp Web Speech API từ frontend
        # hoặc sử dụng Google Speech-to-Text API
        return jsonify({
            "text": "Feature in development",
            "confidence": 0.0
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== TIẾN TRÌNH HỌC TẬP ==========

@app.route('/api/progress', methods=['GET'])
def get_progress():
    """API lấy tiến trình học tập"""
    try:
        user_id = get_current_user()
        progress = db.get_user_progress(user_id)
        
        # Lấy vocabulary đã học
        user_vocab = db.get_user_vocabulary(user_id, limit=100)
        vocab_list = [v['word'] for v in user_vocab]
        
        if progress:
            return jsonify({
                "total_conversations": progress['total_conversations'],
                "vocabulary_learned": vocab_list,
                "grammar_corrections": progress['grammar_corrections'],
                "practice_completed": progress['practice_completed'],
                "total_points": progress['total_points'],
                "level": "A1"  # Có thể lấy từ users table
            })
        
        return jsonify({
            "total_conversations": 0,
            "vocabulary_learned": [],
            "grammar_corrections": 0,
            "practice_completed": 0,
            "total_points": 0,
            "level": "A1"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vocabulary', methods=['GET'])
def get_vocabulary():
    """API lấy danh sách từ vựng đã học (deprecated - use /api/user-vocabulary)"""
    try:
        user_id = get_current_user()
        level = request.args.get('level', 'A1')
        
        # Gợi ý từ vựng theo chủ đề
        topics = bot.topics.get(level, bot.topics['A1'])
        
        # Lấy từ vựng đã học từ database
        user_vocab = db.get_user_vocabulary(user_id, limit=20)
        vocab_list = [v['word'] for v in user_vocab]
        
        return jsonify({
            "level": level,
            "topics": topics,
            "learned_vocabulary": vocab_list
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/user-vocabulary', methods=['GET'])
def get_user_vocabulary():
    """API lấy danh sách từ vựng của user"""
    try:
        user_id = get_current_user()
        vocabulary = db.get_all_vocabulary(user_id)
        
        return jsonify({
            "vocabulary": vocabulary,
            "count": len(vocabulary)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-vocabulary', methods=['POST'])
def add_vocabulary():
    """API thêm từ vựng mới với AI hỗ trợ đầy đủ"""
    try:
        user_id = get_current_user()
        data = request.json
        
        word = data.get('word', '').strip()
        user_meaning = data.get('meaning_vi', '').strip()
        
        if not word:
            return jsonify({"success": False, "error": "Vui lòng nhập từ tiếng Anh"}), 400
        
        if not user_meaning:
            return jsonify({"success": False, "error": "Vui lòng nhập nghĩa tiếng Việt"}), 400
        
        # LUÔN LUÔN gọi AI để:
        # 1. Kiểm tra nghĩa có đúng không
        # 2. Tự động thêm phiên âm
        # 3. Tự động tạo ví dụ câu
        # 4. Phân loại lĩnh vực
        
        prompt = f"""Phân tích từ tiếng Anh mà người dùng nhập: "{word}"
Người dùng cho nghĩa là: "{user_meaning}"

QUAN TRỌNG - Nhiệm vụ theo thứ tự:
1. KIỂM TRA CHÍNH TẢ: Từ "{word}" có viết ĐÚNG chính tả không?
   - Nếu SAI (VD: "hellooo", "computor", "tecnology") → Sửa thành từ ĐÚNG
   - Nếu ĐÚNG → Giữ nguyên

2. KIỂM TRA NGHĨA: Nghĩa "{user_meaning}" có ĐÚNG với từ không?
   - So sánh với nghĩa thật của từ
   - Nếu SAI → Đưa ra nghĩa ĐÚNG

3. PHIÊN ÂM IPA: Cung cấp phiên âm chuẩn

4. VÍ DỤ CÂU: Tạo 1 câu ví dụ TỰ NHIÊN, THỰC TẾ

5. PHÂN LOẠI: Chọn 1 lĩnh vực phù hợp nhất
   (technology, food, business, education, health, travel, sports, music, art, science, nature, entertainment, general)

Trả về JSON chính xác (KHÔNG thêm text nào khác):
{{
    "is_spelling_correct": true/false,
    "corrected_word": "từ đúng (nếu người dùng viết sai)",
    "is_meaning_correct": true/false,
    "corrected_meaning": "nghĩa đúng tiếng Việt",
    "phonetic": "/phiên âm IPA/",
    "example": "Câu ví dụ với từ {word}",
    "topic": "lĩnh vực"
}}

VÍ DỤ:
- Input: "hellooo" + "tạm biệt" 
  → is_spelling_correct: false, corrected_word: "hello", is_meaning_correct: false, corrected_meaning: "xin chào"
  
- Input: "computer" + "máy tính"
  → is_spelling_correct: true, corrected_word: "computer", is_meaning_correct: true, corrected_meaning: "máy tính"
"""

        try:
            print(f"🤖 Đang gọi AI để phân tích từ: {word}")
            response = model.generate_content(prompt)
            ai_text = response.text.strip()
            print(f"✅ AI đã phản hồi thành công")
            
            # Parse JSON từ response
            import json
            import re
            
            # Loại bỏ markdown code block nếu có
            ai_text = re.sub(r'```json\s*', '', ai_text)
            ai_text = re.sub(r'```\s*', '', ai_text)
            
            json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
            if json_match:
                ai_data = json.loads(json_match.group())
                
                # Lấy thông tin từ AI
                is_spelling_correct = ai_data.get('is_spelling_correct', True)
                corrected_word = ai_data.get('corrected_word', word)
                is_meaning_correct = ai_data.get('is_meaning_correct', True)
                corrected_meaning = ai_data.get('corrected_meaning', user_meaning)
                phonetic = ai_data.get('phonetic', '')
                example = ai_data.get('example', '')
                topic = ai_data.get('topic', 'general').lower()
                
                # Sử dụng từ đã sửa nếu người dùng viết sai
                final_word = corrected_word if not is_spelling_correct else word
                
                # Sử dụng nghĩa đã sửa nếu người dùng sai
                final_meaning = corrected_meaning if not is_meaning_correct else user_meaning
                
                # Tạo thông báo sửa lỗi
                correction_note = ""
                if not is_spelling_correct and not is_meaning_correct:
                    correction_note = f"⚠️ AI đã sửa: '{word}' → '{corrected_word}' và nghĩa '{user_meaning}' → '{corrected_meaning}'"
                elif not is_spelling_correct:
                    correction_note = f"⚠️ AI đã sửa chính tả: '{word}' → '{corrected_word}'"
                elif not is_meaning_correct:
                    correction_note = f"⚠️ AI đã sửa nghĩa: '{user_meaning}' → '{corrected_meaning}'"
                
            else:
                # Fallback nếu không parse được JSON
                final_word = word
                final_meaning = user_meaning
                phonetic = ""
                example = f"I use {word} every day."
                topic = 'general'
                correction_note = "⚠️ AI không phản hồi đúng định dạng, sử dụng thông tin mặc định"
                
        except Exception as e:
            print(f"❌ AI error: {e}")
            # Fallback khi lỗi AI
            final_word = word
            final_meaning = user_meaning
            phonetic = ""
            example = f"I use {word} every day."
            topic = 'general'
            correction_note = f"⚠️ Lỗi AI: {str(e)}"
        
        # Lưu vào database với từ và nghĩa đã được AI sửa
        vocab_id = db.save_vocabulary(
            word=final_word,
            phonetic=phonetic,
            meaning_vi=final_meaning,
            meaning_en='',
            example=example,
            level='custom',
            topic=topic
        )
        
        if vocab_id:
            # Thêm vào danh sách từ của user
            db.add_user_vocabulary(user_id, vocab_id)
            
            return jsonify({
                "success": True,
                "vocab_id": vocab_id,
                "word": final_word,
                "original_word": word,
                "phonetic": phonetic,
                "meaning_vi": final_meaning,
                "original_meaning": user_meaning,
                "example": example,
                "topic": topic,
                "correction_note": correction_note,
                "message": "Đã thêm từ vựng thành công"
            })
        else:
            return jsonify({"success": False, "error": "Không thể lưu từ vựng"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/delete-vocabulary/<int:vocab_id>', methods=['DELETE'])
def delete_vocabulary(vocab_id):
    """API xóa từ vựng"""
    try:
        user_id = get_current_user()
        success = db.delete_vocabulary(vocab_id)
        
        return jsonify({
            "success": success,
            "message": "Đã xóa từ vựng" if success else "Không thể xóa từ vựng"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/practice-sentence', methods=['GET'])
def get_practice_sentence():
    """API lấy câu luyện tập (deprecated - được thay thế bởi các API mới)"""
    level = request.args.get('level', 'A1')
    topic = request.args.get('topic', 'general')
    
    # Tạo câu luyện tập từ AI
    prompt = f"""Tạo 1 câu tiếng Anh để học viên cấp độ {level} luyện tập.
Chủ đề: {topic}
Format:
Câu tiếng Anh
Dịch tiếng Việt
Gợi ý phát âm"""
    
    try:
        response = model.generate_content(prompt)
        return jsonify({
            "sentence": response.text,
            "level": level,
            "topic": topic
        })
    except Exception as e:
        return jsonify({
            "sentence": "Hello, how are you today?\nXin chào, hôm nay bạn thế nào?\n/həˈloʊ, haʊ ɑːr juː təˈdeɪ/",
            "level": level,
            "topic": topic
        })

# ========== LUYỆN NGHE (LISTENING PRACTICE) ==========

@app.route('/api/listening/get-sentence', methods=['GET'])
def get_listening_sentence():
    """API lấy câu để luyện nghe"""
    try:
        difficulty = request.args.get('difficulty', 'easy')
        
        difficulty_map = {
            'easy': 'Câu đơn giản, 5-7 từ, từ vựng cơ bản',
            'medium': 'Câu phức tạp hơn, 8-12 từ, có từ nối',
            'hard': 'Câu dài, 13-20 từ, cấu trúc phức tạp'
        }
        
        prompt = f"""Tạo 1 câu tiếng Anh để luyện nghe.
Độ khó: {difficulty_map.get(difficulty, difficulty_map['easy'])}

YÊU CẦU:
- Câu có ý nghĩa thực tế
- Phù hợp để đọc rõ ràng
- Không quá dài

CHỈ TRẢ VỀ CÂU TIẾNG ANH, không thêm gì khác."""

        response = model.generate_content(prompt)
        sentence = response.text.strip()
        
        return jsonify({
            "success": True,
            "sentence": sentence,
            "difficulty": difficulty
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/listening/check-answer', methods=['POST'])
def check_listening_answer():
    """API kiểm tra đáp án luyện nghe"""
    try:
        user_id = get_current_user()
        data = request.json
        
        original_sentence = data.get('sentence', '').strip()
        user_answer = data.get('answer', '').strip()
        difficulty = data.get('difficulty', 'easy')
        
        if not user_answer:
            return jsonify({"success": False, "error": "Vui lòng nhập câu trả lời"}), 400
        
        # So sánh câu (bỏ qua dấu câu và viết hoa)
        import string
        original_clean = original_sentence.lower().translate(str.maketrans('', '', string.punctuation))
        answer_clean = user_answer.lower().translate(str.maketrans('', '', string.punctuation))
        
        # Tính độ tương đồng
        from difflib import SequenceMatcher
        similarity = SequenceMatcher(None, original_clean, answer_clean).ratio()
        is_correct = similarity >= 0.85
        
        # Phân tích lỗi bằng AI nếu không chính xác 100%
        ai_analysis = ""
        if similarity < 0.95:
            analysis_prompt = f"""Phân tích lỗi nghe và viết tiếng Anh của học viên:

CÂU GỐC: {original_sentence}
CÂU HỌC VIÊN VIẾT: {user_answer}

Hãy phân tích CHI TIẾT:
1. 🔍 LỖI CỤ THỂ: Chỉ ra từng từ/cụm từ sai (nếu có)
2. 📝 LÝ DO: Giải thích tại sao học viên viết sai (nhầm lẫn âm thanh, từ vựng, ngữ pháp)
3. 💡 CÁCH SỬA: Hướng dẫn cách viết đúng và phát âm
4. 🎯 GỢI Ý: Lời khuyên để cải thiện kỹ năng nghe

Trả lời ngắn gọn, súc tích, BẰNG TIẾNG VIỆT."""

            try:
                ai_response = model.generate_content(analysis_prompt)
                ai_analysis = ai_response.text
            except Exception as e:
                print(f"AI analysis error: {e}")
                ai_analysis = "Không thể phân tích lỗi lúc này."
        
        # Feedback chi tiết
        if similarity >= 0.95:
            feedback = "🎉 Hoàn hảo! Bạn nghe và viết chính xác 100%!"
        elif similarity >= 0.85:
            feedback = f"✅ Rất tốt! Độ chính xác: {int(similarity*100)}%"
        elif similarity >= 0.70:
            feedback = f"👍 Khá tốt! Độ chính xác: {int(similarity*100)}%. Hãy nghe kỹ hơn!"
        elif similarity >= 0.50:
            feedback = f"😊 Cần cải thiện! Độ chính xác: {int(similarity*100)}%. Nghe lại nhiều lần!"
        else:
            feedback = f"💪 Hãy thử lại! Độ chính xác: {int(similarity*100)}%. Nghe từng từ một!"
        
        # Lưu vào database
        cursor = db.connection.cursor()
        cursor.execute("""
            INSERT INTO listening_exercises 
            (user_id, sentence, user_answer, is_correct, difficulty)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, original_sentence, user_answer, is_correct, difficulty))
        db.connection.commit()
        cursor.close()
        
        return jsonify({
            "success": True,
            "is_correct": is_correct,
            "similarity": round(similarity * 100, 1),
            "feedback": feedback,
            "ai_analysis": ai_analysis,
            "original_sentence": original_sentence,
            "user_answer": user_answer
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ========== TRẮC NGHIỆM TỪ VỰNG (VOCABULARY QUIZ) ==========

@app.route('/api/quiz/generate', methods=['GET'])
def generate_vocabulary_quiz():
    """API tạo câu hỏi trắc nghiệm - từ vocabulary đã học HOẶC AI tạo theo chủ đề"""
    try:
        user_id = get_current_user()
        count = int(request.args.get('count', 10))
        topic = request.args.get('topic', 'my_vocabulary')
        
        # Nếu chọn từ vựng đã học của tôi
        if topic == 'my_vocabulary':
            # Lấy từ vựng đã học
            vocabulary = db.get_all_vocabulary(user_id)
            
            if len(vocabulary) < 4:
                return jsonify({
                    "success": False, 
                    "error": "Bạn cần học ít nhất 4 từ vựng trước khi làm trắc nghiệm từ vựng đã học"
                }), 400
            
            import random
            
            # Chọn ngẫu nhiên các từ để tạo câu hỏi
            selected_vocab = random.sample(vocabulary, min(count, len(vocabulary)))
            
            questions = []
            for vocab in selected_vocab:
                # Tạo 3 đáp án sai từ các từ khác
                wrong_options = random.sample(
                    [v for v in vocabulary if v['id'] != vocab['id']], 
                    min(3, len(vocabulary) - 1)
                )
                
                # Tạo câu hỏi - hiển thị từ tiếng Anh, đáp án là nghĩa tiếng Việt
                question = {
                    "id": vocab['id'],
                    "question": vocab['word'],  # Từ tiếng Anh
                    "word": vocab['word'],
                    "options": [
                        {"text": vocab['meaning_vi'], "is_correct": True},
                        {"text": wrong_options[0]['meaning_vi'] if len(wrong_options) > 0 else "Đáp án sai", "is_correct": False},
                        {"text": wrong_options[1]['meaning_vi'] if len(wrong_options) > 1 else "Đáp án sai", "is_correct": False},
                        {"text": wrong_options[2]['meaning_vi'] if len(wrong_options) > 2 else "Đáp án sai", "is_correct": False}
                    ],
                    "phonetic": vocab.get('phonetic', ''),
                    "example": vocab.get('example', '')
                }
                
                # Trộn đáp án
                import random
                random.shuffle(question['options'])
                questions.append(question)
        
        else:
            # AI tạo từ vựng theo chủ đề
            topic_names = {
                'technology': 'Technology (Công nghệ)',
                'food': 'Food (Đồ ăn)',
                'business': 'Business (Kinh doanh)',
                'education': 'Education (Giáo dục)',
                'health': 'Health (Sức khỏe)',
                'travel': 'Travel (Du lịch)',
                'sports': 'Sports (Thể thao)',
                'music': 'Music (Âm nhạc)',
                'nature': 'Nature (Thiên nhiên)',
                'animals': 'Animals (Động vật)',
                'weather': 'Weather (Thời tiết)',
                'family': 'Family (Gia đình)',
                'emotions': 'Emotions (Cảm xúc)',
                'general': 'General (Tổng hợp)'
            }
            
            topic_display = topic_names.get(topic, topic)
            
            prompt = f"""Tạo {count} câu hỏi trắc nghiệm từ vựng tiếng Anh về chủ đề: {topic_display}

YÊU CẦU:
- Mỗi câu hỏi có 1 từ tiếng Anh và 4 đáp án nghĩa tiếng Việt
- Chỉ có 1 đáp án đúng, 3 đáp án sai (phải liên quan để gây nhiễu)
- Từ vựng phổ biến, thực tế, dễ hiểu
- Đa dạng từ loại (danh từ, động từ, tính từ)

Trả về JSON array CHÍNH XÁC theo format (KHÔNG thêm text nào khác):
[
  {{
    "word": "từ tiếng Anh",
    "correct_answer": "nghĩa đúng tiếng Việt",
    "wrong_answers": ["sai 1", "sai 2", "sai 3"],
    "phonetic": "/phiên âm/",
    "example": "Câu ví dụ"
  }}
]"""

            try:
                print(f"🤖 AI đang tạo {count} câu hỏi về chủ đề: {topic}")
                response = model.generate_content(prompt)
                ai_text = response.text.strip()
                print(f"✅ AI đã phản hồi")
                
                # Parse JSON
                import json
                import re
                
                # Loại bỏ markdown code block
                ai_text = re.sub(r'```json\s*', '', ai_text)
                ai_text = re.sub(r'```\s*', '', ai_text)
                
                # Tìm JSON array
                json_match = re.search(r'\[.*\]', ai_text, re.DOTALL)
                if json_match:
                    vocab_list = json.loads(json_match.group())
                    
                    questions = []
                    for idx, item in enumerate(vocab_list):
                        options = [
                            {"text": item['correct_answer'], "is_correct": True},
                            {"text": item['wrong_answers'][0], "is_correct": False},
                            {"text": item['wrong_answers'][1], "is_correct": False},
                            {"text": item['wrong_answers'][2], "is_correct": False}
                        ]
                        
                        # Trộn đáp án
                        import random
                        random.shuffle(options)
                        
                        question = {
                            "id": f"ai_{topic}_{idx}",
                            "question": item['word'],  # Từ tiếng Anh
                            "word": item['word'],
                            "options": options,
                            "phonetic": item.get('phonetic', ''),
                            "example": item.get('example', '')
                        }
                        questions.append(question)
                else:
                    return jsonify({
                        "success": False,
                        "error": "AI không trả về đúng định dạng. Vui lòng thử lại!"
                    }), 400
                    
            except Exception as e:
                print(f"❌ AI error: {e}")
                return jsonify({
                    "success": False,
                    "error": f"Lỗi AI: {str(e)}"
                }), 500
        
        return jsonify({
            "success": True,
            "questions": questions,
            "total": len(questions)
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/quiz/submit', methods=['POST'])
def submit_quiz():
    """API nộp bài trắc nghiệm"""
    try:
        user_id = get_current_user()
        data = request.json
        
        answers = data.get('answers', [])  # [{vocab_id, user_answer, is_correct, time_taken}]
        
        if not answers:
            return jsonify({"success": False, "error": "Không có đáp án"}), 400
        
        # Lưu kết quả từng câu
        cursor = db.connection.cursor()
        for answer in answers:
            cursor.execute("""
                INSERT INTO vocabulary_quiz 
                (user_id, vocabulary_id, question_type, user_answer, is_correct, time_taken)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                user_id, 
                answer['vocab_id'], 
                'multiple_choice',
                answer['user_answer'],
                answer['is_correct'],
                answer.get('time_taken', 0)
            ))
        
        db.connection.commit()
        cursor.close()
        
        # Tính điểm
        correct_count = sum(1 for a in answers if a['is_correct'])
        total_count = len(answers)
        score = int((correct_count / total_count) * 100) if total_count > 0 else 0
        
        return jsonify({
            "success": True,
            "score": score,
            "correct": correct_count,
            "total": total_count,
            "percentage": score
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ========== GAME TỪ VỰNG (VOCABULARY GAME) ==========

@app.route('/api/game/start', methods=['GET'])
def start_vocabulary_game():
    """API bắt đầu game ghép từ - từ vocabulary đã học HOẶC AI tạo theo chủ đề"""
    try:
        user_id = get_current_user()
        count = int(request.args.get('count', 6))
        topic = request.args.get('topic', 'my_vocabulary')
        
        # Nếu chọn từ vựng đã học
        if topic == 'my_vocabulary':
            # Lấy từ vựng đã học
            vocabulary = db.get_all_vocabulary(user_id)
            
            if len(vocabulary) < 4:
                return jsonify({
                    "success": False,
                    "error": "Bạn cần học ít nhất 4 từ vựng để chơi game với từ đã học"
                }), 400
            
            import random
            selected = random.sample(vocabulary, min(count, len(vocabulary)))
            
            # Tạo cards
            cards = []
            for vocab in selected:
                cards.append({
                    "id": f"word_{vocab['id']}",
                    "type": "word",
                    "text": vocab['word'],
                    "match_id": vocab['id']
                })
                cards.append({
                    "id": f"meaning_{vocab['id']}",
                    "type": "meaning",
                    "text": vocab['meaning_vi'],
                    "match_id": vocab['id']
                })
            
            # Trộn cards
            random.shuffle(cards)
            
        else:
            # AI tạo từ vựng theo chủ đề
            topic_names = {
                'technology': 'Technology (Công nghệ)',
                'food': 'Food (Đồ ăn)',
                'business': 'Business (Kinh doanh)',
                'education': 'Education (Giáo dục)',
                'health': 'Health (Sức khỏe)',
                'travel': 'Travel (Du lịch)',
                'sports': 'Sports (Thể thao)',
                'music': 'Music (Âm nhạc)',
                'nature': 'Nature (Thiên nhiên)',
                'animals': 'Animals (Động vật)',
                'weather': 'Weather (Thời tiết)',
                'family': 'Family (Gia đình)',
                'emotions': 'Emotions (Cảm xúc)',
                'general': 'General (Tổng hợp)'
            }
            
            topic_display = topic_names.get(topic, topic)
            
            prompt = f"""Tạo {count} từ vựng tiếng Anh đơn giản về chủ đề: {topic_display}

YÊU CẦU:
- Từ vựng phổ biến, dễ hiểu, thực tế
- Nghĩa tiếng Việt ngắn gọn, dễ nhớ
- Đa dạng từ loại
- Phù hợp để chơi game ghép từ

Trả về JSON array CHÍNH XÁC (KHÔNG thêm text nào khác):
[
  {{
    "word": "từ tiếng Anh",
    "meaning": "nghĩa tiếng Việt"
  }}
]"""

            try:
                print(f"🎮 AI đang tạo {count} từ vựng game về chủ đề: {topic}")
                response = model.generate_content(prompt)
                ai_text = response.text.strip()
                print(f"✅ AI đã phản hồi")
                
                # Parse JSON
                import json
                import re
                
                # Loại bỏ markdown
                ai_text = re.sub(r'```json\s*', '', ai_text)
                ai_text = re.sub(r'```\s*', '', ai_text)
                
                # Tìm JSON array
                json_match = re.search(r'\[.*\]', ai_text, re.DOTALL)
                if json_match:
                    vocab_list = json.loads(json_match.group())
                    
                    # Tạo cards từ AI vocabulary
                    cards = []
                    for idx, item in enumerate(vocab_list):
                        match_id = f"ai_{topic}_{idx}"
                        cards.append({
                            "id": f"word_{match_id}",
                            "type": "word",
                            "text": item['word'],
                            "match_id": match_id
                        })
                        cards.append({
                            "id": f"meaning_{match_id}",
                            "type": "meaning",
                            "text": item['meaning'],
                            "match_id": match_id
                        })
                    
                    # Trộn cards
                    import random
                    random.shuffle(cards)
                    
                else:
                    return jsonify({
                        "success": False,
                        "error": "AI không trả về đúng định dạng. Vui lòng thử lại!"
                    }), 400
                    
            except Exception as e:
                print(f"❌ AI error: {e}")
                return jsonify({
                    "success": False,
                    "error": f"Lỗi AI: {str(e)}"
                }), 500
        
        return jsonify({
            "success": True,
            "cards": cards,
            "total_pairs": count
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/game/save-score', methods=['POST'])
def save_game_score():
    """API lưu điểm game"""
    try:
        user_id = get_current_user()
        data = request.json
        
        game_type = data.get('game_type', 'matching')
        score = data.get('score', 0)
        correct_answers = data.get('correct_answers', 0)
        total_questions = data.get('total_questions', 0)
        time_taken = data.get('time_taken', 0)
        
        cursor = db.connection.cursor()
        cursor.execute("""
            INSERT INTO vocabulary_game_scores 
            (user_id, game_type, score, correct_answers, total_questions, time_taken)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, game_type, score, correct_answers, total_questions, time_taken))
        
        db.connection.commit()
        cursor.close()
        
        return jsonify({
            "success": True,
            "message": "Đã lưu điểm thành công!"
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/game/leaderboard', methods=['GET'])
def get_game_leaderboard():
    """API lấy bảng xếp hạng game"""
    try:
        user_id = get_current_user()
        game_type = request.args.get('game_type', 'matching')
        
        cursor = db.connection.cursor()
        cursor.execute("""
            SELECT score, correct_answers, total_questions, time_taken, created_at
            FROM vocabulary_game_scores
            WHERE user_id = %s AND game_type = %s
            ORDER BY score DESC, time_taken ASC
            LIMIT 10
        """, (user_id, game_type))
        
        scores = cursor.fetchall()
        cursor.close()
        
        return jsonify({
            "success": True,
            "scores": scores
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    if db:
        print("🚀 Khởi động Language Learning Chatbot...")
        print(f"📊 MySQL Database: Connected")
        print(f"🌐 Truy cập: http://localhost:5000")
        app.run(debug=True, host='0.0.0.0', port=5000)
    else:
        print("❌ Không thể kết nối database. Vui lòng kiểm tra cấu hình MySQL!")
