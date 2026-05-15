/**
 * ev-supabase.js — Engel & Völkers Mittleres Ruhrgebiet
 * Zentrale Datenbankschicht — Version 1.1
 */

const SUPABASE_URL = 'https://pwkoxtyficedetiymgcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fQvTH65W8d6NTxX_KEp3SQ_SVU4YvGV';

// ── HTTP-HELFER ──────────────────────────────────────────────────
const _sb = {
  h(jwt) {
    const headers = {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${jwt || SUPABASE_KEY}`,
      'Prefer':        'return=representation'
    };
    return headers;
  },

  async req(method, path, body, jwt) {
    const url = SUPABASE_URL.replace(/\/$/, '') + path;
    const opts = { method, headers: this.h(jwt) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        msg = j.error_description || j.message || j.msg || j.hint || msg;
      } catch(_) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  // REST
  get(table, query, jwt)  { return this.req('GET',    `/rest/v1/${table}?${query}`, null, jwt); },
  post(table, data, jwt)  { return this.req('POST',   `/rest/v1/${table}`, data, jwt); },

  // Auth
  signIn(email, pw) { return this.req('POST', '/auth/v1/token?grant_type=password', { email, password: pw }); },
  signOut(jwt)      { return this.req('POST', '/auth/v1/logout', {}, jwt); },
  getUser(jwt)      { return this.req('GET',  '/auth/v1/user', null, jwt); },

  // Token storage
  jwt()          { return localStorage.getItem('ev_jwt') || null; },
  setJwt(t)      { localStorage.setItem('ev_jwt', t); },
  clearJwt()     { ['ev_jwt','ev_refresh','ev_user_meta'].forEach(k => localStorage.removeItem(k)); }
};

// ── ÖFFENTLICHE API ──────────────────────────────────────────────
window.EvDB = {

  isConfigured() {
    return SUPABASE_URL !== 'DEINE_SUPABASE_URL_HIER' &&
           SUPABASE_KEY !== 'DEIN_SUPABASE_ANON_KEY_HIER';
  },

  // ── AUTH ────────────────────────────────────────────────────
  async login(email, password) {
    if (!this.isConfigured()) return _demoLogin(email, password);
    const d = await _sb.signIn(email, password);
    if (!d.access_token) throw new Error('Kein Token erhalten — bitte Zugangsdaten prüfen.');
    _sb.setJwt(d.access_token);
    if (d.refresh_token) localStorage.setItem('ev_refresh', d.refresh_token);
    const user = _buildUser(d.user, email);
    localStorage.setItem('ev_user_meta', JSON.stringify(user));
    sessionStorage.setItem('evUser', JSON.stringify(user));
    return user;
  },

  async getCurrentUser() {
    const jwt = _sb.jwt();
    if (!jwt) return null;
    if (!this.isConfigured()) {
      const m = localStorage.getItem('ev_user_meta');
      return m ? JSON.parse(m) : null;
    }
    try {
      const d = await _sb.getUser(jwt);
      const user = _buildUser(d, d.email);
      sessionStorage.setItem('evUser', JSON.stringify(user));
      return user;
    } catch(e) {
      _sb.clearJwt();
      return null;
    }
  },

  async logout() {
    const jwt = _sb.jwt();
    if (jwt && this.isConfigured()) { try { await _sb.signOut(jwt); } catch(_) {} }
    _sb.clearJwt();
    sessionStorage.removeItem('evUser');
  },

  jwt() { return _sb.jwt(); },

  // ── BRAND-SHOP ──────────────────────────────────────────────
  async saveOrder(order) {
    const row = {
      order_number: order.id,
      user_email:   _email(),
      user_name:    _name(),
      items:        order.items,
      total_eur:    order.total,
      status:       order.status || 'approved',
      location:     order.location  || null,
      cost_center:  order.costCenter || null,
      project_ref:  order.projectRef || null,
      notes:        order.notes      || null,
      over_budget:  order.overBudget || false
    };
    if (!this.isConfigured()) return _store('ev_orders', row);
    return _sb.post('shop_orders', row, _sb.jwt());
  },

  async getOrders(limit = 200) {
    if (!this.isConfigured()) return _load('ev_orders');
    return _sb.get('shop_orders',
      `select=*&order=created_at.desc&limit=${limit}`,
      _sb.jwt());
  },

  // ── FINANZIERUNG ────────────────────────────────────────────
  async saveFinanzierung(data) {
    const row = {
      berater_name:    data.beraterName    || null,
      berater_email:   data.beraterEmail   || null,
      referenz:        data.referenz       || null,
      kn1_name:        `${data.kn1_vorname||''} ${data.kn1_nachname||''}`.trim() || null,
      kn1_gebdat:      data.kn1_gebdat     || null,
      kn1_adresse:     data.kn1_adresse    || null,
      kn1_email:       data.kn1_email      || null,
      kn1_tel:         data.kn1_tel        || null,
      kn1_beschaeft:   data.kn1_beschaeft  || null,
      kn1_netto:       parseFloat(data.kn1_netto)  || null,
      kn2_name:        data.kn2_name       || null,
      kn2_netto:       parseFloat(data.kn2_netto)  || null,
      obj_art:         data.obj_art        || null,
      obj_adresse:     data.obj_adresse    || null,
      obj_kaufpreis:   parseFloat(data.obj_kaufpreis)  || null,
      obj_baujahr:     parseInt(data.obj_baujahr)      || null,
      obj_nutzung:     data.obj_nutzung    || null,
      obj_wohnfl:      parseFloat(data.obj_wohnfl)     || null,
      obj_energie_kl:  data.obj_energie_kl || null,
      fin_ek:          parseFloat(data.fin_ek)         || null,
      fin_ek_quote:    parseFloat(data.fin_ek_quote)   || null,
      fin_darlehen:    parseFloat(data.fin_darlehen)   || null,
      fin_gesamt:      parseFloat(data.fin_gesamt)     || null,
      fin_zinsbindung: parseInt(data.fin_zinsbindung)  || null,
      fin_tilgung:     parseFloat(data.fin_tilgung)    || null,
      fin_sondertilg:  data.fin_sondertilg || null,
      foerderungen:    data.foerderungen   || null,
      zielbank:        data.zielbank       || null,
      status:          'gesendet'
    };
    if (!this.isConfigured()) return _store('ev_finanzierung', row);
    return _sb.post('finanzierung_anfragen', row, _sb.jwt());
  },

  async getFinanzierungen(limit = 200) {
    if (!this.isConfigured()) return _load('ev_finanzierung');
    return _sb.get('finanzierung_anfragen',
      `select=*&order=created_at.desc&limit=${limit}`,
      _sb.jwt());
  },

  // ── WEEKLY ──────────────────────────────────────────────────
  async saveWeekly(data) {
    const row = {
      user_name:     data.userName    || null,
      user_email:    _email(),
      kw:            data.kw          || null,
      jahr:          data.jahr        || null,
      rolle:         data.rolle       || null,
      score_pct:     data.scorePct    || null,
      score_note:    data.scoreNote   || null,
      antworten:     data.antworten   || {},
      offene_punkte: data.offenePunkte || [],
      kommentare:    data.kommentare  || {}
    };
    if (!this.isConfigured()) return _store('ev_weekly', row);
    return _sb.post('weekly_checkins', row, _sb.jwt());
  },

  async getWeekly(limit = 500) {
    if (!this.isConfigured()) return _load('ev_weekly');
    return _sb.get('weekly_checkins',
      `select=*&order=created_at.desc&limit=${limit}`,
      _sb.jwt());
  },

  // ── SOCIAL MEDIA ────────────────────────────────────────────
  async saveSocialMedia(data) {
    const row = {
      sender_name:    data.senderName    || null,
      sender_email:   data.senderEmail   || _email(),
      beitragsart:    data.beitragsart   || null,
      plattformen:    data.plattformen   || [],
      format:         data.format        || null,
      ton:            data.ton           || null,
      logo_variante:  data.logoVariante  || null,
      dringlichkeit:  data.dringlichkeit || null,
      inhalt:         data.inhalt        || null,
      objekt_details: data.objektDetails || null,
      anhaenge_anz:   data.anhaengeAnz   || 0,
      status:         'eingegangen'
    };
    if (!this.isConfigured()) return _store('ev_socialmedia', row);
    return _sb.post('socialmedia_anfragen', row, _sb.jwt());
  },

  async getSocialMedia(limit = 200) {
    if (!this.isConfigured()) return _load('ev_socialmedia');
    return _sb.get('socialmedia_anfragen',
      `select=*&order=created_at.desc&limit=${limit}`,
      _sb.jwt());
  },

  // ── ADMIN STATS ─────────────────────────────────────────────
  async getAdminStats() {
    if (!this.isConfigured()) {
      return {
        orders:      _load('ev_orders'),
        finanz:      _load('ev_finanzierung'),
        weekly:      _load('ev_weekly'),
        socialmedia: _load('ev_socialmedia')
      };
    }
    const jwt = _sb.jwt();
    const [orders, finanz, weekly, social] = await Promise.allSettled([
      _sb.get('shop_orders',           'select=*&order=created_at.desc&limit=500', jwt),
      _sb.get('finanzierung_anfragen', 'select=*&order=created_at.desc&limit=500', jwt),
      _sb.get('weekly_checkins',       'select=*&order=created_at.desc&limit=500', jwt),
      _sb.get('socialmedia_anfragen',  'select=*&order=created_at.desc&limit=500', jwt)
    ]);
    return {
      orders:      orders.status      === 'fulfilled' ? orders.value      : [],
      finanz:      finanz.status      === 'fulfilled' ? finanz.value      : [],
      weekly:      weekly.status      === 'fulfilled' ? weekly.value      : [],
      socialmedia: social.status      === 'fulfilled' ? social.value      : []
    };
  }
};

// ── INTERNE HELPERS ──────────────────────────────────────────────
function _buildUser(u, email) {
  const m = u.user_metadata || {};
  const full = m.full_name || m.name || email.split('@')[0].replace('.', ' ');
  const parts = full.trim().split(' ');
  return {
    id:        u.id,
    email,
    fullName:  full,
    firstName: parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : full,
    lastName:  parts.slice(1).join(' '),
    initials:  parts.map(p => p[0]?.toUpperCase() || '').join('').substring(0,2) || 'EV',
    role:      m.role || 'berater'
  };
}

function _email() {
  try { return JSON.parse(sessionStorage.getItem('evUser') || '{}').email || 'unbekannt'; }
  catch(_) { return 'unbekannt'; }
}
function _name() {
  try { return JSON.parse(sessionStorage.getItem('evUser') || '{}').fullName || 'Unbekannt'; }
  catch(_) { return 'Unbekannt'; }
}
function _store(key, row) {
  const arr = _load(key);
  const r = { ...row, id: Date.now(), created_at: new Date().toISOString() };
  arr.unshift(r);
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 500)));
  return r;
}
function _load(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch(_) { return []; }
}
function _demoLogin(email, password) {
  if (password !== 'Sommeranfang') {
    throw new Error('Ungültige Zugangsdaten. Demo-Passwort: Sommeranfang');
  }
  const parts = email.split('@')[0].split('.');
  const user = {
    id: 'demo-' + email, email,
    fullName:  parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
    firstName: parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Demo',
    lastName:  parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'User',
    initials:  parts.map(p => p[0]?.toUpperCase() || '').join('').substring(0,2) || 'EV',
    role:      'berater'
  };
  localStorage.setItem('ev_user_meta', JSON.stringify(user));
  localStorage.setItem('ev_jwt', 'demo-token');
  return user;
}

// Status-Log
(function() {
  if (!window.EvDB.isConfigured()) {
    console.warn('%c[E&V] Supabase nicht konfiguriert — Demo-Modus aktiv', 'color:#C41E3A;font-weight:bold');
  } else {
    console.info('%c[E&V] Supabase verbunden ✓', 'color:#2d7a4f;font-weight:bold');
  }
})();
