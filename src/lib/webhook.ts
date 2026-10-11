import type { ExamResult } from '../data/types';
import { Storage } from './storage';
import { generateSha256 } from './crypto';

export async function syncExamResultToWebhook(result: ExamResult): Promise<boolean> {
  const settings = Storage.getSettings();
  if (!settings.webhookUrl || !settings.autoSync) {
    return false;
  }

  try {
    const timestamp = Date.now();
    const token = settings.secretToken || '';

    // Tạo chữ ký số SHA256: name|score|scaledScore|timestamp|secretToken
    const rawSignatureData = `${result.candidateName}|${result.totalCorrect}|${result.totalScaledScore}|${timestamp}|${token}`;
    const signature = await generateSha256(rawSignatureData);

    const payload = {
      name: result.candidateName,
      email: result.candidateId,
      targetScore: result.targetScore,
      score: result.totalCorrect,
      maxScore: result.totalQuestions,
      percent: Math.round((result.totalCorrect / result.totalQuestions) * 100),
      scaledScore: result.totalScaledScore,
      scaledListening: result.scaledListening,
      scaledReading: result.scaledReading,
      duration: `${Math.floor(result.timeSpentSeconds / 60)} phút ${result.timeSpentSeconds % 60} giây`,
      completedAt: result.completedAt,
      cefrLevel: result.cefrLevel,
      timestamp,
      authToken: token,
      signature,
    };

    await fetch(settings.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.warn('Webhook sync failed:', error);
    return false;
  }
}
