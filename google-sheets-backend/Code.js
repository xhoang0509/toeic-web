// ====================================================================
// TOEIC Online Assessment - Backend Google Sheets Relational Database
// 4 Tables (Sheets):
//   1. Questions: 183 câu hỏi + Đáp án bí mật (Zero-knowledge client)
//   2. Results: Lịch sử nộp bài & bảng điểm đã chấm
//   3. Users: Quản lý học viên theo Email duy nhất, thống kê & BAN/UNBAN
//   4. Config: Cấu hình hệ thống Admin, Secret Token, Banner, v.v.
// ====================================================================

const DEFAULT_SECRET_TOKEN = "toeic_sec_1348139a3a0834c247a8d3bde88cb3d5ce2a8d6023f7f68d";
// Mật khẩu Admin mặc định: admin@toeic2026 (SHA-256 hash)
const DEFAULT_ADMIN_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

function getOrInitDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // -----------------------------------------------------------
  // 1. Table Questions (Chứa 183 câu hỏi & đáp án bí mật)
  // -----------------------------------------------------------
  let questionsSheet = ss.getSheetByName("Questions");
  if (!questionsSheet) {
    questionsSheet = ss.insertSheet("Questions");
  }
  if (questionsSheet.getLastRow() <= 1 && typeof SEED_QUESTIONS_ROWS !== "undefined") {
    questionsSheet.clear();
    const rows = SEED_QUESTIONS_ROWS;
    questionsSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    const headerRange = questionsSheet.getRange(1, 1, 1, rows[0].length);
    headerRange.setBackground("#0369a1");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    questionsSheet.setFrozenRows(1);
  }

  // -----------------------------------------------------------
  // 2. Table Results (Lịch sử nộp bài & bảng điểm)
  // -----------------------------------------------------------
  let resultsSheet = ss.getSheetByName("Results");
  if (!resultsSheet) {
    resultsSheet = ss.insertSheet("Results");
  }
  if (resultsSheet.getLastRow() === 0) {
    resultsSheet.appendRow([
      "Mã Bài Thi",
      "Thời Gian Nộp",
      "Họ Và Tên",
      "Email / Mã HV",
      "Mục Tiêu",
      "Số Câu Đúng",
      "Điểm TOEIC (~/990)",
      "Listening (~/495)",
      "Reading (~/495)",
      "Xếp Loại CEFR",
      "Thời Gian Làm Bài"
    ]);
    const header = resultsSheet.getRange(1, 1, 1, 11);
    header.setBackground("#0284c7");
    header.setFontColor("#ffffff");
    header.setFontWeight("bold");
    resultsSheet.setFrozenRows(1);
  }

  // -----------------------------------------------------------
  // 3. Table Users (Quản lý User duy nhất theo Email & BAN/UNBAN)
  // -----------------------------------------------------------
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
  }
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow([
      "Email",
      "Họ Và Tên",
      "Trạng Thái",
      "Số Lượt Thi",
      "Điểm Cao Nhất",
      "Lần Thi Gần Nhất",
      "Lý Do Khóa (Nếu Có)"
    ]);
    const header = usersSheet.getRange(1, 1, 1, 7);
    header.setBackground("#0f172a");
    header.setFontColor("#ffffff");
    header.setFontWeight("bold");
    usersSheet.setFrozenRows(1);
  }

  // -----------------------------------------------------------
  // 4. Table Config (Cấu hình hệ thống Admin)
  // -----------------------------------------------------------
  let configSheet = ss.getSheetByName("Config");
  if (!configSheet) {
    configSheet = ss.insertSheet("Config");
  }
  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(["Key", "Value", "Mô Tả"]);
    const header = configSheet.getRange(1, 1, 1, 3);
    header.setBackground("#1e293b");
    header.setFontColor("#ffffff");
    header.setFontWeight("bold");
    configSheet.setFrozenRows(1);

    const defaultConfigs = [
      ["admin_password_hash", DEFAULT_ADMIN_PASSWORD_HASH, "Mật khẩu Admin đã mã hóa SHA256 (Mặc định: admin@toeic2026)"],
      ["secret_token", DEFAULT_SECRET_TOKEN, "Secret token bảo mật server"],
      ["exam_duration_minutes", "120", "Thời gian làm bài thi thử (phút)"],
      ["allow_instant_answers", "true", "Cho phép xem đáp án ngay trong chế độ luyện tập"],
      ["show_leaderboard", "true", "Hiển thị Bảng Xếp Hạng trên website"],
      ["announcement_banner", "Chào mừng bạn đến với hệ thống thi thử TOEIC Online chuẩn ETS 2026!", "Thông báo chung hiển thị trên Top Bar website"]
    ];

    defaultConfigs.forEach(function(row) {
      configSheet.appendRow(row);
    });
  }

  return {
    questionsSheet: questionsSheet,
    resultsSheet: resultsSheet,
    usersSheet: usersSheet,
    configSheet: configSheet
  };
}

function readAllConfigs() {
  const db = getOrInitDatabase();
  const data = db.configSheet.getDataRange().getValues();
  const configMap = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const val = String(data[i][1]).trim();
    if (key) {
      configMap[key] = val;
    }
  }
  return configMap;
}

function computeSha256(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  ).map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------
// READ ALL QUESTIONS (Bảo mật: Ẩn Đáp Án & Giải Thích)
// -------------------------------------------------------------
function getClientQuestions(partIdFilter) {
  const db = getOrInitDatabase();
  const rows = db.questionsSheet.getDataRange().getValues();
  const clientQuestions = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const partId = Number(r[2]);
    if (partIdFilter && partIdFilter > 0 && partId !== partIdFilter) {
      continue;
    }

    let mediaFiles = [];
    try {
      mediaFiles = JSON.parse(r[5] || "[]");
    } catch (e) {}

    const options = [
      { letter: "A", text: String(r[8] || "") },
      { letter: "B", text: String(r[9] || "") },
      { letter: "C", text: String(r[10] || "") },
      { letter: "D", text: String(r[11] || "") }
    ].filter(function(opt) { return opt.text.trim().length > 0; });

    // TUYỆT ĐỐI KHÔNG GỬI correctLetter (cột 12) hoặc explanation (cột 13)
    clientQuestions.push({
      id: String(r[0]),
      questionNumber: Number(r[1]),
      partId: partId,
      partName: String(r[3]),
      skill: String(r[4]),
      mediaFiles: mediaFiles,
      passage: String(r[6] || ""),
      question: String(r[7] || ""),
      options: options
    });
  }

  return clientQuestions;
}

// -------------------------------------------------------------
// KIỂM TRA USER CÓ BỊ BAN KHÔNG
// -------------------------------------------------------------
function isUserBanned(email) {
  if (!email) return false;
  const db = getOrInitDatabase();
  const data = db.usersSheet.getDataRange().getValues();
  const normalized = email.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === normalized) {
      return String(data[i][2]).toUpperCase() === "BANNED";
    }
  }
  return false;
}

// -------------------------------------------------------------
// CẬP NHẬT HOẶC TẠO USER (UPSERT)
// -------------------------------------------------------------
function recordUserActivity(email, name, scaledScore) {
  if (!email) return;
  const db = getOrInitDatabase();
  const sheet = db.usersSheet;
  const data = sheet.getDataRange().getValues();
  const normalized = email.trim().toLowerCase();
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === normalized) {
      const currentExams = Number(data[i][3] || 0) + 1;
      const currentBest = Math.max(Number(data[i][4] || 0), scaledScore);
      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 4).setValue(currentExams);
      sheet.getRange(i + 1, 5).setValue(currentBest);
      sheet.getRange(i + 1, 6).setValue(nowStr);
      return;
    }
  }

  // Nếu user mới
  sheet.appendRow([
    normalized,
    name || "Thí sinh",
    "ACTIVE",
    1,
    scaledScore,
    nowStr,
    ""
  ]);
}

// -------------------------------------------------------------
// GET REQUEST ROUTER
// -------------------------------------------------------------
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "getQuestions";
    const configs = readAllConfigs();

    if (action === "getQuestions") {
      const partId = e.parameter.partId ? Number(e.parameter.partId) : 0;
      const questions = getClientQuestions(partId);
      return jsonResponse({
        success: true,
        total: questions.length,
        questions: questions
      });
    }

    if (action === "getPublicConfig") {
      return jsonResponse({
        success: true,
        exam_duration_minutes: Number(configs.exam_duration_minutes || 120),
        allow_instant_answers: configs.allow_instant_answers === "true",
        show_leaderboard: configs.show_leaderboard === "true",
        announcement_banner: configs.announcement_banner || ""
      });
    }

    return jsonResponse({
      status: "ok",
      message: "TOEIC Database API is online",
      timestamp: Date.now()
    });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// -------------------------------------------------------------
// POST REQUEST ROUTER
// -------------------------------------------------------------
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: "Empty request payload" });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action || "gradeExam";
    const configs = readAllConfigs();
    const db = getOrInitDatabase();

    // ---------------------------------------------------------
    // ACTION: ADMIN AUTHENTICATION
    // ---------------------------------------------------------
    if (action === "adminLogin") {
      const inputPass = String(data.password || "");
      const inputHash = computeSha256(inputPass);
      const storedHash = configs.admin_password_hash || DEFAULT_ADMIN_PASSWORD_HASH;

      if (inputHash === storedHash) {
        return jsonResponse({
          success: true,
          message: "Admin login successful",
          token: computeSha256(inputPass + "|" + Date.now())
        });
      }
      return jsonResponse({ success: false, error: "Sai mật khẩu quản trị viên" });
    }

    // ---------------------------------------------------------
    // ACTION: ADMIN GET ALL DATA (Configs + Users + Results)
    // ---------------------------------------------------------
    if (action === "getAdminData") {
      const inputPass = String(data.password || "");
      if (computeSha256(inputPass) !== (configs.admin_password_hash || DEFAULT_ADMIN_PASSWORD_HASH)) {
        return jsonResponse({ success: false, error: "Unauthorized: Invalid Admin Password" });
      }

      // Read Users table
      const usersData = db.usersSheet.getDataRange().getValues();
      const usersList = [];
      for (let i = 1; i < usersData.length; i++) {
        usersList.push({
          email: String(usersData[i][0]),
          name: String(usersData[i][1]),
          status: String(usersData[i][2]),
          totalExams: Number(usersData[i][3] || 0),
          bestScore: Number(usersData[i][4] || 0),
          lastActive: String(usersData[i][5] || ""),
          bannedReason: String(usersData[i][6] || "")
        });
      }

      // Read total results
      const totalResults = Math.max(0, db.resultsSheet.getLastRow() - 1);

      return jsonResponse({
        success: true,
        configs: configs,
        users: usersList,
        totalResults: totalResults
      });
    }

    // ---------------------------------------------------------
    // ACTION: ADMIN BAN / UNBAN USER
    // ---------------------------------------------------------
    if (action === "setBanStatus") {
      const inputPass = String(data.password || "");
      if (computeSha256(inputPass) !== (configs.admin_password_hash || DEFAULT_ADMIN_PASSWORD_HASH)) {
        return jsonResponse({ success: false, error: "Unauthorized: Invalid Admin Password" });
      }

      const targetEmail = String(data.email || "").trim().toLowerCase();
      const newStatus = data.isBanned ? "BANNED" : "ACTIVE";
      const reason = String(data.reason || "");
      const usersData = db.usersSheet.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < usersData.length; i++) {
        if (String(usersData[i][0]).trim().toLowerCase() === targetEmail) {
          db.usersSheet.getRange(i + 1, 3).setValue(newStatus);
          db.usersSheet.getRange(i + 1, 7).setValue(reason);
          updated = true;
          break;
        }
      }

      if (!updated && targetEmail) {
        db.usersSheet.appendRow([
          targetEmail,
          "User",
          newStatus,
          0,
          0,
          Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm"),
          reason
        ]);
      }

      return jsonResponse({
        success: true,
        message: "User " + targetEmail + " has been set to " + newStatus
      });
    }

    // ---------------------------------------------------------
    // ACTION: ADMIN UPDATE CONFIGS
    // ---------------------------------------------------------
    if (action === "updateAdminConfig") {
      const inputPass = String(data.password || "");
      if (computeSha256(inputPass) !== (configs.admin_password_hash || DEFAULT_ADMIN_PASSWORD_HASH)) {
        return jsonResponse({ success: false, error: "Unauthorized: Invalid Admin Password" });
      }

      const newConfigs = data.newConfigs || {};
      const rows = db.configSheet.getDataRange().getValues();

      for (let k in newConfigs) {
        let valToSave = String(newConfigs[k]);
        if (k === "admin_password" && valToSave) {
          k = "admin_password_hash";
          valToSave = computeSha256(valToSave);
        }

        let found = false;
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]).trim() === k) {
            db.configSheet.getRange(i + 1, 2).setValue(valToSave);
            found = true;
            break;
          }
        }
        if (!found && k) {
          db.configSheet.appendRow([k, valToSave, "Cập nhật qua Admin Dashboard"]);
        }
      }

      return jsonResponse({ success: true, message: "Configs updated successfully" });
    }

    // ---------------------------------------------------------
    // ACTION: PRACTICE CHECK SINGLE ANSWER (Instant Check)
    // ---------------------------------------------------------
    if (action === "checkAnswer") {
      const qId = String(data.questionId || "");
      const selected = String(data.selectedLetter || "").trim().toUpperCase();
      const userEmail = String(data.email || "").trim().toLowerCase();

      if (userEmail && isUserBanned(userEmail)) {
        return jsonResponse({
          success: false,
          error: "Tài khoản email của bạn đã bị khóa truy cập bởi Quản trị viên."
        });
      }

      const rows = db.questionsSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === qId) {
          const correctLetter = String(rows[i][12]).trim().toUpperCase();
          const explanation = String(rows[i][13]);
          return jsonResponse({
            success: true,
            isCorrect: selected === correctLetter,
            correctLetter: correctLetter,
            explanation: explanation
          });
        }
      }

      return jsonResponse({ success: false, error: "Không tìm thấy câu hỏi" });
    }

    // ---------------------------------------------------------
    // ACTION: GRADE EXAM (Chấm Điểm Phía Server 100%)
    // ---------------------------------------------------------
    if (action === "gradeExam") {
      const candidate = data.candidate || {};
      const candidateEmail = String(candidate.emailOrCode || "").trim().toLowerCase();
      const candidateName = String(candidate.name || "Thí sinh");

      // 1. Kiểm tra User có bị Ban không
      if (candidateEmail && isUserBanned(candidateEmail)) {
        return jsonResponse({
          success: false,
          error: "Tài khoản email này đã bị khóa quyền nộp bài thi bởi Quản trị viên."
        });
      }

      const candidateAnswers = data.answers || {}; // { questionId: "A" }
      const rows = db.questionsSheet.getDataRange().getValues();

      let totalQuestions = 0;
      let totalCorrect = 0;
      let listeningTotal = 0;
      let listeningCorrect = 0;
      let readingTotal = 0;
      let readingCorrect = 0;

      const partTotal = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
      const partCorrect = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
      const reviewDetails = {}; // Trả về đáp án đúng & giải thích SAU KHI nộp bài

      for (let i = 1; i < rows.length; i++) {
        const qId = String(rows[i][0]);
        const partId = Number(rows[i][2]);
        const skill = String(rows[i][4]);
        const correctLetter = String(rows[i][12]).trim().toUpperCase();
        const explanation = String(rows[i][13]);

        totalQuestions++;
        partTotal[partId] = (partTotal[partId] || 0) + 1;
        if (skill === "Listening") listeningTotal++;
        else readingTotal++;

        const userChoice = String(candidateAnswers[qId] || "").trim().toUpperCase();
        const isRight = userChoice === correctLetter;

        if (isRight) {
          totalCorrect++;
          partCorrect[partId] = (partCorrect[partId] || 0) + 1;
          if (skill === "Listening") listeningCorrect++;
          else readingCorrect++;
        }

        reviewDetails[qId] = {
          correctLetter: correctLetter,
          explanation: explanation,
          isCorrect: isRight
        };
      }

      // Tính điểm theo thang điểm chuẩn ETS
      const scaledListening = Math.min(495, Math.max(5, Math.round((5 + (listeningCorrect / (listeningTotal || 1)) * 490) / 5) * 5));
      const scaledReading = Math.min(495, Math.max(5, Math.round((5 + (readingCorrect / (readingTotal || 1)) * 490) / 5) * 5));
      const totalScaledScore = scaledListening + scaledReading;

      // Xếp loại CEFR
      let cefr = "A1";
      if (totalScaledScore >= 905) cefr = "C1+";
      else if (totalScaledScore >= 785) cefr = "C1";
      else if (totalScaledScore >= 605) cefr = "B2";
      else if (totalScaledScore >= 405) cefr = "B1";
      else if (totalScaledScore >= 255) cefr = "A2";

      const partAccuracy = {};
      for (let p = 1; p <= 7; p++) {
        const tot = partTotal[p] || 1;
        const cor = partCorrect[p] || 0;
        partAccuracy[p] = Math.round((cor / tot) * 100);
      }

      const examId = "EXAM-" + Date.now();
      const dateStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
      const durationStr = Math.floor((data.durationSeconds || 0) / 60) + " phút " + ((data.durationSeconds || 0) % 60) + " giây";

      // Ghi vào Table Results
      db.resultsSheet.appendRow([
        examId,
        dateStr,
        candidateName,
        candidateEmail,
        candidate.targetScore || "650+",
        totalCorrect + "/" + totalQuestions,
        totalScaledScore,
        scaledListening,
        scaledReading,
        cefr,
        durationStr
      ]);

      // Ghi nhận User vào Table Users (Upsert)
      recordUserActivity(candidateEmail, candidateName, totalScaledScore);

      // Trả kết quả chấm điểm hoàn chỉnh cho Client
      return jsonResponse({
        success: true,
        examResult: {
          id: examId,
          candidateName: candidateName,
          candidateId: candidateEmail,
          targetScore: candidate.targetScore || "650+",
          totalCorrect: totalCorrect,
          totalQuestions: totalQuestions,
          listeningCorrect: listeningCorrect,
          readingCorrect: readingCorrect,
          scaledListening: scaledListening,
          scaledReading: scaledReading,
          totalScaledScore: totalScaledScore,
          cefrLevel: cefr,
          partAccuracy: partAccuracy,
          timeSpentSeconds: data.durationSeconds || 0,
          completedAt: dateStr
        },
        reviewDetails: reviewDetails
      });
    }

    return jsonResponse({ error: "Unknown action" });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}
