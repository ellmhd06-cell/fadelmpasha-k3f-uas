import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, X } from 'lucide-react';

interface CameraSelfieModalProps {
  open: boolean;
  mode?: 'clock_in' | 'clock_out';
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 480;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('Gagal memproses foto.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.readAsDataURL(file);
  });
}

export const CameraSelfieModal: React.FC<CameraSelfieModalProps> = ({
  open,
  mode = 'clock_in',
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCapturedUrl(null);
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser tidak mendukung akses kamera langsung. Gunakan unggah file di bawah.');
      return;
    }

    try {
      setStarting(true);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        // Fallback if specific facingMode constraint is unavailable on desktop webcams
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError(
        'Akses kamera tidak tersedia atau belum diizinkan. Pastikan izin kamera aktif atau pilih foto dari galeri.',
      );
    } finally {
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedUrl(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  if (!open) return null;

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const maxW = 480;
    const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally to match selfie preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    setCapturedUrl(dataUrl);
    stopCamera();
  };

  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      stopCamera();
      onCapture(dataUrl);
      onClose();
    } catch {
      setCameraError('Gagal memproses file foto yang dipilih.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-selfie-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 id="camera-selfie-title" className="font-display text-base font-semibold text-slate-900">
              {mode === 'clock_out'
                ? 'Selfie Presensi Pulang (CLOCK OUT)'
                : 'Selfie Presensi Masuk (CLOCK IN)'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'clock_out'
                ? 'Ambil foto wajah secara langsung sebagai bukti CLOCK OUT'
                : 'Ambil foto wajah secara langsung sebagai bukti CLOCK IN'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kamera"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative aspect-[4/3] w-full rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center">
            {capturedUrl ? (
              <img
                src={capturedUrl}
                alt="Hasil foto selfie presensi"
                className="w-full h-full object-cover"
              />
            ) : cameraError ? (
              <div className="px-5 text-center space-y-2">
                <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-200 leading-relaxed">{cameraError}</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {starting && (
                  <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">Mengaktifkan kamera...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {capturedUrl ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={startCamera}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Foto Ulang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCapture(capturedUrl);
                  onClose();
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <span>Gunakan Foto Ini</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {!cameraError && (
                <button
                  type="button"
                  disabled={starting}
                  onClick={handleSnap}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto Selfie</span>
                </button>
              )}

              <div className="flex items-center justify-between gap-2">
                <label className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pilih dari Galeri / File</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFallbackFile}
                    className="hidden"
                  />
                </label>
                {cameraError && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Coba Kamera Lagi
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
