import type { WordCard } from '../domain/types';

let audio: HTMLAudioElement | undefined;

/** 停止上一次播放；网络音频失败时退回英文语音合成。 */
export async function speak(card: WordCard): Promise<void> {
  audio?.pause();
  window.speechSynthesis?.cancel();
  if (card.audioUrl) {
    try { audio = new Audio(card.audioUrl); await audio.play(); return; } catch { /* 离线时使用系统语音。 */ }
  }
  if (window.AndroidTTS?.speak?.(card.content, 'en-US')) return;
  if (!window.speechSynthesis) throw new Error('当前设备没有可用的语音服务');
  const speech = new SpeechSynthesisUtterance(card.content);
  speech.lang = 'en-US';
  const voice = speechSynthesis.getVoices().find(item => item.lang.startsWith('en'));
  if (voice) speech.voice = voice;
  speechSynthesis.speak(speech);
}
