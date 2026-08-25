const fs = require("fs");
const zlib = require("zlib");

const quiz1File = "data/quiz1.js";
const code = fs.readFileSync(quiz1File, "utf8");
const match = code.match(/var quizInfo = "([^"]+)"/);

if (!match) {
  console.error("Could not find quizInfo in", quiz1File);
  process.exit(1);
}

const raw = zlib.inflateSync(Buffer.from(match[1], "base64")).toString("utf8");
const data = JSON.parse(raw);

let modifiedCount = 0;
data.q.forEach(q => {
  if (q.t === "mc" && q.a && Array.isArray(q.a)) {
    const correctLetters = [];
    q.a.forEach((ans, idx) => {
      if (ans.c) {
        correctLetters.push(String.fromCharCode(65 + idx));
      }
    });

    if (correctLetters.length > 0) {
      const ansStr = correctLetters.join(", ");
      // Remove any previously injected answer paragraph if present
      let cleanD = q.d || "";
      cleanD = cleanD.replace(/<p[^>]*class=['"]toeic-answer-line['"][^>]*>[\s\S]*?<\/p>/gi, "");
      cleanD = cleanD.replace(/<p[^>]*>.*?Đáp án.*?<\/p>/gi, "");

      // Injected answer block with class="toeic-answer-line" and data attribute for easy selection
      const answerHtml = `<p class='toeic-answer-line' style='text-align:left;margin-top:4px;'><span style='color:#FF1418;font-size:16px;font-weight:bold;font-family:fnt1_49947,Open Sans Semibold;'>Đáp án là ( ${ansStr} )</span></p>`;
      q.d = cleanD + answerHtml;
      modifiedCount++;
    }
  } else if (q.t === "mct" && Array.isArray(q.D)) {
    const blankAnswers = [];
    let bIdx = 1;
    q.D.forEach(part => {
      if (part && typeof part === "object" && Array.isArray(part.a)) {
        const cIdx = part.c !== undefined ? part.c : 0;
        const letter = String.fromCharCode(65 + cIdx);
        blankAnswers.push(`Blank #${bIdx}: (${letter})`);
        bIdx++;
      }
    });

    if (blankAnswers.length > 0) {
      const ansStr = blankAnswers.join(" | ");
      let cleanD = q.d || "";
      cleanD = cleanD.replace(/<p[^>]*class=['"]toeic-answer-line['"][^>]*>[\s\S]*?<\/p>/gi, "");
      cleanD = cleanD.replace(/<p[^>]*>.*?Đáp án.*?<\/p>/gi, "");

      const answerHtml = `<p class='toeic-answer-line' style='text-align:left;margin-top:4px;'><span style='color:#FF1418;font-size:14px;font-weight:bold;font-family:fnt1_49947,Open Sans Semibold;'>Đáp án: ${ansStr}</span></p>`;
      q.d = cleanD + answerHtml;
      modifiedCount++;
    }
  }
});

console.log(`Updated ${modifiedCount} questions with class-tagged answer lines.`);

const newJsonStr = JSON.stringify(data);
const newDeflated = zlib.deflateSync(Buffer.from(newJsonStr, "utf8"));
const newBase64 = newDeflated.toString("base64");

const updatedCode = code.replace(/var quizInfo = "[^"]+"/, `var quizInfo = "${newBase64}"`);
fs.writeFileSync(quiz1File, updatedCode, "utf8");
console.log("Successfully wrote data/quiz1.js!");
