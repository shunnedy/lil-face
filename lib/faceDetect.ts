'use client';
import { FaceLandmark } from '@/types/editor';

let detectorInstance: unknown = null;
let detectorLoading = false;
const listeners: Array<() => void> = [];

export async function getDetector(): Promise<unknown> {
  if (detectorInstance) return detectorInstance;
  if (detectorLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (detectorInstance) {
          clearInterval(check);
          resolve(detectorInstance);
        }
      }, 200);
    });
  }

  detectorLoading = true;
  try {
    const [tf, faceLandmarksDetection] = await Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/face-landmarks-detection'),
    ]);

    await tf.ready();

    const detector = await (faceLandmarksDetection as {
      createDetector: (model: unknown, config: unknown) => Promise<unknown>;
      SupportedModels: { MediaPipeFaceMesh: unknown };
    }).createDetector(
      (faceLandmarksDetection as { SupportedModels: { MediaPipeFaceMesh: unknown } }).SupportedModels.MediaPipeFaceMesh,
      {
        runtime: 'tfjs',
        refineLandmarks: false,
        maxFaces: 1,
      }
    );

    detectorInstance = detector;
    detectorLoading = false;
    listeners.forEach(fn => fn());
    return detector;
  } catch (e) {
    detectorLoading = false;
    throw e;
  }
}

export async function detectFaceLandmarks(
  canvas: HTMLCanvasElement,
): Promise<FaceLandmark[] | null> {
  const detector = await getDetector() as {
    estimateFaces: (input: HTMLCanvasElement) => Promise<Array<{ keypoints: Array<{x: number; y: number; z: number; name?: string}> }>>;
  };
  if (!detector) return null;

  try {
    const faces = await detector.estimateFaces(canvas);
    if (!faces || faces.length === 0) return null;

    return faces[0].keypoints.map(kp => ({
      x: kp.x,
      y: kp.y,
      z: kp.z ?? 0,
      name: kp.name,
    }));
  } catch {
    return null;
  }
}
