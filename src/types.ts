export interface SubtitleWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TikTokClip {
  id: string;
  jobId: string;
  hookTitle: string;
  start_timestamp: string; // HH:MM:SS
  end_timestamp: string; // HH:MM:SS
  startSec: number;
  endSec: number;
  videoUrl: string | null;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  subtitles: SubtitleWord[];
  createdAt: string;
}

export interface ShortsJob {
  id: string;
  userId: string;
  youtubeUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoTitle: string;
  videoThumbnail: string;
  duration: number; // in seconds
  createdAt: string;
  updatedAt: string;
  error?: string;
}
