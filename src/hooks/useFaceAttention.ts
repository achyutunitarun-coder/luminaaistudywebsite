import { useState, useEffect, useRef, useCallback } from 'react';

export type AttentionLevel = 'focused' | 'slightly_distracted' | 'distracted';

export interface DistractionEvent {
  timestamp: number;
  duration: number;
  level: AttentionLevel;
}

interface FaceAttentionState {
  attentionLevel: AttentionLevel;
  focusStreak: number;
  distractionSeconds: number;
  distractionLog: DistractionEvent[];
  cameraActive: boolean;
  cameraError: string | null;
  faceDetected: boolean;
}

export const useFaceAttention = (enabled: boolean) => {
  const lastKeystrokeRef = useRef<number>(0);
  const TYPING_GRACE_MS = 2000; // Suppress distraction alerts for 2s after typing

  // Listen for any keystrokes globally to detect typing
  useEffect(() => {
    if (!enabled) return;
    const handler = () => { lastKeystrokeRef.current = Date.now(); };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled]);

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

  // Smoothing: require consecutive distracted frames before triggering
  const distractedFrameCountRef = useRef(0);
  const DISTRACTED_FRAME_THRESHOLD = 3; // need 3 consecutive frames

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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play();
        videoRef.current = video;

        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        canvasRef.current = canvas;

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

        let lastProcessTime = 0;
        const PROCESS_INTERVAL = 200; // Process every 200ms instead of every frame

        const detect = () => {
          if (cancelled || !faceLandmarkerRef.current || !videoRef.current) return;

          const now = performance.now();
          
          // Throttle detection to reduce CPU and improve reliability
          if (now - lastProcessTime < PROCESS_INTERVAL) {
            animFrameRef.current = requestAnimationFrame(detect);
            return;
          }
          lastProcessTime = now;

          let facePresent = false;
          let gazeAway = false;

          try {
            const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, now);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              facePresent = true;
              const landmarks = results.faceLandmarks[0];

              // Nose tip position check — lowered thresholds for sensitivity
              const nose = landmarks[1];
              const xDeviation = Math.abs(nose.x - 0.5);
              const yDeviation = Math.abs(nose.y - 0.5);

              // More sensitive: trigger at smaller deviations
              if (xDeviation > 0.15 || yDeviation > 0.2) {
                gazeAway = true;
              }

              // Blendshape eye tracking — lowered thresholds
              if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                const shapes = results.faceBlendshapes[0].categories;
                const getScore = (name: string) => shapes.find((s: any) => s.categoryName === name)?.score || 0;

                const eyeLookOutLeft = getScore('eyeLookOutLeft');
                const eyeLookOutRight = getScore('eyeLookOutRight');
                const eyeLookUpLeft = getScore('eyeLookUpLeft');
                const eyeLookUpRight = getScore('eyeLookUpRight');
                const eyeLookDownLeft = getScore('eyeLookDownLeft');
                const eyeLookDownRight = getScore('eyeLookDownRight');
                const eyeLookInLeft = getScore('eyeLookInLeft');
                const eyeLookInRight = getScore('eyeLookInRight');

                // Lateral gaze: both eyes looking same direction
                const lookingLeft = eyeLookOutLeft > 0.35 || eyeLookInRight > 0.35;
                const lookingRight = eyeLookOutRight > 0.35 || eyeLookInLeft > 0.35;
                const lookingUp = (eyeLookUpLeft + eyeLookUpRight) / 2 > 0.3;
                const lookingDown = (eyeLookDownLeft + eyeLookDownRight) / 2 > 0.45;

                if (lookingLeft || lookingRight || lookingUp || lookingDown) {
                  gazeAway = true;
                }
              }
            }
          } catch {
            // Detection error
          }

          // Frame smoothing to avoid flicker
          const rawDistracted = !facePresent || gazeAway;
          if (rawDistracted) {
            distractedFrameCountRef.current++;
          } else {
            distractedFrameCountRef.current = 0;
          }

          const isDistracted = distractedFrameCountRef.current >= DISTRACTED_FRAME_THRESHOLD;

          lastDetectionRef.current = { facePresent, gazeAway };

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

              if (newDistractionSec >= 6) {
                newLevel = 'distracted';
              } else if (newDistractionSec >= 2) {
                newLevel = 'slightly_distracted';
              } else {
                // Even under 2s, show slight distraction immediately
                newLevel = 'slightly_distracted';
              }

              newFocusStreak = 0;
            } else {
              // Was distracted, now focused again — log it
              if (distractionStartRef.current) {
                const dur = Math.floor((nowMs - distractionStartRef.current) / 1000);
                if (dur >= 2) {
                  newLog = [...prev.distractionLog, {
                    timestamp: distractionStartRef.current,
                    duration: dur,
                    level: dur >= 6 ? 'distracted' : 'slightly_distracted',
                  }];
                }
                distractionStartRef.current = null;
              }
              newLevel = 'focused';
              if (prev.attentionLevel !== 'focused') {
                focusStartRef.current = nowMs;
                newFocusStreak = 0;
              } else {
                newFocusStreak = Math.floor((nowMs - focusStartRef.current) / 1000);
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
