# 🎓 TOEIC Web Assessment & Comprehensive Learning System

[![Deploy to GitHub Pages](https://github.com/xhoang0509/toeic-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/xhoang0509/toeic-web/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Static HTML5](https://img.shields.io/badge/Platform-Static%20HTML5-brightgreen.svg)](#)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-orange.svg)](https://xhoang0509.github.io/toeic-web/)

Hệ thống thi thử và luyện thi tiếng Anh **TOEIC Online** đa phương tiện (Audio + Hình ảnh + Trắc nghiệm), tích hợp **Bắt buộc nhập tên thí sinh**, **Bảng Xếp Hạng thời gian thực (Leaderboard)**, **Luyện tập theo từng Part**, **Audio Controller nâng cao**, **Phân tích kỹ năng Radar Chart**, **Sổ tay câu sai**, **Chứng chỉ hoàn thành PDF**, và **Backend Cloudflare Workers + D1 chấm điểm phía server**.

---

## 🌟 Trọn Bộ 10 Tính Năng Đã Triển Khai

### 1. 👤 Bắt Buộc Nhập Tên Thí Sinh Trước Khi Thi (Required Name Onboarding)
- **Xác thực thí sinh**: Màn hình đăng ký bắt buộc xuất hiện khi truy cập (Họ và tên, Email/Mã học viên, Mục tiêu điểm số: 500+, 650+, 800+, 900+).
- **Khóa tương tác đề thi**: Giao diện bài thi được làm mờ (backdrop blur) và khóa hoàn toàn cho tới khi thí sinh đăng ký hợp lệ.
- **Tự động bắt đầu**: Hệ thống lưu thông tin vào `localStorage`, hiển thị tên trên thanh Top Bar và chuyển thẳng vào đề thi.

### 2. 🏆 Bảng Xếp Hạng Thật Trên Cloudflare D1 (Leaderboard & Multi-tier Ranking)
- **Thuật toán xếp hạng đa tiêu chí**:
  1. Số câu đúng / Tỉ lệ `%` cao hơn xếp trước.
  2. Bằng điểm ➔ Thí sinh làm bài **nhanh hơn (thời gian ngắn hơn)** xếp trước.
  3. Bằng thời gian ➔ Thí sinh nộp bài sớm hơn xếp trước.
- **Huy chương vinh danh**: Top 3 nổi bật (🥇 Vàng, 🥈 Bạc, 🥉 Đồng).
- **Quy đổi điểm TOEIC (~/990)**: Tự động quy đổi sang thang điểm TOEIC quốc tế (10 - 990 điểm, làm tròn bội số 5) chuẩn ETS.
- **Dữ liệu thật, dùng chung mọi thiết bị**: Mỗi lượt nộp bài được ghi vào bảng `results` trên Cloudflare D1 và xếp hạng bằng truy vấn SQL (mỗi thí sinh chỉ lấy lượt thi tốt nhất). Không còn dữ liệu mockup trong `localStorage`.
- **Thống kê & Bộ lọc**: Tổng lượt thi, Điểm cao nhất, Điểm trung bình (tính trên toàn bộ dữ liệu server), Tìm kiếm theo tên.
- **Tự khôi phục khi mất mạng**: Nếu không gọi được API, trang hiển thị lịch sử thi đã lưu trên thiết bị kèm cảnh báo rõ ràng.
- **Xuất CSV Báo cáo (`📥 Xuất CSV`)**: Xuất toàn bộ bảng điểm ra file Excel/CSV chuẩn UTF-8.

### 3. 📚 Chế Độ Luyện Thi Theo Từng Part (Part-by-Part Practice Mode)
- Thí sinh có thể chọn ôn luyện chuyên sâu từng phần riêng lẻ:
  - **Part 1**: Mô tả tranh (Photographs) - 12 câu
  - **Part 2**: Hỏi & Đáp (Question-Response) - 49 câu
  - **Part 3**: Đoạn hội thoại (Short Conversations) - 15 câu
  - **Part 4**: Bài nói ngắn (Short Talks) - 15 câu
  - **Part 5**: Điền câu (Incomplete Sentences) - 60 câu
  - **Part 6**: Điền đoạn văn (Text Completion) - 24 câu (8 đoạn văn × 3 chỗ trống, mỗi chỗ trống là 1 câu hỏi)
  - **Part 7**: Đọc hiểu (Reading Comprehension) - 24 câu

  Tổng cộng **199 câu hỏi** (Listening 91 • Reading 108).
- Kiểm tra đáp án ngay lập tức kèm giải thích và nút xem transcript.

### 4. 🎧 Audio Controller Nâng Cao (Smart Audio Widget)
- Tự động hook vào toàn bộ audio bài nghe trên trang:
  - **Tốc độ phát linh hoạt**: `0.8x` (chậm), `1.0x` (chuẩn), `1.2x` (nhanh), `1.5x` (rất nhanh).
  - **Tua nhanh / lùi lại**: `⏪ -5s` và `⏩ +5s` để nghe lại câu chưa rõ.
  - **Lặp đoạn (Loop A-B)**: Bật/Tắt chế độ lặp lại bài nghe để luyện nghe chép chính tả (Dictation).

### 5. 💡 Transcript & Lời Giải Thích Chi Tiết (Side Drawer)
- Ngăn trượt tiện lợi từ cạnh phải:
  - **Transcript bài nghe**: Lời thoại tiếng Anh đầy đủ kèm trình phát audio nghe lại.
  - **Lời giải thích chi tiết**: Phân tích ngữ pháp, từ vựng và lý do chọn đáp án đúng.
  - **Mẹo làm bài (Exam Strategy)**: Tránh các bẫy thường gặp của từng dạng bài.

### 6. 📊 Phân Tích Năng Lực Radar Chart & Xếp Loại CEFR
- **Biểu đồ Radar SVG trực quan**: Đánh giá sự đồng đều giữa 7 kỹ năng TOEIC.
- **Thanh đo % năng lực chi tiết**: Phân tích từng Part 1 đến Part 7.
- **Khung năng lực quốc tế CEFR**: Tự động xếp hạng trình độ từ A1 đến C1+ (A1, A2, B1, B2, C1, C1+ Master).

### 7. 📕 Sổ Tay Câu Sai & Flashcards (Mistake Notebook)
- Tự động lưu toàn bộ các câu thí sinh làm sai vào `localStorage`.
- Thí sinh có thể mở Sổ Tay Câu Sai để:
  - Xem lại đề bài, đáp án đúng và lời giải thích.
  - Luyện tập làm lại các câu đã sai.
  - Đánh dấu **"Đã hiểu / Xóa khỏi sổ tay"** khi đã nắm vững kiến thức.
  - Badge đếm số câu sai cập nhật theo thời gian thực trên thanh Top Bar.

### 8. 🎓 Chứng Chỉ Hoàn Thành Bài Thi (Official Certificate of Completion)
- Mẫu chứng chỉ trang trọng với khung viền kép vàng hoàng gia (Gold double border), hoa văn chìm:
  - Tên thí sinh in hoa trang trọng.
  - Điểm Listening, Điểm Reading và Tổng điểm TOEIC (~/990).
  - Ngày cấp & Mã số xác thực chứng chỉ (`TOEIC-2026-XXXX`).
  - Nút **"🖨️ In / Lưu PDF"** hỗ trợ print stylesheet chuẩn A4.

### 9. ☁️ Backend Cloudflare Workers + D1 (Chấm Điểm Phía Server)
- **Chấm điểm 100% trên server**: Đáp án đúng và lời giải thích chỉ nằm trong database D1 — bundle JavaScript của trang web **không còn chứa đáp án**, thí sinh không thể mở DevTools để xem trước.
- **Zero-config deploy**: Không cần cấp quyền thủ công như Google Apps Script, không bị lỗi CORS preflight, quota miễn phí 100k request/ngày.
- **Trang Quản trị**: Đăng nhập bằng mật khẩu băm SHA-256 → nhận session token HMAC có hạn 8 giờ; quản lý thời gian thi, banner thông báo, bật/tắt Bảng Xếp Hạng và khóa (BAN) thí sinh theo email.
- Chi tiết API, schema và quy trình vận hành: [docs/CLOUDFLARE_BACKEND.md](docs/CLOUDFLARE_BACKEND.md).

### 10. 👁️ Chế Độ Bật / Tắt Đáp Án (Answer Visibility Toggle)
- Cho phép người học chuyển đổi linh hoạt:
  - **Đáp án: BẬT** ➔ Chế độ Ôn tập (Study Mode), hiển thị đáp án đúng dưới câu hỏi.
  - **Đáp án: TẮT** ➔ Chế độ Thi thử (Real Test Mode), ẩn đáp án để làm bài nghiêm túc.

---

## 📁 Cấu Trúc Dự Án

```
toeic-web/
├── .github/workflows/deploy.yml   # CI: test → build Astro → deploy GitHub Pages
├── cloudflare/                    # Backend Cloudflare Workers + D1
│   ├── src/index.ts               # API: chấm điểm, bảng xếp hạng, cấu hình, quản trị
│   ├── migrations/0001_init.sql    # Schema 4 bảng: questions / results / users / config
│   ├── migrations/0002_seed_questions.sql  # Seed 199 câu hỏi (tự sinh)
│   └── wrangler.toml              # Cấu hình Worker + binding D1
├── scripts/
│   ├── normalize-questions.mjs    # Chuẩn hóa đề: tách Part 6, tạo bản public không đáp án
│   ├── build-seed-sql.mjs         # Sinh SQL seed cho D1
│   └── extract_quiz.js            # Trích xuất đề gốc từ nhị phân iSpring
├── src/
│   ├── components/react/          # ExamRunner, PracticeRunner, LeaderboardTable, AdminDashboard…
│   ├── data/
│   │   ├── questions.json         # Đề gốc trích xuất (nguồn sự thật)
│   │   ├── questions.full.json    # 199 câu CÓ đáp án — chỉ dùng để seed D1
│   │   └── questions.public.json  # 199 câu KHÔNG đáp án — build vào trang web
│   ├── lib/                       # api, admin, storage, shuffle, score, assets
│   ├── pages/                     # index, exam, practice/[part], leaderboard, mistakes, admin
│   └── test/                      # 62 unit test + integration test với Worker thật
├── data/quiz1/                    # Audio (.mp3), hình ảnh, font của đề thi
├── docs/CLOUDFLARE_BACKEND.md     # Tài liệu backend, API & vận hành database
└── legacy/google-sheets-backend/  # Backend Google Apps Script cũ (không còn dùng)
```

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local Development)

Vì bài thi cần nạp các tài nguyên âm thanh (`.mp3`), hình ảnh và font chữ qua Ajax/Fetch, bạn hãy chạy qua một local web server:

### Cách 1: Sử dụng Node.js (Khuyên dùng)
```bash
npm start
# Hoặc: npx serve -l 3000 .
```
Mở trình duyệt tại: `http://localhost:3000`

### Cách 2: Sử dụng Python 3
```bash
python3 -m http.server 3000
```
Mở trình duyệt tại: `http://localhost:3000`

---

## 🌐 Hướng Dẫn Triển Khai GitHub Pages (Public Static Web)

Dự án đã cấu hình sẵn `.github/workflows/deploy.yml` và `.nojekyll`.

### Các bước kích hoạt:
1. **Push source code lên GitHub**:
   ```bash
   git add .
   git commit -m "feat: complete full toeic web assessment features"
   git push origin main
   ```
2. **Kích hoạt GitHub Pages**:
   - Truy cập vào Repository trên GitHub: `https://github.com/xhoang0509/toeic-web`
   - Vào **Settings** ➔ **Pages** (cột trái).
   - Tại **Build and deployment** ➔ **Source**: Chọn **GitHub Actions**.
3. **Xem trang web trực tiếp**:
   - Chờ GitHub Actions hoàn thành (khoảng 30-60 giây).
   - Trang web sẽ online tại:  
     👉 **`https://xhoang0509.github.io/toeic-web/`**

---

## 🛠️ Bộ Công Cụ Dữ Liệu (Scripts)

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm run dev` | Khởi chạy Astro dev server (http://localhost:4321/toeic-web) |
| `npm run build` | Chuẩn hóa đề rồi build trang tĩnh ra `dist/` |
| `npm test` | Chạy 62 unit test (Vitest, không gọi mạng) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript toàn dự án |
| `npm run data:normalize` | Chuẩn hóa đề → `questions.full.json` + `questions.public.json` |
| `npm run db:migrate` | Tạo lại 4 bảng trên Cloudflare D1 |
| `npm run db:seed` | Chuẩn hóa đề, sinh SQL và nạp 199 câu hỏi vào D1 |
| `npm run api:deploy` | Deploy Cloudflare Worker |
| `npm run api:logs` | Xem log Worker realtime |

--- | :--- |
| `npm run start` | Khởi chạy máy chủ cục bộ xem trước website |
| `npm run extract` | Giải mã dữ liệu `quiz1.js` sang JSON |
| `npm run inject` | Chèn nhãn đáp án hiển thị trực tiếp vào quiz |
| `npm run markdown` | Xuất toàn bộ ngân hàng đề thi ra Markdown |

---

## 📄 Tài Liệu Tham Khảo Thêm
- [Backend Cloudflare Workers + D1, API & vận hành database](docs/CLOUDFLARE_BACKEND.md)
- [Kiến trúc kỹ thuật & Event Hooks (bản iSpring gốc)](docs/ARCHITECTURE.md)
- [Hướng dẫn sử dụng dành cho Thí sinh & Giáo viên](docs/USER_GUIDE.md)
- [Toàn bộ câu hỏi & đáp án TOEIC](docs/FULL_QUESTIONS_AND_ANSWERS.md)

---

## 📝 Giấy Phép (License)
Dự án được phân phối dưới giấy phép **MIT License**.
Dữ liệu đề thi phục vụ cho mục đích học tập, ôn luyện và nâng cao năng lực tiếng Anh.
