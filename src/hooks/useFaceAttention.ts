import { useState, useEffect, useRef, useCallback } from 'react';

export type AttentionLevel = 'focused' | 'slightly_distracted' | 'distracted';

export interface DistractionEvent {
  timestamp: number;
  duration: number;
  level: AttentionLevel;
}

interface FaceAttentionState {
  attentionLevel: AttentionLevel;
  focusStreak: number; // seconds of continuous focus
  distractionSeconds: number; // current distraction duration
  distractionLog: DistractionEvent[];
  cameraActive: boolean;
  cameraError: string | null;
  faceDetected: boolean;
}

export const useFaceAttention = (enabled: boolean) => {
  const [state, setState] = useState<FaceAttentionState>({
    attentionLevel: 'focused',
    focusStreak: 0,
    distractionSeconds: 0,
    distractionLog: [],
    cameraActive: false,
    cameraError: null,
    faceDetected: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const distractionStartRef = useRef<number | null>(null);
  const focusStartRef = useRef<number>(Date.now());
  const lastDetectionRef = useRef<{ facePresent: boolean; gazeAway: boolean }>({
    facePresent: true,
    gazeAway: false,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const cleanup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    faceLandmarkerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      setState(s => ({ ...s, cameraActive: false, cameraError: null }));
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        // Get webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Create hidden video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play();
        videoRef.current = video;

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        canvasRef.current = canvas;

        // Load MediaPipe FaceLandmarker
        const vision = await import('@mediapipe/tasks-vision');
        const { FaceLandmarker, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        });

        if (cancelled) return;
        faceLandmarkerRef.current = faceLandmarker;

        setState(s => ({ ...s, cameraActive: true, cameraError: null }));
        focusStartRef.current = Date.now();

        // Start detection loop
        const detect = () => {
          if (cancelled || !faceLandmarkerRef.current || !videoRef.current) return;

          const now = performance.now();
          let facePresent = false;
          let gazeAway = false;

          try {
            const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, now);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              facePresent = true;
              const landmarks = results.faceLandmarks[0];

              // Nose tip (1), left eye (33), right eye (263)
              const nose = landmarks[1];
              
              // Check if face is roughly centered (not turned away)
              // nose.x: 0=left edge, 1=right edge of frame. Center ~0.5
              // nose.y: 0=top, 1=bottom
              const xDeviation = Math.abs(nose.x - 0.5);
              const yDeviation = Math.abs(nose.y - 0.5);

              // If nose is too far from center, they're looking away
              if (xDeviation > 0.25 || yDeviation > 0.3) {
                gazeAway = true;
              }

              // Also check blendshapes for eye direction if available
              if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                const shapes = results.faceBlendshapes[0].categories;
                const eyeLookLeft = shapes.find((s: any) => s.categoryName === 'eyeLookOutLeft')?.score || 0;
                const eyeLookRight = shapes.find((s: any) => s.categoryName === 'eyeLookOutRight')?.score || 0;
                const eyeLookUp = shapes.find((s: any) => s.categoryName === 'eyeLookUpLeft')?.score || 0;
                
                // Strong lateral or upward gaze
                if (eyeLookLeft > 0.6 || eyeLookRight > 0.6 || eyeLookUp > 0.5) {
                  gazeAway = true;
                }
              }
            }
          } catch {
            // Detection error, assume no face
          }

          lastDetectionRef.current = { facePresent, gazeAway };
          const isDistracted = !facePresent || gazeAway;

          setState(prev => {
            const nowMs = Date.now();
            let newLevel: AttentionLevel = 'focused';
            let newDistractionSec = 0;
            let newFocusStreak = prev.focusStreak;
            let newLog = prev.distractionLog;

            if (isDistracted) {
              if (!distractionStartRef.current) {
                distractionStartRef.current = nowMs;
              }
              newDistractionSec = Math.floor((nowMs - distractionStartRef.current) / 1000);

              if (newDistractionSec >= 10) {
                newLevel = 'distracted';
              } else if (newDistractionSec >= 5) {
                newLevel = 'slightly_distracted';
              } else {
                newLevel = prev.attentionLevel === 'focused' ? 'focused' : prev.attentionLevel;
              }

              if (newDistractionSec >= 3) {
                newFocusStreak = 0;
              }
            } else {
              // Was distracted, now focused again — log it
              if (distractionStartRef.current) {
                const dur = Math.floor((nowMs - distractionStartRef.current) / 1000);
                if (dur >= 3) {
                  newLog = [...prev.distractionLog, {
                    timestamp: distractionStartRef.current,
                    duration: dur,
                    level: dur >= 10 ? 'distracted' : 'slightly_distracted',
                  }];
                }
                distractionStartRef.current = null;
              }
              newLevel = 'focused';
              newFocusStreak = Math.floor((nowMs - focusStartRef.current) / 1000);
              if (prev.attentionLevel !== 'focused') {
                focusStartRef.current = nowMs;
                newFocusStreak = 0;
              }
            }

            return {
              ...prev,
              faceDetected: facePresent,
              attentionLevel: newLevel,
              distractionSeconds: newDistractionSec,
              focusStreak: newFocusStreak,
              distractionLog: newLog,
            };
          });

          animFrameRef.current = requestAnimationFrame(detect);
        };

        detect();
      } catch (err: any) {
        if (!cancelled) {
          setState(s => ({
            ...s,
            cameraActive: false,
            cameraError: err?.message || 'Camera access denied',
          }));
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, cleanup]);

  return state;
};
