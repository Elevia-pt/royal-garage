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

  // ===== Filters (homepage) =====
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

    const cards = $$('.car', grid);

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
        apply();
      });
    }
  }

  // ===== Photo gallery (per-car detail page) =====
  const mainPhoto = $('#mainPhoto');
  const thumbs = $$('.thumb');
  if (mainPhoto && thumbs.length > 1) {
    thumbs.forEach((t) =>
      t.addEventListener('click', () => {
        thumbs.forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        mainPhoto.src = t.dataset.src;
      })
    );
  }
})();
