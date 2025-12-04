# English Learning Chatbot

## Cách chạy

### Yêu cầu
- Python 3.8+
- MySQL Server (xampp) 
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
- Lấy key miễn phí: https://makersuite.google.com/app/apikey

5. **Chạy ứng dụng**
```bash
python app.py
```

6. **Truy cập**
```
http://localhost:5000
```

---
