"""
Database module for English Learning App
Quản lý kết nối và truy vấn MySQL database
"""

import pymysql
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

class Database:
    def __init__(self):
        self.config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', 3306)),
            'user': os.getenv('DB_USER', 'hari'),
            'password': os.getenv('DB_PASSWORD', 'hari'),
            'database': os.getenv('DB_NAME', 'english_learning'),
            'charset': 'utf8mb4',
            'cursorclass': pymysql.cursors.DictCursor
        }
        self.connection = None
    
    def connect(self):
        """Kết nối đến MySQL database"""
        try:
            self.connection = pymysql.connect(**self.config)
            print("✅ Kết nối MySQL thành công!")
            return True
        except pymysql.Error as e:
            print(f"❌ Lỗi kết nối MySQL: {e}")
            return False
    
    def create_database(self):
        """Tạo database nếu chưa tồn tại"""
        try:
            # Kết nối không cần database
            config = self.config.copy()
            db_name = config.pop('database')
            
            conn = pymysql.connect(**config)
            cursor = conn.cursor()
            
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Database '{db_name}' đã được tạo!")
            
            cursor.close()
            conn.close()
            return True
        except pymysql.Error as e:
            print(f"❌ Lỗi tạo database: {e}")
            return False
    
    def create_tables(self):
        """Tạo các bảng trong database"""
        if not self.connection:
            self.connect()
        
        try:
            cursor = self.connection.cursor()
            
            # Bảng users - Lưu thông tin người dùng
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE,
                    level VARCHAR(10) DEFAULT 'A1',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    INDEX idx_level (level)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng chat_history - Lưu lịch sử chat
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    user_message TEXT NOT NULL,
                    bot_response TEXT NOT NULL,
                    mode VARCHAR(50) DEFAULT 'conversation',
                    level VARCHAR(10),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng vocabulary - Lưu từ vựng
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vocabulary (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    word VARCHAR(255) NOT NULL,
                    phonetic VARCHAR(255),
                    meaning_vi TEXT,
                    meaning_en TEXT,
                    example TEXT,
                    level VARCHAR(10),
                    topic VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_word (word, level),
                    INDEX idx_word (word),
                    INDEX idx_level (level),
                    INDEX idx_topic (topic)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng user_vocabulary - Từ vựng đã học của user
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_vocabulary (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    vocabulary_id INT NOT NULL,
                    learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    review_count INT DEFAULT 0,
                    mastery_level TINYINT DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user_vocab (user_id, vocabulary_id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_learned_at (learned_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng grammar_rules - Quy tắc ngữ pháp
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS grammar_rules (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    rule_text TEXT NOT NULL,
                    explanation TEXT,
                    examples TEXT,
                    level VARCHAR(10),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_level (level)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng writing_exercises - Bài tập luyện viết
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS writing_exercises (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    topic VARCHAR(255) NOT NULL,
                    prompt TEXT NOT NULL,
                    user_writing TEXT,
                    ai_feedback TEXT,
                    score INT,
                    grammar_errors TEXT,
                    suggestions TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng listening_exercises - Bài tập luyện nghe
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS listening_exercises (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    sentence TEXT NOT NULL,
                    user_answer TEXT,
                    is_correct BOOLEAN,
                    difficulty VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng vocabulary_quiz - Trắc nghiệm từ vựng
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vocabulary_quiz (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    vocabulary_id INT NOT NULL,
                    question_type VARCHAR(50),
                    user_answer TEXT,
                    is_correct BOOLEAN,
                    time_taken INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng vocabulary_game_scores - Điểm số game từ vựng
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vocabulary_game_scores (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    game_type VARCHAR(50),
                    score INT,
                    correct_answers INT,
                    total_questions INT,
                    time_taken INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Bảng user_progress - Tiến trình học tập
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_progress (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    total_conversations INT DEFAULT 0,
                    vocabulary_count INT DEFAULT 0,
                    grammar_corrections INT DEFAULT 0,
                    practice_completed INT DEFAULT 0,
                    total_points INT DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user_progress (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            self.connection.commit()
            print("✅ Tất cả bảng đã được tạo thành công!")
            cursor.close()
            return True
            
        except pymysql.Error as e:
            print(f"❌ Lỗi tạo bảng: {e}")
            self.connection.rollback()
            return False
    
    def get_or_create_user(self, username="guest", email=None):
        """Lấy hoặc tạo user mới"""
        try:
            cursor = self.connection.cursor()
            
            # Kiểm tra user đã tồn tại
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            
            if user:
                cursor.close()
                return user
            
            # Tạo user mới
            cursor.execute(
                "INSERT INTO users (username, email) VALUES (%s, %s)",
                (username, email)
            )
            self.connection.commit()
            
            user_id = cursor.lastrowid
            
            # Tạo progress cho user
            cursor.execute(
                "INSERT INTO user_progress (user_id) VALUES (%s)",
                (user_id,)
            )
            self.connection.commit()
            
            # Lấy user vừa tạo
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            
            cursor.close()
            return user
            
        except pymysql.Error as e:
            print(f"❌ Lỗi get_or_create_user: {e}")
            return None
    
    def save_chat_message(self, user_id, user_message, bot_response, mode='conversation', level='A1'):
        """Lưu tin nhắn chat"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO chat_history (user_id, user_message, bot_response, mode, level)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, user_message, bot_response, mode, level))
            self.connection.commit()
            cursor.close()
            return True
        except pymysql.Error as e:
            print(f"❌ Lỗi save_chat_message: {e}")
            return False
    
    def save_vocabulary(self, word, phonetic='', meaning_vi='', meaning_en='', example='', level='A1', topic='general'):
        """Lưu từ vựng"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO vocabulary (word, phonetic, meaning_vi, meaning_en, example, level, topic)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    phonetic = VALUES(phonetic),
                    meaning_vi = VALUES(meaning_vi),
                    meaning_en = VALUES(meaning_en),
                    example = VALUES(example)
            """, (word, phonetic, meaning_vi, meaning_en, example, level, topic))
            self.connection.commit()
            vocab_id = cursor.lastrowid
            cursor.close()
            return vocab_id
        except pymysql.Error as e:
            print(f"❌ Lỗi save_vocabulary: {e}")
            return None
    
    def add_user_vocabulary(self, user_id, vocabulary_id):
        """Thêm từ vào danh sách từ đã học của user"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO user_vocabulary (user_id, vocabulary_id)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE review_count = review_count + 1
            """, (user_id, vocabulary_id))
            self.connection.commit()
            cursor.close()
            return True
        except pymysql.Error as e:
            print(f"❌ Lỗi add_user_vocabulary: {e}")
            return False
    
    def get_user_vocabulary(self, user_id, limit=20):
        """Lấy danh sách từ đã học của user"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT v.*, uv.learned_at, uv.review_count, uv.mastery_level
                FROM vocabulary v
                JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
                WHERE uv.user_id = %s
                ORDER BY uv.learned_at DESC
                LIMIT %s
            """, (user_id, limit))
            vocabulary = cursor.fetchall()
            cursor.close()
            return vocabulary
        except pymysql.Error as e:
            print(f"❌ Lỗi get_user_vocabulary: {e}")
            return []
    
    def get_all_vocabulary(self, user_id):
        """Lấy tất cả từ vựng của user (không giới hạn)"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT v.id, v.word, v.phonetic, v.meaning_vi, v.meaning_en, 
                       v.example, v.level, v.topic, v.created_at
                FROM vocabulary v
                JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
                WHERE uv.user_id = %s
                ORDER BY uv.learned_at DESC
            """, (user_id,))
            vocabulary = cursor.fetchall()
            cursor.close()
            return vocabulary
        except pymysql.Error as e:
            print(f"❌ Lỗi get_all_vocabulary: {e}")
            return []
    
    def delete_vocabulary(self, vocab_id):
        """Xóa từ vựng"""
        try:
            cursor = self.connection.cursor()
            # Xóa từ bảng user_vocabulary trước (do foreign key)
            cursor.execute("DELETE FROM user_vocabulary WHERE vocabulary_id = %s", (vocab_id,))
            # Xóa từ bảng vocabulary
            cursor.execute("DELETE FROM vocabulary WHERE id = %s", (vocab_id,))
            self.connection.commit()
            cursor.close()
            return True
        except pymysql.Error as e:
            print(f"❌ Lỗi delete_vocabulary: {e}")
            return False
    
    def get_chat_history(self, user_id, limit=10):
        """Lấy lịch sử chat"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT * FROM chat_history
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_id, limit))
            history = cursor.fetchall()
            cursor.close()
            return history
        except pymysql.Error as e:
            print(f"❌ Lỗi get_chat_history: {e}")
            return []
    
    def update_user_progress(self, user_id, conversations=0, vocabulary=0, corrections=0, practice=0, points=0):
        """Cập nhật tiến trình học tập"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                UPDATE user_progress
                SET total_conversations = total_conversations + %s,
                    vocabulary_count = vocabulary_count + %s,
                    grammar_corrections = grammar_corrections + %s,
                    practice_completed = practice_completed + %s,
                    total_points = total_points + %s
                WHERE user_id = %s
            """, (conversations, vocabulary, corrections, practice, points, user_id))
            self.connection.commit()
            cursor.close()
            return True
        except pymysql.Error as e:
            print(f"❌ Lỗi update_user_progress: {e}")
            return False
    
    def get_user_progress(self, user_id):
        """Lấy tiến trình học tập"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("SELECT * FROM user_progress WHERE user_id = %s", (user_id,))
            progress = cursor.fetchone()
            cursor.close()
            return progress
        except pymysql.Error as e:
            print(f"❌ Lỗi get_user_progress: {e}")
            return None
    
    def close(self):
        """Đóng kết nối"""
        if self.connection:
            self.connection.close()
            print("✅ Đã đóng kết nối MySQL")

# Khởi tạo database
def init_database():
    """Khởi tạo database và tạo bảng"""
    db = Database()
    
    # Tạo database
    db.create_database()
    
    # Kết nối
    if db.connect():
        # Tạo bảng
        db.create_tables()
        return db
    
    return None

if __name__ == "__main__":
    # Test database
    print("🔧 Đang khởi tạo database...")
    db = init_database()
    
    if db:
        # Test tạo user
        user = db.get_or_create_user("test_user", "test@example.com")
        print(f"✅ User: {user}")
        
        # Test lưu vocabulary
        vocab_id = db.save_vocabulary(
            word="hello",
            phonetic="/həˈloʊ/",
            meaning_vi="xin chào",
            meaning_en="a greeting",
            example="Hello, how are you?",
            level="A1",
            topic="greetings"
        )
        print(f"✅ Vocabulary ID: {vocab_id}")
        
        db.close()
        print("\n🎉 Database đã sẵn sàng sử dụng!")
    else:
        print("\n❌ Không thể khởi tạo database!")
