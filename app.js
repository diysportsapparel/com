(() => {
  const TOTAL = 19;
  const pages = Array.from({ length: TOTAL }, (_, i) => `assets/pages/page-${String(i + 1).padStart(2, "0")}.jpg`);
  const $ = (id) => document.getElementById(id);
  const frame = $("book-frame");
  const mount = $("book");
  const handle = $("drag-handle");
  let current = 0;
  let flipping = false;
  let coverOpening = false;
  let flipDirection = "next";
  let autoPlay = true;
  let autoTimer = 0;
  let hdReady = false;
  let introDone = false;
  const hqReady = new Set();
  const hqLoading = new Map();
  let zoom = 1;
  let position = { x: 0, y: 0 };
  let drag = null;

  const pageElements = pages.map((src, index) => {
    const page = document.createElement("div");
    page.className = "flip-page";
    page.setAttribute("aria-label", `Page ${index + 1}`);
    const image = document.createElement("img");
    image.src = src;
    image.dataset.pageIndex = String(index);
    image.dataset.hqSrc = `assets/pages-hq/page-${String(index + 1).padStart(2, "0")}.jpg`;
    image.alt = "";
    image.draggable = false;
    page.appendChild(image);
    return page;
  });

  const flipbook = new St.PageFlip(mount, {
    width: 595, height: 842, size: "stretch", minWidth: 135, maxWidth: 595,
    minHeight: 191, maxHeight: 842, drawShadow: true, flippingTime: 920,
    usePortrait: false, startPage: 0, startZIndex: 0, autoSize: true,
    maxShadowOpacity: .55, showCover: true, mobileScrollSupport: true,
    swipeDistance: 20, clickEventForward: true, useMouseEvents: true,
    showPageCorners: true, disableFlipByClick: false
  });

  function updateFrame() {
    frame.classList.toggle("is-cover", current === 0);
    frame.classList.toggle("is-open", current !== 0);
    frame.classList.toggle("is-flipping", flipping);
    frame.classList.toggle("is-cover-turn", coverOpening);
    frame.classList.toggle("flip-prev", flipDirection === "prev");
    frame.classList.toggle("flip-next", flipDirection === "next");
    frame.classList.toggle("is-preparing", !hdReady);
    $("hd-guard").hidden = hdReady;
    frame.style.setProperty("--book-zoom", zoom);
    frame.style.setProperty("--book-x", `${position.x}px`);
    frame.style.setProperty("--book-y", `${position.y}px`);
    $("zoom-readout").textContent = `${Math.round(zoom * 100)}%`;
    $("zoom-out").disabled = zoom <= .8;
    $("zoom-in").disabled = zoom >= 3.5;
  }

  async function ensureHighResolution(indices) {
    const tasks = [...new Set(indices.filter((index) => index >= 0 && index < TOTAL))].map((index) => {
      if (hqReady.has(index)) return Promise.resolve();
      if (hqLoading.has(index)) return hqLoading.get(index);
      const source = `assets/pages-hq/page-${String(index + 1).padStart(2, "0")}.jpg`;
      const task = new Promise((resolve) => {
        const loader = new Image();
        loader.onload = async () => {
          try { await loader.decode?.(); } catch (_) {}
          mount.querySelectorAll(`.flip-page img[data-page-index="${index}"]`).forEach((image) => image.src = source);
          hqReady.add(index);
          hqLoading.delete(index);
          resolve();
        };
        loader.onerror = () => { hqLoading.delete(index); resolve(); };
        loader.src = source;
      });
      hqLoading.set(index, task);
      return task;
    });
    await Promise.all(tasks);
  }

  async function prepareCurrentPages() {
    hdReady = false;
    updatePage();
    await ensureHighResolution([current - 3, current - 2, current - 1, current, current + 1, current + 2, current + 3]);
    hdReady = true;
    updatePage();
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (!autoPlay || !hdReady || !introDone || flipping || current >= TOTAL - 1) return;
    autoTimer = setTimeout(() => {
      if (autoPlay && flipbook.getState() === "read") {
        flipDirection = "next";
        updateFrame();
        flipbook.flipNext("bottom");
      }
    }, 2500);
  }

  function finishIntro() {
    const shell = $("reader-shell");
    const intro = $("site-intro");
    window.setTimeout(() => {
      shell.classList.replace("intro-loading", "intro-leaving");
      intro.classList.add("is-leaving");
    }, 180);
    window.setTimeout(() => {
      intro.remove();
      shell.classList.replace("intro-leaving", "intro-done");
      introDone = true;
      updatePage();
    }, 820);
  }

  function stopAuto() {
    if (!autoPlay) return;
    autoPlay = false;
    clearTimeout(autoTimer);
    updatePage();
  }

  function updatePage() {
    const first = current + 1;
    const shown = first === 1 || first === TOTAL ? [first] : [first, Math.min(first + 1, TOTAL)];
    $("page-label").textContent = shown.length === 1 ? (first === 1 ? "Cover" : `Page ${first}`) : `Pages ${shown[0]}–${shown[1]}`;
    $("page-readout").textContent = `${shown.length === 2 ? `${shown[0]}-${shown[1]}` : shown[0]} / ${TOTAL}`;
    [$("stage-prev"), $("toolbar-prev")].forEach((button) => button.disabled = !hdReady || current === 0 || flipping);
    [$("stage-next"), $("toolbar-next")].forEach((button) => button.disabled = !hdReady || current >= TOTAL - 1 || flipping);
    $("playback-status").textContent = autoPlay ? "AUTO · 2.5S" : "MANUAL";
    $("playback-status").classList.toggle("is-auto", autoPlay);
    document.querySelectorAll(".thumbnail-list button").forEach((button, i) => button.classList.toggle("is-current", shown.includes(i + 1)));
    updateFrame();
    scheduleAuto();
  }

  flipbook.on("init", async () => {
    $("loading").remove();
    await prepareCurrentPages();
    for (let start = 4; start < TOTAL; start += 3) await ensureHighResolution([start, start + 1, start + 2]);
    finishIntro();
  });
  flipbook.on("flip", (event) => { current = Number(event.data); void prepareCurrentPages(); });
  flipbook.on("changeState", (event) => {
    const isTurning = event.data !== "read";
    if (isTurning && !flipping && current === 0) coverOpening = true;
    if (!isTurning) coverOpening = false;
    flipping = isTurning;
    updatePage();
  });
  flipbook.loadFromHTML(pageElements);
  flipbook.getPage(0).setDensity("soft");
  flipbook.getPage(TOTAL - 1).setDensity("soft");

  const previous = () => { stopAuto(); flipDirection = "prev"; updateFrame(); if (hdReady && !flipping && current > 0) flipbook.flipPrev("bottom"); };
  const next = () => { stopAuto(); flipDirection = "next"; updateFrame(); if (hdReady && !flipping && current < TOTAL - 1) flipbook.flipNext("bottom"); };
  $("stage-prev").onclick = $("toolbar-prev").onclick = previous;
  $("stage-next").onclick = $("toolbar-next").onclick = next;

  function setZoom(value) { zoom = Math.min(3.5, Math.max(.8, Math.round(value * 100) / 100)); updateFrame(); }
  frame.addEventListener("wheel", (event) => { event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? .15 : -.15)); }, { passive: false });
  let touchGesture = null;
  frame.addEventListener("touchstart", (event) => {
    const isPinch = event.touches.length >= 2;
    const isZoomedPan = event.touches.length === 1 && zoom > 1.01;
    if (!isPinch && !isZoomedPan) return;
    event.preventDefault();
    event.stopPropagation();
    const first = event.touches[0];
    const second = event.touches[1];
    const centerX = second ? (first.clientX + second.clientX) / 2 : first.clientX;
    const centerY = second ? (first.clientY + second.clientY) / 2 : first.clientY;
    touchGesture = {
      mode: isPinch ? "pinch" : "pan",
      startDistance: second ? Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY) : 0,
      startX: centerX, startY: centerY, startZoom: zoom, originX: position.x, originY: position.y
    };
  }, { passive: false, capture: true });
  frame.addEventListener("touchmove", (event) => {
    if (!touchGesture) return;
    event.preventDefault();
    event.stopPropagation();
    const first = event.touches[0];
    if (!first) return;
    const second = event.touches[1];
    if (touchGesture.mode === "pinch" && second) {
      const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
      const centerX = (first.clientX + second.clientX) / 2;
      const centerY = (first.clientY + second.clientY) / 2;
      zoom = Math.min(3.5, Math.max(.8, Math.round(touchGesture.startZoom * distance / Math.max(touchGesture.startDistance, 1) * 100) / 100));
      position = { x: touchGesture.originX + centerX - touchGesture.startX, y: touchGesture.originY + centerY - touchGesture.startY };
      updateFrame();
    } else if (touchGesture.mode === "pan") {
      position = { x: touchGesture.originX + first.clientX - touchGesture.startX, y: touchGesture.originY + first.clientY - touchGesture.startY };
      updateFrame();
    }
  }, { passive: false, capture: true });
  const endTouchGesture = (event) => {
    if (!touchGesture) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length === 0) touchGesture = null;
  };
  frame.addEventListener("touchend", endTouchGesture, { passive: false, capture: true });
  frame.addEventListener("touchcancel", endTouchGesture, { passive: false, capture: true });
  $("zoom-out").onclick = () => setZoom(zoom - .1);
  $("zoom-in").onclick = () => setZoom(zoom + .1);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Control") frame.classList.add("ctrl-held");
    if (event.key === "ArrowRight" || event.key === "PageDown") next();
    if (event.key === "ArrowLeft" || event.key === "PageUp") previous();
    if (event.key === "Home") { stopAuto(); flipbook.flip(0, "bottom"); }
    if (event.key === "End") { stopAuto(); flipbook.flip(TOTAL - 1, "bottom"); }
    if (event.key === "Escape") closeDrawer();
  });
  window.addEventListener("keyup", (event) => { if (event.key === "Control") frame.classList.remove("ctrl-held"); });
  window.addEventListener("blur", () => frame.classList.remove("ctrl-held"));
  mount.addEventListener("pointerdown", stopAuto, true);
  handle.addEventListener("pointerdown", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault(); handle.setPointerCapture(event.pointerId);
    frame.classList.add("is-dragging");
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: position.x, oy: position.y };
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    position = { x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y };
    updateFrame();
  });
  const endDrag = (event) => {
    if (drag && drag.id === event.pointerId) {
      drag = null;
      frame.classList.remove("is-dragging");
    }
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  const list = $("thumbnail-list");
  pages.forEach((src, index) => {
    const button = document.createElement("button");
    button.innerHTML = `<img src="${src}" alt=""><span>${index + 1}</span>`;
    button.setAttribute("aria-label", `Go to page ${index + 1}`);
    button.onclick = async () => {
      stopAuto();
      if (!flipping) {
        hdReady = false;
        updatePage();
        await ensureHighResolution([index - 3, index - 2, index - 1, index, index + 1, index + 2, index + 3]);
        hdReady = true;
        updatePage();
        flipbook.flip(index, "bottom");
      }
      closeDrawer();
    };
    list.appendChild(button);
  });
  function openDrawer() { $("drawer").classList.add("is-open"); $("drawer").setAttribute("aria-hidden", "false"); }
  function closeDrawer() { $("drawer").classList.remove("is-open"); $("drawer").setAttribute("aria-hidden", "true"); }
  $("header-thumbs").onclick = $("toolbar-thumbs").onclick = $("page-readout").onclick = openDrawer;
  $("close-drawer").onclick = closeDrawer;

  function notice(text) { const box = $("notice"); box.textContent = text; box.hidden = false; clearTimeout(notice.timer); notice.timer = setTimeout(() => box.hidden = true, 1800); }
  $("share").onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); notice("Link copied"); }
    } catch (_) {}
  };
  $("fullscreen").onclick = async () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  updateFrame();
})();
