import type { ExamResult } from '../data/types';
import { Storage } from './storage';

export async function syncExamResultToWebhook(result: ExamResult): Promise<boolean> {
  const settings = Storage.getSettings();
  if (!settings.webhookUrl || !settings.autoSync) {
    return false;
  }

  try {
    const payload = {
      name: result.candidateName,
      email: result.candidateId,
      score: result.totalCorrect,
      maxScore: result.totalQuestions,
      percent: Math.round((result.totalCorrect / result.totalQuestions) * 100),
      scaledScore: result.totalScaledScore,
      duration: `${Math.floor(result.timeSpentSeconds / 60)} phút ${result.timeSpentSeconds % 60} giây`,
      completedAt: result.completedAt,
      cefrLevel: result.cefrLevel,
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
