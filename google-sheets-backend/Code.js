// ====================================================================
// TOEIC Online Assessment - Backend Google Sheets Webhook
// Tích hợp bảo mật chữ ký số HMAC-SHA256, Anti-Replay & Token Verification
// ====================================================================

// Lấy Secret Token từ Script Properties (hoặc cấu hình)
function getSecretToken() {
  const prop = PropertiesService.getScriptProperties().getProperty("SECRET_TOKEN");
  return prop || "YOUR_SECRET_TOKEN_HERE";
}

// Hàm khởi tạo cấu hình mã bảo mật vào Script Properties (chạy 1 lần)
function initSecretToken() {
  PropertiesService.getScriptProperties().setProperty("SECRET_TOKEN", "YOUR_SECRET_TOKEN_HERE");
}

function getOrInitSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Thời Gian Nộp",
      "Họ Và Tên Thí Sinh",
      "Mã Học Viên / Email",
      "Mục Tiêu Điểm",
      "Số Câu Đúng",
      "Điểm TOEIC (~/990)",
      "Listening (~/495)",
      "Reading (~/495)",
      "Xếp Loại CEFR",
      "Thời Gian Làm Bài"
    ]);

    // Định dạng dòng tiêu đề
    const headerRange = sheet.getRange(1, 1, 1, 10);
    headerRange.setBackground("#0284c7");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "TOEIC Assessment API is running securely",
    timestamp: Date.now()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Empty request payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);

    const secretToken = getSecretToken();

    // 1. Kiểm tra Secret Token
    if (!data.authToken || data.authToken !== secretToken) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized: Invalid Secret Token" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Chống Replay Attack (Thời gian gửi trong vòng 5 phút)
    const now = Date.now();
    if (!data.timestamp || Math.abs(now - Number(data.timestamp)) > 5 * 60 * 1000) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Expired request: Timestamp outside 5-minute window" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Kiểm tra tính hợp lệ dữ liệu điểm thi (Sanity Check)
    if (data.score < 0 || data.score > 183 || data.scaledScore < 10 || data.scaledScore > 990) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Invalid Score: Out of valid bounds" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Xác minh chữ ký số SHA-256 (Chống can thiệp hoặc sửa điểm)
    const rawSignatureData = data.name + "|" + data.score + "|" + data.scaledScore + "|" + data.timestamp + "|" + secretToken;
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
    const sheet = getOrInitSheet();
    const formattedDate = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

    sheet.appendRow([
      formattedDate,
      data.name || "Thí sinh",
      data.email || "",
      data.targetScore || "",
      (data.score || 0) + "/" + (data.maxScore || 183),
      data.scaledScore || 10,
      data.scaledListening || 5,
      data.scaledReading || 5,
      data.cefrLevel || "A1",
      data.duration || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Result recorded successfully"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
