'use client';

import NextImage from "next/image";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  backgroundType: "color" | "image";
  backgroundValue: string;
};

const VIDEO_FPS = 30;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createDefaultSlides = (): Slide[] => [
  {
    id: generateId(),
    title: "Welcome to Your Story",
    subtitle: "Craft a narrative with visuals and motion in seconds.",
    duration: 3,
    backgroundType: "color",
    backgroundValue: "#111827",
  },
  {
    id: generateId(),
    title: "Add Your Highlights",
    subtitle: "Combine images, captions, and pacing to match your voice.",
    duration: 3,
    backgroundType: "color",
    backgroundValue: "#1f2937",
  },
  {
    id: generateId(),
    title: "Download and Share",
    subtitle: "Export your cinematic summary as a shareable video.",
    duration: 3,
    backgroundType: "color",
    backgroundValue: "#312e81",
  },
];

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>(() => createDefaultSlides());
  const [selectedId, setSelectedId] = useState<string>(() => slides[0]?.id ?? "");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRunningRef = useRef(false);

  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedId) ?? slides[0] ?? null,
    [slides, selectedId],
  );

  const updateSlide = useCallback(
    (slideId: string, data: Partial<Slide>) => {
      setSlides((prev) =>
        prev.map((slide) => (slide.id === slideId ? { ...slide, ...data } : slide)),
      );
    },
    [setSlides],
  );

  const addSlide = useCallback(() => {
    const newSlide: Slide = {
      id: generateId(),
      title: "New Scene",
      subtitle: "Describe your moment here and fine-tune the pacing.",
      duration: 3,
      backgroundType: "color",
      backgroundValue: "#0f172a",
    };
    setSlides((prev) => [...prev, newSlide]);
    setSelectedId(newSlide.id);
  }, []);

  const removeSlide = useCallback(
    (slideId: string) => {
      setSlides((prev) => {
        const next = prev.filter((slide) => slide.id !== slideId);
        if (next.length === 0) {
          const fallback = createDefaultSlides();
          setSelectedId(fallback[0].id);
          return fallback;
        }
        if (!next.some((slide) => slide.id === selectedId)) {
          setSelectedId(next[0].id);
        }
        return next;
      });
    },
    [selectedId],
  );

  const ensureImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const drawSlide = useCallback(
    async (ctx: CanvasRenderingContext2D, slide: Slide) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (slide.backgroundType === "color") {
        ctx.fillStyle = slide.backgroundValue || "#111827";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else if (slide.backgroundType === "image" && slide.backgroundValue) {
        try {
          const img = await ensureImage(slide.backgroundValue);
          const imageRatio = img.width / img.height;
          const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
          let drawWidth = CANVAS_WIDTH;
          let drawHeight = CANVAS_HEIGHT;
          if (imageRatio > canvasRatio) {
            drawHeight = CANVAS_HEIGHT;
            drawWidth = drawHeight * imageRatio;
          } else {
            drawWidth = CANVAS_WIDTH;
            drawHeight = drawWidth / imageRatio;
          }
          const offsetX = (CANVAS_WIDTH - drawWidth) / 2;
          const offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        } catch {
          ctx.fillStyle = "#111827";
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
      } else {
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, CANVAS_HEIGHT * 0.4);
      gradient.addColorStop(0, "rgba(0,0,0,0.70)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";

      const titleFontSize = 64;
      ctx.font = `700 ${titleFontSize}px 'Inter', 'Segoe UI', sans-serif`;
      wrapText(ctx, slide.title, 80, CANVAS_HEIGHT - 220, CANVAS_WIDTH - 160, titleFontSize + 8);

      ctx.font = `400 32px 'Inter', 'Segoe UI', sans-serif`;
      ctx.fillStyle = "rgba(248,250,252,0.85)";
      wrapText(ctx, slide.subtitle, 80, CANVAS_HEIGHT - 80, CANVAS_WIDTH - 160, 44);
    },
    [ensureImage],
  );

  const stopPreview = useCallback(() => {
    previewRunningRef.current = false;
    setIsPreviewing(false);
    setProgress(0);
  }, []);

  const previewSlides = useCallback(async () => {
    if (previewRunningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    previewRunningRef.current = true;
    setIsPreviewing(true);
    setProgress(0);
    const totalDurationMs = slides.reduce((acc, slide) => acc + slide.duration * 1000, 0);
    let elapsed = 0;
    for (const slide of slides) {
      const frameCount = Math.max(1, Math.round(slide.duration * VIDEO_FPS));
      for (let frame = 0; frame < frameCount; frame++) {
        if (!previewRunningRef.current) {
          stopPreview();
          return;
        }
        await drawSlide(ctx, slide);
        await delay(1000 / VIDEO_FPS);
        elapsed += 1000 / VIDEO_FPS;
        setProgress(Math.min(100, (elapsed / totalDurationMs) * 100));
      }
    }
    stopPreview();
  }, [drawSlide, slides, stopPreview]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedSlide || previewRunningRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    void drawSlide(ctx, selectedSlide);
  }, [drawSlide, selectedSlide]);

  const handleBackgroundUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, slideId: string) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const dataUrl = await readFileAsDataUrl(file);
      updateSlide(slideId, { backgroundType: "image", backgroundValue: dataUrl });
    },
    [updateSlide],
  );

  const generateVideo = useCallback(async () => {
    if (isRendering) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (previewRunningRef.current) {
      stopPreview();
      await delay(100);
    }

    setRenderError(null);
    setVideoUrl(null);
    setIsRendering(true);
    setProgress(0);

    try {
      const stream = canvas.captureStream(VIDEO_FPS);
      if (!stream) throw new Error("Unable to capture canvas stream");

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error("This browser does not support WebM recording.");
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const recorderStopped = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (event) => reject(event.error);
      });

      recorder.start();

      const totalDurationMs = slides.reduce((acc, slide) => acc + slide.duration * 1000, 0);
      let elapsed = 0;

      for (const slide of slides) {
        const frameCount = Math.max(1, Math.round(slide.duration * VIDEO_FPS));
        for (let frame = 0; frame < frameCount; frame++) {
          await drawSlide(ctx, slide);
          await delay(1000 / VIDEO_FPS);
          elapsed += 1000 / VIDEO_FPS;
          setProgress(Math.min(100, (elapsed / totalDurationMs) * 100));
        }
      }

      recorder.stop();
      await recorderStopped;

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setProgress(100);
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : "Failed to render video.");
    } finally {
      setIsRendering(false);
    }
  }, [drawSlide, isRendering, slides, stopPreview]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-sm uppercase tracking-[0.4rem] text-slate-400">Storyforge</p>
            <h1 className="text-2xl font-semibold">Video Creator Studio</h1>
          </div>
          <button
            onClick={generateVideo}
            disabled={isRendering}
            className={clsx(
              "rounded-full px-5 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
              isRendering ? "bg-slate-600 text-slate-300" : "bg-sky-500 text-white hover:bg-sky-400",
            )}
          >
            {isRendering ? "Rendering..." : "Generate Video"}
          </button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-140px)] max-w-6xl grid-cols-12 gap-8 px-6 py-10">
        <section className="col-span-12 flex flex-col gap-4 rounded-3xl bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40 md:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Scenes</h2>
            <button
              onClick={addSlide}
              className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:bg-slate-700"
            >
              Add Scene
            </button>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto pb-3">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setSelectedId(slide.id)}
                className={clsx(
                  "group relative flex items-center justify-between rounded-2xl border border-white/5 px-4 py-4 text-left transition hover:border-sky-500/60 hover:bg-slate-800/40",
                  selectedSlide?.id === slide.id
                    ? "border-sky-400/80 bg-slate-800/40"
                    : "bg-slate-900/40",
                )}
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Scene {index + 1}</p>
                  <p className="text-sm font-semibold text-slate-100">{slide.title}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-300">
                    {slide.duration.toFixed(1)}s
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSlide(slide.id);
                    }}
                    className="text-xs text-slate-400 hover:text-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </button>
            ))}
          </div>
          {selectedSlide ? (
            <div className="rounded-2xl bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Scene Details
              </h3>
              <div className="mt-4 flex flex-col gap-4 text-sm">
                <label className="flex flex-col gap-2 text-slate-300">
                  <span>Title</span>
                  <input
                    value={selectedSlide.title}
                    onChange={(event) =>
                      updateSlide(selectedSlide.id, { title: event.target.value })
                    }
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40"
                    placeholder="Scene headline"
                  />
                </label>
                <label className="flex flex-col gap-2 text-slate-300">
                  <span>Subtitle</span>
                  <textarea
                    value={selectedSlide.subtitle}
                    onChange={(event) =>
                      updateSlide(selectedSlide.id, { subtitle: event.target.value })
                    }
                    className="h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40"
                    placeholder="Add depth or narrative context"
                  />
                </label>
                <label className="flex flex-col gap-2 text-slate-300">
                  <span>Duration (seconds)</span>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={selectedSlide.duration}
                    onChange={(event) =>
                      updateSlide(selectedSlide.id, {
                        duration: Math.max(0.5, Number(event.target.value) || 1),
                      })
                    }
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40"
                  />
                </label>
                <div className="flex flex-col gap-3">
                  <span className="text-slate-300">Backdrop</span>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        updateSlide(selectedSlide.id, { backgroundType: "color" })
                      }
                      className={clsx(
                        "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition",
                        selectedSlide.backgroundType === "color"
                          ? "bg-sky-500 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                      )}
                    >
                      Solid
                    </button>
                    <button
                      onClick={() =>
                        updateSlide(selectedSlide.id, { backgroundType: "image" })
                      }
                      className={clsx(
                        "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition",
                        selectedSlide.backgroundType === "image"
                          ? "bg-sky-500 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                      )}
                    >
                      Image
                    </button>
                  </div>
                  {selectedSlide.backgroundType === "color" ? (
                    <input
                      type="color"
                      value={selectedSlide.backgroundValue}
                      onChange={(event) =>
                        updateSlide(selectedSlide.id, { backgroundValue: event.target.value })
                      }
                      className="h-12 w-20 cursor-pointer rounded-xl border border-white/10 bg-slate-950"
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleBackgroundUpload(event, selectedSlide.id)}
                        className="text-xs text-slate-300"
                      />
                      {selectedSlide.backgroundValue ? (
                        <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10">
                          <NextImage
                            src={selectedSlide.backgroundValue}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Upload a high-resolution JPEG or PNG image.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="col-span-12 flex flex-col gap-6 md:col-span-8">
          <div className="flex items-center gap-4">
            <button
              disabled={isRendering}
              onClick={() =>
                previewRunningRef.current ? stopPreview() : previewSlides()
              }
              className={clsx(
                "rounded-full px-5 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700/60 disabled:text-slate-400",
                isPreviewing
                  ? "bg-amber-500 text-white"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700",
              )}
            >
              {isPreviewing ? "Stop Preview" : "Preview Sequence"}
            </button>
            <div className="flex-grow rounded-full bg-slate-800/80">
              <div
                className="h-2 rounded-full bg-sky-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/80 p-6">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="aspect-video w-full rounded-2xl border border-white/5 bg-black shadow-inner shadow-black/70"
            />
            {!isPreviewing && (
              <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                <p className="rounded-full bg-black/50 px-4 py-2 text-xs uppercase tracking-widest text-slate-200">
                  {selectedSlide ? `Showing Scene: ${selectedSlide.title}` : "Add a scene to begin"}
                </p>
              </div>
            )}
          </div>

          {renderError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {renderError}
            </div>
          ) : null}

          {videoUrl ? (
            <div className="rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 text-sm text-slate-100">
              <h3 className="text-lg font-semibold text-white">Your video is ready</h3>
              <p className="mt-2 text-sm text-slate-300">
                Download the rendered WebM file and share it anywhere.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={videoUrl}
                  download="storyforge-video.webm"
                  className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  Download Video
                </a>
                <video
                  controls
                  src={videoUrl}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40"
                />
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? " " : "") + words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
  }
}
