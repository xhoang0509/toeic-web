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

const allExtracted = [];

data.p.I.forEach((grp, gIdx) => {
  const grpName = grp.n;
  grp.I.forEach((item, qIdx) => {
    const q = qMap[item.i];
    if (!q) return;

    let qType = q.t;
    let media = [];

    if (q.S && q.S.i && sndMap[q.S.i]) {
      media.push({ type: "audio", file: sndMap[q.S.i] });
    }
    if (q.I && q.I.i && imgMap[q.I.i]) {
      media.push({ type: "image", file: imgMap[q.I.i] });
    }

    let mediaTypeStr = "Text";
    const hasAudio = media.some(m => m.type === "audio");
    const hasImage = media.some(m => m.type === "image");
    if (hasAudio && hasImage) mediaTypeStr = "Audio + Image";
    else if (hasAudio) mediaTypeStr = "Audio";
    else if (hasImage) mediaTypeStr = "Image";

    let questionText = cleanHtml(q.d);
    let options = [];
    let correctAnswer = "";

    if (q.t === "bs") {
      questionText = (cleanHtml(q.d) + "\n" + cleanHtml(q.D)).trim();
      mediaTypeStr = "Instruction/Slide";
    } else if (q.t === "mc") {
      if (q.a && Array.isArray(q.a)) {
        q.a.forEach((ans, aIdx) => {
          const letter = String.fromCharCode(65 + aIdx);
          const ansText = cleanHtml(ans.t);
          options.push({ letter, text: ansText, isCorrect: !!ans.c });
          if (ans.c) {
            correctAnswer = `${letter}. ${ansText}`;
          }
        });
      }
    } else if (q.t === "mct") {
      mediaTypeStr = "Text (Passage with Dropdowns)";
      let passageParts = [];
      let blankIdx = 1;
      let blanksInfo = [];
      if (Array.isArray(q.D)) {
        q.D.forEach(part => {
          if (typeof part === "string") {
            passageParts.push(cleanHtml(part));
          } else if (part && typeof part === "object") {
            const correctOptIdx = part.c !== undefined ? part.c : 0;
            const bOptions = (part.a || []).map((opt, oIdx) => {
              const letter = String.fromCharCode(65 + oIdx);
              const oText = cleanHtml(opt);
              return { letter, text: oText, isCorrect: oIdx === correctOptIdx };
            });
            const cOpt = bOptions.find(o => o.isCorrect);
            blanksInfo.push({
              blankNumber: blankIdx,
              options: bOptions,
              correctAnswer: cOpt ? `${cOpt.letter}. ${cOpt.text}` : ""
            });
            passageParts.push(` [___Blank #${blankIdx}___] `);
            blankIdx++;
          }
        });
      }
      questionText = cleanHtml(q.d) + "\n\nPassage:\n" + passageParts.join("");
      options = blanksInfo;
      correctAnswer = blanksInfo.map(b => `Blank #${b.blankNumber}: ${b.correctAnswer}`).join(" | ");
    }

    allExtracted.push({
      id: q.i,
      group: grpName,
      type: qType,
      mediaType: mediaTypeStr,
      mediaFiles: media,
      question: questionText,
      options: options,
      correctAnswer: correctAnswer
    });
  });
});

console.log("Total extracted items:", allExtracted.length);
const grpStats = {};
allExtracted.forEach(e => {
  grpStats[e.group] = (grpStats[e.group] || 0) + 1;
});
console.log("Breakdown by group:", grpStats);

fs.writeFileSync("extracted_questions.json", JSON.stringify(allExtracted, null, 2));
