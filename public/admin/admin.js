(function () {
  'use strict';

  // ===== Bootstrap config =====
  const cfg = window.RG_AUTH || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    document.body.innerHTML =
      '<div style="padding:40px;color:#fca5a5;font-family:system-ui">' +
      '⚠️ Supabase não configurado. Verifica que as env vars <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> estão metidas no Netlify, e faz um redeploy.</div>';
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    document.body.innerHTML =
      '<div style="padding:40px;color:#fca5a5;font-family:system-ui">⚠️ Falha a carregar o SDK do Supabase. Verifica a tua ligação à net.</div>';
    return;
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit'
    }
  });

  const $ = (s) => document.querySelector(s);
  const VIEWS = ['loading', 'login', 'forgot', 'recovery', 'dashboard', 'form'];
  const NUMERIC_FIELDS = ['ano', 'km', 'preco', 'cc', 'cv', 'portas', 'lugares', 'donos'];

  const state = {
    view: 'loading',
    cars: [],
    editingId: null,
    photos: [],
    brands: [],
    equipment: [],
    formBuilt: false,
    inRecovery: false
  };

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
    if (elId !== 'loginError' && elId !== 'recoveryError') {
      setTimeout(() => el.classList.add('hidden'), 9000);
    }
  }
  function hideError(elId) {
    const el = document.getElementById(elId);
    if (el) el.classList.add('hidden');
  }
  function showNotice(msg) {
    const el = document.getElementById('noticeBox');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 6000);
  }
  function fmtPrice(n) { return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €' : '—'; }
  function fmtKm(n) { return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' km' : '—'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function attrEsc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
  function photoUrl(p) {
    if (!p) return '';
    if (/^https?:\/\//i.test(p) || p.startsWith('/')) return p;
    return '/assets/cars/' + p;
  }

  function isRecoveryUrl() {
    const hash = window.location.hash || '';
    return /(^|[#&?])type=recovery(&|$)/.test(hash);
  }

  async function getAccessToken() {
    const { data } = await sb.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  }

  async function api(path, opts) {
    opts = opts || {};
    const token = await getAccessToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (res.status === 401) {
      await sb.auth.signOut();
      setView('login');
      throw new Error('Sessão expirada. Volta a entrar.');
    }
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
    return json;
  }

  async function boot() {
    if (state.inRecovery || isRecoveryUrl()) {
      state.inRecovery = true;
      setView('recovery');
      return;
    }
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (!session) {
      setView('login');
      return;
    }
    const emailEl = $('#userEmail');
    if (emailEl && session.user && session.user.email) {
      emailEl.textContent = session.user.email;
    }
    setView('loading');
    try {
      await Promise.all([loadStaticData(), loadCars()]);
      setView('dashboard');
    } catch (e) {
      if (state.view !== 'login') {
        setView('dashboard');
        showError('errBox', e.message || 'Erro ao carregar dados');
      }
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
        ? `<img src="${esc(photoUrl(c.photos[0]))}" alt="">`
        : '<span class="no-photo">📷</span>';
      const status = c.status || 'available';
      const isSold = status === 'sold';
      const isReserved = status === 'reserved';
      return `
        <article class="car-item ${c.featured ? 'featured' : ''} ${isSold ? 'sold' : ''} ${isReserved ? 'reserved' : ''}" data-id="${attrEsc(c.id)}">
          <div class="car-thumb">
            ${photo}
            ${c.featured ? '<span class="badge-featured">★ DESTAQUE</span>' : ''}
            ${isSold ? '<span class="badge-sold">VENDIDO</span>' : ''}
            ${isReserved ? '<span class="badge-reserved">RESERVADO</span>' : ''}
          </div>
          <div class="car-info">
            <h3>${esc(c.marca)} ${esc(c.modelo)}</h3>
            <p>${esc(c.ano)} · ${fmtKm(c.km)} · ${esc(c.comb)} · <b style="color:#f0c040">${fmtPrice(c.preco)}</b></p>
          </div>
          <div class="car-actions">
            <button class="btn-icon" data-action="edit">✏️ Editar</button>
            <button class="btn-icon featured ${c.featured ? 'is-on' : ''}" data-action="featured">${c.featured ? '★ Em destaque' : '☆ Definir destaque'}</button>
            <label class="status-label">
              Estado
              <select class="status-select" data-action="status">
                <option value="available" ${status === 'available' ? 'selected' : ''}>Disponível</option>
                <option value="reserved" ${status === 'reserved' ? 'selected' : ''}>Reservado</option>
                <option value="sold" ${status === 'sold' ? 'selected' : ''}>Vendido</option>
              </select>
            </label>
            <button class="btn-icon delete" data-action="delete">🗑 Remover</button>
          </div>
        </article>`;
    }).join('');
  }

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

  function renderPhotos() {
    $('#photoCount').textContent = `${state.photos.length}/45`;
    $('#photosGrid').innerHTML = state.photos.map((url, i) => `
      <div class="photo-item" data-i="${i}">
        <img src="${esc(photoUrl(url))}" alt="">
        ${i === 0 ? '<span class="cover">CAPA</span>' : ''}
        <button type="button" class="photo-remove" data-i="${i}" title="Remover">×</button>
      </div>`).join('');
  }

  function compressImage(file, maxW, maxH, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error('Falha a comprimir.'));
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Imagem inválida.'));
      };
      img.src = url;
    });
  }

  function fmtKB(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  async function uploadFile(file) {
    if (state.photos.length >= 45) {
      alert('Máximo de 45 fotos por carro.');
      return;
    }
    if (!file.type.startsWith('image/')) return;
    const status = $('#uploadStatus');
    const skipCompress = file.type === 'image/gif' || file.type === 'image/svg+xml';
    let payload = file;
    let payloadName = file.name;
    try {
      if (!skipCompress) {
        status.textContent = `A comprimir ${file.name} (${fmtKB(file.size)})…`;
        const blob = await compressImage(file, 1920, 1280, 0.82);
        payload = blob;
        payloadName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        status.textContent = `A enviar ${payloadName} (${fmtKB(file.size)} → ${fmtKB(blob.size)})…`;
      } else {
        status.textContent = `A enviar ${file.name} (${fmtKB(file.size)})…`;
      }
      const sign = await api('upload/sign');
      const fd = new FormData();
      fd.append('file', payload, payloadName);
      fd.append('api_key', sign.apiKey);
      fd.append('timestamp', sign.timestamp);
      fd.append('signature', sign.signature);
      fd.append('folder', sign.folder);
      const res = await fetch(sign.uploadUrl, { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'Falha no upload');
      state.photos.push(json.secure_url);
      renderPhotos();
      status.textContent = `✓ ${payloadName} enviado.`;
      setTimeout(() => { if (status.textContent.startsWith('✓')) status.textContent = ''; }, 2500);
    } catch (e) {
      status.textContent = '❌ Erro: ' + e.message;
    }
  }

  // ===== Auth state listener =====
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      state.inRecovery = true;
      setView('recovery');
    } else if (event === 'SIGNED_OUT') {
      state.cars = [];
      state.inRecovery = false;
      setView('login');
    }
  });

  // ===== Event wiring =====
  document.addEventListener('DOMContentLoaded', () => {
    $('#loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError('loginError');
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;
      const btn = $('#btnLogin');
      btn.disabled = true; btn.textContent = 'A entrar…';
      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('#loginPassword').value = '';
        await boot();
      } catch (err) {
        showError('loginError', err.message || 'Erro a entrar');
      } finally {
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    });

    $('#btnForgot')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideError('loginError');
      const email = $('#loginEmail').value.trim();
      if (email) $('#forgotEmail').value = email;
      hideError('forgotError');
      $('#forgotNotice')?.classList.add('hidden');
      setView('forgot');
      setTimeout(() => $('#forgotEmail')?.focus(), 0);
    });

    $('#btnBackToLogin')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideError('forgotError');
      $('#forgotNotice')?.classList.add('hidden');
      setView('login');
    });

    $('#forgotForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError('forgotError');
      $('#forgotNotice')?.classList.add('hidden');
      const email = $('#forgotEmail').value.trim();
      if (!email) return;
      const btn = $('#btnSendReset');
      btn.disabled = true; btn.textContent = 'A enviar…';
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/admin/'
        });
        if (error) throw error;
        const box = $('#forgotNotice');
        box.textContent = '✓ Email enviado para ' + email + '. Vê a caixa de entrada (e Spam).';
        box.classList.remove('hidden');
      } catch (err) {
        showError('forgotError', err.message || 'Erro a enviar email');
      } finally {
        btn.disabled = false; btn.textContent = 'Enviar link de reset';
      }
    });

    $('#recoveryForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError('recoveryError');
      const pw = $('#recoveryPassword').value;
      const confirmPw = $('#recoveryConfirm').value;
      if (pw !== confirmPw) { showError('recoveryError', 'As passwords não coincidem.'); return; }
      if (pw.length < 6) { showError('recoveryError', 'Mínimo 6 caracteres.'); return; }
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'A guardar…';
      try {
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) throw error;
        state.inRecovery = false;
        alert('Password atualizada com sucesso! 🎉');
        // Limpar o hash do URL
        history.replaceState(null, '', '/admin/');
        await boot();
      } catch (err) {
        showError('recoveryError', err.message || 'Erro a atualizar');
      } finally {
        btn.disabled = false; btn.textContent = 'Atualizar password';
      }
    });

    $('#btnLogout')?.addEventListener('click', async () => {
      await sb.auth.signOut();
    });

    $('#btnAddCar')?.addEventListener('click', () => openForm(null));
    $('#btnCancel')?.addEventListener('click', () => {
      if (confirm('As alterações não guardadas perdem-se. Cancelar?')) setView('dashboard');
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
          showNotice('✓ Destaque atualizado. O site público pode levar até 1 min a refletir.');
        } else if (action === 'delete') {
          if (!confirm(`Remover "${car.marca} ${car.modelo}" definitivamente?\n\nIsto não pode ser desfeito.`)) return;
          btn.disabled = true; btn.textContent = '…';
          await api('cars/delete', { method: 'POST', body: { id } });
          await loadCars();
          showNotice('✓ Viatura removida. O site público pode levar até 1 min a refletir.');
        }
      } catch (err) {
        if (state.view !== 'login') {
          showError('errBox', err.message || 'Erro desconhecido');
          await loadCars().catch(() => {});
        }
      }
    });

    $('#carsList')?.addEventListener('change', async (e) => {
      const sel = e.target.closest('select[data-action="status"]');
      if (!sel) return;
      const item = sel.closest('.car-item');
      const id = item?.dataset.id;
      const car = state.cars.find(c => c.id === id);
      if (!car) return;
      const newStatus = sel.value;
      const current = car.status || 'available';
      if (newStatus === current) return;
      const labels = { available: 'Disponível', reserved: 'Reservado', sold: 'Vendido' };
      if (!confirm(`Mudar "${car.marca} ${car.modelo}" para "${labels[newStatus]}"?`)) {
        sel.value = current;
        return;
      }
      sel.disabled = true;
      try {
        await api('cars/status', { method: 'POST', body: { id, status: newStatus } });
        await loadCars();
        showNotice(`✓ Estado alterado para ${labels[newStatus]}. O site público pode levar até 1 min a refletir.`);
      } catch (err) {
        sel.value = current;
        if (state.view !== 'login') {
          showError('errBox', err.message || 'Erro desconhecido');
          await loadCars().catch(() => {});
        }
      } finally {
        sel.disabled = false;
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
        const wasEdit = !!state.editingId;
        await api('cars/save', { method: 'POST', body: payload });
        await loadCars();
        setView('dashboard');
        showNotice(`✓ Viatura ${wasEdit ? 'atualizada' : 'adicionada'}. O site público pode levar até 1 min a refletir.`);
      } catch (err) {
        showError('formErr', 'Erro a guardar: ' + (err.message || ''));
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

    boot();
  });
})();
