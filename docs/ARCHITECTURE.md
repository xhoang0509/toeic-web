# 🏗️ TOEIC Web Assessment - Kiến Trúc Kỹ Thuật (Architecture)

Tài liệu này mô tả chi tiết kiến trúc kỹ thuật của hệ thống thi TOEIC Web, cơ chế tích hợp với runtime iSpring Player, thuật toán xếp hạng và mô hình dữ liệu.

---

## 1. Tổng Quan Kiến Trúc

Ứng dụng được thiết kế theo mô hình **Hybrid Static Web**:
1. **iSpring e-Learning Runtime Core**: Đảm nhiệm việc phát âm thanh, render các dạng câu hỏi trắc nghiệm phức tạp (Multiple Choice, Cloze Passage, Matching, Dropdown), quản lý ngân hàng câu hỏi ngẫu nhiên và tính điểm thi.
2. **Custom TOEIC Application Layer (`data/toeic-app.js` & `data/toeic-app.css`)**: Lớp ứng dụng mở rộng chạy đè lên trên runtime iSpring, cung cấp:
   - Onboarding & Xác thực tên thí sinh bắt buộc trước khi thi.
   - Thanh điều khiển nổi (Top Floating Action Bar).
   - Cơ chế Hook vòng đời bài thi (Lifecycle Interception).
   - Hệ thống Bảng Xếp Hạng (Leaderboard) & Thống kê thành tích.
   - Bộ chuyển đổi chế độ Luyện thi / Thi thật (Answer Visibility Toggle).

```
+---------------------------------------------------------------+
|                      Trình Duyệt Người Dùng                   |
+---------------------------------------------------------------+
|  Custom Layer (toeic-app.js / toeic-app.css)                  |
|  - Start Exam Modal (Required Name)                           |
|  - Top Action Bar (Candidate chip, Leaderboard, Toggle)       |
|  - Leaderboard Modal & CSV Export                             |
|  - Celebration Modal & ETS Scaled Score Calculation           |
+---------------------------------------------------------------+
                                 │
                   Hook Lifecycle & DOM Observer
                                 ▼
+---------------------------------------------------------------+
|  iSpring Core Runtime                                         |
|  - player.js (Presentation Controller, Slide transitions)     |
|  - quizplayer.js (Quiz Engine, Question visualizer, Timer)    |
|  - quiz1.js (TOEIC Question Bank, Compressed Data)            |
+---------------------------------------------------------------+
                                 │
                   Tải Assets Âm Thanh & Hình Ảnh
                                 ▼
+---------------------------------------------------------------+
|  Media & Assets (data/quiz1/*.mp3, *.jpg, *.woff)             |
+---------------------------------------------------------------+
```

---

## 2. Cơ Chế Hook Vòng Đời Bài Thi (Lifecycle Interception)

Để kết nối với iSpring mà không cần sửa đổi mã nguồn đã mã hóa của iSpring, hệ thống sử dụng kỹ thuật **Factory Wrapping + Event Listener**:

### A. Intercept Quiz Player Factory
Trong runtime của iSpring, quiz player được khởi tạo thông qua `iSpring.InteractionPlayerFactory.registerCreateQuizPlayerFunction`.
Hệ thống can thiệp vào hàm này ngay khi tải trang:

```javascript
var origReg = window.iSpring.InteractionPlayerFactory.registerCreateQuizPlayerFunction;
window.iSpring.InteractionPlayerFactory.registerCreateQuizPlayerFunction = function(creatorFn) {
    return origReg(function(a, b, c, d, e, g, h, k, m, p, t, v) {
        var wrappedK = function(quizPlayer) {
            // Lưu QuizPlayer instance
            state.activeQuizPlayer = quizPlayer;
            
            // Lắng nghe sự kiện phiên thi (Session)
            quizPlayer.currentSessionChangedEvent().addHandler(function(session) {
                state.activeQuizSession = session;
                session.quizStateChangeEvent().addHandler(function() {
                    if (session.quizState() === 'completed') {
                        onQuizSessionFinished(session);
                    }
                });
            });

            // Lắng nghe sự kiện nộp bài
            quizPlayer.quizPlayerEvent().addHandler(function(ev) {
                if (ev === 'quizFinished') {
                    onQuizSessionFinished(quizPlayer.currentSession());
                }
            });

            return k(quizPlayer);
        };
        return creatorFn(a, b, c, d, e, g, h, wrappedK, m, p, t, v);
    });
};
```

### B. Fallback DOM MutationObserver
Nhằm đảm bảo 100% không bị bỏ sót sự kiện khi người dùng hoàn thành bài thi qua bất kỳ giao diện nào (kể cả khi các API nội bộ của iSpring có sự thay đổi), một `MutationObserver` được duy trì liên tục để phát hiện sự xuất hiện của các phần tử màn hình kết quả:
- `.visualizer.result`
- `.detailed_results`
- `.groupsResult`

Khi phát hiện màn hình kết quả, hàm `onQuizSessionFinished` sẽ được kích hoạt với cờ bảo vệ `hasRecordedResult` để đảm bảo mỗi lần thi chỉ được ghi nhận đúng một lần.

---

## 3. Thuật Toán Xếp Hạng & Quy Đổi Điểm TOEIC

### A. Công thức quy đổi điểm TOEIC (~/990)
Điểm số thô trong bài thi là số câu hỏi đúng (ví dụ: $38 / 45$ câu, tương ứng $84.4\%$).
Để quy đổi sang thang điểm TOEIC quốc tế (10 - 990 điểm):

$$\text{ScaledScore} = \min\left(990, \max\left(10, \text{round}\left(\frac{10 + \frac{\text{Percent}}{100} \times 980}{5}\right) \times 5\right)\right)$$

*Kết quả luôn được làm tròn về bội số của 5 theo đúng quy chuẩn ETS.*

### B. Tiêu chí sắp xếp thứ hạng (Ranking Criteria)
Thứ hạng được xác định theo 3 cấp độ ưu tiên:
1. **Tỉ lệ chính xác (`percent` giảm dần)**: Thí sinh đạt điểm số cao hơn luôn đứng trước.
2. **Thời gian làm bài (`durationSeconds` tăng dần)**: Trong trường hợp bằng điểm, thí sinh làm bài nhanh hơn (tốn ít thời gian hơn) sẽ xếp trên.
3. **Thời điểm thi (`timestamp` tăng dần)**: Trong trường hợp cùng điểm và cùng thời gian, thí sinh hoàn thành trước được xếp trên.

---

## 4. Cấu Trúc Dữ Liệu (Data Schema)

### A. Thí sinh hiện tại (`toeic_candidate_info`)
```json
{
  "name": "Nguyễn Văn An",
  "email": "an.nv@example.com",
  "target": "650",
  "startTime": 1773302400000
}
```

### B. Bản ghi Bảng Xếp Hạng (`toeic_exam_leaderboard`)
```json
{
  "id": "entry-1773302400000",
  "name": "Nguyễn Văn An",
  "email": "an.nv@example.com",
  "score": 40,
  "maxScore": 45,
  "percent": 89,
  "scaledScore": 880,
  "duration": "21:30",
  "durationSeconds": 1290,
  "date": "11/10/2026 15:45",
  "timestamp": 1773302400000
}
```
