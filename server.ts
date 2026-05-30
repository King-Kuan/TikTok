import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Firebase App on Server Side
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Initialize Gemini SDK with custom Telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper: Extract YouTube ID
function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

// REST Backend API endpoints

// 1. Submit background process job (instant 202 response)
app.post('/api/process', async (req, res) => {
  const { youtubeUrl, userId } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: 'youtubeUrl is required' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId (auth uid) is required' });
  }

  const videoId = getYoutubeId(youtubeUrl);
  const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // Default video metadata
  const thumbnail = videoId 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` 
    : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=60';

  const initialJob = {
    id: jobId,
    userId,
    youtubeUrl,
    status: 'pending',
    videoTitle: 'Fetching video info...',
    videoThumbnail: thumbnail,
    duration: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    // Write starting pending status to Firestore
    await setDoc(doc(db, 'jobs', jobId), initialJob);

    // Run the AI analysis pipeline asynchronously in the background
    runBackgroundAIAnalysis(jobId, youtubeUrl, videoId, userId);

    // Return 22 accepted within 100ms
    return res.status(202).json({ 
      success: true, 
      message: 'Job submitted and started analyzing in background.', 
      jobId 
    });
  } catch (error: any) {
    console.error('Failed to register job in Firestore:', error);
    return res.status(500).json({ error: 'Failed to queue analysis job: ' + error.message });
  }
});

// 2. Trigger active render (Simulated Remotion MP4 Render)
app.post('/api/render', async (req, res) => {
  const { jobId, clipId } = req.body;

  if (!jobId || !clipId) {
    return res.status(400).json({ error: 'jobId and clipId are required' });
  }

  try {
    const clipRef = doc(db, 'jobs', jobId, 'clips', clipId);
    
    // Update status to rendering
    await updateDoc(clipRef, { status: 'rendering' });

    // Simulate standard Remotion rendering pipeline + ImageKit upload asynchronously
    setTimeout(async () => {
      try {
        const renderUrls = [
          'https://assets.mixkit.co/videos/preview/mixkit-urban-traffic-under-neon-signboards-in-shinjuku-43753-large.mp4',
          'https://assets.mixkit.co/videos/preview/mixkit-young-man-dancing-happy-neon-lights-42284-large.mp4',
          'https://assets.mixkit.co/videos/preview/mixkit-creative-workspace-with-computer-of-vlogger-41656-large.mp4',
          'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-video-editor-editing-colored-clips-40995-large.mp4'
        ];
        const videoUrl = renderUrls[Math.floor(Math.random() * renderUrls.length)];

        await updateDoc(clipRef, {
          status: 'completed',
          videoUrl: videoUrl,
        });
        console.log(`Render succeeded for Clip ${clipId} of Job ${jobId}`);
      } catch (err) {
        console.error('Background render step error:', err);
        await updateDoc(clipRef, { status: 'failed' });
      }
    }, 4000); // 4 seconds simulated render

    return res.json({ success: true, message: 'Rendering started in background.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to start rendering: ' + error.message });
  }
});

// Background Worker Pipeline function (Gemini 3.5 Flash Analysis)
async function runBackgroundAIAnalysis(jobId: string, url: string, videoId: string | null, userId: string) {
  const jobRef = doc(db, 'jobs', jobId);

  try {
    // 1. Mark status as processing
    await updateDoc(jobRef, { status: 'processing', updatedAt: new Date().toISOString() });

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in the backend server environment variables.');
    }

    // Prepare advanced prompt utilizing search grounding to retrieve actual YouTube metadata
    const analysisPrompt = `Analyze this YouTube video link: ${url}.
1. Search via Google to retrieve the actual, real video title and its topic context.
2. Based on this topic, break down the content and identify high-value viral TikTok shorts clips. Target up to 20 clips if the video is long enough, or fewer (down to 5) if the video is short. Each segment should represent a continuous 30-60 seconds context.
3. For each segment, provide:
   - A highly engaging hookTitle (e.g. "The $10,000 Secret.. 🤫")
   - A precise 'start_timestamp' (HH:MM:SS) and 'end_timestamp'
   - A list of word-by-word subtitle simulation. To keep response payload structured and avoid token limits, generate word-by-word subtitles containing 10-15 key words for the primary hook statement of that clip segment relative to the start of the clip. Conform timestamps (start_ms, end_ms) so they play correctly.
4. Conform strictly to the responseSchema provided.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: analysisPrompt,
      config: {
        systemInstruction: `You are an expert TikTok editor. Identify between 5 and 20 high-engagement segments (30-60s each) that open with an immediate hook. For each segment, provide word-by-word subtitles with millisecond timestamps relative to the start of that specific clip. Minimize total words to stay within payload limits.`,
        responseMimeType: 'application/json',
        tools: [{ googleSearch: {} }], // Grounding for real YouTube info
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actualVideoTitle: { type: Type.STRING, description: "The exact name of the scanned YouTube video" },
            estimatedDurationSecs: { type: Type.INTEGER, description: "Estimated length of the video in seconds" },
            clips: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hookTitle: { type: Type.STRING },
                  start_timestamp: { type: Type.STRING, description: "HH:MM:SS format relative to video start" },
                  end_timestamp: { type: Type.STRING, description: "HH:MM:SS format relative to video end" },
                  subtitles: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        start_ms: { type: Type.INTEGER },
                        end_ms: { type: Type.INTEGER }
                      },
                      required: ["word", "start_ms", "end_ms"]
                    }
                  }
                },
                required: ["hookTitle", "start_timestamp", "end_timestamp", "subtitles"]
              }
            }
          },
          required: ["actualVideoTitle", "clips"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Gemini returned an empty structured output response.');
    }

    // Clean up possible markdown json wrapping before parsing
    let cleanedText = outputText.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?|```$/g, '').trim();
    }

    const outputObj = JSON.parse(cleanedText);
    const videoTitle = outputObj.actualVideoTitle || `Viral Shorts from YouTube Link`;
    const duration = outputObj.estimatedDurationSecs || 600;
    const clipsList = outputObj.clips || [];

    // Helper: Turn HH:MM:SS to seconds
    const parseTimeToSec = (ts: string): number => {
      const parts = ts.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return 0;
    };

    // 2. Write the 20 viral clips directly as individual Firestore docs
    for (let i = 0; i < clipsList.length; i++) {
      const targetClip = clipsList[i];
      const clipId = `clip_${i + 1}`;
      const startSec = parseTimeToSec(targetClip.start_timestamp);
      const endSec = parseTimeToSec(targetClip.end_timestamp) || (startSec + 45);

      const dbClipDoc = {
        id: clipId,
        jobId,
        hookTitle: targetClip.hookTitle || `Viral Chapter #${i + 1}`,
        start_timestamp: targetClip.start_timestamp,
        end_timestamp: targetClip.end_timestamp,
        startSec,
        endSec,
        videoUrl: null,
        status: 'pending',
        subtitles: targetClip.subtitles || [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'jobs', jobId, 'clips', clipId), dbClipDoc);
    }

    // 3. Mark job status as completed
    await updateDoc(jobRef, {
      status: 'completed',
      videoTitle,
      duration,
      updatedAt: new Date().toISOString()
    });

    console.log(`Job pipeline completed successfully for Job: ${jobId}`);
  } catch (error: any) {
    console.error(`AI Analysis Pipeline error for Job ${jobId}:`, error);

    // Update state to failed
    await updateDoc(jobRef, {
      status: 'failed',
      error: error.message || String(error),
      updatedAt: new Date().toISOString()
    });
  }
}

// Global JSON Error Handler for robust API route error recovery
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Express Route Error:", err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Serving UI and handling Dev Middleware Setup

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TikTok Shorts Generator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
