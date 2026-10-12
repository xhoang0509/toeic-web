# [LEGACY] Backend Google Apps Script

Phiên bản backend cũ, **không còn được sử dụng**.

Backend hiện tại là Cloudflare Workers + D1: xem `cloudflare/` và `docs/CLOUDFLARE_BACKEND.md`.

Lý do thay thế:
- Google Apps Script Web App yêu cầu cấp quyền thủ công ("Allow permission") và hay trả HTML đăng nhập thay vì JSON.
- Mọi request bị ép qua redirect `script.googleusercontent.com`, gây lỗi CORS preflight.
- Quota Sheets API thấp, đọc/ghi 199 câu hỏi cho mỗi lượt chấm điểm rất chậm.
- Không có truy vấn quan hệ nên Bảng Xếp Hạng phải xử lý ở client.

Thư mục này chỉ giữ lại để tham khảo lịch sử.
