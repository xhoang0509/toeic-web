# 🔐 Hướng Dẫn Tích Hợp Google Sheets Làm Database Trực Tuyến An Toàn (Chống Hacker & Bot)

Hệ thống hỗ trợ lưu kết quả thi TOEIC trực tiếp vào Google Sheets hoàn toàn miễn phí, đi kèm cơ chế **ký số mã hóa SHA-256 (HMAC)** và **Secret Token bí mật** để ngăn chặn tuyệt đối bot spam hoặc hacker sửa điểm.

---

## 1. Tạo Google Sheet & Cài Đặt Apps Script

1. Truy cập [Google Sheets](https://sheets.new) để tạo 1 file trang tính mới (Đặt tên: `TOEIC_Exam_Results_2026`).
2. Tại dòng tiêu đề đầu tiên (Row 1), tạo các cột:
   - **A**: Thời gian nộp
   - **B**: Họ và tên thí sinh
   - **C**: Email / Mã học viên
   - **D**: Mục tiêu điểm số
   - **E**: Số câu đúng
   - **F**: Điểm TOEIC (~/990)
   - **G**: Điểm Listening
   - **H**: Điểm Reading
   - **I**: Xếp loại CEFR
   - **J**: Thời gian làm bài
3. Vào menu **Tiện ích mở rộng (Extensions)** ➔ **Apps Script**.
4. Xóa toàn bộ nội dung cũ trong file `Mã.gs` và dán đoạn mã bảo mật sau:

```javascript
// ========================================================
// CẤU HÌNH BẢO MẬT (CHỈ BẠN MỚI BIẾT ĐƯỢC MÃ NÀY)
// ========================================================
const SECRET_TOKEN = "TOEIC_SECURE_TOKEN_2026_XYZ9988"; // <-- ĐỔI THÀNH MÃ BÍ MẬT CỦA BẠN

function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const data = JSON.parse(rawData);

    // 1. Kiểm tra Token bảo mật
    if (!data.authToken || data.authToken !== SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized: Invalid Secret Token" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Chống Replay Attack (Chỉ chấp nhận gói tin gửi trong vòng 5 phút)
    const now = Date.now();
    if (!data.timestamp || Math.abs(now - Number(data.timestamp)) > 5 * 60 * 1000) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Expired: Request timestamp outside 5-minute window" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Kiểm tra tính hợp lệ dữ liệu điểm số (Sanity Check)
    if (data.score < 0 || data.score > 183 || data.scaledScore < 10 || data.scaledScore > 990) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Invalid Score Data" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Xác minh chữ ký số SHA-256 (Chống can thiệp hoặc sửa điểm)
    const rawSignatureData = data.name + "|" + data.score + "|" + data.scaledScore + "|" + data.timestamp + "|" + SECRET_TOKEN;
    const expectedSignature = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      rawSignatureData,
      Utilities.Charset.UTF_8
    ).map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');

    if (data.signature !== expectedSignature) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Tampered Data: Signature mismatch" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Ghi vào Google Sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      new Date(),
      data.name,
      data.email,
      data.targetScore,
      data.score + "/" + (data.maxScore || 183),
      data.scaledScore,
      data.scaledListening || 0,
      data.scaledReading || 0,
      data.cefrLevel,
      data.duration
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Result saved successfully" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 2. Deploy Web App Trên Google Script

1. Nhấp nút **Triển khai (Deploy)** (màu xanh góc trên bên phải) ➔ Chọn **Tùy chọn triển khai mới (New deployment)**.
2. Chọn loại: **Ứng dụng web (Web app)** (biểu tượng bánh răng).
3. Cấu hình:
   - **Mô tả**: `TOEIC Result Webhook v1`
   - **Thực thi dưới dạng (Execute as)**: `Tôi (Me)`
   - **Ai có quyền truy cập (Who has access)**: **`Bất kỳ ai (Anyone)`** *(Bắt buộc chọn Anyone để website gửi kết quả tới được; bảo mật sẽ do SECRET_TOKEN và chữ ký SHA-256 đảm nhiệm)*.
4. Nhấp **Triển khai (Deploy)** ➔ Cấp quyền truy cập tài khoản Google của bạn.
5. Sao chép liên kết **URL ứng dụng web (Web app URL)** (có dạng: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 3. Cấu Hình Biến Môi Trường (Chỉ Bạn Mới Xem Được)

Có 2 cách cấu hình bí mật:

### Cách A: Cấu hình trên GitHub Secrets (Khuyên Dùng Cho Production)
1. Truy cập repo trên GitHub: `https://github.com/xhoang0509/toeic-web`.
2. Vào **Settings** ➔ **Secrets and variables** ➔ **Actions**.
3. Bấm **New repository secret** và thêm 2 secret:
   - `PUBLIC_WEBHOOK_URL`: Dán link Web App URL Google Script ở Bước 2.
   - `PUBLIC_SECRET_TOKEN`: Dán mã bí mật bạn đã đặt trong code Google Script (ví dụ: `TOEIC_SECURE_TOKEN_2026_XYZ9988`).
4. Khi GitHub Actions chạy build, 2 biến này sẽ được tự động inject an toàn vào website.

### Cách B: Cấu hình cục bộ máy tính của bạn
Tạo file `.env.local` tại thư mục gốc của repo (file này đã có trong `.gitignore` nên không bao giờ bị lộ lên GitHub):
```env
PUBLIC_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
PUBLIC_SECRET_TOKEN=TOEIC_SECURE_TOKEN_2026_XYZ9988
```

### Cách C: Nhập trực tiếp qua giao diện Web
Bạn cũng có thể mở website, bấm biểu tượng **Bánh răng Cài đặt (`⚙️`)** trên thanh điều hướng, nhập Webhook URL và Secret Token. Dữ liệu sẽ được lưu an toàn trong trình duyệt của bạn.
