// 告诉 index.html 里的内联兜底脚本：main.js 已经跑起来了，不要强制显示 reveal 内容
document.documentElement.dataset.sdReady = '1';

// three.js 采用动态导入：即使 CDN 加载失败，也只影响地球，不会拖垮整个页面。
let THREE = null;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer:fine)').matches;

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

// Theme
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const THEME_KEY = 'schoolday-theme';

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (_) {}
  applyTheme(saved === 'light' || saved === 'dark' ? saved : systemTheme(), false);
}

initTheme();
let themeTransitioning = false;
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    if (themeTransitioning) return;

    const canViewTransition =
      typeof document.startViewTransition === 'function' &&
      typeof root.animate === 'function';
    if (reduced || !canViewTransition) {
      applyTheme(next);
      return;
    }

    themeTransitioning = true;
    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const xPercent = 100 * x / window.innerWidth;
    const yPercent = 100 * y / window.innerHeight;
    const viewportRadius = Math.hypot(window.innerWidth, window.innerHeight) / Math.SQRT2;
    const radiusPercent = 100 * endRadius / viewportRadius;
    const clipPath = [
      `circle(0% at ${xPercent}% ${yPercent}%)`,
      `circle(${radiusPercent}% at ${xPercent}% ${yPercent}%)`
    ];

    let cleaned = false;
    let cleanupTimer = 0;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.clearTimeout(cleanupTimer);
      root.classList.remove('theme-switching');
      themeTransitioning = false;
    };

    root.classList.add('theme-switching');
    let transition;
    try {
      // 主题重算在新旧快照之间完成，不与可见的圆形转场抢帧。
      transition = document.startViewTransition(() => applyTheme(next));
    } catch (_) {
      applyTheme(next);
      cleanup();
      return;
    }

    cleanupTimer = window.setTimeout(cleanup, 800);
    transition.ready
      .then(() => {
        const animation = root.animate({
          clipPath
        }, {
          duration: 400,
          easing: 'ease-in',
          fill: 'both',
          pseudoElement: '::view-transition-new(root)'
        });
        return animation.finished;
      })
      .catch(() => {
        // 浏览器可能在页面状态变化时跳过转场，主题仍已正常切换。
      })
      .finally(cleanup);
  });
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (_) {}
  if (!saved) applyTheme(e.matches ? 'light' : 'dark', false);
});

// Nav
const nav = document.querySelector('.nav');
const links = [...document.querySelectorAll('.nav nav a')];
const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const scrollBar = document.getElementById('scroll-bar');
const scrollCue = document.querySelector('.scroll-cue');
const navPill = document.getElementById('nav-pill');

// 激活指示片：量出当前链接的位置，再把它平移过去
let activeLink = null;
let pillPlaced = false;
const movePill = (link) => {
  if (!navPill || !link) return;
  if (!pillPlaced) navPill.style.transition = 'none';   // 首帧先关掉过渡
  navPill.style.width = link.offsetWidth + 'px';
  navPill.style.height = link.offsetHeight + 'px';
  navPill.style.transform = 'translate(' + link.offsetLeft + 'px,' + link.offsetTop + 'px)';
  if (!pillPlaced) {
    void navPill.offsetWidth;                           // 先让落位生效，免得从左上角滑进来
    navPill.style.transition = '';                      // 再恢复样式表里的过渡
    navPill.style.opacity = '1';
    pillPlaced = true;
  }
};
const repositionPill = () => { if (activeLink) movePill(activeLink); };
window.addEventListener('resize', repositionPill);
// 品牌字体晚到会把链接撑宽，指示片得跟着重新量一次
if (document.fonts && document.fonts.ready) document.fonts.ready.then(repositionPill).catch(() => {});
window.addEventListener('load', repositionPill);

const onScrollNav = () => {
  const y = window.scrollY;
  if (nav) {
    nav.classList.toggle('scrolled', y > 12);
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 120) current = section;
    }
    // 末尾的「联系」段比其它段矮，后面只剩 footer，页面滚不出足够距离让它够到
    // 120px 参考线：触底、或它已占住视口下半部主体时，直接判定为当前段。
    const last = sections[sections.length - 1];
    if (last && current !== last) {
      const bottomReached = y + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (bottomReached || last.getBoundingClientRect().top <= window.innerHeight * 0.6) current = last;
    }
    links.forEach((link) => {
      const isActive = !!current && link.getAttribute('href') === '#' + current.id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
        // 只在当前项真的换了才量一次，滚动过程中不做多余的布局读取
        if (link !== activeLink) { activeLink = link; movePill(link); }
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
  if (scrollBar) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollBar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
  }
  if (scrollCue) scrollCue.classList.toggle('faded', y > 60);
};
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

// Reveal
// Hero title — split words into cascading chars (skipped under reduced motion)
if (!reduced) {
  document.querySelectorAll('.hero-title .word').forEach((word, wi) => {
    const line = word.closest('.line');
    const base = Number(line && line.dataset.delay || 0) + 240 + wi * 150;
    const text = word.textContent;
    const isGrad = word.classList.contains('gradient-text');
    word.textContent = '';
    [...text].forEach((ch, ci) => {
      const s = document.createElement('span');
      s.className = 'char' + (isGrad ? ' gradient-char' : '');
      s.textContent = ch;
      s.style.setProperty('--d', (base + ci * 60) + 'ms');
      s.style.setProperty('--i', ci);
      word.appendChild(s);
    });
  });
}

const revealItems = [...document.querySelectorAll('.reveal')];
if (reduced) {
  revealItems.forEach((el) => el.classList.add('in-view'));
} else if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = Number(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('in-view'), delay);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });
  revealItems.forEach((el) => io.observe(el));
} else {
  revealItems.forEach((el) => el.classList.add('in-view'));
}

// Typing
const typeTarget = document.querySelector('.type-target');
if (typeTarget) {
  const full = typeTarget.getAttribute('data-text') || '';
  if (reduced) {
    typeTarget.textContent = full;
  } else {
    typeTarget.classList.add('type-cursor');
    let i = 0;
    const tick = () => {
      i += 1;
      typeTarget.textContent = full.slice(0, i);
      if (i < full.length) setTimeout(tick, 18 + Math.random() * 28);
      else typeTarget.classList.remove('type-cursor');
    };
    setTimeout(tick, 250);
  }
}

// Counters
const counters = [...document.querySelectorAll('[data-count]')];
const animateCount = (el) => {
  const target = Number(el.dataset.count || 0);
  const suffix = el.dataset.suffix || '';
  if (reduced) { el.textContent = target + suffix; return; }
  const start = performance.now();
  const duration = 1100;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
if ('IntersectionObserver' in window) {
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        cio.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  counters.forEach((el) => cio.observe(el));
} else {
  counters.forEach(animateCount);
}

// Cursor glow
const glow = document.querySelector('.cursor-glow');
if (glow && !reduced && finePointer) {
  window.addEventListener('pointermove', (e) => {
    glow.style.opacity = '1';
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  }, { passive: true });
  window.addEventListener('pointerleave', () => { glow.style.opacity = '0'; });
}

// GIS reticle cursor — lerped crosshair with live pseudo-coordinate readout
const reticle = document.getElementById('cursor-reticle');
const coordsEl = document.getElementById('cursor-coords');
if (reticle && !reduced && finePointer) {
  let rx = window.innerWidth / 2, ry = window.innerHeight / 2;
  let tx = rx, ty = ry;
  let shown = false, lastCoord = 0;
  const HOVER_SEL = 'a, button, .chip, .tilt, canvas, input, [role="button"]';
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    if (!shown) { shown = true; reticle.classList.add('active'); }
    const hit = e.target && e.target.closest ? e.target.closest(HOVER_SEL) : null;
    reticle.classList.toggle('locked', !!hit);
    if (!retRaf) retRaf = requestAnimationFrame(loopReticle);
    const now = performance.now();
    if (coordsEl && now - lastCoord > 90) {
      lastCoord = now;
      const lat = 30.5728 + (1 - ty / window.innerHeight) * 0.0893;
      const lon = 104.0668 + (tx / window.innerWidth) * 0.1211;
      coordsEl.textContent = 'N' + lat.toFixed(4) + '° E' + lon.toFixed(4) + '°';
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    shown = false;
    reticle.classList.remove('active');
  });
  let retRaf = 0;
  const loopReticle = () => {
    retRaf = 0;
    rx += (tx - rx) * 0.16;
    ry += (ty - ry) * 0.16;
    reticle.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0) translate(-50%,-50%)';
    // 光标停稳后休眠，下一次 pointermove 再唤醒
    if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) {
      retRaf = requestAnimationFrame(loopReticle);
    }
  };
  retRaf = requestAnimationFrame(loopReticle);
}

// Tilt cards
if (!reduced && finePointer) {
  document.querySelectorAll('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = 'translateY(-4px) rotateX(' + (-y * 5) + 'deg) rotateY(' + (x * 6) + 'deg)';
      card.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
      const glowEl = card.querySelector('.card-glow');
      if (glowEl) {
        glowEl.style.left = (e.clientX - rect.left - 90) + 'px';
        glowEl.style.top = (e.clientY - rect.top - 90) + 'px';
        glowEl.style.opacity = '1';
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
      const glowEl = card.querySelector('.card-glow');
      if (glowEl) glowEl.style.opacity = '';
    });
  });
}

// Magnetic buttons — pull toward the cursor with a spring-like offset.
if (!reduced && finePointer) {
  document.querySelectorAll('.magnetic').forEach((el) => {
    const label = el.querySelector('.btn-label') || el;
    const strength = 0.32;
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - (rect.left + rect.width / 2);
      const my = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = 'translate(' + mx * strength + 'px,' + my * strength + 'px)';
      label.style.transform = 'translate(' + mx * strength * 0.4 + 'px,' + my * strength * 0.4 + 'px)';
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
      label.style.transform = '';
    });
  });
}

// Glitch flicker on the accent word — subtle, occasional.
const glitchTarget = document.querySelector('[data-glitch]');
if (glitchTarget && !reduced) {
  const fire = () => {
    glitchTarget.classList.add('glitching');
    setTimeout(() => glitchTarget.classList.remove('glitching'), 320);
    setTimeout(fire, 3600 + Math.random() * 4200);
  };
  setTimeout(fire, 2600);
}

// Particle network background — cursor repulsion, twinkle, meteors, scroll warp
const canvas = document.getElementById('fx-canvas');
if (canvas && !reduced) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, points = [], raf = 0;
  let meteors = [];
  let nextMeteorAt = performance.now() + 1500;
  let mouseX = -9999, mouseY = -9999;
  let scrollVel = 0, lastScrollY = window.scrollY, lastScrollT = performance.now();
  const cssColor = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  // 颜色按帧读取 getComputedStyle 开销大，改为缓存，仅主题切换时刷新
  let particle = cssColor('--particle', 'rgba(140, 180, 255, 0.7)');
  let lineRgb = cssColor('--particle-line', '100, 170, 255');
  window.addEventListener('themechange', () => {
    particle = cssColor('--particle', 'rgba(140, 180, 255, 0.7)');
    lineRgb = cssColor('--particle-line', '100, 170, 255');
  });
  const resize = () => {
    // 背板按 devicePixelRatio 放大、绘制仍走 CSS 像素坐标：高分屏上粒子不再发虚
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(60, Math.floor((w * h) / 26000));
    points = Array.from({ length: count }, () => {
      const vx = (Math.random() - 0.5) * 0.35;
      const vy = (Math.random() - 0.5) * 0.35;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx, vy, bvx: vx, bvy: vy,
        r: Math.random() * 1.6 + 0.6,
        ph: Math.random() * Math.PI * 2,
        tw: 0.6 + Math.random() * 1.4
      };
    });
  };
  window.addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { mouseX = -9999; mouseY = -9999; });
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const dy = window.scrollY - lastScrollY;
    const dt = Math.max(16, now - lastScrollT);
    scrollVel += ((dy / dt * 16) - scrollVel) * 0.6;
    lastScrollY = window.scrollY;
    lastScrollT = now;
  }, { passive: true });
  const spawnMeteor = (now) => {
    const fromTop = Math.random() < 0.6;
    const speed = 6 + Math.random() * 5;
    const angle = Math.PI * (0.7 + Math.random() * 0.12);
    meteors.push({
      x: fromTop ? w * 0.25 + Math.random() * w * 0.75 : w + 40,
      y: fromTop ? -30 : Math.random() * h * 0.35,
      vx: Math.cos(angle) * speed,
      vy: Math.abs(Math.sin(angle)) * speed * 0.62,
      len: 90 + Math.random() * 110
    });
    nextMeteorAt = now + 2400 + Math.random() * 4200;
  };
  let lastFxFrame = 0;
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    if (themeTransitioning) return;
    if (now - lastFxFrame < 33) return; // 30fps 足够柔和，省一半开销
    lastFxFrame = now;
    const warp = Math.min(5, Math.abs(scrollVel) * 0.22);
    scrollVel *= 0.81;
    ctx.clearRect(0, 0, w, h);
    // meteors behind the network
    if (now > nextMeteorAt && meteors.length < 3) spawnMeteor(now);
    meteors = meteors.filter((m) => m.x > -m.len - 80 && m.y < h + m.len + 80);
    for (const m of meteors) {
      m.x += m.vx * 2;
      m.y += m.vy * 2;
      const tailX = m.x - m.vx * (m.len / 10);
      const tailY = m.y - m.vy * (m.len / 10);
      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, 'rgba(' + lineRgb + ',0.85)');
      grad.addColorStop(1, 'rgba(' + lineRgb + ',0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + lineRgb + ',0.9)';
      ctx.fill();
    }
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const dxm = p1.x - mouseX;
      const dym = p1.y - mouseY;
      const d2 = dxm * dxm + dym * dym;
      if (d2 < 16900) {
        const d = Math.sqrt(d2) || 1;
        const f = (1 - d / 130) * 1.1;
        p1.vx += (dxm / d) * f;
        p1.vy += (dym / d) * f;
      }
      p1.vx += (p1.bvx - p1.vx) * 0.03;
      p1.vy += (p1.bvy - p1.vy) * 0.03;
      const sp = 1 + warp * 1.6;
      p1.x += p1.vx * sp * 2;
      p1.y += p1.vy * sp * 2;
      if (p1.x < 0 || p1.x > w) { p1.vx *= -1; p1.bvx *= -1; }
      if (p1.y < 0 || p1.y > h) { p1.vy *= -1; p1.bvy *= -1; }
      const tw = 0.68 + 0.32 * Math.sin(now * 0.0016 * p1.tw + p1.ph);
      if (warp > 0.5) {
        ctx.strokeStyle = 'rgba(' + lineRgb + ',' + (0.5 * tw).toFixed(3) + ')';
        ctx.lineWidth = p1.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - p1.vx * (1.6 + warp * 2.6), p1.y - p1.vy * (1.6 + warp * 2.6));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.r * tw, 0, Math.PI * 2);
        ctx.fillStyle = particle;
        ctx.fill();
      }
    }
  };
  resize();
  raf = requestAnimationFrame(draw);
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    resize();
    raf = requestAnimationFrame(draw);
  });
}

// Unified scroll loop — parallax + marquee + map chrome 共用一个 lerp 循环，静止时休眠
const plxEls = [...document.querySelectorAll('[data-plx]')].map((el) => ({ el, f: parseFloat(el.dataset.plx) || 0 }));
const marqueeEl = document.getElementById('marquee');
const marqueeTrack = document.getElementById('marquee-track');
const compassNeedle = document.getElementById('compass-needle');
const scaleLabel = document.getElementById('scale-label');
if (!reduced && (plxEls.length || (marqueeEl && marqueeTrack) || compassNeedle || scaleLabel)) {
  const SCALE_STEPS = ['2000 km', '1000 km', '500 km', '200 km', '50 km', '10 km'];
  let cur = window.scrollY, tgt = cur, boost = 0, lastY = cur, scrollRaf = 0, mqAnim = null;
  const tick = () => {
    scrollRaf = 0;
    cur += (tgt - cur) * 0.09;
    boost *= 0.93;
    plxEls.forEach(({ el, f }) => {
      el.style.transform = 'translate3d(0,' + (cur * f).toFixed(1) + 'px,0)';
    });
    if (marqueeEl && marqueeTrack) {
      if (!mqAnim && marqueeTrack.getAnimations) mqAnim = marqueeTrack.getAnimations()[0] || null;
      if (mqAnim) { try { mqAnim.playbackRate = 1 + boost; } catch (_) {} }
      marqueeEl.style.setProperty('--skew', (Math.min(9, boost * 2.6)).toFixed(2) + 'deg');
    }
    if (compassNeedle) {
      compassNeedle.style.transform = 'rotate(' + (cur * 0.12).toFixed(1) + 'deg)';
    }
    if (scaleLabel) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const frac = Math.min(1, cur / max);
      const idx = Math.min(SCALE_STEPS.length - 1, Math.floor(frac * SCALE_STEPS.length));
      const label = SCALE_STEPS[idx];
      if (scaleLabel.textContent !== label) scaleLabel.textContent = label;
    }
    if (Math.abs(tgt - cur) >= 0.05 || boost >= 0.02) scrollRaf = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    boost = Math.min(5, boost + Math.abs(y - lastY) * 0.022);
    lastY = y;
    tgt = y;
    if (!scrollRaf) scrollRaf = requestAnimationFrame(tick);
  }, { passive: true });
  tick(); // 手动跑一帧，保证初始状态正确
}

// Click ripple
if (!reduced) {
  window.addEventListener('pointerdown', (e) => {
    const r = document.createElement('span');
    r.className = 'click-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }, { passive: true });
}

// Heading decode — section titles resolve from a cipher scramble
if (!reduced && 'IntersectionObserver' in window) {
  const pool = '!<>-_/[]{}=+*^?#01';
  document.querySelectorAll('.section-head h2, .contact h2').forEach((h2) => {
    const textNode = [...h2.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!textNode) return;
    const span = document.createElement('span');
    span.className = 'h2-text';
    span.textContent = textNode.textContent.trim();
    textNode.replaceWith(span);
  });
  const scramble = (el) => {
    const original = el.dataset.original || el.textContent;
    el.dataset.original = original;
    const chars = [...original];
    const dur = 620 + chars.length * 40;
    const start = performance.now();
    el.classList.add('scrambling');
    const frame = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const resolved = Math.floor(p * chars.length);
      el.textContent = chars.map((c, i) => {
        if (i < resolved || c === ' ') return c;
        return pool[(Math.random() * pool.length) | 0];
      }).join('');
      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = original; el.classList.remove('scrambling'); }
    };
    requestAnimationFrame(frame);
  };
  const sio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        const t = en.target.querySelector('.h2-text');
        if (t) scramble(t);
        sio.unobserve(en.target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.section').forEach((s) => sio.observe(s));
}

// Project hover preview
const preview = document.getElementById('project-preview');
const previewVisual = preview ? preview.querySelector('.preview-visual') : null;
const previewTitle = document.getElementById('preview-title');
const previewBlurb = document.getElementById('preview-blurb');
const previewTags = document.getElementById('preview-tags');
const workItems = [...document.querySelectorAll('.work-item[data-preview]')];

function placePreview(clientX, clientY) {
  if (!preview) return;
  const pad = 16;
  const rect = preview.getBoundingClientRect();
  let left = clientX + 18;
  let top = clientY + 18;
  if (left + rect.width > window.innerWidth - pad) left = clientX - rect.width - 18;
  if (top + rect.height > window.innerHeight - pad) top = clientY - rect.height - 18;
  left = Math.max(pad, left);
  top = Math.max(pad, top);
  preview.style.left = left + 'px';
  preview.style.top = top + 'px';
}

function showPreview(item, clientX, clientY) {
  if (!preview || !window.matchMedia("(hover: hover)").matches || window.innerWidth <= 960) return;
  const kind = item.dataset.preview || 'platform';
  const title = item.dataset.title || '';
  const blurb = item.dataset.blurb || '';
  const tags = (item.dataset.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (previewVisual) previewVisual.setAttribute('data-kind', kind);
  if (previewTitle) previewTitle.textContent = title;
  if (previewBlurb) previewBlurb.textContent = blurb;
  if (previewTags) {
    previewTags.innerHTML = tags.map((tag) => '<span>' + tag + '</span>').join('');
  }
  workItems.forEach((el) => el.classList.toggle('is-previewing', el === item));
  preview.hidden = false;
  preview.setAttribute('aria-hidden', 'false');
  placePreview(clientX, clientY);
  requestAnimationFrame(() => preview.classList.add('visible'));
}

function hidePreview() {
  if (!preview) return;
  preview.classList.remove('visible');
  preview.setAttribute('aria-hidden', 'true');
  workItems.forEach((el) => el.classList.remove('is-previewing'));
  window.setTimeout(() => {
    if (!preview.classList.contains('visible')) preview.hidden = true;
  }, 180);
}

if (preview && window.matchMedia("(hover: hover)").matches) {
  workItems.forEach((item) => {
    item.addEventListener('pointerenter', (e) => showPreview(item, e.clientX, e.clientY));
    item.addEventListener('pointermove', (e) => {
      if (preview.classList.contains('visible')) placePreview(e.clientX, e.clientY);
    });
    item.addEventListener('pointerleave', hidePreview);
  });
  window.addEventListener('scroll', hidePreview, { passive: true });
  window.addEventListener('blur', hidePreview);
}

// Stronger 3D globe with Three.js
function createEarthTexture(theme = "dark") {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d");
  const ocean = theme === "light" ? "#1d4f8c" : "#0b2a55";
  const land = theme === "light" ? "#3fa36d" : "#1f8f63";
  const landHi = theme === "light" ? "#78c58d" : "#3ecf8e";
  const grid = theme === "light" ? "rgba(255,255,255,0.16)" : "rgba(150,200,255,0.18)";
  g.fillStyle = ocean;
  g.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    g.fillStyle = "rgba(255,255,255," + (Math.random() * 0.035) + ")";
    g.fillRect(x, y, 1.5, 1.5);
  }

  g.strokeStyle = grid;
  g.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const y = (i / 12) * c.height;
    g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke();
  }
  for (let i = 1; i < 24; i++) {
    const x = (i / 24) * c.width;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke();
  }

  const blobs = [
    [180, 180, 90, 70], [250, 160, 70, 50], [300, 210, 55, 40],
    [470, 170, 50, 70], [520, 250, 80, 100], [560, 180, 40, 35],
    [700, 300, 120, 70], [780, 250, 90, 55], [860, 320, 70, 45],
    [200, 360, 70, 40], [430, 360, 100, 35], [650, 150, 40, 30]
  ];
  blobs.forEach(([x, y, rx, ry], idx) => {
    const grad = g.createRadialGradient(x, y, 4, x, y, Math.max(rx, ry));
    grad.addColorStop(0, landHi);
    grad.addColorStop(1, land);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, rx, ry, idx % 2 ? 0.3 : -0.2, 0, Math.PI * 2);
    g.fill();
  });

  const lights = [
    [220, 190], [250, 205], [480, 180], [505, 210], [700, 280],
    [760, 300], [820, 250], [180, 360], [430, 350], [860, 330]
  ];
  lights.forEach(([x, y]) => {
    const lg = g.createRadialGradient(x, y, 0, x, y, 10);
    lg.addColorStop(0, "rgba(255,230,150,0.95)");
    lg.addColorStop(1, "rgba(255,200,80,0)");
    g.fillStyle = lg;
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fill();
  });

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

async function initGlobe() {
  const stage = document.getElementById("globe-stage");
  const globeCanvas = document.getElementById("globe-canvas");
  if (!stage || !globeCanvas) return;

  THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({
    canvas: globeCanvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.35, 3.35);

  const ambient = new THREE.AmbientLight(0x9bb7ff, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(4, 2.2, 3);
  const rim = new THREE.DirectionalLight(0x45e0c8, 0.55);
  rim.position.set(-3, -1, -2);
  scene.add(ambient, key, rim);

  const tiltGroup = new THREE.Group();
  scene.add(tiltGroup);
  const rootGroup = new THREE.Group();
  tiltGroup.add(rootGroup);

  let earthTexture = createEarthTexture(root.getAttribute("data-theme") || "dark");
  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTexture,
    roughness: 0.55,
    metalness: 0.08,
    emissive: new THREE.Color("#0a1b33"),
    emissiveIntensity: 0.18
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
  rootGroup.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 1,
      metalness: 0,
      depthWrite: false
    })
  );
  rootGroup.add(clouds);

  // Fresnel atmosphere — shader rim glow instead of a flat shell
  const atmosphereUniforms = {
    uColor: { value: new THREE.Color("#4ea2ff") },
    uBoost: { value: 1.2 }
  };
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.22, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: atmosphereUniforms,
      vertexShader: [
        "varying vec3 vNormal;",
        "void main() {",
        "  vNormal = normalize(normalMatrix * normal);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor;",
        "uniform float uBoost;",
        "varying vec3 vNormal;",
        "void main() {",
        "  float intensity = pow(0.68 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 2.0);",
        "  intensity = max(intensity, 0.0);",
        "  gl_FragColor = vec4(uColor * intensity * uBoost, intensity * uBoost);",
        "}"
      ].join("\n"),
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    })
  );
  rootGroup.add(atmosphere);

  {
    const starCount = 500;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 8 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3)),
      new THREE.PointsMaterial({ color: 0xb7d4ff, size: 0.03, sizeAttenuation: true, transparent: true, opacity: 0.85 })
    );
    scene.add(stars);
  }

  const arcGroup = new THREE.Group();
  rootGroup.add(arcGroup);
  const cities = [
    { lat: 30.5, lon: 114.3 },
    { lat: 39.9, lon: 116.4 },
    { lat: 31.2, lon: 121.5 },
    { lat: 22.3, lon: 114.2 },
    { lat: 1.3, lon: 103.8 },
    { lat: 35.7, lon: 139.7 },
    { lat: 51.5, lon: -0.1 },
    { lat: 40.7, lon: -74.0 }
  ];
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x45e0c8 });
  const pulseRings = [];
  cities.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), markerMat);
    m.position.copy(latLonToVec3(c.lat, c.lon, 1.01));
    arcGroup.add(m);
    // expanding pulse ring on the surface at each city
    const pos = latLonToVec3(c.lat, c.lon, 1.015);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.024, 0.03, 32),
      new THREE.MeshBasicMaterial({ color: 0x45e0c8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.position.copy(pos);
    ring.lookAt(pos.clone().multiplyScalar(2));
    ring.userData.phase = i * 0.45;
    arcGroup.add(ring);
    pulseRings.push(ring);
  });
  const pairs = [[0,1],[1,2],[0,3],[2,4],[4,5],[1,6],[6,7],[2,7]];
  const arcCurves = [];
  pairs.forEach(([a, b], idx) => {
    const start = latLonToVec3(cities[a].lat, cities[a].lon, 1.01);
    const end = latLonToVec3(cities[b].lat, cities[b].lon, 1.01);
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.28 + (idx % 3) * 0.05);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    arcCurves.push(curve);
    const pts = curve.getPoints(40);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: idx % 2 ? 0x7aa2ff : 0x45e0c8,
      transparent: true,
      opacity: 0.65
    }));
    arcGroup.add(line);
  });
  // flow dots travelling along the arcs
  const flowDots = [];
  arcCurves.forEach((curve, idx) => {
    for (let k = 0; k < 2; k++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 8, 8),
        new THREE.MeshBasicMaterial({ color: idx % 2 ? 0x7aa2ff : 0x45e0c8, transparent: true, opacity: 0.9 })
      );
      dot.userData = { curve, offset: k * 0.5 + idx * 0.13, speed: 0.14 + (idx % 3) * 0.035 };
      arcGroup.add(dot);
      flowDots.push(dot);
    }
  });
  // orbiting satellites — independent of earth spin
  const satellites = [];
  const addSatellite = (radius, tiltX, tiltZ, speed, phase) => {
    const orbit = new THREE.Group();
    orbit.rotation.x = tiltX;
    orbit.rotation.z = tiltZ;
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    orbit.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x6c8cff, transparent: true, opacity: 0.3 })
    ));
    const sat = new THREE.Group();
    sat.add(
      new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.022, 0.022), new THREE.MeshBasicMaterial({ color: 0xeaf0ff })),
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.005, 0.034), new THREE.MeshBasicMaterial({ color: 0x6c8cff }))
    );
    orbit.add(sat);
    tiltGroup.add(orbit);
    satellites.push({ sat, radius, speed, angle: phase });
  };
  addSatellite(1.52, 0.42, 0.18, 0.4, 0.6);
  addSatellite(1.74, -0.3, 0.62, -0.26, 2.8);

  // pointer parallax — globe leans toward the cursor
  let tiltXTarget = 0, tiltYTarget = 0;
  stage.addEventListener("pointermove", (e) => {
    if (dragging) return;
    const rect = stage.getBoundingClientRect();
    tiltYTarget = (((e.clientX - rect.left) / rect.width) * 2 - 1) * 0.14;
    tiltXTarget = (((e.clientY - rect.top) / rect.height) * 2 - 1) * 0.1;
  });
  stage.addEventListener("pointerleave", () => { tiltXTarget = 0; tiltYTarget = 0; wheelEngaged = false; });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velX = 0;
  let velY = 0;
  let targetDist = 3.35;
  let currentDist = 3.35;
  let autoRotate = true;

  const onPointerDown = (e) => {
    dragging = true;
    autoRotate = false;
    wheelEngaged = true;
    lastX = e.clientX;
    lastY = e.clientY;
    globeCanvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = dx * 0.005;
    velY = dy * 0.004;
    rootGroup.rotation.y += velX;
    rootGroup.rotation.x = Math.max(-0.9, Math.min(0.9, rootGroup.rotation.x + velY));
  };
  const onPointerUp = (e) => {
    dragging = false;
    try { globeCanvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
    window.setTimeout(() => { if (!dragging) autoRotate = true; }, 1800);
  };
  // 滚轮只在用户"抓过"地球之后才接管：地球占了大半首屏，
  // 无条件 preventDefault 会把路过这里的翻页滚动整段吞掉。
  let wheelEngaged = false;
  const onWheel = (e) => {
    if (!wheelEngaged) return;
    e.preventDefault();
    targetDist = Math.max(2.4, Math.min(4.6, targetDist + e.deltaY * 0.0018));
  };
  globeCanvas.addEventListener("pointerdown", onPointerDown);
  globeCanvas.addEventListener("pointermove", onPointerMove);
  globeCanvas.addEventListener("pointerup", onPointerUp);
  globeCanvas.addEventListener("pointercancel", onPointerUp);
  globeCanvas.addEventListener("pointerleave", onPointerUp);
  globeCanvas.addEventListener("wheel", onWheel, { passive: false });

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = stage;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("themechange", (e) => {
    const theme = e.detail?.theme || "dark";
    earthTexture.dispose();
    earthTexture = createEarthTexture(theme);
    earthMat.map = earthTexture;
    earthMat.emissive = new THREE.Color(theme === "light" ? "#0d2a4d" : "#0a1b33");
    earthMat.needsUpdate = true;
    atmosphereUniforms.uColor.value.set(theme === "light" ? "#5ea8ff" : "#4ea2ff");
    atmosphereUniforms.uBoost.value = theme === "light" ? 0.85 : 1.2;
    ambient.intensity = theme === "light" ? 0.7 : 0.55;
  });

  const hudSat = document.getElementById("hud-sat");
  let satCount = 12;
  let hudFrame = 0;
  setInterval(() => {
    satCount = Math.max(8, Math.min(16, satCount + (Math.random() < 0.5 ? -1 : 1)));
  }, 2400);

  let raf = 0;
  const animate = () => {
    raf = requestAnimationFrame(animate);
    if (themeTransitioning) return;
    if (!reduced) {
      const elapsed = performance.now() * 0.001;
      if (autoRotate && !dragging) rootGroup.rotation.y += 0.0022;
      else {
        rootGroup.rotation.y += velX;
        rootGroup.rotation.x = Math.max(-0.9, Math.min(0.9, rootGroup.rotation.x + velY));
        velX *= 0.93;
        velY *= 0.93;
      }
      clouds.rotation.y += 0.0012;
      currentDist += (targetDist - currentDist) * 0.08;
      camera.position.z = currentDist;
      camera.position.y = 0.28 + (currentDist - 3.35) * 0.05;
      tiltGroup.rotation.x += (tiltXTarget - tiltGroup.rotation.x) * 0.06;
      tiltGroup.rotation.y += (tiltYTarget - tiltGroup.rotation.y) * 0.06;
      pulseRings.forEach((ring) => {
        const t = ((elapsed * 0.55 + ring.userData.phase) % 1.4) / 1.4;
        ring.scale.setScalar(1 + t * 2.4);
        ring.material.opacity = (1 - t) * 0.85;
      });
      flowDots.forEach((dot) => {
        const t = (elapsed * dot.userData.speed + dot.userData.offset) % 1;
        dot.position.copy(dot.userData.curve.getPoint(t));
        dot.material.opacity = Math.sin(Math.PI * t) * 0.95;
      });
      satellites.forEach((s) => {
        s.angle += s.speed * 0.008;
        s.sat.position.set(Math.cos(s.angle) * s.radius, 0, Math.sin(s.angle) * s.radius);
        s.sat.rotation.y = -s.angle;
      });
      if (hudSat && ++hudFrame % 24 === 0) {
        hudSat.textContent = 'SAT ' + satCount + ' · Z ' + currentDist.toFixed(1);
      }
    }
    renderer.render(scene, camera);
  };
  animate();

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!raf) animate();
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
    }, { threshold: 0.05 });
    io.observe(stage);
  }
}

initGlobe().catch((err) => {
  console.warn("Globe init failed:", err);
});
