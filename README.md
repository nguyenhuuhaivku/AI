# English Learning Chatbot

## Cách chạy

### Yêu cầu
- Python 3.8+
- MySQL Server (xampp)
- tạo file .env điền các thông tin này
///========
GEMINI_API_KEY=
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=english_learning
///========

sau đó đổi thông tin user password thành của mình và làm các bước sau
### Các bước

1. **Tạo môi trường ảo (Virtual Environment)**
```bash
python -m venv .venv
.venv\Scripts\activate
```

2. **Cài đặt thư viện**
```bash
pip install -r requirements.txt
```

3. **Tạo database MySQL**
```sql
CREATE DATABASE english_learning;
```

4. **Cấu hình API Key**
- Mở file `app.py`
- Thay `YOUR_API_KEY` bằng Gemini API key của bạn

5. **Chạy ứng dụng**
```bash
python app.py
```

6. **Truy cập**
```
http://localhost:5000
```

---



