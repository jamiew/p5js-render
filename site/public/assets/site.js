// Progressive enhancement for the demo site. Without this script every card
// still shows a poster, a native video player and a static film strip.

const root = document.documentElement;
const liveRegion = document.getElementById('status');
const motionButton = document.querySelector('.motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reducedMotion.matches;
const visible = new Set();

const announce = (message) => {
  liveRegion.textContent = '';
  requestAnimationFrame(() => (liveRegion.textContent = message));
};

// Videos only load and play while on screen, and only when motion is on.
const playIfAllowed = (video) => {
  if (
    motion &&
    visible.has(video) &&
    !video.closest('.card')?.dataset.scrubbing
  ) {
    video.play().catch(() => {});
  }
};

const viewport = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) {
        visible.add(target);
        playIfAllowed(target);
      } else {
        visible.delete(target);
        target.pause();
      }
    }
  },
  { rootMargin: '200px' }
);

const setMotion = (next) => {
  motion = next;
  root.classList.toggle('motion-off', !motion);
  root.classList.toggle('motion-on', motion);
  motionButton.setAttribute('aria-pressed', String(!motion));
  motionButton.textContent = motion ? 'Pause motion' : 'Play motion';
  for (const video of document.querySelectorAll('video')) {
    if (motion) playIfAllowed(video);
    else video.pause();
  }
};

motionButton.addEventListener('click', () => {
  setMotion(!motion);
  announce(motion ? 'Animations playing' : 'Animations paused');
});

for (const video of document.querySelectorAll('.reel video, .remix-video')) {
  viewport.observe(video);
}

// Resolves to an absolute URL once the image is decoded. Absolute, because
// url() inside a custom property resolves against the stylesheet, not the page.
const loadImage = (path) => {
  const url = new URL(path, document.baseURI).href;
  const image = new Image();
  image.src = url;
  return image.decode().then(() => url);
};

// Small strip sprites load shortly before a card scrolls into view.
const spriteLoader = new IntersectionObserver(
  (entries) => {
    for (const { target: card, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      spriteLoader.unobserve(card);
      loadImage(card.dataset.sprite)
        .then((url) => {
          card.style.setProperty('--sprite', `url("${url}")`);
          card.classList.add('sprite-ready');
        })
        .catch(() => card.classList.add('sprite-failed'));
    }
  },
  { rootMargin: '600px' }
);

for (const card of document.querySelectorAll('.card')) {
  const video = card.querySelector('video');
  const stage = card.querySelector('.stage');
  const film = card.querySelector('.film');
  const playhead = card.querySelector('.playhead');
  const label = card.querySelector('.frame');
  const preview = card.querySelector('.scrub-preview');
  const frames = Number(card.dataset.frames);
  const fps = Number(card.dataset.fps);
  const step = Number(card.dataset.spriteStep);
  const columns = Number(card.dataset.spriteColumns);
  const rows = Number(card.dataset.spriteRows);
  let frame = 0;
  let scrubSprite = null;
  let exactSeek = 0;

  // The sharp scrub sprite is large, so it loads only when someone reaches for
  // the strip. Until it arrives the preview upscales the small strip sprite.
  const loadScrubSprite = () => {
    scrubSprite ??= loadImage(card.dataset.scrubSprite)
      .then((url) => card.style.setProperty('--scrub', `url("${url}")`))
      .catch(() => {});
  };
  film.addEventListener('pointerenter', loadScrubSprite);
  film.addEventListener('focus', loadScrubSprite);

  // The custom film strip replaces the native controls once JS is running.
  video.removeAttribute('controls');
  viewport.observe(video);
  spriteLoader.observe(card);

  for (const type of ['loadstart', 'waiting', 'seeking']) {
    video.addEventListener(type, () => {
      if (!video.paused || type === 'seeking')
        stage.classList.add('is-loading');
    });
  }
  for (const type of ['playing', 'seeked', 'pause', 'canplay']) {
    video.addEventListener(type, () => stage.classList.remove('is-loading'));
  }

  const render = (frameNumber, { announceValue = false } = {}) => {
    frame = Math.max(0, Math.min(frames - 1, frameNumber));
    playhead.style.left = `${((frame + 0.5) / frames) * 100}%`;
    label.textContent = `frame ${frame + 1} / ${frames}`;
    if (announceValue) {
      film.setAttribute('aria-valuenow', String(frame + 1));
      film.setAttribute('aria-valuetext', `Frame ${frame + 1} of ${frames}`);
    }
  };

  const follow = () => {
    if (!card.dataset.scrubbing)
      render(Math.floor(video.currentTime * fps + 0.001));
    video.requestVideoFrameCallback(follow);
  };
  if ('requestVideoFrameCallback' in video)
    video.requestVideoFrameCallback(follow);
  else
    video.addEventListener('timeupdate', () =>
      render(Math.floor(video.currentTime * fps))
    );

  // While scrubbing, the sprite gives instant thumbnails. When the pointer
  // rests, or lets go, the video seeks to the exact frame and replaces it.
  const settle = () => {
    const target = frame;
    video.currentTime = (target + 0.5) / fps;
    video.addEventListener(
      'seeked',
      () => {
        // Mid-drag, keep the preview if the pointer has already moved on.
        if (!card.dataset.scrubbing || frame === target) preview.hidden = true;
      },
      { once: true }
    );
  };

  const showPreview = () => {
    clearTimeout(exactSeek);
    exactSeek = setTimeout(settle, 140);
    if (!card.classList.contains('sprite-ready')) return;
    const cell = Math.min(Math.round(frame / step), columns * rows - 1);
    const x = columns > 1 ? ((cell % columns) / (columns - 1)) * 100 : 0;
    const y = rows > 1 ? (Math.floor(cell / columns) / (rows - 1)) * 100 : 0;
    preview.style.backgroundPosition = `${x}% ${y}%`;
    preview.hidden = false;
  };

  const seekTo = (frameNumber) => {
    render(frameNumber, { announceValue: true });
    showPreview();
  };

  const fromPointer = (event) => {
    const box = film.getBoundingClientRect();
    return Math.floor(((event.clientX - box.left) / box.width) * frames);
  };

  film.addEventListener('pointerdown', (event) => {
    film.setPointerCapture(event.pointerId);
    loadScrubSprite();
    card.dataset.scrubbing = 'true';
    video.pause();
    seekTo(fromPointer(event));
  });
  film.addEventListener('pointermove', (event) => {
    if (card.dataset.scrubbing) seekTo(fromPointer(event));
  });
  const release = () => {
    if (!card.dataset.scrubbing) return;
    delete card.dataset.scrubbing;
    clearTimeout(exactSeek);
    settle();
    playIfAllowed(video);
  };
  film.addEventListener('pointerup', release);
  film.addEventListener('pointercancel', release);

  film.addEventListener('keydown', (event) => {
    const jumps = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -Math.ceil(frames / 10),
      PageUp: Math.ceil(frames / 10)
    };
    let target;
    if (event.key in jumps) target = frame + jumps[event.key];
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = frames - 1;
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (video.paused) {
        visible.add(video);
        video.play().catch(() => {});
      } else video.pause();
      return;
    } else return;
    event.preventDefault();
    video.pause();
    render(target, { announceValue: true });
    settle();
  });

  video.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  card.querySelector('.copy').addEventListener('click', async (event) => {
    const command = event.currentTarget.dataset.command;
    try {
      await navigator.clipboard.writeText(command);
      announce(`Copied ${command}`);
    } catch {
      announce('Copy failed. Select the command text instead.');
    }
  });
}

// Clean or debug videos, keeping each card at the same moment.
const modeButtons = [...document.querySelectorAll('.toggle button')];
for (const button of modeButtons) {
  button.addEventListener('click', () => {
    const debug = button.dataset.mode === 'debug';
    for (const other of modeButtons) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    for (const card of document.querySelectorAll('.card')) {
      const video = card.querySelector('video');
      const time = video.currentTime;
      const wasPlaying = !video.paused;
      video.src = debug ? card.dataset.debugVideo : card.dataset.video;
      if (visible.has(video) || wasPlaying) {
        video.addEventListener(
          'loadedmetadata',
          () => (video.currentTime = time),
          { once: true }
        );
        playIfAllowed(video);
      }
    }
    announce(debug ? 'Showing debug HUD videos' : 'Showing clean videos');
  });
}

setMotion(motion);
reducedMotion.addEventListener('change', (event) => setMotion(!event.matches));
