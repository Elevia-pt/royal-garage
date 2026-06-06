// Royal Garage v2 — frontend
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== Header scroll state =====
  const hdr = $('#hdr');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 40);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ===== Mobile menu =====
  const menu = $('#menu');
  const burger = $('#burger');
  if (menu && burger) {
    burger.onclick = () => menu.classList.toggle('open');
    $$('a', menu).forEach((a) => (a.onclick = () => menu.classList.remove('open')));
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !burger.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }

  // ===== Reveal on scroll =====
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 }
  );
  $$('.reveal').forEach((el) => io.observe(el));

  // ===== Counters animation =====
  const cio = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const end = Number(el.dataset.count) || 0;
        const suf = el.dataset.suffix || '';
        let t0 = null;
        const step = (ts) => {
          if (!t0) t0 = ts;
          const p = Math.min((ts - t0) / 1100, 1);
          el.textContent = Math.round(p * end) + suf;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        cio.unobserve(el);
      }),
    { threshold: 0.5 }
  );
  $$('[data-count]').forEach((el) => cio.observe(el));

  // ===== Filters + lazy grid (homepage) =====
  const grid = $('#grid');
  if (grid && $('#filters')) {
    const filterToggle = $('#filter-toggle');
    const filterPanel = $('#filters');
    if (filterToggle) {
      filterToggle.addEventListener('click', () => {
        filterPanel.hidden = !filterPanel.hidden;
      });
    }

    const inputs = {
      marca: $('#f-marca'),
      comb: $('#f-comb'),
      caixa: $('#f-caixa'),
      carroceria: $('#f-carroceria'),
      precoMin: $('#f-preco-min'),
      precoMax: $('#f-preco-max'),
      anoMin: $('#f-ano-min'),
      anoMax: $('#f-ano-max'),
      kmMax: $('#f-km-max'),
      sort: $('#f-sort'),
    };
    const countLabel = $('#filter-count');
    const emptyState = $('#empty-state');
    const clearBtn = $('#filter-clear');
    const gridMore = $('#grid-more');
    const btnShowAll = $('#btn-show-all');

    const INITIAL = Number(grid.dataset.initial) || 6;
    const BATCH = 6;

    const cards = $$('.car', grid);

    let expanded = false; // user clicou "Ver tudo"
    let lazyIO = null;
    let sentinel = null;

    function hasActiveFilters() {
      return Object.entries(inputs).some(([k, i]) => k !== 'sort' && i?.value);
    }

    function matches(card) {
      const d = card.dataset;
      if (inputs.marca?.value && d.marca !== inputs.marca.value) return false;
      if (inputs.comb?.value && d.comb !== inputs.comb.value) return false;
      if (inputs.caixa?.value && !(d.caixa || '').includes(inputs.caixa.value)) return false;
      if (inputs.carroceria?.value && d.carroceria !== inputs.carroceria.value) return false;
      const preco = Number(d.preco) || 0;
      if (inputs.precoMin?.value && preco < Number(inputs.precoMin.value)) return false;
      if (inputs.precoMax?.value && preco > Number(inputs.precoMax.value)) return false;
      const ano = Number(d.ano) || 0;
      if (inputs.anoMin?.value && ano < Number(inputs.anoMin.value)) return false;
      if (inputs.anoMax?.value && ano > Number(inputs.anoMax.value)) return false;
      const km = Number(d.km) || 0;
      if (inputs.kmMax?.value && km > Number(inputs.kmMax.value)) return false;
      return true;
    }

    function sortCards(visible) {
      const by = inputs.sort?.value || 'recent';
      visible.sort((a, b) => {
        const ad = a.dataset, bd = b.dataset;
        switch (by) {
          case 'price-asc':
            return Number(ad.preco) - Number(bd.preco);
          case 'price-desc':
            return Number(bd.preco) - Number(ad.preco);
          case 'km-asc':
            return Number(ad.km) - Number(bd.km);
          case 'recent':
          default:
            return new Date(bd.created || 0) - new Date(ad.created || 0);
        }
      });
    }

    function teardownSentinel() {
      if (lazyIO && sentinel) lazyIO.unobserve(sentinel);
      if (sentinel) { sentinel.remove(); sentinel = null; }
      lazyIO = null;
    }

    function revealLazyBatch() {
      const stillLazy = cards.filter(c => c.classList.contains('lazy') && c.style.display !== 'none');
      stillLazy.slice(0, BATCH).forEach(c => c.classList.remove('lazy'));
      const remaining = cards.filter(c => c.classList.contains('lazy') && c.style.display !== 'none');
      if (remaining.length === 0) teardownSentinel();
    }

    function setupInfiniteScroll() {
      if (sentinel) return;
      sentinel = document.createElement('div');
      sentinel.className = 'grid-sentinel';
      grid.parentElement.insertBefore(sentinel, grid.nextSibling);
      lazyIO = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) revealLazyBatch();
      }, { rootMargin: '300px' });
      lazyIO.observe(sentinel);
    }

    function apply() {
      const visible = [];
      cards.forEach((c) => {
        const ok = matches(c);
        c.style.display = ok ? '' : 'none';
        if (ok) visible.push(c);
      });
      sortCards(visible);
      visible.forEach((c) => grid.appendChild(c));
      if (countLabel) {
        countLabel.textContent = `${visible.length} viatura${visible.length === 1 ? '' : 's'}`;
      }
      if (emptyState) emptyState.hidden = visible.length > 0;

      const filterOn = hasActiveFilters();
      if (filterOn) {
        // Filtros ativos → revela todos os matches, sem lazy
        cards.forEach((c) => c.classList.remove('lazy'));
        if (gridMore) gridMore.classList.add('hidden');
        teardownSentinel();
      } else if (expanded) {
        // Modo infinito ligado → mantém revelação atual + reativa observer
        if (gridMore) gridMore.classList.add('hidden');
        setupInfiniteScroll();
      } else {
        // Estado inicial: 6 + botão "Ver tudo"
        visible.forEach((c, i) => {
          if (i >= INITIAL) c.classList.add('lazy');
          else c.classList.remove('lazy');
        });
        const extra = Math.max(0, visible.length - INITIAL);
        if (gridMore) gridMore.classList.toggle('hidden', extra === 0);
        if (btnShowAll && extra > 0) btnShowAll.textContent = `Ver tudo (+${extra})`;
        teardownSentinel();
      }
    }

    Object.values(inputs).forEach((input) => {
      if (!input) return;
      const evt = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(evt, apply);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Object.values(inputs).forEach((input) => {
          if (!input) return;
          if (input.tagName === 'SELECT') input.selectedIndex = 0;
          else input.value = '';
        });
        expanded = false;
        apply();
      });
    }

    if (btnShowAll) {
      btnShowAll.addEventListener('click', () => {
        expanded = true;
        if (gridMore) gridMore.classList.add('hidden');
        revealLazyBatch();
        setupInfiniteScroll();
      });
    }

    apply();
  }

  // ===== Photo gallery (per-car detail page) =====
  const mainPhoto = $('#mainPhoto');
  const thumbs = $$('.thumb');
  if (mainPhoto) {
    if (thumbs.length > 1) {
      thumbs.forEach((t) =>
        t.addEventListener('click', () => {
          thumbs.forEach((x) => x.classList.remove('active'));
          t.classList.add('active');
          mainPhoto.src = t.dataset.src;
        })
      );
    }

    // ===== Setas dos thumbs (só visíveis se houver overflow) =====
    const thumbsScroll = $('.car-detail-thumbs');
    const thumbsNav = $('.thumbs-nav');
    const navPrev = $('.thumbs-arrow.prev');
    const navNext = $('.thumbs-arrow.next');
    if (thumbs.length > 1 && thumbsScroll && thumbsNav && navPrev && navNext) {
      const step = () => Math.max(220, thumbsScroll.clientWidth * 0.7);
      navPrev.addEventListener('click', () =>
        thumbsScroll.scrollBy({ left: -step(), behavior: 'smooth' })
      );
      navNext.addEventListener('click', () =>
        thumbsScroll.scrollBy({ left: step(), behavior: 'smooth' })
      );
      const refresh = () => {
        const hasOverflow = thumbsScroll.scrollWidth > thumbsScroll.clientWidth + 1;
        thumbsNav.hidden = !hasOverflow;
        if (!hasOverflow) return;
        const sl = thumbsScroll.scrollLeft;
        const max = thumbsScroll.scrollWidth - thumbsScroll.clientWidth;
        navPrev.classList.toggle('disabled', sl <= 2);
        navNext.classList.toggle('disabled', sl >= max - 2);
      };
      thumbsScroll.addEventListener('scroll', refresh, { passive: true });
      window.addEventListener('resize', refresh);
      refresh();
    }

    // ===== Lightbox =====
    const photos = thumbs.length
      ? thumbs.map((t) => t.dataset.src)
      : [mainPhoto.src];

    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Galeria de fotos');
    lb.innerHTML =
      '<button class="lb-close" type="button" aria-label="Fechar">×</button>' +
      '<button class="lb-prev" type="button" aria-label="Anterior">‹</button>' +
      '<button class="lb-next" type="button" aria-label="Seguinte">›</button>' +
      '<div class="lb-stage"><img class="lb-img" alt=""></div>' +
      '<div class="lb-counter">1 / ' + photos.length + '</div>';
    document.body.appendChild(lb);

    const lbImg = lb.querySelector('.lb-img');
    const lbCounter = lb.querySelector('.lb-counter');
    const lbPrev = lb.querySelector('.lb-prev');
    const lbNext = lb.querySelector('.lb-next');
    let lbIdx = 0;
    let touchStartX = null;

    if (photos.length === 1) {
      lbPrev.style.display = 'none';
      lbNext.style.display = 'none';
      lbCounter.style.display = 'none';
    }

    function showLb() {
      lbImg.src = photos[lbIdx];
      lbCounter.textContent = (lbIdx + 1) + ' / ' + photos.length;
    }
    function openLb(idx) {
      lbIdx = idx;
      showLb();
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
    }
    function closeLb() {
      lb.hidden = true;
      document.body.style.overflow = '';
    }
    function nextLb() { lbIdx = (lbIdx + 1) % photos.length; showLb(); }
    function prevLb() { lbIdx = (lbIdx - 1 + photos.length) % photos.length; showLb(); }

    mainPhoto.addEventListener('click', () => {
      const activeThumb = thumbs.find((t) => t.classList.contains('active'));
      const startIdx = activeThumb ? thumbs.indexOf(activeThumb) : 0;
      openLb(startIdx >= 0 ? startIdx : 0);
    });

    lb.querySelector('.lb-close').addEventListener('click', closeLb);
    lbPrev.addEventListener('click', prevLb);
    lbNext.addEventListener('click', nextLb);
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('lb-stage')) closeLb();
    });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowRight') nextLb();
      else if (e.key === 'ArrowLeft') prevLb();
    });
    // Swipe em mobile
    lb.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) nextLb(); else prevLb();
      }
      touchStartX = null;
    });
  }
})();
