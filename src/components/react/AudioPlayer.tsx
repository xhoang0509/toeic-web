import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Repeat } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  title?: string;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  autoPlay = false,
  title = 'Bài nghe câu hỏi',
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const fullSrc = getAssetUrl(src);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if (autoPlay) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      audioRef.current.playbackRate = playbackRate;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.8, 1.0, 1.2, 1.5];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSec = (s: number) => {
    if (isNaN(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md text-white ${className}`}>
      <audio
        ref={audioRef}
        src={fullSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        loop={isLooping}
        preload="metadata"
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Info & Play */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Tạm dừng audio' : 'Phát audio'}
            className="w-11 h-11 shrink-0 rounded-full bg-sky-500 hover:bg-sky-400 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-sky-500/20"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <div className="truncate">
            <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">Audio Track</div>
            <div className="text-sm font-medium text-slate-200 truncate">{title}</div>
          </div>
        </div>

        {/* Middle: Progress Bar */}
        <div className="flex items-center gap-2 w-full sm:flex-1 max-w-md">
          <span className="text-xs font-mono text-slate-400 shrink-0 min-w-[36px]">
            {formatSec(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Thanh tiến độ phát audio"
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
          <span className="text-xs font-mono text-slate-400 shrink-0 min-w-[36px]">
            {formatSec(duration)}
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => skipTime(-5)}
            title="Lùi 5 giây"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center text-xs"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            <span className="text-[11px] font-mono">-5s</span>
          </button>

          <button
            type="button"
            onClick={() => skipTime(5)}
            title="Tua tới 5 giây"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center text-xs"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            <span className="text-[11px] font-mono">+5s</span>
          </button>

          <button
            type="button"
            onClick={cyclePlaybackRate}
            title="Đổi tốc độ phát"
            className="px-2 py-1 text-xs font-mono font-semibold text-sky-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={toggleLoop}
            title={isLooping ? 'Tắt lặp lại' : 'Bật lặp lại'}
            className={`p-1.5 rounded-lg transition-colors ${
              isLooping ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Bật âm' : 'Tắt âm'}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
