# ☁️ Backend Cloudflare Workers + D1

Backend của hệ thống là một **Cloudflare Worker** (`cloudflare/src/index.ts`) đặt trước một
**cơ sở dữ liệu D1** (SQLite phân tán, gói miễn phí). Nó thay thế hoàn toàn backend
Google Apps Script cũ (đã lưu trữ tại `legacy/google-sheets-backend/`).

| | Google Apps Script (cũ) | Cloudflare Worker + D1 (hiện tại) |
| :--- | :--- | :--- |
| Cấp quyền | Phải bấm "Allow permission" thủ công, hay trả về HTML đăng nhập | Không cần, deploy là chạy |
| CORS | Bị redirect qua `script.googleusercontent.com` → lỗi preflight | Header CORS do Worker tự kiểm soát |
| Dữ liệu | 4 sheet, đọc/ghi toàn bộ dải ô mỗi request | 4 bảng SQL, có index & truy vấn quan hệ |
| Bảng xếp hạng | Phải xử lý ở client (và trước đây là dữ liệu mockup) | Truy vấn SQL có xếp hạng, thống kê thật |
| Giá | Miễn phí nhưng quota thấp | Miễn phí: 100k request/ngày, 5GB D1 |

Endpoint hiện tại: `https://toeic-api.xhoang0509.workers.dev`

---

## 1. Mô hình dữ liệu (D1)

| Bảng | Vai trò |
| :--- | :--- |
| `questions` | 199 câu hỏi + **đáp án đúng & lời giải thích** (không bao giờ gửi về client) |
| `results` | Mỗi lượt nộp bài đã chấm — nguồn dữ liệu duy nhất của Bảng Xếp Hạng |
| `users` | Thí sinh duy nhất theo email: số lượt thi, điểm cao nhất, trạng thái ACTIVE/BANNED |
| `config` | Cấu hình hệ thống: hash mật khẩu admin, thời gian thi, banner, bật/tắt bảng xếp hạng |

Schema: `cloudflare/migrations/0001_init.sql`
Seed câu hỏi (tự sinh): `cloudflare/migrations/0002_seed_questions.sql`

---

## 2. API

Tất cả response đều là JSON và có dạng `{ success: boolean, ... }`.

### Công khai

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/health` | Kiểm tra sống |
| GET | `/api/questions?partId=` | Câu hỏi **đã lọc bỏ đáp án** (dự phòng; trang web dùng bản tĩnh) |
| GET | `/api/config` | Thời gian thi, banner, bật/tắt bảng xếp hạng, tổng số câu |
| GET | `/api/leaderboard?limit=&mode=best\|all` | Bảng Xếp Hạng + thống kê (`best` = 1 lượt tốt nhất/thí sinh) |
| POST | `/api/exam/grade` | Chấm toàn bài, lưu `results`, upsert `users`, trả `examResult` + `reviewDetails` |
| POST | `/api/practice/check` | Chấm 1 câu trong chế độ luyện tập |

### Quản trị (yêu cầu `Authorization: Bearer <token>`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| POST | `/api/admin/login` | Nhận mật khẩu → trả session token HMAC-SHA256 (hạn 8 giờ) |
| GET | `/api/admin/data` | Cấu hình (đã ẩn hash mật khẩu) + danh sách thí sinh + thống kê |
| POST | `/api/admin/config` | Cập nhật cấu hình (chỉ các key trong allowlist) hoặc đổi mật khẩu admin |
| POST | `/api/admin/ban` | Khóa / mở khóa thí sinh theo email |

**Bảo mật đã áp dụng**
- Mật khẩu admin lưu dưới dạng SHA-256 trong `config`, so sánh theo thời gian hằng số.
- Mật khẩu chỉ gửi 1 lần khi đăng nhập; sau đó dùng session token. Trình duyệt **không** lưu mật khẩu.
- Không còn mật khẩu dự phòng `admin` (backdoor của backend cũ).
- Chống dò mật khẩu: tối đa 10 lần sai / IP / 15 phút ở Worker, 5 lần / 1 phút ở giao diện.
- `/api/admin/config` chỉ nhận các key hợp lệ; `admin_password_hash` không thể bị ghi trực tiếp.
- Người bị BAN không nộp được bài và không chấm được câu luyện tập.

---

## 3. Vận hành

```bash
# 1. Đăng nhập Cloudflare (chỉ 1 lần)
npx wrangler login

# 2. Tạo database (chỉ 1 lần) rồi dán database_id vào cloudflare/wrangler.toml
npx wrangler d1 create toeic-db

# 3. Khóa ký session token của Admin (chỉ 1 lần)
openssl rand -hex 32 | npx wrangler secret put ADMIN_SESSION_SECRET --config cloudflare/wrangler.toml

# 4. Tạo bảng + nạp ngân hàng câu hỏi
npm run db:migrate      # chạy 0001_init.sql (DROP + CREATE: xóa sạch dữ liệu cũ)
npm run db:seed         # chuẩn hóa questions.json → sinh SQL → nạp 199 câu vào D1

# 5. Deploy Worker
npm run api:deploy
npm run api:logs        # xem log realtime
```

### Truy vấn nhanh

```bash
npx wrangler d1 execute toeic-db --remote --config cloudflare/wrangler.toml \
  --command "SELECT part_id, COUNT(*) FROM questions GROUP BY part_id;"

# Xóa dữ liệu thi thử để bắt đầu một kỳ thi mới (giữ nguyên ngân hàng câu hỏi)
npx wrangler d1 execute toeic-db --remote --config cloudflare/wrangler.toml \
  --command "DELETE FROM results; UPDATE users SET total_exams = 0, best_score = 0;"
```

### Kết nối frontend

Frontend đọc endpoint từ biến môi trường lúc build:

```bash
# .env.local
PUBLIC_API_BASE_URL=https://toeic-api.xhoang0509.workers.dev
```

Trên GitHub Actions, đặt repository secret `PUBLIC_API_BASE_URL` (nếu bỏ trống thì workflow
dùng endpoint mặc định trong `.github/workflows/deploy.yml`).

Khi đổi tên Worker hoặc thêm domain mới, cập nhật `ALLOWED_ORIGINS` trong `cloudflare/wrangler.toml`
rồi deploy lại.

---

## 4. Ngân hàng câu hỏi

`src/data/questions.json` là dữ liệu gốc trích xuất từ đề iSpring. `npm run data:normalize`
sinh ra 2 artifact:

| Artifact | Nội dung | Dùng ở đâu |
| :--- | :--- | :--- |
| `src/data/questions.full.json` | 199 câu **có** đáp án + giải thích | chỉ để seed D1 |
| `src/data/questions.public.json` | 199 câu **không có** đáp án | build vào trang web |

Bước chuẩn hóa xử lý 2 lỗi dữ liệu:
1. 8 câu Part 6 dạng `mct` chứa 3 chỗ trống lồng nhau (giao diện render ra đáp án rỗng)
   → tách thành 24 câu hỏi độc lập `{id}#1`, `{id}#2`, `{id}#3`, kèm passage dùng chung.
2. Đáp án đúng bị đóng gói vào bundle JS → bản public không còn `correctLetter`,
   `isCorrect`, `explanation`. Việc chấm điểm chuyển hoàn toàn về Worker.

Tổng số câu sau chuẩn hóa: **199** (Listening 91 • Reading 108).
`npm run prebuild` tự chạy lại bước này trước mỗi lần build nên 2 artifact luôn đồng bộ.

---

## 5. Kiểm thử

```bash
npm test          # 62 unit test (offline, không gọi mạng)

# Kiểm thử tích hợp thật với Worker đang chạy
TOEIC_API_URL=https://toeic-api.xhoang0509.workers.dev npx vitest run integration.live
```

Bộ integration test xác nhận: cấu hình khớp số câu đã seed, chấm đúng câu Reading sau khi
xáo trộn nhãn đáp án, phát hiện hồi quy nếu client gửi nhãn chưa quy đổi, và lượt nộp bài
xuất hiện trên Bảng Xếp Hạng.
