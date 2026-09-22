/* ========================================
   illa.com — Pixel Disintegration Engine
   ======================================== */

(function () {
  "use strict";

  // ── Config ──
  const PIXEL_SIZE = 3;
  const TEXT = "illa";
  const FONT_SIZE_VW = 18; // vw units for responsiveness
  const HOLD_DURATION = 1800; // ms to hold solid text
  const DISINTEGRATE_DURATION = 3500; // ms for full disintegration
  const SUBTITLE_SHOW_DELAY = 600; // after text renders
  const SUBTITLE_HIDE_DELAY = 200; // before disintegration starts

  // ── DOM ──
  const bgCanvas = document.getElementById("bg-canvas");
  const bgCtx = bgCanvas.getContext("2d");
  const textCanvas = document.getElementById("text-canvas");
  const textCtx = textCanvas.getContext("2d");
  const subtitle = document.getElementById("subtitle");
  const restartHint = document.getElementById("restart-hint");

  let particles = [];
  let animationId = null;
  let isDisintegrating = false;
  let isIdle = false;
  let dpr = window.devicePixelRatio || 1;

  // ── Resize ──
  function resize() {
    dpr = window.devicePixelRatio || 1;

    bgCanvas.width = window.innerWidth * dpr;
    bgCanvas.height = window.innerHeight * dpr;
    bgCanvas.style.width = window.innerWidth + "px";
    bgCanvas.style.height = window.innerHeight + "px";
    bgCtx.scale(dpr, dpr);

    textCanvas.width = window.innerWidth * dpr;
    textCanvas.height = window.innerHeight * dpr;
    textCanvas.style.width = window.innerWidth + "px";
    textCanvas.style.height = window.innerHeight + "px";
    textCtx.scale(dpr, dpr);
  }

  // ── Background: Subtle void particles ──
  const bgParticles = [];
  const BG_PARTICLE_COUNT = 60;

  function initBgParticles() {
    bgParticles.length = 0;
    for (let i = 0; i < BG_PARTICLE_COUNT; i++) {
      bgParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.15 + 0.03,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.008 + 0.003,
      });
    }
  }

  function drawBg() {
    bgCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Radial vignette
    const grad = bgCtx.createRadialGradient(
      window.innerWidth / 2, window.innerHeight / 2,
      window.innerWidth * 0.1,
      window.innerWidth / 2, window.innerHeight / 2,
      window.innerWidth * 0.7
    );
    grad.addColorStop(0, "rgba(17, 14, 30, 0.4)");
    grad.addColorStop(1, "rgba(6, 6, 8, 0)");
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Floating dust
    for (const p of bgParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += p.pulseSpeed;

      if (p.x < -10) p.x = window.innerWidth + 10;
      if (p.x > window.innerWidth + 10) p.x = -10;
      if (p.y < -10) p.y = window.innerHeight + 10;
      if (p.y > window.innerHeight + 10) p.y = -10;

      const a = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bgCtx.fillStyle = `rgba(124, 92, 191, ${a})`;
      bgCtx.fill();
    }
  }

  // ── Extract pixels from text ──
  function getTextPixels() {
    const offscreen = document.createElement("canvas");
    const w = window.innerWidth;
    const h = window.innerHeight;
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d");

    const fontSize = Math.round((FONT_SIZE_VW / 100) * w);

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TEXT, w / 2, h / 2 - h * 0.04);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const pixels = [];

    for (let y = 0; y < h; y += PIXEL_SIZE) {
      for (let x = 0; x < w; x += PIXEL_SIZE) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) {
          pixels.push({ x, y });
        }
      }
    }

    return pixels;
  }

  // ── Color palette for pixels ──
  const COLORS = [
    "#e8e6f0", // ghost white
    "#b794f6", // dissolve light
    "#805ad5", // dissolve mid
    "#9f7aea", // purple mid
    "#d6bcfa", // lavender
    "#c4b5fd", // soft violet
  ];

  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  // ── Create particles from pixel positions ──
  function createParticles(pixelPositions) {
    particles = pixelPositions.map((pos) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Disintegration velocity — outward + randomness
      const speed = 1.5 + Math.random() * 4 + (dist / window.innerWidth) * 3;
      const scatter = (Math.random() - 0.5) * 1.2;

      return {
        // Position
        ox: pos.x,
        oy: pos.y,
        x: pos.x,
        y: pos.y,

        // Velocity for disintegration
        vx: Math.cos(angle + scatter) * speed + (Math.random() - 0.5) * 2,
        vy: Math.sin(angle + scatter) * speed + (Math.random() - 0.5) * 2 - Math.random() * 1.5,

        // Visual
        size: PIXEL_SIZE,
        color: randomColor(),
        alpha: 1,
        fadeDelay: Math.random() * 0.4, // staggered fade
        fadeSpeed: 0.4 + Math.random() * 0.8,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.15,

        // Gravity
        gravity: 0.02 + Math.random() * 0.04,

        // State
        phase: "solid", // solid | disintegrating | dead
      };
    });
  }

  // ── Render: Solid text phase ──
  function drawSolid() {
    textCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      textCtx.fillStyle = p.color;
      textCtx.globalAlpha = 1;
      textCtx.fillRect(p.x, p.y, p.size, p.size);
    }

    textCtx.globalAlpha = 1;
  }

  // ── Render: Disintegration phase ──
  let disintegrateStart = 0;

  function startDisintegration() {
    isDisintegrating = true;
    disintegrateStart = performance.now();

    // Stagger: pixels further from center start later
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let maxDist = 0;
    for (const p of particles) {
      const d = Math.sqrt((p.ox - cx) ** 2 + (p.oy - cy) ** 2);
      if (d > maxDist) maxDist = d;
    }

    for (const p of particles) {
      const d = Math.sqrt((p.ox - cx) ** 2 + (p.oy - cy) ** 2);
      // Inner pixels start disintegrating first (implosion feel)
      p.fadeDelay = (1 - d / maxDist) * 0.3 + Math.random() * 0.25;
      p.phase = "disintegrating";
    }

    // Hide subtitle
    subtitle.classList.add("hidden");
  }

  function drawDisintegration(now) {
    textCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const elapsed = now - disintegrateStart;
    const progress = Math.min(elapsed / DISINTEGRATE_DURATION, 1);
    let alive = 0;

    for (const p of particles) {
      if (p.phase === "dead") continue;

      const pProgress = Math.max(0, progress - p.fadeDelay) / (1 - p.fadeDelay);

      if (pProgress <= 0) {
        // Still solid
        textCtx.fillStyle = p.color;
        textCtx.globalAlpha = 1;
        textCtx.fillRect(p.x, p.y, p.size, p.size);
        alive++;
        continue;
      }

      if (pProgress >= 1) {
        p.phase = "dead";
        continue;
      }

      // Move
      p.x += p.vx * (0.5 + pProgress * 1.5);
      p.y += p.vy * (0.5 + pProgress * 1.5) + p.gravity * elapsed * 0.02;
      p.rotation += p.rotationSpeed;

      // Shrink & fade
      const alpha = 1 - easeInQuad(pProgress);
      const size = p.size * (1 - easeInCubic(pProgress) * 0.7);

      if (alpha <= 0.01 || size <= 0.2) {
        p.phase = "dead";
        continue;
      }

      alive++;

      textCtx.save();
      textCtx.translate(p.x + size / 2, p.y + size / 2);
      textCtx.rotate(p.rotation);
      textCtx.globalAlpha = alpha;
      textCtx.fillStyle = p.color;
      textCtx.fillRect(-size / 2, -size / 2, size, size);
      textCtx.restore();
    }

    textCtx.globalAlpha = 1;

    if (alive === 0 || progress >= 1) {
      isDisintegrating = false;
      isIdle = true;
      restartHint.classList.remove("hidden");
    }
  }

  // ── Easing ──
  function easeInQuad(t) { return t * t; }
  function easeInCubic(t) { return t * t * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // ── Fade-in text assembly ──
  let assembleStart = 0;
  let isAssembling = false;
  const ASSEMBLE_DURATION = 1200;

  function startAssembly() {
    isAssembling = true;
    assembleStart = performance.now();

    for (const p of particles) {
      // Start from random scattered positions — store as sx/sy
      const angle = Math.random() * Math.PI * 2;
      const dist = 150 + Math.random() * 400;
      p.sx = p.ox + Math.cos(angle) * dist;
      p.sy = p.oy + Math.sin(angle) * dist;
      p.alpha = 0;
      p.phase = "assembling";
      p.fadeDelay = Math.random() * 0.4;
    }
  }

  function drawAssembly(now) {
    textCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const elapsed = now - assembleStart;
    const progress = Math.min(elapsed / ASSEMBLE_DURATION, 1);
    let done = 0;

    for (const p of particles) {
      const pProgress = Math.min(1, Math.max(0, progress - p.fadeDelay) / (1 - p.fadeDelay));

      const eased = easeOutCubic(pProgress);

      // Lerp from scattered start (sx,sy) to home (ox,oy)
      const drawX = lerp(p.sx, p.ox, eased);
      const drawY = lerp(p.sy, p.oy, eased);

      const alpha = eased;

      textCtx.globalAlpha = alpha;
      textCtx.fillStyle = p.color;
      textCtx.fillRect(drawX, drawY, p.size, p.size);

      if (pProgress >= 1) done++;
    }

    textCtx.globalAlpha = 1;

    if (done >= particles.length || progress >= 1) {
      isAssembling = false;
      // Snap all particles to their home
      for (const p of particles) {
        p.x = p.ox;
        p.y = p.oy;
        p.alpha = 1;
        p.phase = "solid";
      }
      onTextReady();
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Main animation loop ──
  function animate(now) {
    animationId = requestAnimationFrame(animate);

    drawBg();

    if (isAssembling) {
      drawAssembly(now);
    } else if (isDisintegrating) {
      drawDisintegration(now);
    } else if (!isIdle) {
      drawSolid();
    } else {
      textCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  // ── Sequence ──
  function onTextReady() {
    // Show subtitle after a beat
    setTimeout(() => {
      subtitle.classList.remove("hidden");
    }, SUBTITLE_SHOW_DELAY);

    // Then disintegrate
    setTimeout(() => {
      startDisintegration();
    }, HOLD_DURATION + SUBTITLE_SHOW_DELAY);
  }

  function startSequence() {
    isIdle = false;
    isDisintegrating = false;
    isAssembling = false;

    subtitle.classList.add("hidden");
    restartHint.classList.add("hidden");

    const pixelPositions = getTextPixels();
    createParticles(pixelPositions);

    // Start with assembly animation
    startAssembly();
  }

  // ── Click to restart ──
  document.addEventListener("click", () => {
    if (isIdle) {
      startSequence();
    }
  });

  // ── Resize handler ──
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resize();
      initBgParticles();
      if (!isDisintegrating && !isAssembling) {
        startSequence();
      }
    }, 200);
  });

  // ── Init ──
  function init() {
    resize();
    initBgParticles();

    // Wait for fonts
    document.fonts.ready.then(() => {
      startSequence();
      animate(performance.now());
    });
  }

  init();
})();
