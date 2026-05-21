"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Slide } from "@/lib/playlist";

export default function PlayerPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  // Get screen param client-side
  const [screenId, setScreenId] = useState("lobby");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setScreenId(p.get("screen") || "lobby");
  }, []);

  // Fetch playlist
  const fetchPlaylist = useCallback(async () => {
    try {
      const res = await fetch(`/api/player?screen=${screenId}`);
      const data = await res.json();
      if (data.slides?.length) setSlides(data.slides);
    } catch {}
  }, [screenId]);

  useEffect(() => {
    if (!screenId) return;
    fetchPlaylist();
    const interval = setInterval(fetchPlaylist, 5 * 60 * 1000); // re-fetch every 5 min
    return () => clearInterval(interval);
  }, [screenId, fetchPlaylist]);

  // Slide timer
  const advance = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setCurrent(c => (c + 1) % Math.max(slides.length, 1));
      setVisible(true);
    }, 1200);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return;
    const dur = (slides[current]?.durationSeconds || 10) * 1000;
    timerRef.current = setTimeout(advance, dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, slides, advance]);

  // Canvas background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Late spring: warm bokeh orbs + faint light shafts
    const W = () => canvas!.width;
    const H = () => canvas!.height;

    const orbs = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 18 + Math.random() * 80,
      dx: (Math.random() - 0.5) * 0.12,
      dy: -0.04 - Math.random() * 0.08,
      alpha: 0.018 + Math.random() * 0.042,
      hue: Math.random() < 0.6
        ? { r: 223, g: 167, b: 38 }
        : Math.random() < 0.5
        ? { r: 31, g: 171, b: 223 }
        : { r: 168, g: 217, b: 219 },
    }));

    const shafts = [0, 1, 2, 3].map(i => ({
      x: window.innerWidth * (0.1 + i * 0.25),
      width: 60 + Math.random() * 120,
      alpha: 0.012 + Math.random() * 0.016,
      speed: 0.0003 + Math.random() * 0.0004,
      phase: Math.random() * Math.PI * 2,
    }));

    function draw() {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#001f2e");
      g.addColorStop(0.5, "#003149");
      g.addColorStop(1, "#002038");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      shafts.forEach(s => {
        const pulse = Math.sin(frameRef.current * s.speed + s.phase) * 0.3 + 0.7;
        const gx = ctx.createLinearGradient(s.x - s.width, 0, s.x + s.width, h);
        gx.addColorStop(0, "rgba(223,167,38,0)");
        gx.addColorStop(0.5, `rgba(223,167,38,${s.alpha * pulse})`);
        gx.addColorStop(1, "rgba(223,167,38,0)");
        ctx.save();
        ctx.transform(1, 0, -0.3, 1, 0, 0);
        ctx.fillStyle = gx;
        ctx.fillRect(s.x - s.width, 0, s.width * 2, h);
        ctx.restore();
      });

      orbs.forEach(o => {
        o.x += o.dx; o.y += o.dy;
        if (o.y + o.r < 0) { o.y = h + o.r; o.x = Math.random() * w; }
        if (o.x < -o.r) o.x = w + o.r;
        if (o.x > w + o.r) o.x = -o.r;
        const rg = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        rg.addColorStop(0, `rgba(${o.hue.r},${o.hue.g},${o.hue.b},${o.alpha})`);
        rg.addColorStop(1, `rgba(${o.hue.r},${o.hue.g},${o.hue.b},0)`);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = rg;
        ctx.fill();
      });

      frameRef.current++;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const slide = slides[current];

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#001f2e", position: "relative" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* CONTENT LAYER */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        opacity: visible ? 1 : 0,
        transition: "opacity 1.2s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!slide && (
          <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'Source Sans 3', sans-serif", fontSize: "14px" }}>
            No content scheduled
          </div>
        )}

        {/* IMAGE SLIDE */}
        {slide?.type === "image" && slide.blobUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.blobUrl}
            alt={slide.name}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* VIDEO SLIDE */}
        {slide?.type === "video" && slide.blobUrl && (
          <video
            key={slide.blobUrl}
            autoPlay muted playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          >
            <source src={slide.blobUrl} type={slide.mimeType || "video/mp4"} />
          </video>
        )}

        {/* VERSE SLIDE */}
        {slide?.type === "verse" && (
          <div style={{ maxWidth: "72%", textAlign: "center", padding: "0 40px", position: "relative", zIndex: 3 }}>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(17px, 2.6vw, 36px)",
              color: "#fff",
              lineHeight: 1.5,
              marginBottom: "26px",
            }}>
              &ldquo;{slide.verseText}&rdquo;
            </div>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontWeight: 300,
              fontSize: "clamp(12px, 1.4vw, 20px)",
              color: "#dfa726",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}>
              {slide.verseRef}
            </div>
          </div>
        )}

        {/* EVENTS SLIDE */}
        {slide?.type === "events" && (
          <div style={{ width: "58%", minWidth: "320px", position: "relative", zIndex: 3 }}>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif", fontWeight: 300,
              fontSize: "clamp(10px, 1.1vw, 15px)", letterSpacing: "0.18em",
              textTransform: "uppercase", color: "#1fabdf", marginBottom: "10px",
            }}>
              Today at Bethany
            </div>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600,
              fontSize: "clamp(20px, 2.8vw, 40px)", color: "#fff",
              marginBottom: "20px", letterSpacing: "-0.02em",
            }}>
              {slide.eventsDate}
            </div>
            {(slide.events || []).map(ev => (
              <div key={ev.id} style={{
                display: "flex", gap: "18px", padding: "11px 0",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{
                  fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600,
                  fontSize: "clamp(11px, 1.15vw, 15px)", color: "#dfa726",
                  minWidth: "56px", paddingTop: "2px", flexShrink: 0,
                }}>
                  {ev.startTime}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600,
                    fontSize: "clamp(13px, 1.45vw, 20px)", color: "#fff", lineHeight: 1.25,
                  }}>
                    {ev.name}
                  </div>
                  {ev.location && (
                    <div style={{
                      fontFamily: "'Roboto', sans-serif", fontWeight: 300,
                      fontSize: "clamp(10px, 0.95vw, 13px)", color: "rgba(168,217,219,0.7)", marginTop: "3px",
                    }}>
                      {ev.location}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BETHANY LOGO */}
      {(slide?.type === "verse" || slide?.type === "events") && (
        <div style={{ position: "absolute", bottom: "20px", right: "24px", zIndex: 10, opacity: 0.18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://bethanycentral.org/wp-content/uploads/2023/10/Full-Logo-Mark-Only-WHITE.png"
            alt="Bethany Baptist Church"
            style={{ height: "40px" }}
          />
        </div>
      )}

      {/* PROGRESS BAR */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: "rgba(255,255,255,0.07)", zIndex: 20 }}>
        <ProgressBar durationSeconds={slide?.durationSeconds || 10} key={`${current}-${slide?.id}`} />
      </div>
    </div>
  );
}

function ProgressBar({ durationSeconds }: { durationSeconds: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      setPct(Math.min(100, ((now - start) / (durationSeconds * 1000)) * 100));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationSeconds]);
  return <div style={{ height: "100%", background: "rgba(223,167,38,0.45)", width: `${pct}%` }} />;
}
