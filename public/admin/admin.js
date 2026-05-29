(function () {
  'use strict';

  const API = '/api';
  const $ = (s) => document.querySelector(s);

  const state = {
    view: 'loading',
    user: null,
    cars: [],
    editingId: null,
    photos: [],
    brands: [],
    equipment: [],
    formBuilt: false,
  };

  const VIEWS = ['loading', 'login', 'dashboard', 'form'];
  const NUMERIC_FIELDS = ['ano', 'km', 'preco', 'cc', 'cv', 'portas', 'lugares', 'donos'];

  function setView(name) {
    state.view = name;
    VIEWS.forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
  }

  function showError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 9000);
  }

  function fmtPrice(n) { return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €' : '—'; }
  function fmtKm(n) { return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' km' : '—'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function attrEsc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

  // ===== Netlify Identity =====
  function waitForIdentity() {
    return new Promise((resolve) => {
      if (window.netlifyIdentity) return resolve();
      const t = setInterval(() => {
        if (window.netlifyIdentity) { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  waitForIdentity().then(() => {
    netlifyIdentity.on('init', user => {
      if (user) onLogin(user);
      else setView('login');
    });
    netlifyIdentity.on('login', user => {
      netlifyIdentity.close();
      onLogin(user);
    });
    netlifyIdentity.on('logout', () => {
      state.user = null;
      setView('login');
    });
    netlifyIdentity.init();
  });

  async function onLogin(user) {
    state.user = user;
    const emailEl = $('#userEmail');
    if (emailEl) emailEl.textContent = user.email || '';
    setView('loading');
    try {
      await loadStaticData();
      await loadCars();
      setView('dashboard');
    } catch (e) {
      setView('dashboard');
      showError('errBox', 'Erro ao carregar dados: ' + e.message);
    }
  }

  async function loadStaticData() {
    if (state.brands.length && state.equipment.length) return;
    const [brands, equipment] = await Promise.all([
      fetch('/data/brands.json').then(r => r.json()),
      fetch('/data/equipment.json').then(r => r.json())
    ]);
    state.brands = brands;
    state.equipment = equipment;
  }

  // ===== API client =====
  async function api(path, opts = {}) {
    const user = netlifyIdentity.currentUser();
    if (!user) throw new Error('Sessão expirada. Faz login outra vez.');
    const token = await user.jwt();
    const res = await fetch(`${API}/${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
    return json;
  }

  // ===== Cars list =====
  async function loadCars() {
    const { cars } = await api('cars');
    state.cars = cars || [];
    renderCarsList();
  }

  function renderCarsList() {
    const list = $('#carsList');
    if (!state.cars.length) {
      list.innerHTML = '<div class="empty">Ainda não tens carros. Carrega "＋ Adicionar carro" para começar.</div>';
      return;
    }
    list.innerHTML = state.cars.map(c => {
      const photo = (c.photos && c.photos[0])
        ? `<img src="${esc(c.photos[0])}" alt="">`
        : '<span class="no-photo">📷</span>';
      const isSold = c.status === 'sold';
      return `
        <article class="car-item ${c.featured ? 'featured' : ''} ${isSold ? 'sold' : ''}" data-id="${attrEsc(c.id)}">
          <div class="car-thumb">
            ${photo}
            ${c.featured ? '<span class="badge-featured">★ DESTAQUE</span>' : ''}
            ${isSold ? '<span class="badge-sold">VENDIDO</span>' : ''}
          </div>
          <div class="car-info">
            <h3>${esc(c.marca)} ${esc(c.modelo)}</h3>
            <p>${esc(c.ano)} · ${fmtKm(c.km)} · ${esc(c.comb)} · <b style="color:#f0c040">${fmtPrice(c.preco)}</b></p>
          </div>
          <div class="car-actions">
            <button class="btn-icon" data-action="edit">✏️ Editar</button>
            <button class="btn-icon featured ${c.featured ? 'is-on' : ''}" data-action="featured">${c.featured ? '★ Em destaque' : '☆ Definir destaque'}</button>
            <button class="btn-icon" data-action="status">${isSold ? '🔄 Marcar disponível' : '✓ Marcar vendido'}</button>
            <button class="btn-icon delete" data-action="delete">🗑 Remover</button>
          </div>
        </article>`;
    }).join('');
  }

  // ===== Form =====
  function buildFormOnce() {
    if (state.formBuilt) return;
    const marcaSel = $('#f-marca');
    marcaSel.innerHTML = '<option value="">Escolher…</option>' + state.brands.map(b => `<option>${esc(b)}</option>`).join('');
    $('#equipmentList').innerHTML = state.equipment.map(cat => `
      <div class="equip-cat">
        <h4>${esc(cat.category)}</h4>
        <div class="equip-cb-grid">
          ${cat.items.map(item => `<label><input type="checkbox" name="extras" value="${attrEsc(item)}"> ${esc(item)}</label>`).join('')}
        </div>
      </div>`).join('');
    state.formBuilt = true;
  }

  function resetForm() {
    $('#carForm').reset();
    state.photos = [];
    renderPhotos();
    $('#formErr').classList.add('hidden');
  }

  function openForm(car) {
    buildFormOnce();
    resetForm();
    state.editingId = car ? car.id : null;
    $('#formTitle').textContent = car ? `Editar: ${car.marca} ${car.modelo}` : 'Adicionar carro';

    if (car) {
      const form = $('#carForm');
      ['marca', 'modelo', 'versao', 'ano', 'mes', 'km', 'comb', 'caixa', 'preco',
       'cc', 'cv', 'tracao', 'portas', 'lugares', 'cor', 'carroceria',
       'origem', 'donos', 'garantia', 'inspecao', 'desc'].forEach(k => {
        const el = form.elements[k];
        if (el && car[k] != null) el.value = car[k];
      });
      if (Array.isArray(car.extras)) {
        car.extras.forEach(ex => {
          const cb = form.querySelector(`input[name="extras"][value="${ex.replace(/"/g, '\\"')}"]`);
          if (cb) cb.checked = true;
        });
      }
      state.photos = Array.isArray(car.photos) ? [...car.photos] : [];
      renderPhotos();
    }
    setView('form');
  }

  function collectForm() {
    const form = $('#carForm');
    const payload = { extras: [] };
    const data = new FormData(form);
    for (const [k, vRaw] of data.entries()) {
      const v = String(vRaw).trim();
      if (k === 'extras') {
        if (v) payload.extras.push(v);
      } else {
        if (v === '') continue;
        if (NUMERIC_FIELDS.includes(k)) {
          const n = Number(v);
          if (!Number.isNaN(n)) payload[k] = n;
        } else {
          payload[k] = v;
        }
      }
    }
    if (!payload.extras.length) delete payload.extras;
    payload.photos = [...state.photos];
    if (state.editingId) payload.id = state.editingId;
    return payload;
  }

  // ===== Photos =====
  function renderPhotos() {
    $('#photoCount').textContent = `${state.photos.length}/15`;
    $('#photosGrid').innerHTML = state.photos.map((url, i) => `
      <div class="photo-item" data-i="${i}">
        <img src="${esc(url)}" alt="">
        ${i === 0 ? '<span class="cover">CAPA</span>' : ''}
        <button type="button" class="photo-remove" data-i="${i}" title="Remover">×</button>
      </div>`).join('');
  }

  async function uploadFile(file) {
    if (state.photos.length >= 15) {
      alert('Máximo de 15 fotos por carro.');
      return;
    }
    if (!file.type.startsWith('image/')) return;
    const status = $('#uploadStatus');
    status.textContent = `A enviar ${file.name}…`;
    try {
      const sign = await api('upload/sign');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sign.apiKey);
      fd.append('timestamp', sign.timestamp);
      fd.append('signature', sign.signature);
      fd.append('folder', sign.folder);
      const res = await fetch(sign.uploadUrl, { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'Falha no upload');
      state.photos.push(json.secure_url);
      renderPhotos();
      status.textContent = '';
    } catch (e) {
      status.textContent = '❌ Erro: ' + e.message;
    }
  }

  // ===== Event wiring =====
  document.addEventListener('DOMContentLoaded', () => {
    $('#btnLogin')?.addEventListener('click', () => netlifyIdentity.open());
    $('#btnLogout')?.addEventListener('click', () => netlifyIdentity.logout());
    $('#btnAddCar')?.addEventListener('click', () => openForm(null));
    $('#btnCancel')?.addEventListener('click', () => {
      if (confirm('As alterações não guardadas perdem-se. Cancelar?')) {
        setView('dashboard');
      }
    });

    $('#carsList')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const item = btn.closest('.car-item');
      const id = item?.dataset.id;
      const car = state.cars.find(c => c.id === id);
      if (!car) return;
      const action = btn.dataset.action;

      try {
        if (action === 'edit') {
          openForm(car);
        } else if (action === 'featured') {
          if (!confirm(`Definir "${car.marca} ${car.modelo}" como viatura em destaque?`)) return;
          btn.disabled = true; btn.textContent = '…';
          await api('cars/featured', { method: 'POST', body: { id } });
          await loadCars();
        } else if (action === 'status') {
          const next = car.status === 'sold' ? 'available' : 'sold';
          const verb = next === 'sold' ? 'VENDIDO' : 'disponível';
          if (!confirm(`Marcar "${car.marca} ${car.modelo}" como ${verb}?`)) return;
          btn.disabled = true; btn.textContent = '…';
          await api('cars/status', { method: 'POST', body: { id, status: next } });
          await loadCars();
        } else if (action === 'delete') {
          if (!confirm(`Remover "${car.marca} ${car.modelo}" definitivamente?\n\nIsto não pode ser desfeito.`)) return;
          btn.disabled = true; btn.textContent = '…';
          await api('cars/delete', { method: 'POST', body: { id } });
          await loadCars();
        }
      } catch (err) {
        showError('errBox', err.message || 'Erro desconhecido');
        await loadCars();
      }
    });

    $('#carForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = collectForm();
      if (!payload.marca || !payload.modelo) {
        showError('formErr', 'Marca e modelo são obrigatórios.');
        return;
      }
      const saveBtn = $('#btnSave');
      saveBtn.disabled = true;
      saveBtn.textContent = 'A guardar…';
      try {
        await api('cars/save', { method: 'POST', body: payload });
        await loadCars();
        setView('dashboard');
      } catch (err) {
        showError('formErr', 'Erro a guardar: ' + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
      }
    });

    const dz = $('#dropzone');
    const inp = $('#photoInput');
    if (dz && inp) {
      dz.addEventListener('click', () => inp.click());
      inp.addEventListener('change', async (e) => {
        for (const f of Array.from(e.target.files)) await uploadFile(f);
        e.target.value = '';
      });
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
      dz.addEventListener('drop', async (e) => {
        e.preventDefault();
        dz.classList.remove('drag');
        for (const f of Array.from(e.dataTransfer.files)) await uploadFile(f);
      });
    }

    $('#photosGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.photo-remove');
      if (!btn) return;
      const i = +btn.dataset.i;
      state.photos.splice(i, 1);
      renderPhotos();
    });
  });
})();
