const fs = require("fs");
const data = JSON.parse(fs.readFileSync(".quiz_decoded.txt", "utf8"));

function cleanHtml(html) {
  if (!html) return "";
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  return text;
}

const imgMap = {};
(data.a.i || []).forEach(img => { imgMap[img.i] = img.s; });
const sndMap = {};
(data.a.s || []).forEach(snd => {
  if (snd.s && snd.s[0]) sndMap[snd.i] = snd.s[0].s;
});

const qMap = {};
data.q.forEach(q => { qMap[q.i] = q; });

let outMarkdown = "# TOÀN BỘ DANH SÁCH CÂU HỎI VÀ ĐÁP ÁN BÀI THI ĐÁNG GIÁ CƠ BẢN TOEIC\n\n";

data.p.I.forEach((grp, gIdx) => {
  outMarkdown += `\n---\n\n## 📁 ${grp.n}\n`;
  if (grp.s && grp.s.s && grp.s.s.r) {
    outMarkdown += `*Cơ chế: Chọn ngẫu nhiên ${grp.s.s.r.s} / ${grp.I.length} câu trong ngân hàng đề.*\n\n`;
  } else {
    outMarkdown += `*Cơ chế: Cố định toàn bộ ${grp.I.length} câu.*\n\n`;
  }

  grp.I.forEach((item, qIdx) => {
    const q = qMap[item.i];
    if (!q) return;

    let media = [];
    if (q.S && q.S.i && sndMap[q.S.i]) {
      media.push(`🔊 Audio: \`${sndMap[q.S.i]}\``);
    }
    if (q.I && q.I.i && imgMap[q.I.i]) {
      media.push(`🖼️ Image: \`${imgMap[q.I.i]}\``);
    }

    let mediaTypeStr = "Text";
    if (media.length === 2) mediaTypeStr = "Audio + Image";
    else if (q.S && q.S.i) mediaTypeStr = "Audio";
    else if (q.I && q.I.i) mediaTypeStr = "Image";

    if (q.t === "bs") {
      outMarkdown += `### 📌 Slide Hướng Dẫn: ${cleanHtml(q.d)}\n`;
      outMarkdown += `**Loại:** Slide thông tin / Hướng dẫn\n\n`;
      outMarkdown += `> ${cleanHtml(q.D).replace(/\n/g, "\n> ")}\n\n`;
    } else if (q.t === "mc") {
      outMarkdown += `### Câu hỏi ${qIdx + 1}: ${cleanHtml(q.d)}\n`;
      outMarkdown += `- **ID:** \`${q.i}\`\n`;
      outMarkdown += `- **Loại:** Multiple Choice (${mediaTypeStr})\n`;
      if (media.length > 0) {
        outMarkdown += `- **Tài nguyên Media:** ${media.join(" | ")}\n`;
      }
      outMarkdown += `- **Các lựa chọn:**\n`;
      let correctAns = "";
      (q.a || []).forEach((ans, aIdx) => {
        const letter = String.fromCharCode(65 + aIdx);
        const ansText = cleanHtml(ans.t);
        const isC = !!ans.c;
        if (isC) correctAns = `${letter}. ${ansText}`;
        outMarkdown += `  - [${isC ? "x" : " "}] **${letter}.** ${ansText} ${isC ? "*(ĐÁP ÁN ĐÚNG)*" : ""}\n`;
      });
      outMarkdown += `- **👉 Đáp án chính xác:** **${correctAns}**\n\n`;
    } else if (q.t === "mct") {
      outMarkdown += `### Câu hỏi ${qIdx + 1} (Điền vào đoạn văn): ${cleanHtml(q.d)}\n`;
      outMarkdown += `- **ID:** \`${q.i}\`\n`;
      outMarkdown += `- **Loại:** Passage with Dropdowns (Text Cloze)\n`;

      let passageText = "";
      let blankIdx = 1;
      let blanks = [];

      if (Array.isArray(q.D)) {
        q.D.forEach(part => {
          if (typeof part === "string") {
            passageText += cleanHtml(part);
          } else if (part && typeof part === "object") {
            const correctOptIdx = part.c !== undefined ? part.c : 0;
            const bOptions = (part.a || []).map((opt, oIdx) => {
              const letter = String.fromCharCode(65 + oIdx);
              const oText = cleanHtml(opt);
              return { letter, text: oText, isCorrect: oIdx === correctOptIdx };
            });
            const cOpt = bOptions.find(o => o.isCorrect);
            blanks.push({
              num: blankIdx,
              options: bOptions,
              correct: cOpt ? `${cOpt.letter}. ${cOpt.text}` : ""
            });
            passageText += ` **[👉 Chỗ trống #${blankIdx}]** `;
            blankIdx++;
          }
        });
      }

      outMarkdown += `\n**Đoạn văn:**\n\n${passageText}\n\n`;
      outMarkdown += `**Chi tiết đáp án cho từng chỗ trống:**\n`;
      blanks.forEach(b => {
        outMarkdown += `  - **Chỗ trống #${b.num}:**\n`;
        b.options.forEach(opt => {
          outMarkdown += `    - [${opt.isCorrect ? "x" : " "}] ${opt.letter}. ${opt.text} ${opt.isCorrect ? "*(ĐÚNG)*" : ""}\n`;
        });
        outMarkdown += `    - **👉 Đáp án đúng:** **${b.correct}**\n`;
      });
      outMarkdown += "\n";
    }
  });
});

fs.writeFileSync("FULL_QUESTIONS_AND_ANSWERS.md", outMarkdown);
console.log("Written FULL_QUESTIONS_AND_ANSWERS.md successfully! Length:", outMarkdown.length);
