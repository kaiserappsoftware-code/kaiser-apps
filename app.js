/* Kaiser · Rekod Kerja & Tuntutan — Fasa 1 (mod demo)
 * Satu apps, dua paparan: Apps Pekerja (penyelia) dan Apps Pentadbiran (pengurus, pengarah, akaun).
 * Data disimpan dalam pelayar (localStorage). Lapisan `Store` boleh ditukar kepada Firebase kemudian.
 */
(function () {
  'use strict';

  // ---------- Konstan ----------
  const SKOP = [
    { id: 'sivil', nama: 'Kejuruteraan awam (sivil)', pendek: 'Sivil' },
    { id: 'elektrik', nama: 'Kerja elektrik', pendek: 'Elektrik' },
    { id: 'mekanikal', nama: 'Kerja mekanikal', pendek: 'Mekanikal' },
    { id: 'ac', nama: 'Penghawa dingin', pendek: 'AC' },
    { id: 'fabrikasi', nama: 'Fabrikasi & struktur keluli', pendek: 'Fabrikasi' },
    { id: 'cat', nama: 'Pengecatan & sand blasting', pendek: 'Cat / blasting' },
    { id: 'fasiliti', nama: 'Penyelenggaraan fasiliti', pendek: 'Fasiliti' },
    { id: 'tenaga', nama: 'Bekalan tenaga kerja', pendek: 'Tenaga kerja' },
  ];
  const VO_STATUS = ['Sedang dijalankan', 'Menunggu sebut harga', 'Sebut harga dihantar', 'PO diterima', 'Diinvois', 'Dibayar'];
  const PERANAN = { pekerja: 'Pekerja', penyelia: 'Penyelia', pengurus: 'Pengurus', pengarah: 'Pengarah', akaun: 'Akaun' };
  const STATUS_LABEL = { dihantar: 'Dihantar', disahkan: 'Disahkan', diluluskan: 'Diluluskan', dikembalikan: 'Dikembalikan', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan', dibayar: 'Dibayar', dijelaskan: 'Dijelaskan' };
  const DB_KEY = 'kaiser_app_v1';
  // Dua apps, satu kod: 'pekerja' (telefon pekerja, log masuk ID + PIN) atau 'urus' (pengurusan & akaun, log masuk emel).
  const APP = window.KAISER_APP === 'pekerja' ? 'pekerja' : 'urus';
  const BASE = window.KAISER_BASE || '';
  const PIN_DOMAIN = 'pekerja.kaiser-apps.app';
  const pinEmail = (id, ver) => `${String(id).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.v${ver || 1}@${PIN_DOMAIN}`;
  const normId = (id) => String(id || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const USER_KEY = 'kaiser_app_user';

  // ---------- Utiliti ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const thisMonth = () => today().slice(0, 7);
  const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const monthName = (ym) => `${BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  const fmtDate = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${Number(dd)} ${BULAN[Number(m) - 1].slice(0, 3)} ${y}`; };
  const rm = (n) => 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rm0 = (n) => 'RM ' + Math.round(Number(n || 0)).toLocaleString('en-MY');
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const daysBetween = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);

  function toast(msg) {
    const t = $('#toast'); t.textContent = window.KaiserBahasa && localStorage.getItem('kaiser_bahasa') === 'en' ? window.KaiserBahasa.teks(String(msg)) : msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- Store (localStorage; tukar kepada Firebase dalam fasa seterusnya) ----------
  const Store = {
    load() {
      try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* storan tidak tersedia */ }
      return null;
    },
    save(db) {
      try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return true; }
      catch (e) { toast('Storan peranti penuh. Padam rekod lama atau sambung ke Firebase.'); return false; }
    },
    getUser() { try { return localStorage.getItem(USER_KEY); } catch (e) { return null; } },
    setUser(id) { try { id ? localStorage.setItem(USER_KEY, id) : localStorage.removeItem(USER_KEY); } catch (e) { /* abaikan */ } },
  };

  function seed() {
    const t = today(), m = thisMonth();
    const d = (day) => `${m}-${pad(Math.min(day, Number(t.slice(8, 10))))}`;
    // Data contoh: kumpulan ikut pasukan penyelia (nama sebenar akan diberi oleh Dato').
    const kumpulan = [
      { id: 'G1', nama: 'Pasukan Iskandar (contoh)', penyelia: ['u3'], pengurus: ['u2'], aktif: true },
      { id: 'G2', nama: 'Pasukan Husni (contoh)', penyelia: ['u4'], pengurus: ['u2'], aktif: true },
    ];
    const users = [
      { id: 'u1', nama: 'Mohd. Rasidi', peranan: 'pengarah', pengarahUtama: true, jawatan: 'Pengarah Urusan', kumpulanId: 'G1' },
      { id: 'u2', nama: 'Ahmad Azli', peranan: 'pengurus', jawatan: 'Pengurus Projek', templat: 'pengurusProjek', kuasa: Object.fromEntries(['tetapanPekerja', 'lulusCuti', 'jadual', 'susunKumpulan', 'projek', 'sahkan', 'lihatHadir', 'belian', 'bukaVO', 'jamKontrak', 'tunaiTapak', 'pantauan', 'aksesAdmin', 'adminCuti', 'adminKumpulan', 'adminSemak', 'adminHadir', 'dashboard'].map((k) => [k, true])), skopKumpulan: ['semua'], kumpulanId: 'G1' },
      { id: 'u3', nama: 'Iskandar', peranan: 'penyelia', staffId: 'K002', jawatan: 'Penyelia Tapak', templat: 'penyelia', kuasa: Object.fromEntries(['tetapanPekerja', 'lulusCuti', 'jadual', 'sahkan', 'lihatHadir', 'belian', 'bukaVO', 'jamKontrak', 'tunaiTapak', 'pantauan'].map((k) => [k, true])), skopKumpulan: ['G1'], kumpulanId: 'G1', akaunApps: { status: 'aktif', peranti: null } },
      { id: 'u4', nama: 'Husni Yahya', peranan: 'penyelia', staffId: 'K003', jawatan: 'Pengurus Tapak', templat: 'penyelia', kuasa: Object.fromEntries(['tetapanPekerja', 'lulusCuti', 'jadual', 'sahkan', 'lihatHadir', 'belian', 'bukaVO', 'jamKontrak', 'tunaiTapak', 'pantauan'].map((k) => [k, true])), skopKumpulan: ['G2'], kumpulanId: 'G2', akaunApps: { status: 'aktif', peranti: null } },
      { id: 'u5', nama: 'Akaun Kaiser', peranan: 'akaun', jawatan: 'Pengurus Kewangan', templat: 'pengurusKewangan', kuasa: Object.fromEntries(['aksesAdmin', 'adminTuntutan', 'gaji', 'adminTunai', 'eksport', 'dashboard'].map((k) => [k, true])), skopKumpulan: ['semua'], kumpulanId: 'G1' },
      { id: 'u6', nama: 'Muhd Nasrun', peranan: 'pekerja', staffId: 'K001', jawatan: 'Penyelaras', jenis: 'Tetap', templat: 'pekerja', kuasa: {}, skopKumpulan: [], kumpulanId: 'G1', tarikhMula: '2012-03-01', akaunApps: { status: 'aktif', peranti: null } },
    ];
    const kod = [
      ['FPG-26-CV-001', 'Pembaikan longkang dan konkrit', 'sivil', 30000],
      ['FPG-26-EL-001', 'Pendawaian, lampu dan soket', 'elektrik', 15000],
      ['FPG-26-MK-001', 'Pembaikan pam dan paip', 'mekanikal', 12000],
      ['FPG-26-AC-001', 'Servis unit penghawa dingin', 'ac', 8000],
      ['FPG-26-FB-001', 'Fabrikasi dan pemasangan struktur keluli', 'fabrikasi', 25000],
      ['FPG-26-CT-001', 'Pengecatan dan sand blasting', 'cat', 10000],
      ['FPG-26-PM-001', 'Penyelenggaraan bangunan dan handyman', 'fasiliti', 20000],
      ['FPG-26-TK-001', 'Bekalan tenaga kerja', 'tenaga', 18000],
    ].map(([k, p, s, b], i) => ({ id: 'k' + (i + 1), kod: k, penerangan: p, skop: s, jenis: 'Kontrak', bajet: b, status: 'Aktif', tarikh: d(1) }));
    kod.push({ id: 'k9', kod: 'FPG-26-VO-001', penerangan: 'Contoh: tambah longkang Blok B', skop: 'sivil', jenis: 'VO', bajet: 0, status: 'Aktif', voStatus: 'Sedang dijalankan', pemberiArahan: 'Jurutera loji FPG (contoh)', caraArahan: 'WhatsApp', bukti: [], semak: 'dihantar', userId: 'u3', tarikh: d(3), history: [] });
    const belian = [
      { id: uid(), tarikh: d(2), userId: 'u3', kodId: 'k1', pembekal: 'Kedai Hardware (contoh)', noResit: 'R-1001', item: 'Simen 4 beg', jumlah: 96, bayaran: 'Tunai', noPO: '', resit: [], status: 'dihantar', nota: '', history: [] },
      { id: uid(), tarikh: d(2), userId: 'u4', kodId: 'k2', pembekal: 'Kedai Elektrik (contoh)', noResit: 'R-2033', item: 'Pemutus litar 2 unit', jumlah: 140, bayaran: 'Tunai', noPO: '', resit: [], status: 'disahkan', nota: '', history: [] },
      { id: uid(), tarikh: d(3), userId: 'u3', kodId: 'k9', pembekal: 'Pembekal Konkrit (contoh)', noResit: 'INV-77', item: 'Konkrit siap bancuh', jumlah: 1850, bayaran: 'PO', noPO: '', resit: [], status: 'dihantar', nota: '', history: [] },
    ];
    const laporan = [
      { id: uid(), tarikh: d(2), userId: 'u3', kodId: 'k1', lokasi: 'Blok A', tugas: 'Tampal retak longkang (contoh)', pekerja: 'Iskandar + 2 pekerja kontrak', jam: 6, bahan: 'Simen, 2 beg', gambar: [], status: 'dihantar', nota: '', history: [] },
      { id: uid(), tarikh: d(2), userId: 'u4', kodId: 'k2', lokasi: 'Stor 2', tugas: 'Tukar pemutus litar (contoh)', pekerja: 'Husni Yahya', jam: 2, bahan: 'Pemutus litar, 1 unit', gambar: [], status: 'diluluskan', nota: '', history: [] },
    ];
    return {
      v: 1,
      settings: { klien: 'FPG Oleochemicals Sdn. Bhd.', tapak: 'FPG Oleochemicals, Kuantan', prefix: 'FPG-26', hadTunai: 200, imprest: 2000 },
      users, kod, belian, laporan, hadir: [],
      mohon: [
        { id: uid(), jenis: 'cuti', userId: 'u6', tarikh: d(2), jenisCuti: 'Tahunan', mula: d(20), tamat: d(21), hari: 2, sebab: 'Urusan keluarga (contoh)', lampiran: [], status: 'dihantar', nota: '', history: [] },
        { id: uid(), jenis: 'tuntutan', userId: 'u3', tarikh: d(3), jenisTuntutan: 'Tol & parkir', tarikhBelanja: d(3), jumlah: 18.4, keterangan: 'Tol ke pembekal Gebeng (contoh)', kodId: 'k1', resitT: [], status: 'dihantar', nota: '', history: [] },
      ],
      tunai: [{ id: uid(), tarikh: d(1), jumlah: 2000, catatan: 'Imprest awal (contoh)', oleh: 'u5' }],
      kiraan: [], audit: [], kumpulan, templat: [], logPengelola: [],
      sulit: [{ id: 'u6', gajiAsas: 2200, elaun: 150, bank: 'Maybank (contoh)', noAkaun: '1234-xxxx (contoh)' }],
    };
  }

  // ---------- Firebase (mod awan) ----------
  // Jika fail firebase-config.js dan SDK Firebase dimuatkan, apps guna Firestore. Jika tidak, mod demo (localStorage).
  const CFG = window.KAISER_FIREBASE;
  const CLOUD = !!(CFG && window.firebase && window.firebase.initializeApp);
  const DEFAULT_SETTINGS = { klien: 'FPG Oleochemicals Sdn. Bhd.', tapak: 'FPG Oleochemicals, Kuantan', prefix: 'FPG-26', hadTunai: 200, imprest: 2000, waktuMasuk: '08:00', tapakLat: '', tapakLng: '', radius: 500, kadarKm: 0, hadPendahuluan: 500, hariJelasPetty: 7 };
  let fs = null, auth = null, fbPekerja = null, fbUtama = null;
  const TANPA_PENGARAH = 'kaiser_pekerja_tanpa_pengarah';
  const imgCache = {};
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  if (CLOUD) {
    // Setiap apps ada sesi log masuk sendiri: log masuk di Apps Pengurusan tidak terbawa ke Apps Pekerja, dan sebaliknya.
    // Apps Pengurusan guna sesi utama. Apps Pekerja ada sesi sendiri ('kaiser-pekerja'), tetapi boleh
    // menumpang sesi Apps Pengurusan jika yang log masuk di sana ialah Pengarah Utama (lihat pilihSesi).
    if (APP === 'pekerja') { fbPekerja = firebase.initializeApp(CFG, 'kaiser-pekerja'); fbUtama = firebase.initializeApp(CFG); }
    else gunaSesi(firebase.initializeApp(CFG), true);
  }
  function gunaSesi(app, simpanLuarTalian) {
    fs = app.firestore();
    if (simpanLuarTalian) { try { fs.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) { /* abaikan */ } }
    auth = app.auth();
  }
  const clean = (o) => JSON.parse(JSON.stringify(o));
  const Cloud = {
    unsubs: [],
    write(coll, obj) {
      const data = clean(obj); const id = data.id; delete data.id;
      return fs.collection(coll).doc(id).set(data).catch((e) => { console.error(e); toast('Gagal simpan ke awan: ' + (e.code || e.message)); });
    },
    stop() { this.unsubs.forEach((u) => { try { u(); } catch (e) { /* abaikan */ } }); this.unsubs = []; },
    subscribe(u) {
      this.stop();
      const admin = !['penyelia', 'pekerja'].includes(u.peranan);
      const listen = (coll, q) => {
        this.unsubs.push(q.onSnapshot((snap) => {
          db[coll] = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          scheduleRender();
        }, (e) => { console.error(coll, e); toast('Tiada akses: ' + coll); }));
      };
      // Pekerja tanpa kuasa hanya membaca profil sendiri; pemegang kuasa membaca pekerja dalam skop kumpulannya.
      if (admin || utama(u)) listen('users', fs.collection('users'));
      else if (Object.keys(u.kuasa || {}).length && skopOrang(u).length) listen('users', skopOrang(u).includes('semua') ? fs.collection('users') : fs.collection('users').where('kumpulanId', 'in', skopOrang(u).slice(0, 30)));
      else this.unsubs.push(fs.collection('users').doc(u.id).onSnapshot((d) => { if (d.exists) { db.users = [Object.assign({ id: d.id }, d.data())]; scheduleRender(); } }, (e) => console.error('users', e)));
      listen('kumpulan', fs.collection('kumpulan'));
      listen('memo', fs.collection('memo'));
      listen('templat', fs.collection('templat'));
      if (bolehLihatGaji(u)) listen('sulit', fs.collection('sulit'));
      listen('kod', fs.collection('kod'));
      ['laporan', 'belian', 'hadir', 'mohon'].forEach((c) => listen(c, admin ? fs.collection(c) : fs.collection(c).where('userId', '==', u.id)));
      if (admin) { listen('tunai', fs.collection('tunai')); listen('kiraan', fs.collection('kiraan')); }
      this.unsubs.push(fs.collection('settings').doc('main').onSnapshot((d) => { db.settings = Object.assign({}, DEFAULT_SETTINGS, d.exists ? d.data() : {}); scheduleRender(); }, () => {}));
    },
  };
  function emptyDb() { return { v: 1, settings: Object.assign({}, DEFAULT_SETTINGS), users: [], kod: [], belian: [], laporan: [], hadir: [], mohon: [], tunai: [], kiraan: [], audit: [], sulit: [], templat: [], kumpulan: [], logPengelola: [], memo: [] }; }

  // Simpan gambar draf: mod awan → dokumen berasingan dalam koleksi `gambar`, rekod hanya simpan id.
  function persistPhotos(arr) {
    if (!CLOUD) return arr.map((p) => ({ img: p.img, cap: p.cap || '' }));
    return arr.map((p) => {
      if (p.id) return { id: p.id, cap: p.cap || '' };
      const id = uid();
      imgCache[id] = p.img;
      fs.collection('gambar').doc(id).set({ data: p.img, ownerId: state.userId, t: new Date().toISOString() }).catch((e) => toast('Gagal simpan gambar: ' + (e.code || e.message)));
      return { id, cap: p.cap || '' };
    });
  }
  const imgSrc = (g) => (g.img || (g.id && imgCache[g.id]) || BLANK);
  const imgAttr = (g) => `src="${imgSrc(g)}" data-gid="${esc(g.id || '')}"`;
  function hydrateImages() {
    if (!CLOUD) return;
    document.querySelectorAll('img[data-gid]').forEach((el) => {
      const id = el.dataset.gid;
      if (!id) return;
      if (imgCache[id]) { el.src = imgCache[id]; return; }
      if (imgCache[id] === null) return;
      imgCache[id] = null;
      fs.collection('gambar').doc(id).get().then((d) => {
        imgCache[id] = d.exists ? d.data().data : undefined;
        if (imgCache[id]) document.querySelectorAll(`img[data-gid="${id}"]`).forEach((x) => { x.src = imgCache[id]; });
      }).catch(() => { imgCache[id] = undefined; });
    });
  }

  let db = CLOUD ? emptyDb() : (Store.load() || seed());
  db.mohon = db.mohon || [];
  db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings);
  const state = { userId: CLOUD ? null : Store.getUser(), draft: null, bulan: thisMonth(), modal: null, screen: CLOUD ? 'loading' : null, authUser: null };
  if (location.hostname === 'localhost') window.__kaiser = { state, get db() { return db; } };
  const me = () => db.users.find((u) => u.id === state.userId) || null;
  const userName = (id) => (db.users.find((u) => u.id === id) || {}).nama || '—';
  const kodOf = (id) => db.kod.find((k) => k.id === id) || null;
  const skopOf = (id) => SKOP.find((s) => s.id === id) || { nama: '—', pendek: '—' };
  const isAdmin = (u) => u && !['penyelia', 'pekerja'].includes(u.peranan);

  // changes: senarai [koleksi, rekod] yang berubah (untuk mod awan).
  function commit(act, ref, changes) {
    const a = { id: uid(), t: new Date().toISOString(), userId: state.userId, act, ref: ref || '' };
    if (CLOUD) {
      (changes || []).forEach(([coll, obj]) => Cloud.write(coll, obj));
      Cloud.write('audit', a);
      return true;
    }
    db.audit.push(a);
    if (db.audit.length > 2000) db.audit = db.audit.slice(-2000);
    return Store.save(db);
  }

  // ---------- Bendera merah ----------
  function flagsBelian(b) {
    const f = [];
    const k = kodOf(b.kodId);
    if (!b.resit || !b.resit.length) f.push('Tiada gambar resit');
    if (!b.noResit) f.push('Tiada no. resit');
    if (!k) f.push('Tiada kod kerja');
    else if (k.status !== 'Aktif') f.push('Kod kerja ditutup');
    if (b.bayaran === 'Tunai' && num(b.jumlah) > num(db.settings.hadTunai)) f.push('Melebihi had tunai');
    if (b.bayaran === 'PO' && !b.noPO) f.push('No. PO tiada');
    if (b.noResit && db.belian.some((o) => o.id !== b.id && o.noResit && o.noResit.trim().toLowerCase() === b.noResit.trim().toLowerCase() && (o.pembekal || '').trim().toLowerCase() === (b.pembekal || '').trim().toLowerCase())) f.push('Resit berganda');
    const sameItem = db.belian.filter((o) => o.item && b.item && o.item.trim().toLowerCase() === b.item.trim().toLowerCase() && daysBetween(o.tarikh, b.tarikh) <= 7);
    if (sameItem.length >= 3) f.push('Belian berulang (3+ dalam 7 hari)');
    return f;
  }
  function flagsLaporan(l) {
    const f = [];
    const k = kodOf(l.kodId);
    if (!k) f.push('Tiada kod kerja');
    else if (k.status !== 'Aktif') f.push('Kod kerja ditutup');
    if (!l.gambar || !l.gambar.length) f.push('Tiada gambar kerja');
    if (num(l.jam) > 12) f.push('Jam melebihi 12');
    return f;
  }
  function flagsVO(k) {
    const f = [];
    if (!k.bukti || !k.bukti.length) f.push('Tiada bukti arahan');
    if (!k.pemberiArahan) f.push('Pemberi arahan tidak dinyatakan');
    return f;
  }

  // ---------- Pengiraan ----------
  const live = (x) => x.status !== 'dikembalikan';
  const inMonth = (x, ym) => (x.tarikh || '').slice(0, 7) === ym;
  function kosKod(kodId, ym) { return db.belian.filter((b) => b.kodId === kodId && live(b) && (!ym || inMonth(b, ym))).reduce((s, b) => s + num(b.jumlah), 0); }
  function jamKod(kodId, ym) { return db.laporan.filter((l) => l.kodId === kodId && live(l) && (!ym || inMonth(l, ym))).reduce((s, l) => s + num(l.jam), 0); }
  function pendingItems() {
    const items = [];
    db.belian.forEach((b) => items.push({ type: 'belian', rec: b, flags: flagsBelian(b) }));
    db.laporan.forEach((l) => items.push({ type: 'laporan', rec: l, flags: flagsLaporan(l) }));
    db.kod.filter((k) => k.jenis === 'VO' && k.semak).forEach((k) => items.push({ type: 'vo', rec: Object.assign({}, k, { status: k.semak }), flags: flagsVO(k) }));
    return items;
  }
  function queueFor(u) {
    if (!u) return [];
    const want = u.peranan === 'pengarah' ? ['disahkan', 'dihantar'] : ['dihantar'];
    return pendingItems().filter((it) => want.includes(it.rec.status)).sort((a, b) => (a.rec.tarikh < b.rec.tarikh ? 1 : -1));
  }
  function skopStats(skopId, ym) {
    const kods = db.kod.filter((k) => k.skop === skopId);
    const ids = new Set(kods.map((k) => k.id));
    const aktif = kods.filter((k) => k.status === 'Aktif').length;
    const kos = db.belian.filter((b) => ids.has(b.kodId) && live(b) && inMonth(b, ym)).reduce((s, b) => s + num(b.jumlah), 0);
    const kosAll = db.belian.filter((b) => ids.has(b.kodId) && live(b)).reduce((s, b) => s + num(b.jumlah), 0);
    const jam = db.laporan.filter((l) => ids.has(l.kodId) && live(l) && inMonth(l, ym)).reduce((s, l) => s + num(l.jam), 0);
    const bajet = kods.reduce((s, k) => s + num(k.bajet), 0);
    const flags = pendingItems().filter((it) => ['dihantar', 'disahkan'].includes(it.rec.status) && it.flags.length && ids.has(it.type === 'vo' ? it.rec.id : it.rec.kodId)).length;
    const voOpen = kods.filter((k) => k.jenis === 'VO' && !['Diinvois', 'Dibayar'].includes(k.voStatus)).length;
    return { kods, aktif, kos, kosAll, jam, bajet, flags, voOpen };
  }
  function voBelumDicaj() {
    return db.kod.filter((k) => k.jenis === 'VO' && !['Diinvois', 'Dibayar'].includes(k.voStatus)).reduce((s, k) => s + kosKod(k.id), 0);
  }
  function bakiTunai() {
    const masuk = db.tunai.reduce((s, t) => s + num(t.jumlah), 0);
    const keluar = db.belian.filter((b) => b.bayaran === 'Tunai' && live(b)).reduce((s, b) => s + num(b.jumlah), 0);
    return { masuk, keluar, baki: masuk - keluar };
  }

  // ---------- Gambar ----------
  function compressImage(file, max) {
    max = max || 1000;
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = () => reject(new Error('Gagal membaca gambar'));
      rd.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak disokong'));
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.62));
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

  // ---------- Ikon ----------
  const I = {
    lapor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/></svg>',
    resit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>',
    vo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
    senarai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    jam: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cuti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    tuntut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    dompet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2M3 10h18"/></svg>',
    wang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    kamera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/></svg>',
  };

  const pill = (s) => `<span class="pill p-${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;
  const flagPills = (f) => (f.length ? f.map((x) => `<span class="pill p-flag">${esc(x)}</span>`).join(' ') : '<span class="pill p-okflag">OK</span>');

  // ---------- Paparan: log masuk ----------
  function viewLogin() {
    if (CLOUD) return viewCloudLogin();
    const order = ['pekerja', 'penyelia', 'pengurus', 'pengarah', 'akaun'];
    const users = db.users.filter((u) => (APP === 'pekerja' ? isField(u) : isAdmin(u))).sort((a, b) => order.indexOf(a.peranan) - order.indexOf(b.peranan));
    return `<div class="login">
      <div class="logo"><img src="${APP === 'pekerja' ? '' : BASE}icon-192.png" alt="Logo Kaiser"><div><h1>${APP === 'pekerja' ? 'Kaiser Pekerja' : 'Kaiser Pengurusan'}</h1><div class="muted small">${APP === 'pekerja' ? 'Kehadiran, laporan kerja dan permohonan' : 'Pengurusan, akaun dan tuntutan projek'}</div></div></div>
      <div class="notice">Mod demo: data disimpan dalam pelayar ini sahaja. Pilih pengguna untuk masuk.</div>
      <div class="stack">${users.map((u) => `<button class="user" data-a="login" data-id="${u.id}"><span><b>${esc(u.nama)}</b><br><span class="muted small">${PERANAN[u.peranan]}</span></span><span aria-hidden="true">›</span></button>`).join('')}</div>
    </div>`;
  }

  function loginShell(inner) {
    return `<div class="login"><div class="logo"><img src="${APP === 'pekerja' ? '' : BASE}icon-192.png" alt="Logo Kaiser"><div><h1>${APP === 'pekerja' ? 'Kaiser Pekerja' : 'Kaiser Pengurusan'}</h1><div class="muted small">${APP === 'pekerja' ? 'Kehadiran, laporan kerja dan permohonan' : 'Pengurusan, akaun dan tuntutan projek'}</div></div></div>${kadPasang()}${inner}<div style="text-align:center;margin-top:16px"><button class="btn sm" data-a="tukarBahasa">🌐 ${bahasa() === 'en' ? 'Bahasa Melayu' : 'English'}</button></div></div>`;
  }
  function viewCloudLogin() {
    if (state.screen === 'loading') return loginShell('<div class="muted">Memuatkan…</div>');
    if (state.screen === 'wrongapp') return loginShell(wrongAppMsg());
    if (state.screen === 'pertama') return viewPertama();
    if (MESEJ_SEKAT[state.screen]) return loginShell(`<div class="notice bad">${MESEJ_SEKAT[state.screen]}${state.screen === 'perantiLain' && state.sekatInfo ? `<div class="small" style="margin-top:6px">${esc(state.sekatInfo)}</div>` : ''}</div><button class="btn" data-a="logout">Log keluar</button>`);
    if (state.screen === 'bootstrap' && APP === 'pekerja') return loginShell('<div class="notice bad">Sistem belum disediakan. Pengarah perlu log masuk ke Apps Pengurusan dahulu.</div><button class="btn" data-a="logout">Log keluar</button>');
    if (state.screen === 'bootstrap') return loginShell(`<div class="card stack"><h2>Sediakan sistem</h2>
      <div class="small">Anda pengguna pertama (${esc(state.authUser.email)}). Akaun ini akan didaftarkan sebagai <b>Pengarah</b>, dan anda boleh menambah pengguna lain dalam Tetapan.</div>
      <form class="stack" data-form="bootstrap"><label class="f">Nama penuh<input class="i" name="nama" required></label><button class="btn primary" type="submit">Sediakan sistem</button></form>
      <button class="btn" data-a="logout">Log keluar</button></div>`);
    if (state.screen === 'notreg') return loginShell(`<div class="notice bad">Akaun <b>${esc(APP === 'pekerja' ? 'ini' : state.authUser.email)}</b> belum didaftarkan atau telah dinyahaktifkan. Hubungi Pengarah Kaiser.</div><button class="btn" data-a="logout">Log keluar</button>`);
    if (APP === 'pekerja' && state.loginPengarah) return loginShell(`<form class="card stack" data-form="login">
        <div class="small"><b>👑 Pengarah Utama</b>: masuk ke Apps Pekerja dengan emel. Semua rekod dibuat atas nama anda sendiri, dan kemasukan direkod dalam log.</div>
        <label class="f">Emel<input class="i" type="email" name="email" autocomplete="username" required></label>
        <label class="f">Kata laluan<input class="i" type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Log masuk</button>
        <button class="btn" type="button" data-a="loginPengarah">‹ Kembali ke log masuk ID + PIN</button>
      </form>`);
    if (APP === 'pekerja') return loginShell(`${navigator.onLine ? '' : '<div class="notice">Tiada internet. Log masuk pertama kali memerlukan internet.</div>'}
      <form class="card stack" data-form="loginPin">
        <label class="f">ID pekerja<input class="i" name="staffId" autocomplete="username" autocapitalize="characters" placeholder="Contoh: K001" required style="text-transform:uppercase"></label>
        <label class="f">PIN (6 digit)<input class="i" type="password" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Log masuk</button>
        <div class="muted tiny">Lupa PIN? Hubungi pengurus atau Pengarah untuk set semula.</div>
      </form>
      <button class="btn block" data-a="loginPengarah" style="margin-top:10px">👑 Log masuk Pengarah Utama (emel)</button>`);
    return loginShell(`${navigator.onLine ? '' : '<div class="notice">Tiada internet. Log masuk pertama kali memerlukan internet.</div>'}
      <form class="card stack" data-form="login">
        <label class="f">Emel<input class="i" type="email" name="email" autocomplete="username" required></label>
        <label class="f">Kata laluan<input class="i" type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Log masuk</button>
        <button class="btn" type="button" data-a="resetPw">Lupa kata laluan</button>
      </form>`);
  }

  // ---------- Paparan: Apps Pekerja ----------
  function topbar(title, back) {
    const u = me();
    return `<header class="topbar">
      ${back ? `<a class="iconbtn" href="${back}" aria-label="Kembali">‹</a>` : `<img src="${APP === 'pekerja' ? '' : BASE}icon-64.png" alt="">`}
      <div><div class="t">${esc(title)}</div><div class="s">${esc(u.nama)} · ${APP === 'pekerja' && utama(u) ? '👑 Mod Pengarah' : PERANAN[u.peranan]}</div></div>
      <span class="sp"></span>
      <button class="iconbtn" data-a="sync" aria-label="Sync">⟳</button>
      <button class="iconbtn" data-a="tukarBahasa">${bahasa() === 'en' ? 'BM' : 'EN'}</button>
      ${CLOUD && u.staffId ? '<a class="iconbtn" href="#pin">PIN</a>' : ''}
      <button class="iconbtn" data-a="logout">Keluar</button>
    </header>`;
  }

  function viewHome() {
    const u = me(), t = today();
    const h = db.hadir.find((x) => x.userId === u.id && x.tarikh === t);
    const mine = (arr) => arr.filter((x) => x.userId === u.id);
    const lapToday = mine(db.laporan).filter((x) => x.tarikh === t).length;
    const resToday = mine(db.belian).filter((x) => x.tarikh === t).length;
    const back = mine(db.belian).concat(mine(db.laporan)).filter((x) => x.status === 'dikembalikan');
    const bc = bakiCuti(u);
    const aktifMohon = mine(db.mohon).filter((m) => stepOf(m)).length;
    const pettyBelum = mine(db.mohon).filter((m) => m.jenis === 'pettycash' && m.status === 'dibayar');
    const isSv = u.peranan !== 'pekerja';
    const recent = mine(db.laporan).map((x) => ({ x, t: 'laporan' })).concat(mine(db.belian).map((x) => ({ x, t: 'belian' })))
      .sort((a, b) => (a.x.tarikh < b.x.tarikh ? 1 : -1)).slice(0, 5);
    let clock;
    if (!h) clock = `<a class="clock in" href="#hadir" style="text-decoration:none">${I.jam} Masuk Kerja</a>`;
    else if (!h.keluar) clock = `<a class="clock out" href="#hadir" style="text-decoration:none">${I.jam} Keluar Kerja <span class="small" style="font-weight:500">(masuk ${esc(h.masuk)})</span></a>`;
    else clock = `<div class="card small">Hari ini: masuk ${esc(h.masuk)}, keluar ${esc(h.keluar)}.</div>`;
    return `${topbar('Apps Pekerja')}
    <main class="wrap">
      ${navigator.onLine ? '' : '<div class="notice">Luar talian. Rekod disimpan dalam telefon dan akan dihantar bila ada liputan.</div>'}
      ${CLOUD ? '' : '<div class="notice small">Mod demo: data hanya dalam pelayar ini.</div>'}
      ${sudahDipasang() ? '' : '<button class="btn accent block" data-a="pasang" style="margin-bottom:12px">📲 Pasang apps di skrin telefon</button>'}
      ${jamDigital()}
      ${kadMemo(u)}
      ${back.length ? `<a class="notice bad" href="#rekod" style="text-decoration:none"><b>${back.length} rekod dikembalikan</b> untuk pembetulan. Tekan untuk lihat.</a>` : ''}
      ${pettyBelum.length ? `<a class="notice" href="#permohonan" style="text-decoration:none"><b>Petty cash ${rm(pettyBelum.reduce((a, m) => a + num(m.jumlah), 0))} belum dijelaskan.</b> Hantar resit belian dan pulangkan baki.</a>` : ''}
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card kpi" style="text-align:center;padding:10px"><div class="v">${bc.Tahunan}</div><div class="l">Baki cuti tahunan</div></div>
        <div class="card kpi" style="text-align:center;padding:10px"><div class="v">${aktifMohon}</div><div class="l">Permohonan aktif</div></div>
        <div class="card kpi" style="text-align:center;padding:10px"><div class="v" style="color:${back.length ? 'var(--bad)' : 'var(--ink)'}">${back.length}</div><div class="l">Dikembalikan</div></div>
      </div>
      ${clock}
      <div class="tiles">
        <a class="tile g-op" href="#laporan">${I.lapor}<span>Laporan Kerja</span></a>
        ${isSv ? `<a class="tile g-op" href="#belian">${I.resit}<span>Belian / Resit</span></a>
        <a class="tile g-op" href="#vo">${I.vo}<span>Arahan Kerja Tambahan</span></a>` : ''}
        <a class="tile g-hr" href="#mohon-cuti">${I.cuti}<span>Mohon Cuti</span></a>
        <a class="tile g-ak" href="#mohon-tuntutan">${I.tuntut}<span>Tuntutan</span></a>
        <a class="tile g-ak" href="#mohon-pettycash">${I.dompet}<span>Petty Cash</span></a>
        <a class="tile g-ak" href="#mohon-pendahuluan">${I.wang}<span>Pendahuluan Gaji</span></a>
        <a class="tile g-sy" href="#permohonan">${I.senarai}<span>Permohonan Saya</span></a>
        <a class="tile g-sy" href="#rekod">${I.senarai}<span>Rekod Kerja Saya</span></a>
      </div>
      <h2>Rekod terkini</h2>
      <div class="stack" style="gap:8px">${recent.length ? recent.map(({ x, t: ty }) => {
        const k = kodOf(x.kodId);
        return `<button class="item" data-a="openMine" data-type="${ty}" data-id="${x.id}"><span><span class="t">${esc(ty === 'laporan' ? x.tugas : x.item)}</span><br><span class="muted tiny">${fmtDate(x.tarikh)} · ${esc(k ? k.kod : '—')} · ${ty === 'laporan' ? esc(x.jam) + ' jam' : rm(x.jumlah)}</span></span>${pill(x.status)}</button>`;
      }).join('') : '<div class="muted small">Belum ada rekod.</div>'}</div>
    </main>`;
  }

  function kodOptions(sel, onlyActive) {
    const list = db.kod.filter((k) => !onlyActive || k.status === 'Aktif' || k.id === sel);
    return `<option value="">Pilih kod kerja…</option>` + SKOP.map((s) => {
      const ks = list.filter((k) => k.skop === s.id);
      if (!ks.length) return '';
      return `<optgroup label="${esc(s.nama)}">${ks.map((k) => `<option value="${k.id}" ${k.id === sel ? 'selected' : ''}>${esc(k.kod)} · ${esc(k.penerangan)}</option>`).join('')}</optgroup>`;
    }).join('');
  }

  function photoGrid(field, caps, capture) {
    const arr = state.draft[field] || [];
    const tiles = arr.map((p, i) => `<div class="ph"><img ${imgAttr(p)} alt=""${esc(p.cap || 'Gambar')}"><button type="button" class="x" data-a="rmPhoto" data-f="${field}" data-i="${i}" aria-label="Buang gambar">×</button>${p.cap ? `<span class="cap">${esc(p.cap)}</span>` : ''}</div>`).join('');
    const adds = (caps || ['']).map((c) => `<label class="addph">${I.kamera}<span>${c ? 'Gambar ' + esc(c.toLowerCase()) : 'Tambah gambar'}</span><input type="file" accept="image/*" capture="${capture || 'environment'}" data-file="${field}" data-cap="${esc(c)}"></label>`).join('');
    return `<div class="photos" id="ph-${field}">${tiles}${adds}</div>`;
  }

  function viewLaporan(id) {
    const rec = id ? db.laporan.find((x) => x.id === id) : null;
    if (!state.draft || state.draft._form !== 'laporan' || state.draft._id !== (id || null)) {
      state.draft = { _form: 'laporan', _id: id || null, gambar: rec ? (rec.gambar || []).slice() : [] };
    }
    const r = rec || { tarikh: today(), kodId: '', lokasi: '', tugas: '', pekerja: me().nama, jam: '', bahan: '' };
    return `${topbar(rec ? 'Betulkan laporan' : 'Laporan Kerja', '#home')}
    <main class="wrap">
      ${rec && rec.nota ? `<div class="notice bad"><b>Nota pengurus:</b> ${esc(rec.nota)}</div>` : ''}
      <form class="stack" data-form="laporan">
        <div class="grid2">
          <label class="f">Tarikh<input class="i" type="date" name="tarikh" value="${esc(r.tarikh)}" required></label>
          <label class="f">Jam kerja<input class="i" type="number" name="jam" min="0" max="24" step="0.5" inputmode="decimal" value="${esc(r.jam)}" required></label>
        </div>
        <label class="f">Kod kerja<select class="i" name="kodId" required>${kodOptions(r.kodId, true)}</select></label>
        <label class="f">Lokasi<input class="i" name="lokasi" value="${esc(r.lokasi)}" placeholder="Contoh: Blok B, longkang utara" required></label>
        <label class="f">Tugas yang dibuat<textarea class="i" name="tugas" required placeholder="Terangkan kerja yang dibuat">${esc(r.tugas)}</textarea></label>
        <label class="f">Pekerja<input class="i" name="pekerja" value="${esc(r.pekerja)}" placeholder="Nama pekerja / bilangan pekerja kontrak"></label>
        <label class="f">Bahan digunakan <span class="muted tiny" style="font-weight:400">Satu baris setiap bahan, contoh: Simen, 2 beg</span><textarea class="i" name="bahan">${esc(r.bahan)}</textarea></label>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Gambar kerja${photoGrid('gambar', ['Sebelum', 'Semasa', 'Selepas'])}</div>
        <button class="btn primary block" type="submit">${rec ? 'Hantar semula' : 'Hantar laporan'}</button>
      </form>
    </main>`;
  }

  function viewBelian(id) {
    const rec = id ? db.belian.find((x) => x.id === id) : null;
    if (!state.draft || state.draft._form !== 'belian' || state.draft._id !== (id || null)) {
      state.draft = { _form: 'belian', _id: id || null, resit: rec ? (rec.resit || []).slice() : [], bayaran: rec ? rec.bayaran : 'Tunai' };
    }
    const r = rec || { tarikh: today(), kodId: '', pembekal: '', noResit: '', item: '', jumlah: '', noPO: '' };
    const byr = state.draft.bayaran;
    return `${topbar(rec ? 'Betulkan belian' : 'Belian / Resit', '#home')}
    <main class="wrap">
      ${rec && rec.nota ? `<div class="notice bad"><b>Nota pengurus:</b> ${esc(rec.nota)}</div>` : ''}
      <form class="stack" data-form="belian">
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Gambar resit${photoGrid('resit', [''])}</div>
        <div class="grid2">
          <label class="f">Tarikh<input class="i" type="date" name="tarikh" value="${esc(r.tarikh)}" required></label>
          <label class="f">Jumlah (RM)<input class="i" type="number" name="jumlah" min="0" step="0.01" inputmode="decimal" value="${esc(r.jumlah)}" required></label>
        </div>
        <label class="f">Kod kerja<select class="i" name="kodId" required>${kodOptions(r.kodId, true)}</select></label>
        <div class="grid2">
          <label class="f">Pembekal<input class="i" name="pembekal" value="${esc(r.pembekal)}" required></label>
          <label class="f">No. resit / invois<input class="i" name="noResit" value="${esc(r.noResit)}"></label>
        </div>
        <label class="f">Barang / perkhidmatan<input class="i" name="barang" value="${esc(r.item)}" placeholder="Contoh: Simen 4 beg" required></label>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Cara bayaran
          <div class="chips">${['Tunai', 'PO'].map((b) => `<button type="button" class="chip ${byr === b ? 'on' : ''}" data-a="setBayaran" data-v="${b}" aria-pressed="${byr === b}">${b === 'Tunai' ? 'Tunai runcit' : 'Pesanan belian (PO)'}</button>`).join('')}</div>
        </div>
        ${byr === 'PO' ? `<label class="f">No. PO<input class="i" name="noPO" value="${esc(r.noPO)}"></label>` : `<div class="muted tiny">Had belian tunai sekali beli: ${rm(db.settings.hadTunai)}</div>`}
        <button class="btn primary block" type="submit">${rec ? 'Hantar semula' : 'Hantar resit'}</button>
      </form>
    </main>`;
  }

  function viewVO() {
    if (!state.draft || state.draft._form !== 'vo') state.draft = { _form: 'vo', bukti: [], skop: '' };
    const sk = state.draft.skop;
    return `${topbar('Arahan Kerja Tambahan', '#home')}
    <main class="wrap">
      <div class="notice">Rekod arahan klien <b>sebelum</b> kerja dimulakan. Kod VO baharu akan dibuka untuk semua rekod kerja ini.</div>
      <form class="stack" data-form="vo">
        <label class="f">Penerangan kerja<textarea class="i" name="penerangan" required placeholder="Contoh: Tambah longkang 20 m di Blok B"></textarea></label>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Skop kerja
          <div class="chips">${SKOP.map((s) => `<button type="button" class="chip ${sk === s.id ? 'on' : ''}" data-a="setSkop" data-v="${s.id}" aria-pressed="${sk === s.id}">${esc(s.pendek)}</button>`).join('')}</div>
        </div>
        <label class="f">Lokasi<input class="i" name="lokasi" required></label>
        <div class="grid2">
          <label class="f">Diarahkan oleh (nama &amp; jawatan klien)<input class="i" name="pemberiArahan" required></label>
          <label class="f">Cara arahan<select class="i" name="caraArahan"><option>Arahan Tapak</option><option>WhatsApp</option><option>Emel</option><option>Lisan</option><option>Minit mesyuarat</option></select></label>
        </div>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Bukti arahan (gambar arahan, tangkap layar WhatsApp, tapak)${photoGrid('bukti', [''])}</div>
        <button class="btn primary block" type="submit">Buka kod VO</button>
      </form>
    </main>`;
  }

  function viewRekod() {
    const u = me();
    const rows = db.laporan.filter((x) => x.userId === u.id).map((x) => ({ x, t: 'laporan' }))
      .concat(db.belian.filter((x) => x.userId === u.id).map((x) => ({ x, t: 'belian' })))
      .concat(db.kod.filter((k) => k.jenis === 'VO' && k.userId === u.id).map((x) => ({ x: Object.assign({}, x, { status: x.semak || 'disahkan' }), t: 'vo' })))
      .sort((a, b) => (a.x.tarikh < b.x.tarikh ? 1 : -1));
    return `${topbar('Rekod Saya', '#home')}
    <main class="wrap">
      <div class="stack" style="gap:8px">${rows.length ? rows.map(({ x, t }) => {
        const k = kodOf(x.kodId);
        const title = t === 'laporan' ? x.tugas : t === 'belian' ? x.item : `VO: ${x.penerangan}`;
        const sub = t === 'vo' ? `${x.kod} · ${x.voStatus}` : `${k ? k.kod : '—'} · ${t === 'laporan' ? x.jam + ' jam' : rm(x.jumlah)}`;
        return `<button class="item" data-a="openMine" data-type="${t}" data-id="${x.id}"><span><span class="t">${esc(title)}</span><br><span class="muted tiny">${fmtDate(x.tarikh)} · ${esc(sub)}</span></span>${pill(x.status)}</button>`;
      }).join('') : '<div class="muted">Belum ada rekod.</div>'}</div>
    </main>`;
  }

  // ---------- Paparan: Apps Pentadbiran ----------
  function adminShell(active, body) {
    const u = me();
    const q = queueFor(u).length;
    // Menu dalam bentuk kad berwarna ikut bahagian: operasi (biru), pekerja (teal), akaun (hijau/kuning), sistem (ungu).
    const MENU = { dash: ['🏠', 'op'], semak: ['✅', 'op'], hadir: ['🕘', 'hr'], pekerja: ['👥', 'hr'], mohon: ['📝', 'hr'], memo: ['📢', 'hr'], skop: ['📊', 'op'], vo: ['📣', 'op'], kod: ['🏷', 'op'], tunai: ['💵', 'ak'], eksport: ['📤', 'ak'], log: ['📜', 'sy'], tetapan: ['⚙️', 'sy'] };
    const link = (r, label, extra) => { const [ik, g] = MENU[r] || ['•', 'op']; return `<a href="#a-${r}" class="mk g-${g} ${active === r ? 'on' : ''}"><span class="ik">${ik}</span><span class="lb">${label}</span>${extra || ''}</a>`; };
    return `<div class="admin">
      <nav class="side ${state.menuBuka ? 'buka' : ''}" aria-label="Menu pentadbiran">
        <button class="mk-togol" data-a="togolMenu">☰ <span>${state.menuBuka ? 'Tutup menu' : 'Menu'}</span></button>
        <div class="brand"><img src="${BASE}icon-64.png" alt=""><div><b>Kaiser</b><div class="tiny" style="color:#BFD0E0">${esc(u.nama)} · ${PERANAN[u.peranan]}</div></div></div>
        ${link('dash', 'Utama')}
        ${u.peranan !== 'akaun' ? link('semak', 'Peti semakan', q ? `<span class="badge">${q}</span>` : '') : ''}
        ${link('hadir', 'Kehadiran')}
        ${bolehDaftar(u) || bolehLihatGaji(u) || isAdmin(u) ? link('pekerja', 'Pekerja') : ''}
        ${link('mohon', 'Permohonan staf', mohonQueue(u).length ? `<span class="badge">${mohonQueue(u).length}</span>` : '')}
        ${link('skop', 'Pantauan skop kerja')}
        ${link('vo', 'Daftar VO')}
        ${link('kod', 'Kod kerja')}
        ${link('tunai', 'Tunai runcit')}
        ${link('eksport', 'Eksport bulanan')}
        ${utama(u) || adaKuasa(u, 'pantauan') || Object.keys(u.kuasa || {}).length ? link('memo', 'Memo &amp; pengumuman') : ''}
        ${utama(u) ? link('log', 'Log kemasukan') : ''}
        ${utama(u) ? link('tetapan', 'Tetapan &amp; sandaran') : ''}
        <a class="mk g-sy" href="${BASE}pekerja/?pengarah=1" target="_blank" rel="noopener"><span class="ik">📱</span><span class="lb">Buka Apps Pekerja ↗</span></a>
        <a class="mk g-sy" href="#" data-a="sync"><span class="ik">⟳</span><span class="lb">Sync</span>${state.syncAt ? `<span class="tiny" style="color:#BFD0E0">${new Date(state.syncAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>` : ''}</a>
        <a class="mk g-sy" href="#" data-a="tukarBahasa"><span class="ik">🌐</span><span class="lb">${bahasa() === 'en' ? 'Bahasa Melayu' : 'English'}</span></a>
        <a class="mk g-out" href="#" data-a="logout"><span class="ik">🚪</span><span class="lb">Log keluar</span></a>
      </nav>
      <main class="main">${jamDigital()}${body}</main>
    </div>`;
  }

  function monthPicker() {
    const months = new Set([thisMonth()]);
    db.belian.concat(db.laporan).forEach((x) => x.tarikh && months.add(x.tarikh.slice(0, 7)));
    return `<label class="f" style="min-width:180px">Bulan<select class="i" data-a-change="setBulan">${[...months].sort().reverse().map((m) => `<option value="${m}" ${m === state.bulan ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select></label>`;
  }

  function viewDash() {
    const u = me(), ym = state.bulan;
    const q = queueFor(u);
    const kos = db.belian.filter((b) => live(b) && inMonth(b, ym)).reduce((s, b) => s + num(b.jumlah), 0);
    const flagged = pendingItems().filter((it) => ['dihantar', 'disahkan'].includes(it.rec.status) && it.flags.length).length;
    const tn = bakiTunai();
    return adminShell('dash', `${bannerSandaran()}
      <div class="row between" style="align-items:flex-end">
        <div><div class="muted small">${esc(db.settings.klien)}</div><h1>Selamat datang, ${esc(u.nama)}</h1></div>
        ${monthPicker()}
      </div>
      <div class="kpis">
        <div class="card kpi"><div class="l">Menunggu semakan anda</div><div class="v">${q.length}</div></div>
        <div class="card kpi"><div class="l">Kos ${monthName(ym)}</div><div class="v">${rm0(kos)}</div></div>
        <div class="card kpi"><div class="l">VO belum dicaj (kos)</div><div class="v" style="color:var(--warn)">${rm0(voBelumDicaj())}</div></div>
        <div class="card kpi"><div class="l">Bendera merah terbuka</div><div class="v" style="color:${flagged ? 'var(--bad)' : 'var(--ink)'}">${flagged}</div></div>
        <div class="card kpi"><div class="l">Baki tunai runcit</div><div class="v">${rm0(tn.baki)}</div></div>
        <div class="card kpi"><div class="l">Hadir hari ini</div><div class="v">${db.hadir.filter((h) => h.tarikh === today()).length} / ${fieldUsers().length}</div></div>
        <div class="card kpi"><div class="l">Permohonan staf menunggu anda</div><div class="v">${mohonQueue(u).length}</div></div>
      </div>
      <section class="stack"><div class="row between"><h2>Pantauan skop kerja</h2><span class="muted small">Tekan skop untuk butiran</span></div>${skopGrid(ym)}</section>
      ${u.peranan !== 'akaun' ? `<section class="card stack"><div class="row between"><h2>Peti semakan</h2><a class="btn sm" href="#a-semak">Lihat semua</a></div>${queueTable(q.slice(0, 6))}</section>` : ''}
    `);
  }

  function skopGrid(ym) {
    return `<div class="grid-auto">${SKOP.map((s) => {
      const st = skopStats(s.id, ym);
      return `<a class="skop ${st.flags ? 'hot' : ''}" href="#a-skop-${s.id}" style="text-decoration:none"><b>${esc(s.nama)}</b><span class="muted small">${st.aktif} kod aktif · ${rm0(st.kos)} · ${st.jam} jam</span><span>${st.flags ? `<span class="pill p-flag">${st.flags} bendera merah</span>` : '<span class="pill p-okflag">Tiada isu</span>'} ${st.voOpen ? `<span class="pill p-vo">${st.voOpen} VO terbuka</span>` : ''}</span></a>`;
    }).join('')}</div>`;
  }

  function queueTable(items) {
    if (!items.length) return '<div class="muted small">Tiada rekod menunggu semakan.</div>';
    return `<div class="tbl"><table><thead><tr><th>Tarikh</th><th>Oleh</th><th>Jenis</th><th>Kod kerja</th><th>Butiran</th><th class="n">Jumlah</th><th>Semakan</th><th>Status</th></tr></thead><tbody>${items.map((it) => {
      const r = it.rec, k = it.type === 'vo' ? r : kodOf(r.kodId);
      const jenis = { belian: 'Resit', laporan: 'Laporan kerja', vo: 'Arahan VO' }[it.type];
      const det = it.type === 'belian' ? r.item : it.type === 'laporan' ? r.tugas : r.penerangan;
      const amt = it.type === 'belian' ? rm(r.jumlah) : it.type === 'laporan' ? r.jam + ' jam' : '—';
      return `<tr style="cursor:pointer" data-a="openRec" data-type="${it.type}" data-id="${r.id}"><td>${fmtDate(r.tarikh)}</td><td>${esc(userName(r.userId))}</td><td>${jenis}</td><td>${esc(k ? k.kod : '—')}</td><td>${esc(det)}</td><td class="n">${esc(amt)}</td><td>${flagPills(it.flags)}</td><td>${pill(r.status)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function viewSemak() {
    const q = queueFor(me());
    const u = me();
    return adminShell('semak', `
      <div><h1>Peti semakan</h1><div class="muted small">${u.peranan === 'pengarah' ? 'Rekod yang telah disahkan pengurus menunggu kelulusan akhir anda. Rekod yang belum disahkan juga dipaparkan.' : 'Rekod yang dihantar dari tapak menunggu pengesahan anda.'} Tekan baris untuk semak.</div></div>
      <section class="card">${queueTable(q)}</section>`);
  }

  function viewSkopList() {
    return adminShell('skop', `<div class="row between" style="align-items:flex-end"><h1>Pantauan skop kerja</h1>${monthPicker()}</div>${skopGrid(state.bulan)}`);
  }

  function viewSkop(id) {
    const s = SKOP.find((x) => x.id === id);
    if (!s) return viewSkopList();
    const ym = state.bulan, st = skopStats(id, ym);
    const pct = st.bajet ? Math.round((st.kosAll / st.bajet) * 100) : 0;
    const ids = new Set(st.kods.map((k) => k.id));
    const flagged = pendingItems().filter((it) => ['dihantar', 'disahkan'].includes(it.rec.status) && it.flags.length && ids.has(it.type === 'vo' ? it.rec.id : it.rec.kodId));
    const photos = db.laporan.filter((l) => ids.has(l.kodId) && l.gambar && l.gambar.length).sort((a, b) => (a.tarikh < b.tarikh ? 1 : -1)).flatMap((l) => l.gambar.map((g) => ({ g, l }))).slice(0, 8);
    return adminShell('skop', `
      <a href="#a-skop" class="small">‹ Semua skop</a>
      <div class="row between" style="align-items:flex-end"><div><div class="muted small">Pantauan skop kerja</div><h1>${esc(s.nama)}</h1></div>${monthPicker()}</div>
      <div class="kpis">
        <div class="card kpi"><div class="l">Kod aktif</div><div class="v">${st.aktif}</div></div>
        <div class="card kpi"><div class="l">Jam (${monthName(ym)})</div><div class="v">${st.jam}</div></div>
        <div class="card kpi"><div class="l">Kos (${monthName(ym)})</div><div class="v">${rm0(st.kos)}</div></div>
        <div class="card kpi"><div class="l">VO terbuka</div><div class="v" style="color:var(--warn)">${st.voOpen}</div></div>
        <div class="card kpi"><div class="l">Bendera merah</div><div class="v" style="color:${st.flags ? 'var(--bad)' : 'var(--ink)'}">${st.flags}</div></div>
      </div>
      <div class="card stack" style="gap:8px"><div class="row between small"><b>Kos keseluruhan berbanding bajet</b><span class="muted">${rm0(st.kosAll)} daripada ${rm0(st.bajet)}${st.bajet ? ` (${pct}%)` : ''}</span></div><div class="bar"><div class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div></div>
      <section class="card stack"><h2>Kod kerja dalam skop ini</h2>
        <div class="tbl"><table><thead><tr><th>Kod</th><th>Penerangan</th><th>Jenis</th><th>Status</th><th class="n">Jam bulan ini</th><th class="n">Kos bulan ini</th><th class="n">Kos keseluruhan</th><th class="n">Bajet</th></tr></thead><tbody>
        ${st.kods.map((k) => `<tr><td>${esc(k.kod)}</td><td>${esc(k.penerangan)}</td><td>${k.jenis === 'VO' ? `<span class="pill p-vo">VO · ${esc(k.voStatus)}</span>` : esc(k.jenis)}</td><td>${esc(k.status)}</td><td class="n">${jamKod(k.id, ym)}</td><td class="n">${rm(kosKod(k.id, ym))}</td><td class="n">${rm(kosKod(k.id))}</td><td class="n">${k.bajet ? rm0(k.bajet) : '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Tiada kod kerja.</td></tr>'}
        </tbody></table></div></section>
      <section class="card stack"><h2>Bendera merah terbuka</h2>${flagged.length ? queueTable(flagged) : '<div class="muted small">Tiada.</div>'}</section>
      <section class="card stack"><h2>Gambar kerja terkini</h2>${photos.length ? `<div class="thumbs">${photos.map(({ g, l }) => `<img ${imgAttr(g)} alt="${esc((g.cap || 'Gambar') + ' · ' + l.tugas)}" data-a="zoom">`).join('')}</div>` : '<div class="muted small">Belum ada gambar.</div>'}</section>
    `);
  }

  function viewKod() {
    const u = me();
    const canEdit = u.peranan === 'pengurus' || u.peranan === 'pengarah';
    return adminShell('kod', `
      <h1>Kod kerja</h1>
      ${canEdit ? `<form class="card stack" data-form="kod"><h2>Buka kod kerja baharu</h2>
        <div class="grid-auto">
          <label class="f">Kod<input class="i" name="kod" required placeholder="${esc(db.settings.prefix)}-CV-002"></label>
          <label class="f">Skop<select class="i" name="skop" required>${SKOP.map((s) => `<option value="${s.id}">${esc(s.nama)}</option>`).join('')}</select></label>
          <label class="f">Jenis<select class="i" name="jenis"><option>Kontrak</option><option>Ad-hoc</option><option>VO</option></select></label>
          <label class="f">Bajet (RM)<input class="i" name="bajet" type="number" min="0" step="1"></label>
        </div>
        <label class="f">Penerangan<input class="i" name="penerangan" required></label>
        <div><button class="btn primary" type="submit">Simpan kod kerja</button></div>
      </form>` : ''}
      <section class="card"><div class="tbl"><table><thead><tr><th>Kod</th><th>Penerangan</th><th>Skop</th><th>Jenis</th><th class="n">Bajet</th><th class="n">Kos</th><th>Status</th><th></th></tr></thead><tbody>
      ${db.kod.slice().sort((a, b) => a.kod.localeCompare(b.kod)).map((k) => `<tr><td>${esc(k.kod)}</td><td>${esc(k.penerangan)}</td><td>${esc(skopOf(k.skop).pendek)}</td><td>${esc(k.jenis)}</td><td class="n">${k.bajet ? rm0(k.bajet) : '—'}</td><td class="n">${rm(kosKod(k.id))}</td><td>${esc(k.status)}</td><td>${canEdit ? `<button class="btn sm" data-a="toggleKod" data-id="${k.id}">${k.status === 'Aktif' ? 'Tutup' : 'Buka semula'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>`);
  }

  function viewVOList() {
    const canEdit = true; // pengurus, pengarah dan akaun boleh kemas kini status VO (contoh: akaun tanda Diinvois / Dibayar)
    const vos = db.kod.filter((k) => k.jenis === 'VO').sort((a, b) => (a.tarikh < b.tarikh ? 1 : -1));
    return adminShell('vo', `
      <div><h1>Daftar kerja tambahan (VO)</h1><div class="muted small">Kerja yang diarahkan klien dan dijejak hingga dibayar. Kos dikira daripada resit di bawah kod VO.</div></div>
      <div class="kpis">${VO_STATUS.map((s) => `<div class="card kpi"><div class="l">${esc(s)}</div><div class="v">${vos.filter((k) => k.voStatus === s).length}</div></div>`).join('')}</div>
      <section class="card"><div class="tbl"><table><thead><tr><th>Tarikh</th><th>Kod</th><th>Kerja</th><th>Skop</th><th>Diarahkan oleh</th><th class="n">Kos setakat ini</th><th class="n">Jam</th><th>Status VO</th></tr></thead><tbody>
      ${vos.map((k) => `<tr><td>${fmtDate(k.tarikh)}</td><td><a href="#" data-a="openRec" data-type="vo" data-id="${k.id}">${esc(k.kod)}</a></td><td>${esc(k.penerangan)}</td><td>${esc(skopOf(k.skop).pendek)}</td><td>${esc(k.pemberiArahan || '—')}</td><td class="n">${rm(kosKod(k.id))}</td><td class="n">${jamKod(k.id)}</td><td>${canEdit ? `<select class="i" style="min-height:36px;padding:4px 8px" data-a-change="voStatus" data-id="${k.id}" aria-label="Status VO ${esc(k.kod)}">${VO_STATUS.map((s) => `<option ${s === k.voStatus ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : esc(k.voStatus)}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Belum ada VO.</td></tr>'}
      </tbody></table></div></section>`);
  }

  function viewTunai() {
    const tn = bakiTunai();
    const last = db.kiraan[db.kiraan.length - 1];
    const u = me();
    const can = u.peranan !== 'penyelia';
    const keluar = db.belian.filter((b) => b.bayaran === 'Tunai' && live(b)).sort((a, b) => (a.tarikh < b.tarikh ? 1 : -1));
    return adminShell('tunai', `
      <div><h1>Tunai runcit</h1><div class="muted small">Imprest tapak: ${rm(db.settings.imprest)} · had sekali beli: ${rm(db.settings.hadTunai)}</div></div>
      <div class="kpis">
        <div class="card kpi"><div class="l">Jumlah top-up</div><div class="v">${rm0(tn.masuk)}</div></div>
        <div class="card kpi"><div class="l">Belian tunai</div><div class="v">${rm0(tn.keluar)}</div></div>
        <div class="card kpi"><div class="l">Baki sepatutnya</div><div class="v">${rm(tn.baki)}</div></div>
        <div class="card kpi"><div class="l">Kiraan terakhir</div><div class="v">${last ? rm(last.jumlah) : '—'}</div><div class="tiny muted">${last ? `${fmtDate(last.tarikh)} · varians ${rm(last.jumlah - last.jangka)}` : 'Belum dikira'}</div></div>
      </div>
      ${can ? `<div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <form class="card stack" data-form="topup"><h2>Top-up tunai</h2><label class="f">Jumlah (RM)<input class="i" name="jumlah" type="number" min="0" step="0.01" required></label><label class="f">Catatan<input class="i" name="catatan" placeholder="Contoh: Tambah semula imprest"></label><button class="btn primary" type="submit">Rekod top-up</button></form>
        <form class="card stack" data-form="kiraan"><h2>Kiraan tunai fizikal</h2><label class="f">Tunai dikira (RM)<input class="i" name="jumlah" type="number" min="0" step="0.01" required></label><div class="muted tiny">Varians mesti sifar atau dijelaskan.</div><button class="btn primary" type="submit">Rekod kiraan</button></form>
      </div>` : ''}
      <section class="card stack"><h2>Belian tunai</h2><div class="tbl"><table><thead><tr><th>Tarikh</th><th>Oleh</th><th>Kod</th><th>Barang</th><th class="n">Jumlah</th><th>Status</th></tr></thead><tbody>
      ${keluar.map((b) => `<tr style="cursor:pointer" data-a="openRec" data-type="belian" data-id="${b.id}"><td>${fmtDate(b.tarikh)}</td><td>${esc(userName(b.userId))}</td><td>${esc((kodOf(b.kodId) || {}).kod || '—')}</td><td>${esc(b.item)}</td><td class="n">${rm(b.jumlah)}</td><td>${pill(b.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Tiada.</td></tr>'}
      </tbody></table></div></section>`);
  }

  function viewEksport() {
    const ym = state.bulan;
    const kods = db.kod.map((k) => ({ k, kos: kosKod(k.id, ym), jam: jamKod(k.id, ym) })).filter((x) => x.kos || x.jam);
    const belumLulus = db.belian.concat(db.laporan).filter((x) => inMonth(x, ym) && ['dihantar', 'disahkan'].includes(x.status)).length;
    return adminShell('eksport', `
      <div class="row between" style="align-items:flex-end"><div><h1>Eksport bulanan</h1><div class="muted small">Ringkasan untuk draf invois klien dan master financial.</div></div>${monthPicker()}</div>
      ${belumLulus ? `<div class="notice bad">${belumLulus} rekod ${monthName(ym)} belum diluluskan. Selesaikan dahulu sebelum tutup bulan.</div>` : '<div class="notice" style="background:var(--ok-bg);border-color:#BFE3CC;color:var(--ok)">Semua rekod bulan ini telah diluluskan.</div>'}
      <div class="row">
        <button class="btn primary" data-a="csv" data-v="ringkasan">Muat turun ringkasan kod kerja (CSV)</button>
        <button class="btn" data-a="csv" data-v="belian">Senarai belian (CSV)</button>
        <button class="btn" data-a="csv" data-v="laporan">Senarai laporan &amp; jam (CSV)</button>
        <button class="btn" data-a="csv" data-v="gaji">Ringkasan gaji staf (CSV)</button>
      </div>
      <section class="card stack"><h2>Ringkasan ${monthName(ym)}</h2><div class="tbl"><table><thead><tr><th>Kod</th><th>Penerangan</th><th>Skop</th><th>Jenis</th><th class="n">Jam</th><th class="n">Kos bahan / belian</th></tr></thead><tbody>
      ${kods.map(({ k, kos, jam }) => `<tr><td>${esc(k.kod)}</td><td>${esc(k.penerangan)}</td><td>${esc(skopOf(k.skop).pendek)}</td><td>${esc(k.jenis)}</td><td class="n">${jam}</td><td class="n">${rm(kos)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Tiada rekod bulan ini.</td></tr>'}
      </tbody></table></div><div class="muted tiny">Caj kepada klien dikira mengikut jadual kadar kontrak dalam fasa 3. Ringkasan ini ialah kos sebenar.</div></section>`);
  }

  function viewTetapan() {
    const s = db.settings;
    return adminShell('tetapan', `
      <h1>Tetapan &amp; pengguna</h1>
      <form class="card stack" data-form="settings"><h2>Tetapan</h2>
        <div class="grid-auto">
          <label class="f">Klien<input class="i" name="klien" value="${esc(s.klien)}"></label>
          <label class="f">Awalan kod<input class="i" name="prefix" value="${esc(s.prefix)}"></label>
          <label class="f">Had belian tunai sekali beli (RM)<input class="i" type="number" name="hadTunai" value="${esc(s.hadTunai)}"></label>
          <label class="f">Imprest tunai runcit (RM)<input class="i" type="number" name="imprest" value="${esc(s.imprest)}"></label>
          <label class="f">Waktu masuk kerja<input class="i" type="time" name="waktuMasuk" value="${esc(s.waktuMasuk)}"></label>
          <label class="f">Kadar perjalanan (RM / km)<input class="i" type="number" step="0.01" name="kadarKm" value="${esc(s.kadarKm)}"></label>
          <label class="f">Had pendahuluan gaji (RM)<input class="i" type="number" name="hadPendahuluan" value="${esc(s.hadPendahuluan)}"></label>
          <label class="f">Tempoh jelaskan petty cash (hari)<input class="i" type="number" name="hariJelasPetty" value="${esc(s.hariJelasPetty)}"></label>
        </div>
        <h3>Lokasi tapak untuk kehadiran</h3>
        <div class="grid-auto">
          <label class="f">Latitud<input class="i" name="tapakLat" value="${esc(s.tapakLat)}" inputmode="decimal"></label>
          <label class="f">Longitud<input class="i" name="tapakLng" value="${esc(s.tapakLng)}" inputmode="decimal"></label>
          <label class="f">Jarak dibenarkan (meter)<input class="i" type="number" name="radius" value="${esc(s.radius)}"></label>
        </div>
        <div class="muted tiny">Berdiri di pintu masuk tapak dan tekan "Guna lokasi saya sekarang". Kosongkan jika tidak mahu semakan jarak.</div>
        <div class="row"><button class="btn" type="button" data-a="lokasiTapak">Guna lokasi saya sekarang</button></div>
        <div><button class="btn primary" type="submit">Simpan tetapan</button></div>
      </form>
      <section class="card stack"><h2>💾 Sandaran data</h2>
        <div class="small">Pelan Spark tiada sandaran automatik. Muat turun sandaran <b>setiap minggu</b> dan simpan fail di tempat selamat (cth. Google Drive peribadi). Fail ini mengandungi data peribadi pekerja: jangan kongsi.</div>
        <div class="small">Sandaran terakhir: <b>${db.settings.sandaranTerakhir ? esc(new Date(db.settings.sandaranTerakhir).toLocaleString('ms-MY')) : 'belum pernah'}</b></div>
        <label class="small"><input type="checkbox" id="sandaranGambar"> Termasuk gambar (fail lebih besar, guna lebih banyak kuota bacaan)</label>
        <div><button class="btn primary" data-a="sandaran">Muat turun sandaran</button></div>
      </section>
      <section class="card stack"><h2>Migrasi ke model kuasa</h2>
        <div class="small">Tukar peranan lama kepada templat kuasa, isi kumpulan pekerja dan rekod lama, dan sediakan status apps. Tiada data dipadam. ${db.settings.migrasi ? `<b>Sudah dijalankan ${esc(new Date(db.settings.migrasi.masa).toLocaleDateString('ms-MY'))}.</b> Boleh dijalankan semula dengan selamat.` : '<b>Belum dijalankan.</b>'}</div>
        <div><button class="btn" data-a="migrasi">Jalankan migrasi</button></div>
      </section>
      ${state.hasilEmel ? kadEmel(state.hasilEmel) : ''}
      <section class="card stack"><h2>Akaun emel (Pengarah Utama &amp; pengurusan)</h2>
        <div class="muted small">Pekerja (ID + PIN) didaftarkan dalam menu <a href="#a-pekerja">Pekerja</a>. Di sini hanya akaun yang log masuk dengan emel, contohnya Datin sebagai Pengarah Utama.</div>
        <div class="tbl"><table style="min-width:380px"><thead><tr><th>Nama</th><th>Peranan</th><th></th></tr></thead><tbody>${db.users.filter((u) => u.aktif !== false && !u.staffId).map((u) => `<tr><td><a href="#a-pekerja-p-${u.id}">${esc(u.nama)}</a> ${ikonKuasa(u)} <a class="btn sm" href="#a-pekerja-p-${u.id}">Ubah</a>${u.email ? `<br><span class="muted tiny">${esc(u.email)}</span>` : ''}</td><td>${utama(u) ? 'Pengarah Utama' : PERANAN[u.peranan]}</td><td><div class="row" style="gap:6px;flex-wrap:wrap">${u.email && u.id !== state.userId ? butangWa(mesejEmel(u.nama, u.email, ''), u.telefon) : ''}${u.id !== state.userId ? `<button class="btn sm danger" data-a="rmUser" data-id="${u.id}">Nyahaktif</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>
        <form class="row" data-form="user" style="align-items:flex-end;flex-wrap:wrap">
          <label class="f" style="flex:1 1 200px">Nama<input class="i" name="nama" required></label>
          ${CLOUD ? `<label class="f" style="flex:1 1 220px">Emel<input class="i" type="email" name="email" required></label>
          <label class="f" style="flex:1 1 160px">Kata laluan sementara<input class="i" name="password" minlength="6" required></label>` : ''}
          <label class="f" style="flex:1 1 160px">Peranan<select class="i" name="peranan"><option value="pengarah">Pengarah Utama</option><option value="pengurus">Pengurus (lama)</option><option value="akaun">Akaun (lama)</option></select></label>
          <button class="btn primary" type="submit">Tambah akaun emel</button>
        </form>
      </section>
      ${CLOUD ? `<section class="card stack"><h2>Sambungan</h2><div class="small">Disambung ke Firebase projek <b>${esc(CFG.projectId)}</b>.</div></section>` : `<section class="card stack"><h2>Data demo</h2><div class="muted small">Padam semua rekod dalam pelayar ini dan mula semula dengan data contoh.</div><div><button class="btn danger" data-a="reset">Set semula data demo</button></div></section>`}`);
  }

  // ---------- Modul staf: kehadiran bergambar dan permohonan ----------
  const isField = (u) => u && (u.peranan === 'penyelia' || u.peranan === 'pekerja');
  const fieldUsers = () => db.users.filter((u) => u.aktif !== false && isField(u));
  const MOHON = {
    cuti: { nama: 'Permohonan cuti', pendek: 'Cuti' },
    tuntutan: { nama: 'Tuntutan perbelanjaan', pendek: 'Tuntutan' },
    pettycash: { nama: 'Permohonan petty cash', pendek: 'Petty cash' },
    pendahuluan: { nama: 'Pendahuluan gaji', pendek: 'Pendahuluan gaji' },
  };
  const JENIS_CUTI = ['Tahunan', 'Sakit', 'Hospital', 'Kecemasan', 'Tanpa gaji', 'Bersalin / paterniti', 'Lain-lain'];
  const JENIS_TUNTUTAN = ['Perjalanan (km)', 'Makan / elaun luar kawasan', 'Tol & parkir', 'Bahan / alat dibeli sendiri', 'Lain-lain'];
  // Aliran kelulusan bagi setiap jenis permohonan: status semasa → langkah seterusnya.
  const TWO_STEP = {
    dihantar: { to: 'disahkan', who: ['pengurus', 'pengarah'], label: 'Sahkan' },
    disahkan: { to: 'diluluskan', who: ['pengarah'], label: 'Lulus akhir' },
    diluluskan: { to: 'dibayar', who: ['akaun', 'pengarah'], label: 'Tanda dibayar' },
  };
  const STEP = {
    cuti: { dihantar: { to: 'diluluskan', who: ['pengurus', 'pengarah'], label: 'Luluskan cuti' } },
    pendahuluan: TWO_STEP,
    tuntutan: TWO_STEP,
    pettycash: {
      dihantar: { to: 'diluluskan', who: ['pengurus', 'pengarah'], label: 'Luluskan' },
      diluluskan: { to: 'dibayar', who: ['akaun', 'pengarah'], label: 'Tanda wang diberi' },
      dibayar: { to: 'dijelaskan', who: ['akaun', 'pengurus', 'pengarah'], label: 'Jelaskan', form: true },
    },
  };
  const stepOf = (m) => (STEP[m.jenis] || {})[m.status] || null;
  const canAct = (m, u) => { const st = stepOf(m); return !!(st && u && st.who.includes(u.peranan) && m.userId !== u.id); };
  const canReject = (m, u) => canAct(m, u) && m.status !== 'dibayar';
  function mohonQueue(u) { return (db.mohon || []).filter((m) => canAct(m, u)); }

  const tsDate = (v) => (!v ? null : v.toDate ? v.toDate() : v.seconds ? new Date(v.seconds * 1000) : null);
  const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  function kiraHari(mula, tamat) {
    if (!mula || !tamat || tamat < mula) return 0;
    let n = 0;
    for (let t = Date.parse(mula); t <= Date.parse(tamat); t += 864e5) if (new Date(t).getUTCDay() !== 0) n++;
    return n;
  }
  function jarakMeter(a, b) {
    const R = 6371000, rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function tapakPoint() {
    const lat = parseFloat(db.settings.tapakLat), lng = parseFloat(db.settings.tapakLng);
    return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
  }

  // Hak cuti minimum Akta Kerja 1955 (seksyen 60E, 60F) ikut tempoh perkhidmatan; boleh diganti per pekerja.
  function hakCuti(u) {
    const y = u && u.tarikhMula ? (Date.now() - Date.parse(u.tarikhMula)) / (365.25 * 864e5) : 0;
    return {
      Tahunan: num(u && u.cutiTahunan) || (y >= 5 ? 16 : y >= 2 ? 12 : 8),
      Sakit: num(u && u.cutiSakit) || (y >= 5 ? 22 : y >= 2 ? 18 : 14),
      Hospital: 60,
    };
  }
  function bakiCuti(u) {
    const yr = String(new Date().getFullYear());
    const d = {};
    (db.mohon || []).filter((m) => m.jenis === 'cuti' && m.userId === (u && u.id) && m.status === 'diluluskan' && (m.mula || '').startsWith(yr))
      .forEach((m) => { d[m.jenisCuti] = (d[m.jenisCuti] || 0) + num(m.hari); });
    const h = hakCuti(u);
    return { Tahunan: h.Tahunan - (d.Tahunan || 0) - (d.Kecemasan || 0), Sakit: h.Sakit - (d.Sakit || 0), Hospital: h.Hospital - (d.Hospital || 0), hak: h, diambil: d };
  }
  function potonganBulan(m, ym) {
    if (m.jenis !== 'pendahuluan' || m.status !== 'dibayar' || !m.bulanPotong) return 0;
    const n = Math.max(1, num(m.ansuran) || 1), i = monthsBetween(m.bulanPotong, ym);
    return i >= 0 && i < n ? num(m.jumlah) / n : 0;
  }

  function flagsHadir(h) {
    const f = [];
    if (!h) return f;
    if (h.masuk && db.settings.waktuMasuk && h.masuk > db.settings.waktuMasuk) f.push('Lewat');
    if (!(h.fotoMasuk || []).length) f.push('Tiada swafoto');
    if (!h.gpsMasuk) f.push('Tiada lokasi');
    if (num(h.jarakMasuk) > num(db.settings.radius) && tapakPoint()) f.push(`Jauh dari tapak (${Math.round(h.jarakMasuk)} m)`);
    if (h.keluar && num(h.jarakKeluar) > num(db.settings.radius) && tapakPoint()) f.push(`Keluar jauh dari tapak (${Math.round(h.jarakKeluar)} m)`);
    const sv = tsDate(h.masukServer);
    if (sv) {
      const local = Date.parse(`${h.tarikh}T${h.masuk}:00`);
      if (Math.abs(sv.getTime() - local) > 10 * 60000) f.push('Masa telefon berbeza');
    }
    return f;
  }
  function jamHadir(h) {
    if (!h || !h.masuk || !h.keluar) return 0;
    const [a, b] = [h.masuk, h.keluar].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
    return Math.max(0, Math.round(((b - a) / 60) * 10) / 10);
  }

  function flagsMohon(m) {
    const f = [];
    const u = db.users.find((x) => x.id === m.userId) || {};
    const others = (db.mohon || []).filter((o) => o.userId === m.userId && o.id !== m.id && o.jenis === m.jenis);
    if (m.jenis === 'cuti' && m.status === 'dihantar') {
      const b = bakiCuti(u);
      if (['Tahunan', 'Kecemasan'].includes(m.jenisCuti) && num(m.hari) > b.Tahunan) f.push('Melebihi baki cuti tahunan');
      if (m.jenisCuti === 'Sakit' && num(m.hari) > b.Sakit) f.push('Melebihi baki cuti sakit');
      if (['Sakit', 'Hospital'].includes(m.jenisCuti) && !(m.lampiran || []).length) f.push('Tiada sijil cuti sakit');
    }
    if (m.jenis === 'pendahuluan') {
      if (num(m.jumlah) > num(db.settings.hadPendahuluan)) f.push('Melebihi had pendahuluan');
      const aktif = others.filter((o) => ['dihantar', 'disahkan', 'diluluskan'].includes(o.status) || (o.status === 'dibayar' && o.bulanPotong && monthsBetween(o.bulanPotong, thisMonth()) < Math.max(1, num(o.ansuran) || 1) - 1));
      if (aktif.length) f.push('Ada pendahuluan belum selesai');
    }
    if (m.jenis === 'pettycash') {
      if (others.some((o) => o.status === 'dibayar')) f.push('Petty cash lama belum dijelaskan');
      if (m.status === 'dibayar' && m.tarikhBayar && daysBetween(m.tarikhBayar, today()) > num(db.settings.hariJelasPetty)) f.push('Lewat dijelaskan');
    }
    if (m.jenis === 'tuntutan') {
      if (m.jenisTuntutan === 'Perjalanan (km)') { if (!num(m.km)) f.push('Tiada jarak perjalanan'); }
      else if (!(m.resitT || []).length) f.push('Tiada resit');
    }
    return f;
  }
  function mohonSummary(m) {
    if (m.jenis === 'cuti') return [`${m.jenisCuti} · ${fmtDate(m.mula)}${m.tamat !== m.mula ? ' – ' + fmtDate(m.tamat) : ''}`, `${m.hari} hari`];
    if (m.jenis === 'pendahuluan') return [`${m.sebab || '—'} · potong ${num(m.ansuran) > 1 ? m.ansuran + ' bulan' : 'sekali'} dari ${m.bulanPotong ? monthName(m.bulanPotong) : '—'}`, rm(m.jumlah)];
    if (m.jenis === 'pettycash') return [`${m.tujuan || '—'}${kodOf(m.kodId) ? ' · ' + kodOf(m.kodId).kod : ''}`, rm(m.jumlah)];
    return [`${m.jenisTuntutan}${m.keterangan ? ' · ' + m.keterangan : ''}`, rm(m.jumlah)];
  }

  // ----- Apps Pekerja: kehadiran -----
  function viewHadir() {
    const u = me(), t = today();
    const h = db.hadir.find((x) => x.userId === u.id && x.tarikh === t);
    const mode = !h ? 'masuk' : !h.keluar ? 'keluar' : 'siap';
    if (mode === 'siap') {
      return `${topbar('Kehadiran', '#home')}<main class="wrap"><div class="card stack"><h2>Kehadiran hari ini lengkap</h2><div>Masuk ${esc(h.masuk)} · keluar ${esc(h.keluar)} · ${jamHadir(h)} jam</div><div>${flagPills(flagsHadir(h))}</div></div><a class="btn block" href="#home">Kembali</a></main>`;
    }
    if (!state.draft || state.draft._form !== 'hadir' || state.draft._mode !== mode) {
      state.draft = { _form: 'hadir', _mode: mode, foto: [], gps: null, gpsMsg: 'Mendapatkan lokasi…' };
      setTimeout(ambilLokasi, 50);
    }
    return `${topbar(mode === 'masuk' ? 'Masuk Kerja' : 'Keluar Kerja', '#home')}
    <main class="wrap">
      <form class="stack" data-form="hadir">
        <div class="card" style="text-align:center"><div class="muted small">${fmtDate(t)}</div><div style="font-size:40px;font-weight:700;color:var(--ink)" id="jam-kini">${nowTime()}</div>${mode === 'keluar' ? `<div class="small">Masuk pada ${esc(h.masuk)}</div>` : ''}</div>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Swafoto (wajib)${photoGrid('foto', ['Swafoto'], 'user')}</div>
        <div class="card small" id="gps-box">${gpsBox()}</div>
        <label class="f">Catatan (pilihan)<input class="i" name="nota" placeholder="Contoh: terus ke tapak pembekal"></label>
        <button class="btn primary block" type="submit">${mode === 'masuk' ? 'Rekod masuk kerja' : 'Rekod keluar kerja'}</button>
        <div class="muted tiny">Swafoto dan lokasi hanya digunakan untuk rekod kehadiran dan disimpan dalam sistem Kaiser.</div>
      </form>
    </main>`;
  }
  function gpsBox() {
    const g = state.draft && state.draft.gps, tp = tapakPoint();
    if (!g) return `<div class="row between"><span>${esc((state.draft && state.draft.gpsMsg) || '')}</span><button type="button" class="btn sm" data-a="ambilLokasi">Cuba lagi</button></div>`;
    const d = tp ? jarakMeter(g, tp) : null;
    return `<div class="row between"><span>Lokasi diperoleh (±${Math.round(g.acc)} m)${d != null ? ` · ${Math.round(d)} m dari tapak` : ''}</span>${d != null ? (d > num(db.settings.radius) ? '<span class="pill p-flag">Jauh dari tapak</span>' : '<span class="pill p-okflag">Di tapak</span>') : ''}</div>`;
  }
  function ambilLokasi() {
    if (!state.draft || state.draft._form !== 'hadir') return;
    const box = () => { const b = $('#gps-box'); if (b) b.innerHTML = gpsBox(); };
    if (!navigator.geolocation) { state.draft.gpsMsg = 'Telefon ini tidak menyokong lokasi.'; box(); return; }
    state.draft.gpsMsg = 'Mendapatkan lokasi…'; box();
    try {
      navigator.geolocation.getCurrentPosition((p) => {
        if (!state.draft || state.draft._form !== 'hadir') return;
        state.draft.gps = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        box();
      }, (e) => { if (state.draft) { state.draft.gpsMsg = e.code === 1 ? 'Kebenaran lokasi ditolak. Benarkan lokasi dalam tetapan pelayar.' : 'Lokasi tidak dapat diperoleh.'; box(); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    } catch (e) { state.draft.gpsMsg = 'Lokasi tidak tersedia di sini.'; box(); }
  }

  // ----- Apps Pekerja: borang permohonan -----
  function viewMohon(jenis) {
    if (!MOHON[jenis]) return viewPermohonanSaya();
    const u = me(), s = db.settings;
    if (!state.draft || state.draft._form !== 'mohon' || state.draft._jenis !== jenis) state.draft = { _form: 'mohon', _jenis: jenis, lampiran: [], resitT: [] };
    let body = '';
    if (jenis === 'cuti') {
      const b = bakiCuti(u);
      body = `<div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="card kpi" style="text-align:center;padding:10px"><div class="v">${b.Tahunan}</div><div class="l">Baki tahunan</div></div>
          <div class="card kpi" style="text-align:center;padding:10px"><div class="v">${b.Sakit}</div><div class="l">Baki sakit</div></div>
          <div class="card kpi" style="text-align:center;padding:10px"><div class="v">${b.Hospital}</div><div class="l">Baki hospital</div></div></div>
        <label class="f">Jenis cuti<select class="i" name="jenisCuti" required>${JENIS_CUTI.map((j) => `<option>${j}</option>`).join('')}</select></label>
        <div class="grid2"><label class="f">Dari<input class="i" type="date" name="mula" value="${today()}" required data-a-change="kiraHari"></label><label class="f">Hingga<input class="i" type="date" name="tamat" value="${today()}" required data-a-change="kiraHari"></label></div>
        <div class="small" id="hari-cuti">${kiraHari(today(), today())} hari bekerja (Ahad tidak dikira)</div>
        <label class="f">Sebab<textarea class="i" name="sebab" required></textarea></label>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Lampiran (sijil cuti sakit / dokumen)${photoGrid('lampiran', [''])}</div>`;
    } else if (jenis === 'pendahuluan') {
      const nx = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; })();
      body = `<div class="notice small">Had pendahuluan: ${rm(s.hadPendahuluan)}. Jumlah ini akan dipotong daripada gaji mengikut jadual yang dipilih.</div>
        <label class="f">Jumlah (RM)<input class="i" type="number" min="1" step="0.01" name="jumlah" inputmode="decimal" required></label>
        <label class="f">Sebab<textarea class="i" name="sebab" required></textarea></label>
        <div class="grid2"><label class="f">Cara potongan<select class="i" name="ansuran"><option value="1">Sekali gus</option><option value="2">2 bulan</option><option value="3">3 bulan</option><option value="4">4 bulan</option></select></label>
        <label class="f">Mula dipotong<input class="i" type="month" name="bulanPotong" value="${nx}" required></label></div>`;
    } else if (jenis === 'pettycash') {
      body = `<div class="notice small">Wang petty cash mesti dijelaskan dengan resit belian dalam ${esc(s.hariJelasPetty)} hari. Baki dipulangkan kepada akaun.</div>
        <label class="f">Jumlah diperlukan (RM)<input class="i" type="number" min="1" step="0.01" name="jumlah" inputmode="decimal" required></label>
        <label class="f">Tujuan<textarea class="i" name="tujuan" required placeholder="Contoh: beli bahan baiki paip Blok B"></textarea></label>
        <label class="f">Kod kerja<select class="i" name="kodId">${kodOptions('', true)}</select></label>
        <label class="f">Tarikh diperlukan<input class="i" type="date" name="tarikhPerlu" value="${today()}"></label>`;
    } else {
      body = `<label class="f">Jenis tuntutan<select class="i" name="jenisTuntutan">${JENIS_TUNTUTAN.map((j) => `<option>${j}</option>`).join('')}</select></label>
        <div class="grid2"><label class="f">Tarikh belanja<input class="i" type="date" name="tarikhBelanja" value="${today()}" required></label>
        <label class="f">Jumlah (RM)<input class="i" type="number" min="0" step="0.01" name="jumlah" inputmode="decimal"></label></div>
        <label class="f">Jarak perjalanan (km)<input class="i" type="number" min="0" step="0.1" name="km" inputmode="decimal"></label>
        <div class="muted tiny">${num(s.kadarKm) ? `Untuk perjalanan, jumlah dikira automatik: km × ${rm(s.kadarKm)}.` : 'Kadar per km belum ditetapkan oleh Pengarah; isi jumlah sendiri.'}</div>
        <label class="f">Keterangan<textarea class="i" name="keterangan" required placeholder="Contoh: ke Gebeng ambil bahan untuk VO-002"></textarea></label>
        <label class="f">Kod kerja (jika berkaitan projek)<select class="i" name="kodId">${kodOptions('', true)}</select></label>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Gambar resit${photoGrid('resitT', [''])}</div>`;
    }
    return `${topbar(MOHON[jenis].nama, '#home')}
    <main class="wrap"><form class="stack" data-form="mohon" data-jenis="${jenis}">${body}<button class="btn primary block" type="submit">Hantar permohonan</button></form></main>`;
  }

  function viewPermohonanSaya() {
    const u = me();
    const mine = (db.mohon || []).filter((m) => m.userId === u.id).sort((a, b) => (a.tarikh < b.tarikh ? 1 : -1));
    return `${topbar('Permohonan Saya', '#home')}
    <main class="wrap"><div class="stack" style="gap:8px">${mine.length ? mine.map((m) => {
      const [d, a] = mohonSummary(m);
      return `<button class="item" data-a="openMohon" data-id="${m.id}"><span><span class="t">${esc(MOHON[m.jenis].pendek)} · ${esc(a)}</span><br><span class="muted tiny">${fmtDate(m.tarikh)} · ${esc(d)}</span></span>${pill(m.status)}</button>`;
    }).join('') : '<div class="muted">Belum ada permohonan.</div>'}</div></main>`;
  }

  // ----- Apps Pentadbiran: kehadiran -----
  function viewAHadir() {
    const day = state.hariHadir || today();
    const users = fieldUsers();
    const onLeave = (uid2) => (db.mohon || []).find((m) => m.jenis === 'cuti' && m.userId === uid2 && m.status === 'diluluskan' && m.mula <= day && m.tamat >= day);
    const rows = users.map((u) => ({ u, h: db.hadir.find((x) => x.userId === u.id && x.tarikh === day), c: onLeave(u.id) }));
    const hadir = rows.filter((r) => r.h).length, lewat = rows.filter((r) => r.h && flagsHadir(r.h).includes('Lewat')).length, cuti = rows.filter((r) => !r.h && r.c).length;
    const thumb = (arr) => ((arr || [])[0] ? `<img ${imgAttr(arr[0])} alt="Swafoto" data-a="zoom" style="width:44px;height:44px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:6px;cursor:zoom-in">` : '');
    return adminShell('hadir', `
      <div class="row between" style="align-items:flex-end"><div><h1>Kehadiran</h1><div class="muted small">Swafoto, lokasi dan masa pelayan bagi setiap kakitangan tapak.</div></div>
        <label class="f">Tarikh<input class="i" type="date" value="${day}" data-a-change="setHariHadir"></label></div>
      <div class="kpis">
        <div class="card kpi"><div class="l">Hadir</div><div class="v">${hadir} / ${users.length}</div></div>
        <div class="card kpi"><div class="l">Lewat</div><div class="v" style="color:${lewat ? 'var(--warn)' : 'var(--ink)'}">${lewat}</div></div>
        <div class="card kpi"><div class="l">Bercuti</div><div class="v">${cuti}</div></div>
        <div class="card kpi"><div class="l">Tiada rekod</div><div class="v" style="color:${users.length - hadir - cuti ? 'var(--bad)' : 'var(--ink)'}">${users.length - hadir - cuti}</div></div>
      </div>
      <section class="card"><div class="tbl"><table><thead><tr><th>Nama</th><th>Peranan</th><th>Masuk</th><th>Keluar</th><th class="n">Jam</th><th>Semakan</th></tr></thead><tbody>
      ${rows.map(({ u, h, c }) => `<tr><td>${esc(u.nama)}</td><td>${PERANAN[u.peranan]}</td>
        <td>${h ? `${thumb(h.fotoMasuk)}${esc(h.masuk)}` : c ? `<span class="pill p-vo">Cuti ${esc(c.jenisCuti)}</span>` : '<span class="muted">—</span>'}</td>
        <td>${h && h.keluar ? `${thumb(h.fotoKeluar)}${esc(h.keluar)}` : h ? '<span class="muted">Belum keluar</span>' : ''}</td>
        <td class="n">${h ? jamHadir(h) || '—' : ''}</td>
        <td>${h ? flagPills(flagsHadir(h)) : c ? '' : '<span class="pill p-flag">Tiada rekod</span>'}${h && h.nota ? `<div class="tiny muted">${esc(h.nota)}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Belum ada pekerja atau penyelia didaftarkan.</td></tr>'}
      </tbody></table></div></section>`);
  }

  // ----- Apps Pentadbiran: permohonan staf -----
  function viewAMohon() {
    const u = me();
    const fj = state.mohonJenis || 'semua', fs2 = state.mohonStatus || 'tindakan';
    let list = (db.mohon || []).slice();
    if (fj !== 'semua') list = list.filter((m) => m.jenis === fj);
    if (fs2 === 'tindakan') list = list.filter((m) => canAct(m, u));
    else if (fs2 === 'aktif') list = list.filter((m) => !!stepOf(m));
    list.sort((a, b) => (a.tarikh < b.tarikh ? 1 : -1));
    const cnt = (j) => mohonQueue(u).filter((m) => m.jenis === j).length;
    return adminShell('mohon', `
      <div><h1>Permohonan staf</h1><div class="muted small">Cuti, tuntutan, petty cash dan pendahuluan gaji daripada Apps Pekerja.</div></div>
      <div class="kpis">${Object.keys(MOHON).map((j) => `<div class="card kpi"><div class="l">${MOHON[j].pendek} menunggu anda</div><div class="v">${cnt(j)}</div></div>`).join('')}</div>
      <div class="row">
        <label class="f">Jenis<select class="i" data-a-change="setMohonJenis"><option value="semua">Semua</option>${Object.keys(MOHON).map((j) => `<option value="${j}" ${fj === j ? 'selected' : ''}>${MOHON[j].pendek}</option>`).join('')}</select></label>
        <label class="f">Papar<select class="i" data-a-change="setMohonStatus"><option value="tindakan" ${fs2 === 'tindakan' ? 'selected' : ''}>Perlu tindakan saya</option><option value="aktif" ${fs2 === 'aktif' ? 'selected' : ''}>Semua yang aktif</option><option value="semua" ${fs2 === 'semua' ? 'selected' : ''}>Semua</option></select></label>
      </div>
      <section class="card"><div class="tbl"><table><thead><tr><th>Tarikh</th><th>Nama</th><th>Jenis</th><th>Butiran</th><th class="n">Jumlah</th><th>Semakan</th><th>Status</th></tr></thead><tbody>
      ${list.map((m) => { const [d, a] = mohonSummary(m); return `<tr style="cursor:pointer" data-a="openMohon" data-id="${m.id}"><td>${fmtDate(m.tarikh)}</td><td>${esc(userName(m.userId))}</td><td>${esc(MOHON[m.jenis].pendek)}</td><td>${esc(d)}</td><td class="n">${esc(a)}</td><td>${flagPills(flagsMohon(m))}</td><td>${pill(m.status)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Tiada permohonan.</td></tr>'}
      </tbody></table></div></section>`);
  }

  function mohonDetail(id) {
    const m = (db.mohon || []).find((x) => x.id === id);
    if (!m) return '';
    const u = me();
    const rows = [['Nama', userName(m.userId)], ['Tarikh mohon', fmtDate(m.tarikh)]];
    let imgs = [];
    if (m.jenis === 'cuti') {
      const b = bakiCuti(db.users.find((x) => x.id === m.userId) || {});
      rows.push(['Jenis cuti', m.jenisCuti], ['Tempoh', `${fmtDate(m.mula)} – ${fmtDate(m.tamat)} (${m.hari} hari)`], ['Sebab', m.sebab], ['Baki tahunan / sakit', `${b.Tahunan} / ${b.Sakit} hari`]);
      imgs = (m.lampiran || []).map((g) => ({ img: g.img, id: g.id, cap: 'Lampiran' }));
    } else if (m.jenis === 'pendahuluan') {
      rows.push(['Jumlah', rm(m.jumlah)], ['Sebab', m.sebab], ['Potongan', `${num(m.ansuran) > 1 ? `${m.ansuran} bulan × ${rm(num(m.jumlah) / num(m.ansuran))}` : 'Sekali gus'} mulai ${m.bulanPotong ? monthName(m.bulanPotong) : '—'}`]);
    } else if (m.jenis === 'pettycash') {
      rows.push(['Jumlah', rm(m.jumlah)], ['Tujuan', m.tujuan], ['Kod kerja', (kodOf(m.kodId) || {}).kod || '—'], ['Tarikh diperlukan', fmtDate(m.tarikhPerlu)]);
      if (m.tarikhBayar) rows.push(['Wang diberi', fmtDate(m.tarikhBayar)]);
      if (m.status === 'dijelaskan') rows.push(['Dibelanjakan', rm(m.jumlahGuna)], ['Baki dipulangkan', rm(num(m.jumlah) - num(m.jumlahGuna))]);
    } else {
      rows.push(['Jenis', m.jenisTuntutan], ['Tarikh belanja', fmtDate(m.tarikhBelanja)], ['Jumlah', rm(m.jumlah)], ...(num(m.km) ? [['Jarak', `${m.km} km`]] : []), ['Keterangan', m.keterangan], ['Kod kerja', (kodOf(m.kodId) || {}).kod || '—']);
      imgs = (m.resitT || []).map((g) => ({ img: g.img, id: g.id, cap: 'Resit' }));
    }
    const st = stepOf(m);
    let actions = '';
    if (canAct(m, u)) {
      actions = st.form ? `<button class="btn primary" data-a="mohonJelas" data-id="${m.id}">${st.label}</button>` : `<button class="btn primary" data-a="mohonStep" data-id="${m.id}">${st.label}</button>`;
      if (canReject(m, u)) actions += ` <button class="btn danger" data-a="mohonTolak" data-id="${m.id}">Tolak</button>`;
    } else if (m.userId === u.id && m.status === 'dihantar') {
      actions = `<button class="btn danger" data-a="mohonBatal" data-id="${m.id}">Batalkan permohonan</button>`;
    } else if (st && isAdmin(u) && m.userId === u.id) {
      actions = '<div class="muted small">Permohonan anda sendiri perlu diluluskan oleh orang lain.</div>';
    }
    const hist = (m.history || []).slice().reverse();
    return `<div class="row between"><h2>${esc(MOHON[m.jenis].nama)}</h2>${pill(m.status)}</div>
      <div>${flagPills(flagsMohon(m))}</div>
      ${m.nota ? `<div class="notice bad"><b>Nota:</b> ${esc(m.nota)}</div>` : ''}
      <div class="tbl"><table style="min-width:0"><tbody>${rows.map(([a, b]) => `<tr><th style="width:38%">${esc(a)}</th><td style="white-space:pre-line">${esc(b)}</td></tr>`).join('')}</tbody></table></div>
      ${imgs.length ? `<div class="thumbs">${imgs.map((g) => `<img ${imgAttr(g)} alt="${esc(g.cap)}" data-a="zoom">`).join('')}</div>` : ''}
      ${actions ? `<div class="row" id="mohon-actions">${actions}</div>` : ''}
      ${hist.length ? `<details><summary class="small">Sejarah (${hist.length})</summary><ul class="small">${hist.map((h) => `<li>${esc(new Date(h.t).toLocaleString('ms-MY'))} · ${esc(userName(h.by))} · ${esc(h.act)}${h.nota ? ` · “${esc(h.nota)}”` : ''}</li>`).join('')}</ul></details>` : ''}
      <div><button class="btn" data-a="closeModal">Tutup</button></div>`;
  }

  function saveMohon(m, act, nota) {
    (m.history = m.history || []).push({ t: new Date().toISOString(), by: state.userId, act, nota: nota || '' });
    commit(`${m.jenis}: ${act}`, m.id, [['mohon', m]]);
  }
  const findMohon = (id) => (db.mohon || []).find((x) => x.id === id);

  const STAF_ACTIONS = {
    ambilLokasi() { ambilLokasi(); },
    openMohon(el) { openModal(mohonDetail(el.dataset.id)); },
    mohonStep(el) {
      const m = findMohon(el.dataset.id), u = me();
      if (!m || !canAct(m, u)) return;
      const st = stepOf(m);
      m.status = st.to; m.nota = '';
      if (st.to === 'dibayar') m.tarikhBayar = today();
      saveMohon(m, STATUS_LABEL[st.to]);
      closeModal(); toast(`${MOHON[m.jenis].pendek}: ${STATUS_LABEL[st.to].toLowerCase()}`); render();
    },
    mohonTolak(el) {
      $('#mohon-actions').outerHTML = `<form class="stack" data-form="mohonTolak" data-id="${el.dataset.id}"><label class="f">Sebab ditolak<textarea class="i" name="nota" required></textarea></label><div><button class="btn danger" type="submit">Tolak permohonan</button></div></form>`;
    },
    mohonJelas(el) {
      const m = findMohon(el.dataset.id);
      $('#mohon-actions').outerHTML = `<form class="stack" data-form="mohonJelas" data-id="${m.id}"><label class="f">Jumlah dibelanjakan ikut resit (RM)<input class="i" type="number" step="0.01" min="0" max="${esc(m.jumlah)}" name="jumlahGuna" required></label><div class="muted tiny">Baki = ${rm(m.jumlah)} tolak jumlah dibelanjakan, mesti dipulangkan kepada akaun. Pastikan resit telah direkod dalam Belian / Resit.</div><div><button class="btn primary" type="submit">Sahkan penjelasan</button></div></form>`;
    },
    mohonBatal(el) {
      if (!confirmInline(el, 'Tekan sekali lagi untuk batal')) return;
      const m = findMohon(el.dataset.id);
      m.status = 'dibatalkan'; saveMohon(m, 'Dibatalkan');
      closeModal(); toast('Permohonan dibatalkan'); render();
    },
    lokasiTapak() {
      if (!navigator.geolocation) { toast('Lokasi tidak disokong'); return; }
      toast('Mendapatkan lokasi…');
      navigator.geolocation.getCurrentPosition((p) => {
        const f = $('form[data-form=settings]');
        f.elements.namedItem('tapakLat').value = p.coords.latitude.toFixed(6);
        f.elements.namedItem('tapakLng').value = p.coords.longitude.toFixed(6);
        toast('Lokasi diisi. Tekan Simpan tetapan.');
      }, () => toast('Lokasi tidak dapat diperoleh'), { enableHighAccuracy: true, timeout: 15000 });
    },
  };

  const STAF_CHANGE = {
    kiraHari() { const f = $('form[data-form=mohon]'); const n = kiraHari(f.elements.namedItem('mula').value, f.elements.namedItem('tamat').value); $('#hari-cuti').textContent = `${n} hari bekerja (Ahad tidak dikira)`; },
    setHariHadir(el) { state.hariHadir = el.value; render(); },
    setMohonJenis(el) { state.mohonJenis = el.value; render(); },
    setMohonStatus(el) { state.mohonStatus = el.value; render(); },
  };

  const STAF_FORMS = {
    hadir(fd) {
      const d = state.draft, u = me(), t = today(), mode = d._mode;
      if (!d.foto.length) { toast('Ambil swafoto dahulu'); return; }
      const tp = tapakPoint();
      const jarak = d.gps && tp ? Math.round(jarakMeter(d.gps, tp)) : null;
      let h = db.hadir.find((x) => x.userId === u.id && x.tarikh === t);
      const foto = persistPhotos(d.foto);
      if (mode === 'masuk') {
        h = { id: uid(), userId: u.id, tarikh: t, masuk: nowTime(), keluar: '', fotoMasuk: foto, gpsMasuk: d.gps, jarakMasuk: jarak, nota: (fd.nota || '').trim() };
        db.hadir.push(h);
      } else {
        Object.assign(h, { keluar: nowTime(), fotoKeluar: foto, gpsKeluar: d.gps, jarakKeluar: jarak, nota: [h.nota, (fd.nota || '').trim()].filter(Boolean).join(' · ') });
      }
      if (commit(mode === 'masuk' ? 'masuk kerja' : 'keluar kerja', h.id, [['hadir', h]])) {
        if (CLOUD) setTimeout(() => fs.collection('hadir').doc(h.id).update({ [mode + 'Server']: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}), 300);
        else { h[mode + 'Server'] = { seconds: Math.floor(Date.now() / 1000) }; Store.save(db); }
        state.draft = null;
        const fl = flagsHadir(h);
        toast(mode === 'masuk' ? `Masuk kerja ${h.masuk} direkod${fl.length ? ' · ' + fl.join(', ') : ''}` : `Keluar kerja ${h.keluar} direkod`);
        location.hash = '#home';
      }
    },
    mohon(fd, form) {
      const jenis = form.dataset.jenis, d = state.draft;
      const m = { id: uid(), jenis, userId: state.userId, tarikh: today(), status: 'dihantar', nota: '', history: [{ t: new Date().toISOString(), by: state.userId, act: 'Dihantar' }] };
      if (jenis === 'cuti') {
        if (fd.tamat < fd.mula) { toast('Tarikh tamat sebelum tarikh mula'); return; }
        Object.assign(m, { jenisCuti: fd.jenisCuti, mula: fd.mula, tamat: fd.tamat, hari: kiraHari(fd.mula, fd.tamat), sebab: fd.sebab.trim(), lampiran: persistPhotos(d.lampiran) });
        if (!m.hari) { toast('Tempoh cuti tiada hari bekerja'); return; }
      } else if (jenis === 'pendahuluan') {
        Object.assign(m, { jumlah: num(fd.jumlah), sebab: fd.sebab.trim(), ansuran: num(fd.ansuran) || 1, bulanPotong: fd.bulanPotong });
      } else if (jenis === 'pettycash') {
        Object.assign(m, { jumlah: num(fd.jumlah), tujuan: fd.tujuan.trim(), kodId: fd.kodId || '', tarikhPerlu: fd.tarikhPerlu });
      } else {
        const km = num(fd.km), kadar = num(db.settings.kadarKm);
        let jumlah = num(fd.jumlah);
        if (fd.jenisTuntutan === 'Perjalanan (km)' && km && kadar && !jumlah) jumlah = Math.round(km * kadar * 100) / 100;
        if (!jumlah) { toast('Isi jumlah tuntutan'); return; }
        Object.assign(m, { jenisTuntutan: fd.jenisTuntutan, tarikhBelanja: fd.tarikhBelanja, jumlah, km, keterangan: fd.keterangan.trim(), kodId: fd.kodId || '', resitT: persistPhotos(d.resitT) });
      }
      db.mohon.push(m);
      if (commit(`mohon ${jenis}`, m.id, [['mohon', m]])) {
        state.draft = null;
        const f = flagsMohon(m);
        toast(`${MOHON[jenis].pendek} dihantar${f.length ? ' · ' + f.join(', ') : ''}`);
        location.hash = '#permohonan';
      }
    },
    mohonTolak(fd, form) {
      const m = findMohon(form.dataset.id);
      m.status = 'ditolak'; m.nota = fd.nota.trim(); saveMohon(m, 'Ditolak', m.nota);
      closeModal(); toast('Permohonan ditolak'); render();
    },
    mohonJelas(fd, form) {
      const m = findMohon(form.dataset.id);
      m.jumlahGuna = num(fd.jumlahGuna); m.status = 'dijelaskan'; m.tarikhJelas = today();
      saveMohon(m, `Dijelaskan · guna ${rm(m.jumlahGuna)}, baki ${rm(num(m.jumlah) - m.jumlahGuna)}`);
      closeModal(); toast('Petty cash dijelaskan'); render();
    },
  };

  // Ringkasan bulanan untuk pemprosesan gaji (input kepada sistem gaji / akaun).
  function gajiRows(ym) {
    const head = [['Nama', 'Peranan', 'Hari hadir', 'Jumlah jam', 'Hari lewat', 'Cuti tahunan', 'Cuti sakit/hospital', 'Cuti tanpa gaji', 'Cuti lain', 'Potongan pendahuluan (RM)', 'Tuntutan dibayar (RM)', 'Petty cash belum dijelaskan (RM)']];
    const inYm = (d) => (d || '').slice(0, 7) === ym;
    const cutiHari = (m) => { let n = 0; for (let t = Date.parse(m.mula); t <= Date.parse(m.tamat); t += 864e5) { const ds = new Date(t).toISOString().slice(0, 10); if (inYm(ds) && new Date(t).getUTCDay() !== 0) n++; } return n; };
    return head.concat(db.users.filter((u) => u.aktif !== false).map((u) => {
      const hs = db.hadir.filter((h) => h.userId === u.id && inYm(h.tarikh));
      const ms = (db.mohon || []).filter((m) => m.userId === u.id);
      const cuti = (types) => ms.filter((m) => m.jenis === 'cuti' && m.status === 'diluluskan' && types.includes(m.jenisCuti)).reduce((a, m) => a + cutiHari(m), 0);
      return [u.nama, PERANAN[u.peranan], hs.length, hs.reduce((a, h) => a + jamHadir(h), 0), hs.filter((h) => flagsHadir(h).includes('Lewat')).length,
        cuti(['Tahunan', 'Kecemasan']), cuti(['Sakit', 'Hospital']), cuti(['Tanpa gaji']), cuti(['Bersalin / paterniti', 'Lain-lain']),
        ms.reduce((a, m) => a + potonganBulan(m, ym), 0).toFixed(2),
        ms.filter((m) => m.jenis === 'tuntutan' && m.status === 'dibayar' && inYm(m.tarikhBayar)).reduce((a, m) => a + num(m.jumlah), 0).toFixed(2),
        ms.filter((m) => m.jenis === 'pettycash' && m.status === 'dibayar').reduce((a, m) => a + num(m.jumlah), 0).toFixed(2)];
    }));
  }


  // ---------- Modal butiran rekod ----------
  function recDetail(type, id) {
    const u = me();
    let r, flags, rows = [], imgs = [];
    if (type === 'belian') {
      r = db.belian.find((x) => x.id === id); if (!r) return '';
      flags = flagsBelian(r);
      rows = [['Tarikh', fmtDate(r.tarikh)], ['Oleh', userName(r.userId)], ['Kod kerja', (kodOf(r.kodId) || {}).kod || '—'], ['Skop', skopOf((kodOf(r.kodId) || {}).skop).nama], ['Pembekal', r.pembekal], ['No. resit', r.noResit || '—'], ['Barang', r.item], ['Jumlah', rm(r.jumlah)], ['Bayaran', r.bayaran + (r.bayaran === 'PO' ? ` · ${r.noPO || 'tiada no. PO'}` : '')]];
      imgs = (r.resit || []).map((g) => ({ img: g.img, id: g.id, cap: 'Resit' }));
    } else if (type === 'laporan') {
      r = db.laporan.find((x) => x.id === id); if (!r) return '';
      flags = flagsLaporan(r);
      rows = [['Tarikh', fmtDate(r.tarikh)], ['Oleh', userName(r.userId)], ['Kod kerja', (kodOf(r.kodId) || {}).kod || '—'], ['Skop', skopOf((kodOf(r.kodId) || {}).skop).nama], ['Lokasi', r.lokasi], ['Tugas', r.tugas], ['Pekerja', r.pekerja], ['Jam', r.jam], ['Bahan', r.bahan || '—']];
      imgs = r.gambar || [];
    } else {
      const k = db.kod.find((x) => x.id === id); if (!k) return '';
      r = Object.assign({}, k, { status: k.semak || 'disahkan' });
      flags = flagsVO(k);
      rows = [['Tarikh', fmtDate(k.tarikh)], ['Dibuka oleh', userName(k.userId)], ['Kod VO', k.kod], ['Skop', skopOf(k.skop).nama], ['Kerja', k.penerangan], ['Lokasi', k.lokasi || '—'], ['Diarahkan oleh', k.pemberiArahan || '—'], ['Cara arahan', k.caraArahan || '—'], ['Status VO', k.voStatus], ['Kos setakat ini', rm(kosKod(k.id))], ['Jam setakat ini', jamKod(k.id)]];
      imgs = (k.bukti || []).map((g) => ({ img: g.img, id: g.id, cap: 'Bukti arahan' }));
    }
    const own = r.userId === u.id;
    let actions = '';
    if (isAdmin(u) && u.peranan !== 'akaun' && !own) {
      if (r.status === 'dihantar') actions = `<button class="btn primary" data-a="review" data-v="sahkan" data-type="${type}" data-id="${id}">Sahkan</button>`;
      if (r.status === 'disahkan' && u.peranan === 'pengarah') actions = `<button class="btn primary" data-a="review" data-v="lulus" data-type="${type}" data-id="${id}">Lulus akhir</button>`;
      if (u.peranan === 'pengarah' && r.status === 'dihantar') actions += ` <button class="btn" data-a="review" data-v="lulusTerus" data-type="${type}" data-id="${id}">Sahkan &amp; lulus</button>`;
      if (['dihantar', 'disahkan'].includes(r.status)) actions += ` <button class="btn danger" data-a="review" data-v="kembali" data-type="${type}" data-id="${id}">Kembalikan</button>`;
    } else if (isAdmin(u) && own && ['dihantar', 'disahkan'].includes(r.status)) {
      actions = '<div class="muted small">Rekod anda sendiri perlu disemak oleh orang lain.</div>';
    }
    if (own && r.status === 'dikembalikan' && type !== 'vo') actions = `<a class="btn primary" href="#${type}-${id}" data-a="closeModal">Betulkan &amp; hantar semula</a>`;
    const hist = (r.history || []).slice().reverse();
    return `<div class="row between"><h2>${{ belian: 'Resit / belian', laporan: 'Laporan kerja', vo: 'Arahan kerja tambahan' }[type]}</h2>${pill(r.status)}</div>
      <div>${flagPills(flags)}</div>
      ${r.nota ? `<div class="notice bad"><b>Nota:</b> ${esc(r.nota)}</div>` : ''}
      <div class="tbl"><table style="min-width:0"><tbody>${rows.map(([a, b]) => `<tr><th style="width:38%">${esc(a)}</th><td style="white-space:pre-line">${esc(b)}</td></tr>`).join('')}</tbody></table></div>
      ${imgs.length ? `<div class="thumbs">${imgs.map((g) => `<img ${imgAttr(g)} alt="${esc(g.cap || 'Gambar')}" data-a="zoom">`).join('')}</div>` : '<div class="muted small">Tiada gambar.</div>'}
      ${actions ? `<div class="row" id="rev-actions">${actions}</div>` : ''}
      ${hist.length ? `<details><summary class="small">Sejarah (${hist.length})</summary><ul class="small">${hist.map((h) => `<li>${esc(new Date(h.t).toLocaleString('ms-MY'))} · ${esc(userName(h.by))} · ${esc(h.act)}${h.nota ? ` · “${esc(h.nota)}”` : ''}</li>`).join('')}</ul></details>` : ''}
      <div><button class="btn" data-a="closeModal">Tutup</button></div>`;
  }

  function openModal(html) {
    closeModal();
    const m = document.createElement('div');
    m.className = 'modal'; m.id = 'modal';
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`;
    setTimeout(hydrateImages, 0);
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
    document.body.appendChild(m);
    if (window.KaiserBahasa) window.KaiserBahasa.terjemah(m, bahasa());
    const f = m.querySelector('button, a, select, input'); if (f) f.focus();
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }

  // ---------- Pasang apps, apps salah, tukar PIN ----------
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installEvt = e; scheduleRender(); });
  // ---------- Pasang apps di skrin utama telefon ----------
  const sudahDipasang = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  function jenisPelayar() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua);
    if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|Telegram|; wv\)/.test(ua)) return 'dalamApps';
    if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'iosLain' : 'iosSafari';
    if (/SamsungBrowser/.test(ua)) return 'samsung';
    if (/Android/.test(ua)) return 'android';
    return 'komputer';
  }
  function kadPasang() {
    if (sudahDipasang()) return '';
    const nama = APP === 'pekerja' ? 'Kaiser Pekerja' : 'Kaiser Pengurusan';
    return `<div class="card row" style="gap:12px;align-items:center;border:2px solid #0FA3A3;margin-bottom:14px">
      <img src="${APP === 'pekerja' ? '' : BASE}icon-192.png" alt="" style="width:56px;height:56px;border-radius:12px">
      <div style="flex:1"><b>Pasang ${nama} di skrin telefon</b><div class="muted tiny">Buka terus dari skrin utama seperti apps biasa.</div></div></div>
      <button class="btn accent block" data-a="pasang" style="margin-bottom:14px;font-size:17px">📲 Pasang apps di skrin telefon</button>`;
  }
  function panduanPasang() {
    const link = location.href.replace(/#.*$/, '');
    const salin = `<button class="btn block" data-a="salinLink" data-t="${esc(link)}">Salin link apps</button>`;
    const p = {
      dalamApps: `<p><b>Anda membuka link dalam WhatsApp / apps lain.</b> Apps tidak boleh dipasang dari sini.</p><ol><li>Tekan <b>⋮</b> (atas kanan) → <b>Buka dalam Chrome</b> (iPhone: <b>Buka dalam Safari</b>).</li><li>Atau tekan <b>Salin link</b>, buka Chrome / Safari, tampal link.</li><li>Kemudian tekan butang <b>📲 Pasang</b> sekali lagi.</li></ol>${salin}`,
      iosLain: `<p><b>Di iPhone, apps hanya boleh dipasang melalui Safari.</b></p><ol><li>Tekan <b>Salin link</b>.</li><li>Buka <b>Safari</b> dan tampal link.</li><li>Tekan butang <b>Kongsi</b> ⬆️ (bawah skrin) → <b>Add to Home Screen</b> / <b>Tambah ke Skrin Utama</b> → <b>Add</b>.</li></ol>${salin}`,
      iosSafari: `<ol><li>Tekan butang <b>Kongsi</b> ⬆️ di bawah skrin.</li><li>Leret ke bawah, pilih <b>Add to Home Screen</b> / <b>Tambah ke Skrin Utama</b>.</li><li>Tekan <b>Add</b> / <b>Tambah</b>. Ikon Kaiser akan muncul di skrin utama.</li></ol>`,
      samsung: `<ol><li>Tekan <b>☰</b> (bawah kanan).</li><li>Pilih <b>Tambah halaman ke</b> → <b>Skrin utama</b>.</li><li>Tekan <b>Tambah</b>.</li></ol><p class="muted tiny">Atau buka link ini dalam Chrome dan tekan butang Pasang.</p>${salin}`,
      android: `<ol><li>Tekan <b>⋮</b> (atas kanan Chrome).</li><li>Pilih <b>Pasang apl</b> / <b>Install app</b> (atau <b>Tambah ke skrin utama</b>).</li><li>Tekan <b>Pasang</b>. Ikon Kaiser akan muncul di skrin utama.</li></ol><p class="muted tiny">Jika pilihan itu tiada: tutup Chrome sepenuhnya, buka link semula, dan cuba lagi.</p>`,
      komputer: `<p>Buka link ini di <b>telefon</b> (Chrome untuk Android, Safari untuk iPhone), kemudian tekan butang Pasang.</p>${salin}`,
    }[jenisPelayar()];
    openModal(`<h2>📲 Pasang apps di skrin telefon</h2>${p}<button class="btn primary block" data-a="tutupModal">Faham</button>`);
  }
  window.addEventListener('appinstalled', () => { state.installEvt = null; toast('Apps dipasang di skrin utama'); scheduleRender(); });
  function installHint() {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return '';
    if (state.installEvt) return `<button class="btn accent block" data-a="pasang">Pasang ${APP === 'pekerja' ? 'Kaiser Pekerja' : 'Kaiser Pengurusan'} di telefon</button>`;
    if (/iphone|ipad/i.test(navigator.userAgent)) return '<div class="muted tiny">Untuk pasang di iPhone: tekan butang Kongsi, kemudian "Add to Home Screen".</div>';
    return '<div class="muted tiny">Untuk pasang: buka menu pelayar ⋮ dan pilih "Install app" atau "Add to Home screen".</div>';
  }
  function wrongAppMsg() {
    return APP === 'pekerja'
      ? `<div class="notice">Akaun ini ialah akaun pengurusan. Sila gunakan <b>Apps Pengurusan</b>.</div><a class="btn primary block" href="${BASE}">Buka Apps Pengurusan</a><button class="btn block" data-a="logout">Log keluar</button>`
      : `<div class="notice">Akaun ini ialah akaun pekerja. Sila gunakan <b>Apps Pekerja</b> dengan ID dan PIN.</div><a class="btn primary block" href="${BASE}pekerja/">Buka Apps Pekerja</a><button class="btn block" data-a="logout">Log keluar</button>`;
  }
  function viewPin() {
    return `${topbar('Tukar PIN', '#home')}<main class="wrap"><form class="card stack" data-form="tukarPin">
      <label class="f">PIN lama<input class="i" type="password" name="pinLama" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label>
      <label class="f">PIN baharu (6 digit)<input class="i" type="password" name="pinBaru" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label>
      <label class="f">Ulang PIN baharu<input class="i" type="password" name="pinBaru2" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label>
      <button class="btn primary" type="submit">Tukar PIN</button></form></main>`;
  }

  // ================= PERINGKAT 1: KUASA, KUMPULAN & PENDAFTARAN PEKERJA =================
  const KUASA_URUS = [
    { k: 'tetapanPekerja', ikon: '🆔', label: 'Tetapan pekerja', ket: 'Daftar pekerja, ubah maklumat asas, set semula PIN, lepaskan telefon, aktif/nyahaktif. Bukan gaji, IC, bank atau kuasa.' },
    { k: 'lulusCuti', ikon: '📅', label: 'Lulus cuti', ket: 'Meluluskan permohonan cuti kumpulan.' },
    { k: 'jadual', ikon: '🗓', label: 'Jadual kerja', ket: 'Roster, syif dan tugasan harian ikut tapak.' },
    { k: 'susunKumpulan', ikon: '🧩', label: 'Susun kumpulan & pindah pekerja', ket: 'Memindahkan pekerja antara kumpulan dalam skop.' },
    { k: 'projek', ikon: '🏗', label: 'Projek & kod kerja', ket: 'Buka dan tutup projek serta kod kerja.' },
    { k: 'sahkan', ikon: '✅', label: 'Sahkan laporan & resit', ket: 'Pengesahan peringkat 1.' },
    { k: 'lihatHadir', ikon: '👀', label: 'Lihat kehadiran', ket: 'Kehadiran kumpulan.' },
    { k: 'belian', ikon: '🧾', label: 'Resit & belian', ket: 'Merekod belian dan resit.' },
    { k: 'bukaVO', ikon: '📣', label: 'Buka kod VO', ket: 'Arahan kerja tambahan klien.' },
    { k: 'jamKontrak', ikon: '👷', label: 'Rekod jam pekerja kontrak', ket: 'Direkod secara berkumpulan.' },
    { k: 'tunaiTapak', ikon: '💵', label: 'Tunai runcit tapak', ket: 'Petty cash di tapak.' },
    { k: 'pantauan', ikon: '📊', label: 'Pantauan kumpulan & projek', ket: 'Ringkasan kumpulan dan projek.' },
  ];
  const KUASA_ADMIN = [
    { k: 'aksesAdmin', ikon: '🖥', label: 'Akses Apps Admin', ket: 'Induk: tanpa ini, modul di bawah tidak aktif.', induk: true },
    { k: 'daftarPekerja', ikon: '👥', label: 'Pendaftaran pekerja', ket: 'Bukan gaji, bank atau kuasa.' },
    { k: 'adminCuti', ikon: '📅', label: 'Cuti & jadual kerja', ket: '' },
    { k: 'adminKumpulan', ikon: '🧩', label: 'Kumpulan operasi & projek', ket: '' },
    { k: 'adminSemak', ikon: '✅', label: 'Peti semakan', ket: 'Sahkan peringkat 1.' },
    { k: 'adminHadir', ikon: '👀', label: 'Kehadiran', ket: '' },
    { k: 'adminTuntutan', ikon: '💳', label: 'Tuntutan, petty cash & pendahuluan', ket: 'Semak dan tanda dibayar. Bukan lulus.' },
    { k: 'gaji', ikon: '💰', label: 'Gaji & eksport gaji', ket: 'Baca gaji, IC dan bank. Hanya Pengarah Utama boleh mengubahnya.' },
    { k: 'adminTunai', ikon: '💵', label: 'Tunai runcit & stok', ket: '' },
    { k: 'eksport', ikon: '📤', label: 'Eksport perakaunan & laporan', ket: '' },
    { k: 'dashboard', ikon: '📊', label: 'Dashboard pengurusan', ket: '' },
  ];
  const SEMUA_KUASA = KUASA_URUS.concat(KUASA_ADMIN);
  const kunci = (arr) => Object.fromEntries(arr.map((k) => [k, true]));
  const TEMPLAT_ASAS = [
    { id: 'pekerja', nama: 'Pekerja', skop: 'tiada', kuasa: {} },
    { id: 'penyelia', nama: 'Penyelia', skop: 'sendiri', kuasa: kunci(['tetapanPekerja', 'lulusCuti', 'jadual', 'sahkan', 'lihatHadir', 'belian', 'bukaVO', 'jamKontrak', 'tunaiTapak', 'pantauan']) },
    { id: 'pengurusOperasi', nama: 'Pengurus Operasi', skop: 'semua', kuasa: kunci(KUASA_URUS.map((x) => x.k).concat(['aksesAdmin', 'adminCuti', 'adminKumpulan', 'adminSemak', 'adminHadir', 'dashboard'])) },
    { id: 'pengurusProjek', nama: 'Pengurus Projek', skop: 'semua', kuasa: kunci(KUASA_URUS.map((x) => x.k).concat(['aksesAdmin', 'adminCuti', 'adminKumpulan', 'adminSemak', 'adminHadir', 'dashboard'])) },
    { id: 'kerani', nama: 'Kerani', skop: 'semua', kuasa: kunci(['aksesAdmin', 'daftarPekerja', 'adminCuti', 'adminHadir']) },
    { id: 'pengurusKewangan', nama: 'Pengurus Kewangan', skop: 'semua', kuasa: kunci(['aksesAdmin', 'adminTuntutan', 'gaji', 'adminTunai', 'eksport', 'dashboard']) },
  ];
  // Kumpulan kerja cadangan Dato' (21 Nov 2026), ikut bidang kerja Kaiser di FPG.
  const KUMPULAN_CADANGAN = ['General Worker', 'Electrical', 'Health & Safety (HSE)', 'Civil', 'Mechanical', 'Fabrication & Welding', 'Painting & Blasting', 'Air-Cond (HVAC)', 'QA/QC', 'Pentadbiran (Office)'];
  const JAWATAN_ASAS = ['Pekerja Am', 'Juruteknik', 'Juruteknik Elektrik', 'Tukang Kimpal', 'Pemandu', 'Penyelaras', 'Penyelia Tapak', 'Pengurus Tapak', 'Pengurus Projek', 'Pengurus Operasi', 'Kerani', 'Pengurus Kewangan', 'OSH-C', 'QAQC'];
  const SULIT_MEDAN = [['noIC', 'No. IC'], ['alamat', 'Alamat'], ['gajiAsas', 'Gaji asas (RM)'], ['elaun', 'Elaun tetap (RM)'], ['bank', 'Bank'], ['noAkaun', 'No. akaun bank'], ['noKWSP', 'No. KWSP'], ['noPERKESO', 'No. PERKESO']];

  const utama = (u) => !!u && (u.pengarahUtama === true || u.peranan === 'pengarah');
  const adaKuasa = (u, k) => utama(u) || !!(u && u.kuasa && u.kuasa[k]);
  const adaAdmin = (u, k) => utama(u) || (adaKuasa(u, 'aksesAdmin') && adaKuasa(u, k));
  const ikonKuasa = (u) => (utama(u) ? '👑' : SEMUA_KUASA.filter((x) => u && u.kuasa && u.kuasa[x.k]).map((x) => x.ikon).join(''));
  const skopOrang = (u) => (u && u.skopKumpulan) || [];
  const dalamSkop = (u, kid) => utama(u) || skopOrang(u).includes('semua') || skopOrang(u).includes(kid);
  const bolehDaftar = (u) => utama(u) || adaKuasa(u, 'tetapanPekerja') || adaAdmin(u, 'daftarPekerja');
  const bolehLihatGaji = (u) => utama(u) || adaAdmin(u, 'gaji');
  const biasa = (p) => !utama(p) && !Object.keys((p && p.kuasa) || {}).some((k) => p.kuasa[k]) && !skopOrang(p).length;
  const bolehUrus = (u, p) => !!p && bolehDaftar(u) && p.id !== u.id && (utama(u) || (biasa(p) && dalamSkop(u, p.kumpulanId)));
  const templatList = () => (db.templat && db.templat.length ? TEMPLAT_ASAS.map((t) => Object.assign({}, t, db.templat.find((x) => x.id === t.id) || {})).concat(db.templat.filter((x) => !TEMPLAT_ASAS.some((t) => t.id === x.id))) : TEMPLAT_ASAS);
  const templatOf = (id) => templatList().find((t) => t.id === id) || null;
  const kumpulanList = () => (db.kumpulan || []).filter((k) => k.aktif !== false);
  const kumpulanOf = (id) => (db.kumpulan || []).find((k) => k.id === id) || null;
  const kumpulanNama = (id) => (kumpulanOf(id) || {}).nama || '—';
  const jawatanList = () => (db.settings.jawatan && db.settings.jawatan.length ? db.settings.jawatan : JAWATAN_ASAS);
  const sulitOf = (id) => (db.sulit || []).find((s) => s.id === id) || {};
  const linkPekerja = () => { try { return new URL(BASE + 'pekerja/', location.href).href.replace(/#.*$/, ''); } catch (e) { return 'pekerja/'; } };
  const telWa = (t) => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '6' + d; return d; };
  // Peranan lama dikekalkan untuk keserasian: akaun PIN = pekerja, atau penyelia jika ada kuasa tab Urus.
  const perananDariKuasa = (p, kuasa) => (!p.staffId || !['pekerja', 'penyelia'].includes(p.peranan || 'pekerja') ? p.peranan : (KUASA_URUS.some((x) => kuasa && kuasa[x.k]) ? 'penyelia' : 'pekerja'));

  function statusApps(p) {
    if (p.aktif === false) return ['Dinyahaktif', 'ditolak'];
    if (!p.staffId) return ['Log masuk emel', 'diluluskan'];
    const a = p.akaunApps;
    if (!a) return ['Aktif (sebelum migrasi)', 'disahkan'];
    if (a.status === 'sementara') return (a.tamatMs || 0) < Date.now() ? ['PIN sementara tamat', 'dikembalikan'] : [`Belum aktif · PIN sementara tamat ${new Date(a.tamatMs).toLocaleDateString('ms-MY')}`, 'dihantar'];
    if (a.peranti) return [`Aktif · ${a.peranti.nama || 'telefon'}`, 'diluluskan'];
    return ['Aktif · telefon belum dikunci', 'disahkan'];
  }
  // Ringkasan kuasa untuk senarai (ikon penuh hanya jika sedikit).
  const ringkasKuasa = (p) => { if (utama(p)) return '👑'; const n = Object.keys(p.kuasa || {}).filter((k) => p.kuasa[k]).length; return n > 4 ? `<span class="pill p-disahkan">${n} kuasa</span>` : ikonKuasa(p); };
  const statusPill = (p) => { const [t, c] = statusApps(p); return `<span class="pill p-${c}">${esc(t)}</span>`; };

  // Log Pengelola: setiap tindakan pemegang kuasa direkod (tidak boleh dipadam).
  function logP(tindakan, rekod, lama, baharu) {
    const u = me();
    const e = { oleh: u.id, nama: u.nama, apps: APP, tindakan, rekod: rekod || '', lama: lama == null ? null : clean(lama), baharu: baharu == null ? null : clean(baharu) };
    if (CLOUD) return fs.collection('logPengelola').doc(uid()).set(Object.assign(e, { masa: firebase.firestore.FieldValue.serverTimestamp() })).catch((er) => console.error('logP', er));
    (db.logPengelola = db.logPengelola || []).push(Object.assign(e, { id: uid(), masa: new Date().toISOString() }));
    Store.save(db);
  }

  let Akaun = null;
  // Mod demo: tiada akaun log masuk sebenar; PIN hanya dipaparkan.
  const AkaunDemo = {
    async daftar(profil, sulit) {
      const id = normId(profil.staffId);
      if (db.users.some((u) => u.staffId === id)) throw { code: 'kaiser/id-wujud' };
      const pin = window.KaiserAkaun ? window.KaiserAkaun.pinRawak() : '123456';
      const tamatMs = Date.now() + 7 * 864e5;
      const p = Object.assign({}, profil, { id: 'P' + uid(), staffId: id, aktif: true, ver: 1, akaunApps: { status: 'sementara', peranti: null, tamatMs } });
      db.users.push(p);
      if (sulit) (db.sulit = db.sulit || []).push(Object.assign({ id: p.id }, sulit));
      Store.save(db);
      return { profilId: p.id, staffId: id, pin, tamatMs };
    },
    async setSemulaPin(u) {
      const pin = window.KaiserAkaun ? window.KaiserAkaun.pinRawak() : '123456';
      const tamatMs = Date.now() + 7 * 864e5;
      u.ver = (num(u.ver) || 1) + 1; u.akaunApps = { status: 'sementara', peranti: null, tamatMs }; Store.save(db);
      return { staffId: u.staffId, pin, tamatMs };
    },
    async lepaskanPeranti(u) { u.akaunApps = Object.assign({}, u.akaunApps || {}, { peranti: null }); Store.save(db); },
  };
  const akaun = () => { if (CLOUD && window.KaiserAkaun && fs) Akaun = Akaun || window.KaiserAkaun.buat({ fs, CFG, firebase }); return Akaun || AkaunDemo; };
  const nextStaffId = () => {
    const n = db.users.map((u) => /^K(\d+)$/.exec(u.staffId || '')).filter(Boolean).map((m) => Number(m[1]));
    return 'K' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
  };

  // ---------- Paparan: tab 👥 Pekerja ----------
  function pekerjaNav(on) {
    const u = me();
    const t = (r, ik, l, g) => `<a class="tabkad g-${g} ${on === r ? 'on' : ''}" href="#a-pekerja${r ? '-' + r : ''}"><span class="ik">${ik}</span><span>${l}</span></a>`;
    return `<div class="tabkad-baris">${t('', '📋', 'Senarai', 'op')}${bolehDaftar(u) ? t('daftar', '➕', '+ Daftar pekerja', 'hr') : ''}${bolehLihatGaji(u) ? t('gaji', '💰', 'Gaji', 'ak') : ''}${t('jawatan', '🧩', 'Jawatan, templat &amp; kumpulan', 'sy')}</div>`;
  }
  function dalamSkopSaya(p) { const u = me(); return utama(u) || isAdmin(u) || dalamSkop(u, p.kumpulanId) || p.id === u.id; }

  function viewPekerjaSenarai() {
    const u = me();
    const list = db.users.filter(dalamSkopSaya).sort((a, b) => (kumpulanNama(a.kumpulanId) + a.nama).localeCompare(kumpulanNama(b.kumpulanId) + b.nama));
    return adminShell('pekerja', `<h1>Pekerja</h1>${pekerjaNav('')}
      ${state.hasilPin ? kadPin(state.hasilPin) : ''}
      <div class="card"><div class="tbl"><table style="min-width:560px"><thead><tr><th>Nama</th><th>ID</th><th>Jawatan</th><th>Kumpulan</th><th>Apps</th></tr></thead><tbody>
      ${list.map((p) => `<tr style="cursor:pointer" data-a="bukaPekerja" data-id="${p.id}"><td style="min-width:170px"><b>${esc(p.nama)}</b><br><span title="Kuasa">${ringkasKuasa(p)}</span></td><td>${esc(p.staffId || (p.email ? 'emel' : '—'))}</td><td>${esc(p.jawatan || PERANAN[p.peranan] || '')}</td><td>${esc(kumpulanNama(p.kumpulanId))}</td><td>${statusPill(p)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Tiada pekerja.</td></tr>'}
      </tbody></table></div></div>
      ${bolehDaftar(u) ? '' : '<div class="muted small">Anda tiada kuasa mendaftar pekerja.</div>'}`);
  }

  function kadPin(h) {
    const tamat = new Date(h.tamatMs).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    const msg = `Assalamualaikum ${h.nama}.\n\nApps Kaiser Pekerja:\n${linkPekerja()}\n\n1. Buka link dalam Chrome (Android) atau Safari (iPhone), kemudian pasang apps (menu ⋮ → Install app / Kongsi → Add to Home Screen).\n2. Masuk dengan ID: ${h.staffId}\n   PIN sementara: ${h.pin}\n3. Cipta PIN baharu anda sendiri.\n\nPIN sementara tamat ${tamat}. Satu telefon untuk satu pekerja. Jangan kongsi PIN dengan sesiapa.`;
    const tel = telWa(h.telefon);
    return `<section class="card stack" style="border:2px solid var(--accent, #0FA3A3)">
      <h2>${h.baru ? '✅ Pekerja didaftarkan' : '🔑 PIN sementara baharu'}: ${esc(h.nama)}</h2>
      <div class="grid2"><div><div class="muted tiny">ID pekerja</div><div style="font-size:26px;font-weight:800">${esc(h.staffId)}</div></div>
      <div><div class="muted tiny">PIN sementara</div><div style="font-size:26px;font-weight:800;letter-spacing:3px">${esc(h.pin)}</div></div></div>
      <div class="small">PIN ini hanya dipaparkan <b>sekali</b> dan tamat <b>${esc(tamat)}</b>. Pekerja wajib menukar PIN semasa log masuk pertama.</div>
      <div class="small">Link apps: <b>${esc(linkPekerja())}</b></div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <a class="btn accent" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(msg)}">📲 Hantar melalui WhatsApp</a>
        <button class="btn" data-a="salinPin" data-t="${esc(msg)}">Salin mesej</button>
        <button class="btn" data-a="tutupPin">Tutup</button>
      </div></section>`;
  }

  // Mesej WhatsApp untuk akaun emel (Apps Pengurusan).
  const linkUrus = () => { try { return new URL(BASE + 'index.html', location.href).href.replace(/#.*$/, ''); } catch (e) { return 'index.html'; } };
  function mesejEmel(nama, email, password) {
    return `Assalamualaikum ${nama}.\n\nAkaun Apps Pengurusan Kaiser telah disediakan.\n${linkUrus()}\n\n1. Buka link dalam Chrome (Android) atau Safari (iPhone).\n2. Log masuk:\n   Emel: ${email}\n   Kata laluan: ${password || '(diberikan secara berasingan)'}\n3. Pasang apps: menu ⋮ → Install app / Kongsi → Add to Home Screen.\n\nJangan kongsi kata laluan dengan sesiapa.`;
  }
  const butangWa = (msg, tel, label) => `<a class="btn sm accent" target="_blank" rel="noopener" href="https://wa.me/${telWa(tel)}?text=${encodeURIComponent(msg)}">📲 ${label || 'WhatsApp'}</a>`;
  function kadEmel(h) {
    const msg = mesejEmel(h.nama, h.email, h.password);
    return `<section class="card stack" style="border:2px solid #0FA3A3">
      <h2>✅ Akaun emel disediakan: ${esc(h.nama)}</h2>
      <div class="small">Emel: <b>${esc(h.email)}</b><br>Kata laluan sementara: <b>${esc(h.password)}</b> <span class="muted tiny">(dipaparkan sekali sahaja)</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${butangWa(msg, '', 'Hantar melalui WhatsApp')}
        <button class="btn sm" data-a="salinPin" data-t="${esc(msg)}">Salin mesej</button>
        <button class="btn sm" data-a="tutupEmel">Tutup</button></div></section>`;
  }
  function borangKerja(p, opts) {
    const u = me(); const o = opts || {};
    const ro = o.readonly ? 'disabled' : '';
    const kumpulanBoleh = kumpulanList().filter((k) => utama(u) || dalamSkop(u, k.id) || k.id === p.kumpulanId);
    const w = p.waris || {};
    return `<div class="grid-auto">
      <label class="f">Nama penuh<input class="i" name="nama" value="${esc(p.nama)}" required ${ro}></label>
      <label class="f">ID pekerja<input class="i" name="staffId" value="${esc(p.staffId || '')}" ${o.baru ? 'required data-auto="' + esc(p.staffId || '') + '"' : 'disabled'} style="text-transform:uppercase"></label>
      <label class="f">Jawatan<input class="i" name="jawatan" list="dl-jawatan" value="${esc(p.jawatan || '')}" ${o.baru ? 'required' : ''} ${ro}></label>
      <label class="f">Jenis<select class="i" name="jenis" ${ro}>${['Tetap', 'Kontrak'].map((j) => `<option ${p.jenis === j ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
      <label class="f">Kumpulan<select class="i" name="kumpulanId" ${o.baru ? 'required' : ''} ${ro}><option value="">${kumpulanBoleh.length ? '— pilih —' : '— belum ada kumpulan —'}</option>${kumpulanBoleh.map((k) => `<option value="${k.id}" ${p.kumpulanId === k.id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></label>
      <label class="f">No. telefon<input class="i" name="telefon" inputmode="tel" value="${esc(p.telefon || '')}" placeholder="01x-xxxxxxx" ${ro}></label>
      <label class="f">Tarikh mula kerja<input class="i" type="date" name="tarikhMula" value="${esc(p.tarikhMula || '')}" ${ro}></label>
      <label class="f">Waris (nama)<input class="i" name="warisNama" value="${esc(w.nama || '')}" ${ro}></label>
      <label class="f">Waris (telefon)<input class="i" name="warisTelefon" inputmode="tel" value="${esc(w.telefon || '')}" ${ro}></label>
    </div><datalist id="dl-jawatan">${jawatanList().map((j) => `<option value="${esc(j)}">`).join('')}</datalist>`;
  }
  function borangSulit(s, ro) {
    return `<div class="grid-auto">${SULIT_MEDAN.map(([k, l]) => `<label class="f">${l}<input class="i" name="s_${k}" value="${esc(s[k] || '')}" ${ro ? 'disabled' : ''} ${/gaji|elaun/i.test(k) ? 'inputmode="decimal"' : ''}></label>`).join('')}</div>`;
  }
  const ambilSulit = (fd) => { const o = {}; SULIT_MEDAN.forEach(([k]) => { const v = (fd['s_' + k] || '').trim(); if (v) o[k] = /gaji|elaun/i.test(k) ? num(v) : v; }); return o; };
  const ambilProfil = (fd) => ({ nama: fd.nama.trim(), jawatan: (fd.jawatan || '').trim(), jenis: fd.jenis || 'Tetap', kumpulanId: fd.kumpulanId || '', telefon: (fd.telefon || '').trim(), tarikhMula: fd.tarikhMula || '', waris: { nama: (fd.warisNama || '').trim(), telefon: (fd.warisTelefon || '').trim() } });

  function viewPekerjaDaftar() {
    const u = me();
    if (!bolehDaftar(u)) return viewPekerjaSenarai();
    return adminShell('pekerja', `<h1>Daftar pekerja</h1>${pekerjaNav('daftar')}
      ${kumpulanList().length ? '' : `<div class="notice bad stack"><div><b>Belum ada kumpulan kerja dalam sistem.</b> Senarai Kumpulan akan kosong sehingga kumpulan dicipta.</div>${utama(u) ? `<div><button class="btn primary" data-a="kumpulanCadangan">Cipta 10 kumpulan kerja sekarang</button></div><div class="tiny">${esc(KUMPULAN_CADANGAN.join(', '))}</div>` : '<div>Minta Pengarah mencipta kumpulan kerja.</div>'}</div>`}
      <form class="card stack" data-form="daftarPekerja">
        <h2>Borang kerja</h2>
        ${borangKerja({ staffId: nextStaffId(), jenis: 'Tetap', kumpulanId: (kumpulanList().find((k) => dalamSkop(u, k.id)) || {}).id }, { baru: true })}
        ${utama(u) ? `<label class="f">Templat kuasa<select class="i" name="templat">${templatList().map((t) => `<option value="${t.id}">${esc(t.nama)}</option>`).join('')}</select></label>
          <div class="muted tiny">Kotak kuasa ditanda mengikut templat. Ubah satu-satu dalam profil pekerja selepas didaftarkan.</div>
          <details><summary class="small"><b>Gaji, IC &amp; bank</b> (Pengarah Utama sahaja)</summary>${borangSulit({}, false)}</details>`
        : '<div class="muted tiny">Pekerja baharu didaftarkan tanpa kuasa. Gaji, IC dan bank diisi oleh Pengarah Utama.</div>'}
        <div class="notice small">Sistem akan menjana <b>PIN sementara</b> (tamat 7 hari). Pekerja wajib menukarnya semasa log masuk pertama, dan apps akan dikunci pada telefonnya.</div>
        <button class="btn primary" type="submit">Daftar &amp; jana PIN</button>
      </form>`);
  }

  function viewPekerjaProfil(id) {
    const u = me(); const p = db.users.find((x) => x.id === id);
    if (!p || !dalamSkopSaya(p)) return viewPekerjaSenarai();
    const boleh = bolehUrus(u, p);
    // Pengarah Utama boleh mengubah borang kerja sendiri (cth. nama).
    const bolehBorang = boleh || (utama(u) && p.id === u.id);
    const pr = p.akaunApps && p.akaunApps.peranti;
    const t = templatOf(p.templat);
    const kotak = (x) => `<label class="kuasa" style="display:flex;gap:10px;align-items:flex-start;padding:8px;border:1px solid var(--line,#dde3ea);border-radius:10px">
        <input type="checkbox" name="k_${x.k}" ${p.kuasa && p.kuasa[x.k] ? 'checked' : ''} ${utama(u) && !utama(p) ? '' : 'disabled'} style="width:22px;height:22px;margin-top:2px">
        <span><b>${x.ikon} ${esc(x.label)}</b>${x.ket ? `<br><span class="muted tiny">${esc(x.ket)}</span>` : ''}</span></label>`;
    return adminShell('pekerja', `<h1>${esc(p.nama)} <span title="Kuasa">${ikonKuasa(p)}</span></h1>${pekerjaNav('')}
      ${state.hasilPin && state.hasilPin.staffId === p.staffId ? kadPin(state.hasilPin) : ''}
      <section class="card stack"><h2>Apps pekerja</h2>
        <div>${statusPill(p)} ${p.staffId ? `<span class="muted small">ID ${esc(p.staffId)}</span>` : `<span class="muted small">${esc(p.email || '')}</span>`}</div>
        ${pr ? `<div class="small">Dikunci pada: <b>${esc(pr.nama || 'telefon')}</b> sejak ${esc(new Date(pr.masa).toLocaleDateString('ms-MY'))}</div>` : ''}
        ${boleh && p.staffId ? `<div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn" data-a="pinPekerja" data-id="${p.id}">🔑 Set semula PIN</button>
          ${pr ? `<button class="btn" data-a="lepasPeranti" data-id="${p.id}">📱 Lepaskan telefon</button>` : ''}
          <button class="btn ${p.aktif === false ? 'primary' : 'danger'}" data-a="aktifPekerja" data-id="${p.id}">${p.aktif === false ? 'Aktifkan semula' : 'Nyahaktif'}</button></div>` : ''}
      </section>
      <form class="card stack" data-form="profilPekerja" data-id="${p.id}"><h2>Borang kerja</h2>
        ${borangKerja(p, { readonly: !bolehBorang })}
        ${bolehBorang ? '<div><button class="btn primary" type="submit">Simpan</button></div>' : ''}
      </form>
      <form class="card stack" data-form="kuasaPekerja" data-id="${p.id}"><h2>Kuasa</h2>
        ${utama(p) ? '<div class="small">👑 Pengarah Utama: semua kuasa.</div>' : `
        ${utama(u) ? `<div class="row" style="gap:8px;align-items:flex-end;flex-wrap:wrap"><label class="f" style="flex:1 1 200px">Templat<select class="i" name="templat">${templatList().map((x) => `<option value="${x.id}" ${p.templat === x.id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select></label><button class="btn" type="button" data-a="gunaTemplat" data-id="${p.id}">Tanda ikut templat</button></div>` : `<div class="small">Templat: <b>${esc(t ? t.nama : '—')}</b>. Hanya Pengarah Utama boleh mengubah kuasa.</div>`}
        <h3>Kumpulan 1 · tab 🛠 Urus (Apps Pekerja)</h3><div class="stack" style="gap:6px">${KUASA_URUS.map(kotak).join('')}</div>
        <h3>Kumpulan 2 · Apps Admin</h3><div class="stack" style="gap:6px">${KUASA_ADMIN.map(kotak).join('')}</div>
        <h3>Skop kumpulan</h3><div class="row" style="gap:12px;flex-wrap:wrap">
          <label class="small"><input type="checkbox" name="sk_semua" ${skopOrang(p).includes('semua') ? 'checked' : ''} ${utama(u) ? '' : 'disabled'}> Semua kumpulan</label>
          ${kumpulanList().map((k) => `<label class="small"><input type="checkbox" name="sk_${k.id}" ${skopOrang(p).includes(k.id) ? 'checked' : ''} ${utama(u) ? '' : 'disabled'}> ${esc(k.nama)}</label>`).join('')}</div>
        ${utama(u) ? '<div><button class="btn primary" type="submit">Simpan kuasa</button></div>' : ''}`}
      </form>
      ${bolehLihatGaji(u) ? `<form class="card stack" data-form="sulitPekerja" data-id="${p.id}"><h2>Gaji, IC &amp; bank ${utama(u) ? '' : '<span class="muted tiny">(baca sahaja)</span>'}</h2>
        ${borangSulit(sulitOf(p.id), !utama(u))}
        ${utama(u) ? '<div><button class="btn primary" type="submit">Simpan</button></div>' : ''}</form>` : ''}`);
  }

  function viewPekerjaGaji() {
    const u = me();
    if (!bolehLihatGaji(u)) return viewPekerjaSenarai();
    const list = db.users.filter((p) => p.aktif !== false).sort((a, b) => a.nama.localeCompare(b.nama));
    return adminShell('pekerja', `<h1>Gaji pekerja</h1>${pekerjaNav('gaji')}
      <div class="muted small">${utama(u) ? 'Tekan nama untuk mengubah.' : 'Baca sahaja. Hanya Pengarah Utama boleh mengubah gaji dan bank.'}</div>
      <div class="card"><div class="tbl"><table style="min-width:620px"><thead><tr><th>Nama</th><th>Jawatan</th><th class="n">Gaji asas</th><th class="n">Elaun</th><th>Bank</th><th>No. akaun</th></tr></thead><tbody>
      ${list.map((p) => { const s = sulitOf(p.id); return `<tr style="cursor:pointer" data-a="bukaPekerja" data-id="${p.id}"><td>${esc(p.nama)}</td><td>${esc(p.jawatan || '')}</td><td class="n">${s.gajiAsas ? rm(s.gajiAsas) : '—'}</td><td class="n">${s.elaun ? rm(s.elaun) : '—'}</td><td>${esc(s.bank || '—')}</td><td>${esc(s.noAkaun || '—')}</td></tr>`; }).join('')}
      </tbody></table></div></div>`);
  }

  function viewPekerjaJawatan() {
    const u = me(); const U = utama(u);
    const bil = (kid) => db.users.filter((p) => p.kumpulanId === kid && p.aktif !== false).length;
    const pilihOrang = (name, sel) => `<select class="i" name="${name}" ${U ? '' : 'disabled'}><option value="">—</option>${db.users.filter((p) => p.aktif !== false).map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')}</select>`;
    return adminShell('pekerja', `<h1>Jawatan, templat &amp; kumpulan</h1>${pekerjaNav('jawatan')}
      <section class="card stack"><h2>Kumpulan operasi</h2>
        <div class="muted small">Kumpulan ikut bidang kerja. Pilih penyelia dan pengurus bagi setiap kumpulan. Nama boleh ditukar bila-bila masa.</div>
        ${(db.kumpulan || []).map((k) => `<form class="row" data-form="kumpulan" data-id="${k.id}" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
          <label class="f" style="flex:2 1 180px">Nama<input class="i" name="nama" value="${esc(k.nama)}" ${U ? '' : 'disabled'}></label>
          <label class="f" style="flex:1 1 150px">Penyelia${pilihOrang('penyelia', (k.penyelia || [])[0])}</label>
          <label class="f" style="flex:1 1 150px">Pengurus${pilihOrang('pengurus', (k.pengurus || [])[0])}</label>
          <span class="small muted" style="padding-bottom:10px">${bil(k.id)} orang${k.aktif === false ? ' · tidak aktif' : ''}</span>
          ${U ? '<button class="btn sm primary" type="submit">Simpan</button>' : ''}</form>`).join('') || '<div class="muted small">Belum ada kumpulan.</div>'}
        ${U && KUMPULAN_CADANGAN.some((n) => !(db.kumpulan || []).some((k) => k.nama === n)) ? `<div><button class="btn primary" data-a="kumpulanCadangan">Cipta kumpulan cadangan (${KUMPULAN_CADANGAN.filter((n) => !(db.kumpulan || []).some((k) => k.nama === n)).length})</button> <span class="muted tiny">${esc(KUMPULAN_CADANGAN.join(', '))}</span></div>` : ''}
        ${U ? `<form class="row" data-form="kumpulanBaru" style="gap:8px;align-items:flex-end"><label class="f" style="flex:1">Kumpulan baharu<input class="i" name="nama" placeholder="Contoh: Pasukan Iskandar" required></label><button class="btn" type="submit">Tambah</button></form>` : ''}
      </section>
      <section class="card stack"><h2>Templat jawatan</h2>
        <div class="tbl"><table style="min-width:420px"><thead><tr><th>Templat</th><th>Kuasa</th><th>Skop</th></tr></thead><tbody>
        ${templatList().map((t) => `<tr><td><b>${esc(t.nama)}</b></td><td>${SEMUA_KUASA.filter((x) => t.kuasa && t.kuasa[x.k]).map((x) => `<span title="${esc(x.label)}">${x.ikon}</span>`).join(' ') || '<span class="muted">tiada</span>'}</td><td class="small">${{ tiada: '—', sendiri: 'Kumpulan sendiri', semua: 'Semua / di bawahnya' }[t.skop] || esc(t.skop)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="muted tiny">Templat hanya menanda kotak secara automatik semasa mendaftar. Kuasa sebenar setiap orang diubah dalam profilnya.</div>
      </section>
      <section class="card stack"><h2>Senarai jawatan</h2>
        <div class="row" style="gap:6px;flex-wrap:wrap">${jawatanList().map((j) => `<span class="pill p-disahkan">${esc(j)}${U ? ` <a href="#" data-a="buangJawatan" data-v="${esc(j)}" aria-label="Buang">✕</a>` : ''}</span>`).join('')}</div>
        ${U ? `<form class="row" data-form="jawatanBaru" style="gap:8px;align-items:flex-end"><label class="f" style="flex:1">Jawatan baharu<input class="i" name="nama" required></label><button class="btn" type="submit">Tambah</button></form>` : ''}
      </section>`);
  }

  // ---------- Sandaran (Spark tiada sandaran automatik) ----------
  const KOLEKSI_SANDARAN = ['users', 'sulit', 'akses', 'idmap', 'peranti', 'templat', 'kumpulan', 'settings', 'meta', 'kod', 'laporan', 'belian', 'hadir', 'mohon', 'tunai', 'kiraan', 'audit', 'logPengelola'];
  function muatTurunFail(nama, teks, jenis) {
    const blob = new Blob([teks], { type: jenis || 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function buatSandaran(denganGambar) {
    const out = { apps: 'Kaiser', versi: 1, projek: CLOUD ? CFG.projectId : 'demo', masa: new Date().toISOString(), oleh: me().nama, data: {} };
    if (CLOUD) {
      const senarai = KOLEKSI_SANDARAN.concat(denganGambar ? ['gambar'] : []);
      for (const c of senarai) {
        const snap = await fs.collection(c).get();
        out.data[c] = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      }
      await fs.collection('settings').doc('main').set({ sandaranTerakhir: out.masa }, { merge: true });
    } else {
      out.data = clean(db);
      db.settings.sandaranTerakhir = out.masa; Store.save(db);
    }
    const n = Object.values(out.data).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);
    muatTurunFail(`sandaran-kaiser-${today()}.json`, JSON.stringify(out));
    logP('Muat turun sandaran', `${n} rekod${denganGambar ? ' + gambar' : ''}`);
    return n;
  }
  const hariSejakSandaran = () => { const t = db.settings.sandaranTerakhir; return t ? Math.floor((Date.now() - Date.parse(t)) / 864e5) : null; };
  function bannerSandaran() {
    if (!utama(me())) return '';
    const h = hariSejakSandaran();
    if (h !== null && h < 7) return '';
    return `<a class="notice bad" href="#a-tetapan" style="text-decoration:none;display:block"><b>💾 ${h === null ? 'Belum pernah buat sandaran.' : `Sandaran terakhir ${h} hari lalu.`}</b> Tekan untuk muat turun sandaran mingguan.</a>`;
  }

  // ---------- Migrasi peranan lama → kuasa ----------
  async function jalankanMigrasi() {
    const ops = [];
    let kums = (db.kumpulan || []).slice();
    if (!kums.length) {
      const k = { id: 'KUMUM', nama: 'Kumpulan Umum (tukar nama)', penyelia: [], pengurus: [], aktif: true };
      kums = [k]; ops.push(['kumpulan', k]);
    }
    const kDefault = kums[0].id;
    const peta = { penyelia: 'penyelia', pengurus: 'pengurusOperasi', akaun: 'pengurusKewangan', pekerja: 'pekerja' };
    const userKum = {};
    db.users.forEach((u) => {
      const c = {};
      if (u.peranan === 'pengarah' && !u.pengarahUtama) c.pengarahUtama = true;
      if (!u.templat && u.peranan !== 'pengarah') {
        const t = templatOf(peta[u.peranan] || 'pekerja');
        c.templat = t.id; c.kuasa = Object.assign({}, t.kuasa);
        c.skopKumpulan = t.skop === 'semua' ? ['semua'] : t.skop === 'sendiri' ? [u.kumpulanId || kDefault] : [];
      }
      if (!u.kumpulanId) c.kumpulanId = kDefault;
      if (u.staffId && !u.akaunApps) c.akaunApps = { status: 'aktif', peranti: null };
      userKum[u.id] = u.kumpulanId || kDefault;
      if (Object.keys(c).length) ops.push(['users', Object.assign({}, u, c), c, u]);
    });
    const rek = [];
    ['laporan', 'belian', 'hadir', 'mohon'].forEach((coll) => (db[coll] || []).forEach((r) => { if (!r.kumpulanId && userKum[r.userId]) rek.push([coll, r.id, userKum[r.userId]]); }));
    if (CLOUD) {
      const batches = []; let b = fs.batch(), n = 0;
      const add = (fn) => { fn(b); if (++n >= 400) { batches.push(b); b = fs.batch(); n = 0; } };
      ops.forEach(([coll, obj, c]) => add((bb) => (coll === 'kumpulan' ? bb.set(fs.collection(coll).doc(obj.id), clean(Object.assign({}, obj, { id: undefined }))) : bb.update(fs.collection('users').doc(obj.id), clean(c)))));
      db.users.filter((u) => u.staffId).forEach((u) => add((bb) => bb.set(fs.collection('idmap').doc(u.staffId), { profil: u.id }, { merge: true })));
      rek.forEach(([coll, id, kid]) => add((bb) => bb.update(fs.collection(coll).doc(id), { kumpulanId: kid })));
      add((bb) => bb.set(fs.collection('settings').doc('main'), { migrasi: { v: 1, masa: new Date().toISOString() } }, { merge: true }));
      batches.push(b);
      for (const x of batches) await x.commit();
    } else {
      ops.forEach(([coll, obj]) => { if (coll === 'kumpulan') (db.kumpulan = db.kumpulan || []).push(obj); else Object.assign(db.users.find((u) => u.id === obj.id), obj); });
      rek.forEach(([coll, id, kid]) => { const r = db[coll].find((x) => x.id === id); if (r) r.kumpulanId = kid; });
      db.settings.migrasi = { v: 1, masa: new Date().toISOString() }; Store.save(db);
    }
    logP('Migrasi peranan → kuasa', `${ops.length} profil/kumpulan, ${rek.length} rekod`);
    return [ops.length, rek.length];
  }

  // ---------- Apps Pekerja: log masuk pertama & kunci telefon ----------
  const PERANTI_KEY = 'kaiser_peranti_id';
  function perantiId() {
    try { let id = localStorage.getItem(PERANTI_KEY); if (!id) { id = 'D' + uid() + uid(); localStorage.setItem(PERANTI_KEY, id); } return id; } catch (e) { return 'D-tiada-storan'; }
  }
  function namaPeranti() {
    const ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone'; if (/iPad/.test(ua)) return 'iPad';
    const m = /Android [\d.]+; ([^;)]+)/.exec(ua);
    if (m) return m[1].replace(/Build.*$/, '').trim() || 'Android';
    return /Android/.test(ua) ? 'Android' : 'Komputer';
  }
  // Pulangan: null jika OK, atau kod skrin sekatan.
  async function semakPeranti(prof) {
    const dev = perantiId();
    const pr = prof.akaunApps && prof.akaunApps.peranti;
    if (pr && pr.id && pr.id !== dev) { state.sekatInfo = `Dikunci pada: ${pr.nama || 'telefon lain'} sejak ${new Date(pr.masa).toLocaleDateString('ms-MY')}.`; return 'perantiLain'; }
    const d = await fs.collection('peranti').doc(dev).get();
    if (d.exists && d.data().profil !== prof.id) return 'perantiMilikLain';
    if (!pr || !pr.id) {
      const a = Object.assign({ status: 'aktif' }, prof.akaunApps || {}, { peranti: { id: dev, nama: namaPeranti(), masa: Date.now() } });
      const b = fs.batch();
      b.update(fs.collection('users').doc(prof.id), { akaunApps: a });
      if (!d.exists) b.set(fs.collection('peranti').doc(dev), { profil: prof.id, staffId: prof.staffId || '', masa: Date.now() });
      await b.commit();
      prof.akaunApps = a;
    }
    return null;
  }
  function viewPertama() {
    return loginShell(`<form class="card stack" data-form="pinPertama">
      <h2>Selamat datang${state.pertama && state.pertama.nama ? ', ' + esc(state.pertama.nama) : ''}</h2>
      <div class="notice small"><b>Notis privasi (PDPA 2010).</b> Apps ini merekod <b>gambar swafoto dan lokasi GPS</b> hanya semasa anda menekan Masuk / Keluar Kerja, serta gambar laporan dan resit yang anda hantar. Data digunakan untuk kehadiran, gaji dan tuntutan Kaiser Engineering sahaja, dan hanya dilihat oleh pengurusan yang diberi kuasa.</div>
      <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="setuju" required style="width:20px;height:20px"> Saya faham dan bersetuju.</label>
      <label class="f">Cipta PIN baharu (6 digit)<input class="i" type="password" name="pinBaru" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label>
      <label class="f">Ulang PIN baharu<input class="i" type="password" name="pinBaru2" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label>
      <div class="muted tiny">Jangan guna tarikh lahir atau nombor mudah seperti 123456. Selepas ini apps dikunci pada telefon ini.</div>
      <button class="btn primary" type="submit">Simpan PIN &amp; mula</button>
      <button class="btn" type="button" data-a="logout">Log keluar</button></form>`);
  }
  const MESEJ_SEKAT = {
    tamat: 'PIN sementara anda sudah <b>tamat tempoh</b> (7 hari). Minta pengurus atau Pengarah set semula PIN.',
    perantiLain: 'Akaun anda <b>dikunci pada telefon lain</b>. Jika anda menukar telefon, memasang semula apps atau mengosongkan data pelayar, minta pengurus tekan <b>Lepaskan telefon</b> dalam profil anda.',
    perantiMilikLain: 'Telefon ini sudah <b>didaftarkan untuk pekerja lain</b>. Satu telefon untuk satu pekerja. Hubungi pengurus.',
  };

  // Had cubaan salah (di telefon). Sekatan pelayan sebenar menunggu Blaze; Firebase juga menyekat sementara cubaan berlebihan.
  const CUBAAN_KEY = 'kaiser_cubaan_pin';
  const cubaan = () => { try { return JSON.parse(localStorage.getItem(CUBAAN_KEY) || '{}'); } catch (e) { return {}; } };
  const setCubaan = (o) => { try { localStorage.setItem(CUBAAN_KEY, JSON.stringify(o)); } catch (e) { /* abaikan */ } };

  const PK_ACTIONS = {
    bukaPekerja(el) { state.hasilPin = null; location.hash = '#a-pekerja-p-' + el.dataset.id; },
    tutupPin() { state.hasilPin = null; render(); },
    tutupEmel() { state.hasilEmel = null; render(); },
    async salinPin(el) { try { await navigator.clipboard.writeText(el.dataset.t); toast('Mesej disalin'); } catch (e) { toast('Tidak dapat menyalin. Guna butang WhatsApp.'); } },
    async pinPekerja(el) {
      const p = db.users.find((x) => x.id === el.dataset.id);
      if (!confirmInline(el, 'Tekan sekali lagi: jana PIN baharu')) return;
      el.disabled = true;
      try {
        const r = await akaun().setSemulaPin(p);
        state.hasilPin = Object.assign({ nama: p.nama, telefon: p.telefon }, r);
        logP('Set semula PIN', `${p.staffId} ${p.nama}`);
        toast('PIN sementara baharu dijana'); render(); window.scrollTo(0, 0);
      } catch (e) { el.disabled = false; toast(authMsg(e)); }
    },
    async lepasPeranti(el) {
      const p = db.users.find((x) => x.id === el.dataset.id);
      if (!confirmInline(el, 'Tekan sekali lagi untuk lepaskan')) return;
      try { const lama = p.akaunApps && p.akaunApps.peranti; await akaun().lepaskanPeranti(p); logP('Lepaskan telefon', `${p.staffId} ${p.nama}`, lama, null); toast('Telefon dilepaskan'); render(); } catch (e) { toast(authMsg(e)); }
    },
    async aktifPekerja(el) {
      const p = db.users.find((x) => x.id === el.dataset.id);
      if (p.aktif !== false && !confirmInline(el, 'Tekan sekali lagi untuk nyahaktif')) return;
      const baru = p.aktif === false;
      p.aktif = baru;
      if (CLOUD) { try { await fs.collection('users').doc(p.id).update({ aktif: baru }); } catch (e) { p.aktif = !baru; toast(authMsg(e)); return; } } else Store.save(db);
      logP(baru ? 'Aktifkan pekerja' : 'Nyahaktif pekerja', `${p.staffId || p.email} ${p.nama}`);
      toast(baru ? 'Pekerja diaktifkan' : 'Pekerja dinyahaktif'); render();
    },
    gunaTemplat(el) {
      const form = el.closest('form'); const t = templatOf(form.elements.namedItem('templat').value);
      SEMUA_KUASA.forEach((x) => { const c = form.elements.namedItem('k_' + x.k); if (c) c.checked = !!(t.kuasa && t.kuasa[x.k]); });
      const p = db.users.find((x) => x.id === el.dataset.id);
      form.querySelectorAll('input[name^="sk_"]').forEach((c) => { c.checked = t.skop === 'semua' ? c.name === 'sk_semua' : t.skop === 'sendiri' ? c.name === 'sk_' + p.kumpulanId : false; });
      toast(`Kotak ditanda ikut templat ${t.nama}. Tekan Simpan kuasa.`);
    },
    async kumpulanCadangan(el) {
      el.disabled = true;
      const baru = KUMPULAN_CADANGAN.filter((n) => !(db.kumpulan || []).some((k) => k.nama === n)).map((nama, i) => ({ id: 'G' + uid() + i, nama, penyelia: [], pengurus: [], aktif: true }));
      try {
        if (CLOUD) { const b = fs.batch(); baru.forEach((k) => b.set(fs.collection('kumpulan').doc(k.id), clean(Object.assign({}, k, { id: undefined })))); await b.commit(); }
        else { db.kumpulan = (db.kumpulan || []).concat(baru); Store.save(db); }
        logP('Cipta kumpulan cadangan', baru.map((k) => k.nama).join(', '));
        toast(`${baru.length} kumpulan dicipta`); render();
      } catch (e) { el.disabled = false; toast(authMsg(e)); }
    },
    async buangJawatan(el) {
      if (!confirmInline(el, '✕?')) return;
      const j = jawatanList().filter((x) => x !== el.dataset.v);
      await simpanSettings({ jawatan: j }); render();
    },
    async sandaran(el) {
      el.disabled = true; const t = el.textContent; el.textContent = 'Menyediakan…';
      try { const n = await buatSandaran(!!($('#sandaranGambar') || {}).checked); toast(`Sandaran dimuat turun (${n} rekod)`); } catch (e) { console.error(e); toast('Gagal: ' + (e.code || e.message)); }
      el.disabled = false; el.textContent = t; render();
    },
    async migrasi(el) {
      if (!confirmInline(el, 'Tekan sekali lagi untuk jalankan migrasi')) return;
      el.disabled = true;
      try { const [a, b] = await jalankanMigrasi(); toast(`Migrasi selesai: ${a} profil, ${b} rekod`); } catch (e) { console.error(e); toast('Migrasi gagal: ' + (e.code || e.message)); }
      render();
    },
  };
  async function simpanSettings(c) {
    Object.assign(db.settings, c);
    if (CLOUD) await fs.collection('settings').doc('main').set(clean(c), { merge: true }); else Store.save(db);
  }

  const PK_FORMS = {
    async daftarPekerja(fd, form) {
      const u = me();
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Mendaftar…';
      try {
        // ID cadangan mungkin lapuk jika senarai pekerja dimuat selepas borang dibuka: guna ID seterusnya.
        const inp = form.elements.namedItem('staffId');
        if (inp && inp.dataset.auto && normId(fd.staffId) === inp.dataset.auto && db.users.some((x) => x.staffId === inp.dataset.auto)) fd.staffId = nextStaffId();
        const profil = Object.assign(ambilProfil(fd), { staffId: normId(fd.staffId), peranan: 'pekerja', templat: 'pekerja', kuasa: {}, skopKumpulan: [] });
        if (!profil.kumpulanId) throw { code: 'kaiser/kumpulan', message: 'Pilih kumpulan' };
        let sulit = null;
        if (utama(u)) {
          const t = templatOf(fd.templat || 'pekerja');
          profil.templat = t.id; profil.kuasa = Object.assign({}, t.kuasa);
          profil.skopKumpulan = t.skop === 'semua' ? ['semua'] : t.skop === 'sendiri' ? [profil.kumpulanId] : [];
          profil.peranan = perananDariKuasa({ staffId: profil.staffId, peranan: 'pekerja' }, profil.kuasa);
          const s = ambilSulit(fd); if (Object.keys(s).length) sulit = s;
        }
        let r;
        for (let cuba = 0; ; cuba++) {
          try { r = await akaun().daftar(profil, sulit); break; } catch (er) {
            // ID cadangan sudah diambil (senarai belum dimuat sepenuhnya): cuba nombor seterusnya.
            const m = /^K(\d+)$/.exec(profil.staffId);
            if (er && er.code === 'kaiser/id-wujud' && inp && inp.dataset.auto && m && cuba < 20) { profil.staffId = 'K' + String(Number(m[1]) + 1).padStart(3, '0'); continue; }
            throw er;
          }
        }
        state.hasilPin = Object.assign({ baru: true, nama: profil.nama, telefon: profil.telefon }, r);
        logP('Daftar pekerja', `${r.staffId} ${profil.nama}`, null, { jawatan: profil.jawatan, kumpulan: kumpulanNama(profil.kumpulanId), templat: profil.templat });
        location.hash = '#a-pekerja-p-' + r.profilId; render(); window.scrollTo(0, 0);
      } catch (e) { btn.disabled = false; btn.textContent = 'Daftar & jana PIN'; toast(e.code === 'kaiser/kumpulan' ? e.message : authMsg(e)); }
    },
    async profilPekerja(fd, form) {
      const p = db.users.find((x) => x.id === form.dataset.id);
      const c = ambilProfil(fd);
      const lama = Object.fromEntries(Object.keys(c).map((k) => [k, p[k] == null ? '' : p[k]]));
      try {
        if (CLOUD) await fs.collection('users').doc(p.id).update(clean(c)); else { Object.assign(p, c); Store.save(db); }
        logP('Ubah maklumat pekerja', `${p.staffId || p.email} ${p.nama}`, lama, c);
        toast('Disimpan');
      } catch (e) { toast(authMsg(e)); }
    },
    async kuasaPekerja(fd, form) {
      const p = db.users.find((x) => x.id === form.dataset.id);
      const kuasa = {}; SEMUA_KUASA.forEach((x) => { if (fd['k_' + x.k]) kuasa[x.k] = true; });
      const skop = fd.sk_semua ? ['semua'] : kumpulanList().filter((k) => fd['sk_' + k.id]).map((k) => k.id);
      if (Object.keys(kuasa).length && !skop.length) { toast('Pilih sekurang-kurangnya satu kumpulan dalam skop'); return; }
      const c = { templat: fd.templat || p.templat || 'pekerja', kuasa, skopKumpulan: Object.keys(kuasa).length ? skop : [], peranan: perananDariKuasa(p, kuasa) };
      const lama = { templat: p.templat || '', kuasa: p.kuasa || {}, skopKumpulan: p.skopKumpulan || [] };
      try {
        if (CLOUD) await fs.collection('users').doc(p.id).update(clean(c)); else { Object.assign(p, c); Store.save(db); }
        logP('Ubah kuasa', `${p.staffId || p.email} ${p.nama}`, lama, c);
        toast('Kuasa disimpan'); render();
      } catch (e) { toast(authMsg(e)); }
    },
    async sulitPekerja(fd, form) {
      const id = form.dataset.id; const s = ambilSulit(fd);
      try {
        if (CLOUD) await fs.collection('sulit').doc(id).set(s);
        else { db.sulit = (db.sulit || []).filter((x) => x.id !== id).concat([Object.assign({ id }, s)]); Store.save(db); }
        logP('Ubah gaji/IC/bank', userName(id));
        toast('Disimpan');
      } catch (e) { toast(authMsg(e)); }
    },
    async kumpulan(fd, form) {
      const k = (db.kumpulan || []).find((x) => x.id === form.dataset.id);
      const c = { nama: fd.nama.trim(), penyelia: fd.penyelia ? [fd.penyelia] : [], pengurus: fd.pengurus ? [fd.pengurus] : [] };
      try { if (CLOUD) await fs.collection('kumpulan').doc(k.id).update(c); else { Object.assign(k, c); Store.save(db); } logP('Ubah kumpulan', c.nama); toast('Kumpulan disimpan'); } catch (e) { toast(authMsg(e)); }
    },
    async kumpulanBaru(fd) {
      const k = { id: 'G' + uid(), nama: fd.nama.trim(), penyelia: [], pengurus: [], aktif: true };
      try { if (CLOUD) await fs.collection('kumpulan').doc(k.id).set(clean(Object.assign({}, k, { id: undefined }))); else { (db.kumpulan = db.kumpulan || []).push(k); Store.save(db); } logP('Tambah kumpulan', k.nama); toast('Kumpulan ditambah'); render(); } catch (e) { toast(authMsg(e)); }
    },
    async jawatanBaru(fd) {
      const j = jawatanList().concat([fd.nama.trim()]).filter((v, i, a) => v && a.indexOf(v) === i);
      try { await simpanSettings({ jawatan: j }); render(); } catch (e) { toast(authMsg(e)); }
    },
    async pinPertama(fd, form) {
      if (fd.pinBaru !== fd.pinBaru2) { toast('PIN tidak sepadan'); return; }
      if (/^(\d)\1{5}$/.test(fd.pinBaru) || ['123456', '654321', '012345', '123123'].includes(fd.pinBaru)) { toast('PIN terlalu mudah. Pilih nombor lain.'); return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        const cu = auth.currentUser; const pt = state.pertama;
        const dev = perantiId();
        const devDoc = await fs.collection('peranti').doc(dev).get();
        if (devDoc.exists && devDoc.data().profil !== pt.profil) { state.screen = 'perantiMilikLain'; render(); return; }
        await cu.updatePassword(fd.pinBaru);
        const b = fs.batch();
        b.update(fs.collection('akses').doc(cu.uid), { sementara: false });
        b.update(fs.collection('users').doc(pt.profil), { akaunApps: { status: 'aktif', peranti: { id: dev, nama: namaPeranti(), masa: Date.now() }, pinDitukar: Date.now() }, pdpa: Date.now() });
        if (!devDoc.exists) b.set(fs.collection('peranti').doc(dev), { profil: pt.profil, staffId: pt.staffId || '', masa: Date.now() });
        await b.commit();
        state.pertama = null; toast('PIN disimpan. Selamat bekerja!');
        await onSignedIn(cu);
      } catch (e) { btn.disabled = false; btn.textContent = 'Simpan PIN & mula'; toast(authMsg(e)); }
    },
  };

  // ================= KEMAS KINI 21 NOV: BAHASA, JAM, SYNC, LOG KEMASUKAN, MEMO =================
  const LANG_KEY = 'kaiser_bahasa';
  const bahasa = () => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ms'; } catch (e) { return 'ms'; } };
  const LOKAL = () => (bahasa() === 'en' ? 'en-MY' : 'ms-MY');

  // Jam digital & tarikh semasa (dikemas kini setiap saat tanpa melukis semula skrin).
  const jamDigital = () => '<div class="jam" data-jam aria-live="off"></div>';
  function kemasJam() {
    const els = document.querySelectorAll('[data-jam]');
    if (!els.length) return;
    const d = new Date();
    const tarikh = d.toLocaleDateString(LOKAL(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const masa = d.toLocaleTimeString(LOKAL(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    els.forEach((el) => { el.innerHTML = `<span class="jam-masa">${masa}</span><span class="jam-tarikh">${tarikh}</span>`; });
  }
  setInterval(kemasJam, 1000);

  // Log kemasukan: sekali bagi setiap sesi pelayar (setiap kali apps dibuka), untuk semua pengguna.
  function catatKemasukan() {
    try {
      const k = 'kaiser_logmasuk_' + APP + '_' + state.userId;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch (e) { /* abaikan */ }
    const u = me();
    logP('Log masuk', APP === 'pekerja' ? 'Apps Pekerja' : 'Apps Pengurusan', null, { peranti: namaPeranti(), mod: APP === 'pekerja' && utama(u) ? 'Pengarah' : (u.staffId ? 'ID ' + u.staffId : 'emel') });
  }

  // ---------- Log kemasukan (Apps Urus, Pengarah Utama) ----------
  const masaLog = (m) => { if (!m) return 0; if (typeof m === 'string') return Date.parse(m); if (m.toMillis) return m.toMillis(); if (m.seconds) return m.seconds * 1000; return Number(m) || 0; };
  async function muatLog() {
    state.logMuat = true;
    try {
      if (CLOUD) {
        const snap = await fs.collection('logPengelola').orderBy('masa', 'desc').limit(1000).get();
        state.logData = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      } else state.logData = (db.logPengelola || []).slice();
    } catch (e) { console.error(e); toast('Gagal memuatkan log: ' + (e.code || e.message)); state.logData = []; }
    state.logMuat = false; render();
  }
  function viewLogKemasukan() {
    if (!state.logData && !state.logMuat) setTimeout(muatLog, 0);
    const f = state.logTapis || { jenis: 'masuk', apps: '', cari: '', hari: '7' };
    const dari = Date.now() - Number(f.hari || 7) * 864e5;
    const rows = (state.logData || []).map((l) => Object.assign({}, l, { ms: masaLog(l.masa) }))
      .filter((l) => l.ms >= dari)
      .filter((l) => (f.jenis === 'masuk' ? l.tindakan === 'Log masuk' : f.jenis === 'urus' ? l.tindakan !== 'Log masuk' : true))
      .filter((l) => !f.apps || (l.apps === f.apps))
      .filter((l) => !f.cari || String(l.nama || '').toLowerCase().includes(f.cari.toLowerCase()))
      .sort((a, b) => b.ms - a.ms);
    const orang = new Set(rows.filter((l) => l.tindakan === 'Log masuk').map((l) => l.oleh)).size;
    const ket = (l) => (l.tindakan === 'Log masuk' ? `${esc(l.rekod)}${l.baharu ? ` · ${esc(l.baharu.mod || '')} · ${esc(l.baharu.peranti || '')}` : ''}` : esc(l.rekod || ''));
    return adminShell('log', `<h1>Log kemasukan &amp; tindakan</h1>
      <form class="card row" data-form="tapisLog" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
        <label class="f" style="flex:1 1 150px">Jenis<select class="i" name="jenis"><option value="masuk" ${f.jenis === 'masuk' ? 'selected' : ''}>Log masuk apps</option><option value="urus" ${f.jenis === 'urus' ? 'selected' : ''}>Tindakan pengelola</option><option value="semua" ${f.jenis === 'semua' ? 'selected' : ''}>Semua</option></select></label>
        <label class="f" style="flex:1 1 130px">Apps<select class="i" name="apps"><option value="">Semua</option><option value="pekerja" ${f.apps === 'pekerja' ? 'selected' : ''}>Apps Pekerja</option><option value="urus" ${f.apps === 'urus' ? 'selected' : ''}>Apps Pengurusan</option></select></label>
        <label class="f" style="flex:1 1 110px">Tempoh<select class="i" name="hari">${[['1', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['365', 'Setahun']].map(([v, l]) => `<option value="${v}" ${f.hari === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f" style="flex:2 1 160px">Nama<input class="i" name="cari" value="${esc(f.cari)}" placeholder="Cari nama"></label>
        <button class="btn primary" type="submit">Tapis</button>
        <button class="btn" type="button" data-a="muatLog">⟳ Muat semula</button>
      </form>
      <div class="muted small">${state.logMuat ? 'Memuatkan…' : `${rows.length} rekod${f.jenis === 'masuk' ? ` · ${orang} orang` : ''}. Log tidak boleh diubah atau dipadam.`}</div>
      <div class="card"><div class="tbl"><table style="min-width:560px"><thead><tr><th>Masa</th><th>Nama</th><th>Apps</th><th>Tindakan</th><th>Butiran</th></tr></thead><tbody>
      ${rows.slice(0, 500).map((l) => `<tr><td class="small">${esc(new Date(l.ms).toLocaleString(LOKAL(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</td><td>${esc(l.nama || '')}</td><td class="small">${l.apps === 'pekerja' ? 'Pekerja' : 'Pengurusan'}</td><td>${esc(l.tindakan)}</td><td class="small">${ket(l)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Tiada rekod.</td></tr>'}
      </tbody></table></div></div>`);
  }

  // ---------- Memo & pengumuman ----------
  const memoAktif = (m) => { const t = today(); return (!m.mula || m.mula <= t) && (!m.tamat || m.tamat >= t); };
  const memoUntuk = (m, u) => !(m.kumpulan || []).length || (m.kumpulan || []).includes(u.kumpulanId) || utama(u);
  const bolehMemo = (u) => utama(u) || Object.keys(u.kuasa || {}).some((k) => u.kuasa[k]);
  function kadMemo(u) {
    const list = (db.memo || []).filter((m) => memoAktif(m) && memoUntuk(m, u)).sort((a, b) => (b.penting ? 1 : 0) - (a.penting ? 1 : 0) || (b.masa || 0) - (a.masa || 0));
    if (!list.length) return '';
    return `<section class="stack" style="gap:8px;margin-bottom:12px">${list.map((m) => `<div class="notice ${m.penting ? 'bad' : ''}" style="display:block">
      <div><b>${m.penting ? '⚠️ ' : '📢 '}${esc(m.tajuk)}</b></div>
      <div class="small" style="white-space:pre-wrap;margin-top:4px">${esc(m.isi)}</div>
      <div class="tiny muted" style="margin-top:4px">${esc(m.nama || '')} · ${esc(new Date(m.masa || Date.now()).toLocaleDateString(LOKAL()))}</div></div>`).join('')}</section>`;
  }
  function viewMemoAdmin() {
    const u = me();
    if (!bolehMemo(u)) return viewDash();
    const kums = kumpulanList().filter((k) => utama(u) || dalamSkop(u, k.id));
    const semua = utama(u) || skopOrang(u).includes('semua');
    const list = (db.memo || []).slice().sort((a, b) => (b.masa || 0) - (a.masa || 0));
    const sasaran = (m) => (!(m.kumpulan || []).length ? 'Semua pekerja' : m.kumpulan.map(kumpulanNama).join(', '));
    return adminShell('memo', `<h1>Memo &amp; pengumuman</h1>
      <div class="muted small">Memo dipaparkan di skrin utama Apps Pekerja bagi kumpulan yang ditanda, dalam tempoh yang ditetapkan.</div>
      <form class="card stack" data-form="memoBaru"><h2>Memo baharu</h2>
        <label class="f">Tajuk<input class="i" name="tajuk" required maxlength="120"></label>
        <label class="f">Mesej<textarea class="i" name="isi" rows="4" required maxlength="2000"></textarea></label>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <label class="f" style="flex:1 1 140px">Mula<input class="i" type="date" name="mula" value="${today()}"></label>
          <label class="f" style="flex:1 1 140px">Tamat<input class="i" type="date" name="tamat" value="${new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)}"></label></div>
        <div class="small"><b>Kepada:</b></div>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          ${semua ? '<label class="small"><input type="checkbox" name="kg_semua" checked> Semua pekerja</label>' : ''}
          ${kums.map((k) => `<label class="small"><input type="checkbox" name="kg_${k.id}"> ${esc(k.nama)}</label>`).join('')}</div>
        <label class="small"><input type="checkbox" name="penting"> ⚠️ Penting (dipaparkan merah, di atas)</label>
        <div><button class="btn primary" type="submit">Hantar memo</button></div>
      </form>
      <section class="card stack"><h2>Senarai memo</h2>
      ${list.map((m) => `<div class="row between" style="gap:10px;border-bottom:1px solid #e3e8ee;padding:8px 0;align-items:flex-start">
        <div><b>${m.penting ? '⚠️ ' : ''}${esc(m.tajuk)}</b> ${memoAktif(m) ? '<span class="pill p-diluluskan">Aktif</span>' : '<span class="pill p-dibatalkan">Tidak aktif</span>'}
          <div class="small" style="white-space:pre-wrap">${esc(m.isi)}</div>
          <div class="tiny muted">${esc(sasaran(m))} · ${esc(m.mula || '')} → ${esc(m.tamat || '')} · ${esc(m.nama || '')}</div></div>
        ${utama(u) || m.oleh === u.id ? `<button class="btn sm danger" data-a="padamMemo" data-id="${m.id}">Padam</button>` : ''}</div>`).join('') || '<div class="muted small">Belum ada memo.</div>'}
      </section>`);
  }

  const MOD2_ACTIONS = {
    togolMenu() { state.menuBuka = !state.menuBuka; render(); },
    loginPengarah() { state.loginPengarah = !state.loginPengarah; render(); },
    tukarBahasa() { try { localStorage.setItem(LANG_KEY, bahasa() === 'en' ? 'ms' : 'en'); } catch (e) { /* abaikan */ } render(); kemasJam(); },
    muatLog() { state.logData = null; muatLog(); },
    async sync(el) {
      if (el) el.disabled = true;
      try {
        if (CLOUD && me()) {
          await Promise.race([fs.waitForPendingWrites ? fs.waitForPendingWrites() : Promise.resolve(), new Promise((r) => setTimeout(r, 8000))]);
          Cloud.subscribe(me());
        }
        if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistration(); if (r) r.update().catch(() => {}); }
        state.syncAt = Date.now(); state.logData = null;
        toast(`Disegerakkan ${new Date().toLocaleTimeString(LOKAL(), { hour: '2-digit', minute: '2-digit', hour12: false })}`);
      } catch (e) { toast('Sync gagal: ' + (e.code || e.message)); }
      if (el) el.disabled = false;
      render();
    },
    async padamMemo(el) {
      if (!confirmInline(el, 'Padam?')) return;
      const id = el.dataset.id; const m = (db.memo || []).find((x) => x.id === id);
      try {
        if (CLOUD) await fs.collection('memo').doc(id).delete(); else { db.memo = db.memo.filter((x) => x.id !== id); Store.save(db); }
        logP('Padam memo', m ? m.tajuk : id); toast('Memo dipadam'); render();
      } catch (e) { toast(authMsg(e)); }
    },
  };
  const MOD2_FORMS = {
    tapisLog(fd) { state.logTapis = { jenis: fd.jenis, apps: fd.apps, cari: (fd.cari || '').trim(), hari: fd.hari }; render(); },
    async memoBaru(fd, form) {
      const u = me();
      const kumpulan = fd.kg_semua ? [] : kumpulanList().filter((k) => fd['kg_' + k.id]).map((k) => k.id);
      if (!fd.kg_semua && !kumpulan.length) { toast('Pilih sekurang-kurangnya satu kumpulan'); return; }
      const m = { tajuk: fd.tajuk.trim(), isi: fd.isi.trim(), mula: fd.mula || today(), tamat: fd.tamat || '', kumpulan, penting: !!fd.penting, oleh: u.id, nama: u.nama, masa: Date.now() };
      try {
        const id = uid();
        if (CLOUD) await fs.collection('memo').doc(id).set(m); else { (db.memo = db.memo || []).push(Object.assign({ id }, m)); Store.save(db); }
        logP('Hantar memo', m.tajuk, null, { kepada: kumpulan.length ? kumpulan.map(kumpulanNama).join(', ') : 'Semua' });
        toast('Memo dihantar'); form.reset(); render();
      } catch (e) { toast(authMsg(e)); }
    },
  };

  // ---------- Router ----------
  function render() {
    renderCore();
    const app = $('#app');
    kemasJam();
    if (window.KaiserBahasa) window.KaiserBahasa.terjemah(app, bahasa());
    document.documentElement.lang = bahasa();
  }
  function renderCore() {
    const app = $('#app');
    const u = me();
    const hash = location.hash.replace(/^#/, '');
    const parts = hash.split('-').filter(Boolean);
    if (!u) { app.innerHTML = viewLogin(); return; }
    if (CLOUD && u.aktif === false) { app.innerHTML = viewLogin(); return; }
    if ((APP === 'pekerja' && !isField(u) && !utama(u)) || (APP === 'urus' && !isAdmin(u))) { app.innerHTML = loginShell(wrongAppMsg()); return; }
    if (APP === 'pekerja' && parts[0] === 'a') { location.hash = '#home'; return; }
    if (APP === 'urus' && parts[0] !== 'a') { location.hash = '#a-dash'; return; }
    if (parts[0] === 'a') {
      if (!isAdmin(u)) { location.hash = '#home'; return; }
      const v = parts[1] || 'dash';
      const map = { hadir: viewAHadir, mohon: viewAMohon, dash: viewDash, semak: viewSemak, skop: () => (parts[2] ? viewSkop(parts[2]) : viewSkopList()), vo: viewVOList, kod: viewKod, tunai: viewTunai, eksport: viewEksport, tetapan: () => (utama(u) ? viewTetapan() : viewDash()), memo: viewMemoAdmin, log: () => (utama(u) ? viewLogKemasukan() : viewDash()),
        pekerja: () => ({ daftar: viewPekerjaDaftar, gaji: viewPekerjaGaji, jawatan: viewPekerjaJawatan, p: () => viewPekerjaProfil(parts[3]) }[parts[2]] || viewPekerjaSenarai)() };
      app.innerHTML = (map[v] || viewDash)();
    } else {
      const v = (parts[0] && parts[0] !== 'mula') ? parts[0] : (isAdmin(u) && APP !== 'pekerja' ? 'admin' : 'home');
      if (v === 'admin') { location.hash = '#a-dash'; return; }
      if (!['laporan', 'belian', 'vo', 'hadir', 'mohon'].includes(v)) state.draft = null;
      const map = { pin: viewPin, home: viewHome, laporan: () => viewLaporan(parts[1]), belian: () => viewBelian(parts[1]), vo: viewVO, rekod: viewRekod, hadir: viewHadir, mohon: () => viewMohon(parts[1]), permohonan: viewPermohonanSaya };
      app.innerHTML = (map[v] || viewHome)();
    }
    if (state.lastHash !== hash) window.scrollTo(0, 0);
    state.lastHash = hash;
    hydrateImages();
  }

  // Lukis semula hanya grid gambar supaya isian borang tidak hilang.
  function refreshPhotos(field) {
    const el = $('#ph-' + field); if (!el) return;
    const caps = field === 'gambar' ? ['Sebelum', 'Semasa', 'Selepas'] : field === 'foto' ? ['Swafoto'] : [''];
    el.outerHTML = photoGrid(field, caps, field === 'foto' ? 'user' : 'environment');
    hydrateImages();
  }
  function rerenderKeepForm() {
    const form = $('form[data-form]');
    const vals = form ? Object.fromEntries(new FormData(form).entries()) : {};
    render();
    const f2 = $('form[data-form]');
    if (f2) Object.entries(vals).forEach(([k, v]) => { const el = f2.elements.namedItem(k); if (el && el.type !== 'file') el.value = v; });
  }

  // ---------- Tindakan ----------
  const A = {
    login(el) { state.userId = el.dataset.id; Store.setUser(state.userId); location.hash = APP === 'urus' ? '#a-dash' : '#home'; render(); },
    pasang() {
      if (state.installEvt) { state.installEvt.prompt(); state.installEvt.userChoice.then((c) => { if (c && c.outcome !== 'accepted') panduanPasang(); }).finally(() => { state.installEvt = null; render(); }); return; }
      panduanPasang();
    },
    tutupModal() { closeModal(); },
    async salinLink(el) { try { await navigator.clipboard.writeText(el.dataset.t); toast('Link disalin'); } catch (e) { toast(el.dataset.t); } },
    resetPin(el) {
      const u = db.users.find((x) => x.id === el.dataset.id);
      el.closest('td').innerHTML = `<form class="row" data-form="resetPin" data-id="${u.id}" style="gap:6px"><input class="i" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="PIN baharu" required style="max-width:130px"><button class="btn sm primary" type="submit">Simpan</button></form>`;
    },
    logout() { state.draft = null; location.hash = '#mula'; try { Object.keys(sessionStorage).filter((k) => k.startsWith('kaiser_logmasuk_')).forEach((k) => sessionStorage.removeItem(k)); } catch (e) { /* abaikan */ } if (CLOUD && state.sesiPengarah) { try { localStorage.setItem(TANPA_PENGARAH, '1'); } catch (e) { /* abaikan */ } Cloud.stop(); location.replace(location.pathname); return; } if (CLOUD) { Cloud.stop(); auth.signOut(); return; } state.userId = null; Store.setUser(null); render(); },
    resetPw() { const em = ($('input[name=email]') || {}).value; if (!em) { toast('Isi emel dahulu'); return; } auth.sendPasswordResetEmail(em.trim()).then(() => toast('Emel tetapan semula kata laluan dihantar')).catch((e) => toast(authMsg(e))); },
    ...STAF_ACTIONS,
    ...PK_ACTIONS,
    ...MOD2_ACTIONS,
    rmPhoto(el) { state.draft[el.dataset.f].splice(Number(el.dataset.i), 1); refreshPhotos(el.dataset.f); },
    setBayaran(el) { state.draft.bayaran = el.dataset.v; rerenderKeepForm(); },
    setSkop(el) { state.draft.skop = el.dataset.v; rerenderKeepForm(); },
    openMine(el) { openModal(recDetail(el.dataset.type, el.dataset.id)); },
    openRec(el) { openModal(recDetail(el.dataset.type, el.dataset.id)); },
    closeModal() { closeModal(); },
    zoom(el) { const w = document.createElement('div'); w.className = 'modal'; w.style.zIndex = 70; w.innerHTML = `<div class="box"><img class="full" src="${el.getAttribute('src')}" alt="${esc(el.alt)}"><div class="small muted">${esc(el.alt)}</div><button class="btn">Tutup</button></div>`; w.addEventListener('click', () => w.remove()); document.body.appendChild(w); },
    review(el) {
      const { type, id, v } = el.dataset;
      if (v === 'kembali') {
        const box = $('#rev-actions');
        box.outerHTML = `<form class="stack" data-form="kembali" data-type="${type}" data-id="${id}"><label class="f">Sebab dikembalikan<textarea class="i" name="nota" required placeholder="Contoh: Gambar resit tidak jelas"></textarea></label><div class="row"><button class="btn danger" type="submit">Kembalikan kepada penyelia</button></div></form>`;
        return;
      }
      const target = type === 'belian' ? db.belian.find((x) => x.id === id) : type === 'laporan' ? db.laporan.find((x) => x.id === id) : db.kod.find((x) => x.id === id);
      if (!target) return;
      const next = v === 'sahkan' ? 'disahkan' : 'diluluskan';
      if (type === 'vo') target.semak = next; else target.status = next;
      target.nota = '';
      (target.history = target.history || []).push({ t: new Date().toISOString(), by: state.userId, act: STATUS_LABEL[next] });
      commit(`${next} ${type}`, id, [[type === 'vo' ? 'kod' : type, target]]);
      closeModal(); toast(`Rekod ${STATUS_LABEL[next].toLowerCase()}`); render();
    },
    toggleKod(el) { const k = kodOf(el.dataset.id); k.status = k.status === 'Aktif' ? 'Ditutup' : 'Aktif'; commit(`kod ${k.status}`, k.id, [['kod', k]]); render(); },
    rmUser(el) {
      if (!confirmInline(el, 'Buang?')) return;
      const u = db.users.find((x) => x.id === el.dataset.id);
      if (CLOUD) { u.aktif = false; commit('nyahaktif pengguna', u.id, [['users', u]]); }
      else { db.users = db.users.filter((x) => x.id !== el.dataset.id); commit('buang pengguna', el.dataset.id); }
      render();
    },
    reset(el) { if (!confirmInline(el, 'Tekan sekali lagi untuk padam semua')) return; db = seed(); Store.save(db); toast('Data demo diset semula'); render(); },
    csv(el) { downloadCSV(el.dataset.v); },
    csvDownload() { csvDownload(); },
    csvCopy() { csvCopy(); },
  };

  // Pengesahan dua kali tekan (tanpa dialog pelayar).
  function confirmInline(el, label) {
    if (el.dataset.armed) return true;
    el.dataset.armed = '1'; const old = el.textContent; el.textContent = window.KaiserBahasa && bahasa() === 'en' ? window.KaiserBahasa.teks(label) : label;
    setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 3000);
    return false;
  }

  const CHANGE = {
    ...STAF_CHANGE,
    setBulan(el) { state.bulan = el.value; render(); },
    voStatus(el) { const k = kodOf(el.dataset.id); k.voStatus = el.value; (k.history = k.history || []).push({ t: new Date().toISOString(), by: state.userId, act: 'Status VO: ' + el.value }); commit('status VO', k.id, [['kod', k]]); toast('Status VO dikemas kini'); },
  };

  const FORMS = {
    ...STAF_FORMS,
    ...PK_FORMS,
    ...MOD2_FORMS,
    laporan(fd, form) {
      const id = state.draft._id;
      const data = { tarikh: fd.tarikh, kodId: fd.kodId, lokasi: fd.lokasi.trim(), tugas: fd.tugas.trim(), pekerja: fd.pekerja.trim(), jam: num(fd.jam), bahan: fd.bahan.trim(), gambar: persistPhotos(state.draft.gambar) };
      let r;
      if (id) {
        r = db.laporan.find((x) => x.id === id);
        Object.assign(r, data, { status: 'dihantar' });
        (r.history = r.history || []).push({ t: new Date().toISOString(), by: state.userId, act: 'Dihantar semula' });
      } else {
        r = Object.assign({ id: uid(), userId: state.userId, status: 'dihantar', nota: '', history: [{ t: new Date().toISOString(), by: state.userId, act: 'Dihantar' }] }, data);
        db.laporan.push(r);
      }
      if (commit('hantar laporan', r.id, [['laporan', r]])) { state.draft = null; toast('Laporan dihantar'); location.hash = '#home'; }
    },
    belian(fd) {
      const id = state.draft._id;
      const data = { tarikh: fd.tarikh, kodId: fd.kodId, pembekal: fd.pembekal.trim(), noResit: (fd.noResit || '').trim(), item: fd.barang.trim(), jumlah: num(fd.jumlah), bayaran: state.draft.bayaran, noPO: state.draft.bayaran === 'PO' ? (fd.noPO || '').trim() : '', resit: persistPhotos(state.draft.resit) };
      let r;
      if (id) {
        r = db.belian.find((x) => x.id === id);
        Object.assign(r, data, { status: 'dihantar' });
        (r.history = r.history || []).push({ t: new Date().toISOString(), by: state.userId, act: 'Dihantar semula' });
      } else {
        r = Object.assign({ id: uid(), userId: state.userId, status: 'dihantar', nota: '', history: [{ t: new Date().toISOString(), by: state.userId, act: 'Dihantar' }] }, data);
        db.belian.push(r);
      }
      const f = flagsBelian(r);
      if (commit('hantar resit', r.id, [['belian', r]])) { state.draft = null; toast(f.length ? `Dihantar dengan bendera: ${f.join(', ')}` : 'Resit dihantar'); location.hash = '#home'; }
    },
    vo(fd) {
      if (!state.draft.skop) { toast('Pilih skop kerja'); return; }
      const n = db.kod.filter((k) => k.jenis === 'VO').length + 1;
      let kod = `${db.settings.prefix}-VO-${String(n).padStart(3, '0')}`;
      while (db.kod.some((k) => k.kod === kod)) kod = kod.replace(/(\d+)$/, (m) => String(Number(m) + 1).padStart(3, '0'));
      const vk = { id: uid(), kod, penerangan: fd.penerangan.trim(), skop: state.draft.skop, jenis: 'VO', bajet: 0, status: 'Aktif', voStatus: 'Sedang dijalankan', lokasi: fd.lokasi.trim(), pemberiArahan: fd.pemberiArahan.trim(), caraArahan: fd.caraArahan, bukti: persistPhotos(state.draft.bukti), semak: 'dihantar', userId: state.userId, tarikh: today(), history: [{ t: new Date().toISOString(), by: state.userId, act: 'VO dibuka' }] };
      db.kod.push(vk);
      if (commit('buka VO', kod, [['kod', vk]])) { state.draft = null; toast(`Kod ${kod} dibuka. Gunakan kod ini untuk laporan dan resit.`); location.hash = '#home'; }
    },
    kembali(fd, form) {
      const { type, id } = form.dataset;
      const t = type === 'belian' ? db.belian.find((x) => x.id === id) : type === 'laporan' ? db.laporan.find((x) => x.id === id) : db.kod.find((x) => x.id === id);
      if (type === 'vo') t.semak = 'dikembalikan'; else t.status = 'dikembalikan';
      t.nota = fd.nota.trim();
      (t.history = t.history || []).push({ t: new Date().toISOString(), by: state.userId, act: 'Dikembalikan', nota: t.nota });
      commit('kembalikan ' + type, id, [[type === 'vo' ? 'kod' : type, t]]); closeModal(); toast('Rekod dikembalikan kepada penyelia'); render();
    },
    kod(fd, form) {
      if (db.kod.some((k) => k.kod.toLowerCase() === fd.kod.trim().toLowerCase())) { toast('Kod ini sudah wujud'); return; }
      const k = { id: uid(), kod: fd.kod.trim(), penerangan: fd.penerangan.trim(), skop: fd.skop, jenis: fd.jenis, bajet: num(fd.bajet), status: 'Aktif', tarikh: today(), userId: state.userId };
      if (k.jenis === 'VO') Object.assign(k, { voStatus: 'Sedang dijalankan', bukti: [], history: [] });
      db.kod.push(k); commit('buka kod', k.kod, [['kod', k]]); toast('Kod kerja disimpan'); render();
    },
    topup(fd) { const t = { id: uid(), tarikh: today(), jumlah: num(fd.jumlah), catatan: fd.catatan, oleh: state.userId }; db.tunai.push(t); commit('top-up tunai', '', [['tunai', t]]); toast('Top-up direkod'); render(); },
    kiraan(fd) { const jangka = bakiTunai().baki; const kr = { id: uid(), tarikh: today(), jumlah: num(fd.jumlah), jangka, oleh: state.userId }; db.kiraan.push(kr); commit('kiraan tunai', '', [['kiraan', kr]]); const v = num(fd.jumlah) - jangka; toast(Math.abs(v) < 0.005 ? 'Kiraan sepadan' : `Varians ${rm(v)}: perlu dijelaskan`); render(); },
    settings(fd) { Object.assign(db.settings, { klien: fd.klien, prefix: fd.prefix, hadTunai: num(fd.hadTunai), imprest: num(fd.imprest), waktuMasuk: fd.waktuMasuk || '08:00', kadarKm: num(fd.kadarKm), hadPendahuluan: num(fd.hadPendahuluan), hariJelasPetty: num(fd.hariJelasPetty) || 7, tapakLat: (fd.tapakLat || '').trim(), tapakLng: (fd.tapakLng || '').trim(), radius: num(fd.radius) || 500 }); commit('tetapan', '', [['settings', Object.assign({ id: 'main' }, db.settings)]]); toast('Tetapan disimpan'); render(); },
    user(fd, form) {
      if (!CLOUD) { db.users.push({ id: uid(), nama: fd.nama.trim(), peranan: fd.peranan, pengarahUtama: fd.peranan === 'pengarah', tarikhMula: fd.tarikhMula || '' }); commit('tambah pengguna', fd.nama); toast('Pengguna ditambah'); render(); return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Mendaftar…';
      const field = false;
      if (field && (!normId(fd.staffId) || !/^[0-9]{6}$/.test(fd.pin || ''))) { btn.disabled = false; btn.textContent = 'Tambah pengguna'; toast('Pekerja / Penyelia perlukan ID pekerja dan PIN 6 digit'); return; }
      if (!field && (!fd.email || (fd.password || '').length < 6)) { btn.disabled = false; btn.textContent = 'Tambah pengguna'; toast('Pengurusan perlukan emel dan kata laluan (sekurang-kurangnya 6 aksara)'); return; }
      (field ? createPinUser(fd) : createCloudUser(fd)).then(() => { if (!field) state.hasilEmel = { nama: fd.nama.trim(), email: fd.email.trim().toLowerCase(), password: fd.password }; toast(field ? `${fd.nama} didaftarkan. ID ${normId(fd.staffId)}, PIN seperti ditetapkan.` : `${fd.nama} didaftarkan. Beri emel dan kata laluan sementara kepadanya.`); render(); })
        .catch((e) => { btn.disabled = false; btn.textContent = 'Tambah pengguna'; toast(authMsg(e)); });
    },
    login(fd, form) {
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Masuk…';
      auth.signInWithEmailAndPassword(fd.email.trim(), fd.password).catch((e) => { btn.disabled = false; btn.textContent = 'Log masuk'; toast(authMsg(e)); });
    },
    bootstrap(fd) { bootstrapSystem(fd.nama.trim()); },
    async loginPin(fd, form) {
      const c = cubaan();
      if (c.sehingga && c.sehingga > Date.now()) { toast(`Terlalu banyak PIN salah. Cuba lagi selepas ${Math.ceil((c.sehingga - Date.now()) / 60000)} minit.`); return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Masuk…';
      const salah = () => {
        const n = (cubaan().n || 0) + 1;
        if (n >= 5) { setCubaan({ n: 0, sehingga: Date.now() + 15 * 60000 }); return 'PIN salah 5 kali. Log masuk dikunci 15 minit di telefon ini.'; }
        setCubaan({ n }); return `ID atau PIN salah (${n}/5)`;
      };
      const fail = (m) => { btn.disabled = false; btn.textContent = 'Log masuk'; toast(m); };
      try {
        const id = normId(fd.staffId);
        const map = await fs.collection('idmap').doc(id).get();
        if (!map.exists || !map.data().email) { fail(salah()); return; }
        await auth.signInWithEmailAndPassword(map.data().email, fd.pin);
        setCubaan({});
      } catch (e) { fail(e && ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(e.code) ? salah() : authMsg(e)); }
    },
    async resetPin(fd, form) {
      const u = db.users.find((x) => x.id === form.dataset.id);
      try { await resetPinUser(u, fd.pin); toast(`PIN ${u.nama} telah ditukar`); render(); } catch (e) { toast(authMsg(e)); }
    },
    async tukarPin(fd, form) {
      if (fd.pinBaru !== fd.pinBaru2) { toast('PIN baharu tidak sepadan'); return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const cu = auth.currentUser;
        await cu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(cu.email, fd.pinLama));
        await cu.updatePassword(fd.pinBaru);
        toast('PIN ditukar'); location.hash = '#home';
      } catch (e) { btn.disabled = false; toast(e && e.code === 'auth/invalid-credential' ? 'PIN lama salah' : authMsg(e)); }
    },
  };

  // ---------- CSV ----------
  function downloadCSV(kind) {
    const ym = state.bulan;
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    let rows;
    if (kind === 'belian') {
      rows = [['Tarikh', 'Oleh', 'Kod kerja', 'Skop', 'Pembekal', 'No resit', 'Barang', 'Jumlah (RM)', 'Bayaran', 'No PO', 'Status', 'Bendera']]
        .concat(db.belian.filter((b) => inMonth(b, ym)).map((b) => { const k = kodOf(b.kodId) || {}; return [b.tarikh, userName(b.userId), k.kod, skopOf(k.skop).nama, b.pembekal, b.noResit, b.item, num(b.jumlah).toFixed(2), b.bayaran, b.noPO, STATUS_LABEL[b.status], flagsBelian(b).join('; ')]; }));
    } else if (kind === 'laporan') {
      rows = [['Tarikh', 'Oleh', 'Kod kerja', 'Skop', 'Lokasi', 'Tugas', 'Pekerja', 'Jam', 'Bahan', 'Status']]
        .concat(db.laporan.filter((l) => inMonth(l, ym)).map((l) => { const k = kodOf(l.kodId) || {}; return [l.tarikh, userName(l.userId), k.kod, skopOf(k.skop).nama, l.lokasi, l.tugas, l.pekerja, l.jam, l.bahan, STATUS_LABEL[l.status]]; }));
    } else if (kind === 'gaji') {
      rows = gajiRows(ym);
    } else {
      rows = [['Kod kerja', 'Penerangan', 'Skop', 'Jenis', 'Status VO', 'Jam', 'Kos (RM)']]
        .concat(db.kod.map((k) => [k.kod, k.penerangan, skopOf(k.skop).nama, k.jenis, k.voStatus || '', jamKod(k.id, ym), kosKod(k.id, ym).toFixed(2)]).filter((r) => r[5] || Number(r[6])));
    }
    const csv = rows.map((r) => r.map(q).join(',')).join('\r\n');
    const name = `kaiser-${kind}-${ym}.csv`;
    state.csv = { csv, name };
    openModal(`<h2>${esc(name)}</h2><div class="muted small">${rows.length - 1} baris. Muat turun fail, atau salin dan tampal ke Excel / Google Sheets.</div>
      <textarea class="i" readonly style="min-height:200px;font-family:ui-monospace,monospace;font-size:12px">${esc(csv)}</textarea>
      <div class="row"><button class="btn primary" data-a="csvDownload">Muat turun CSV</button><button class="btn" data-a="csvCopy">Salin</button><button class="btn" data-a="closeModal">Tutup</button></div>`);
  }
  function csvDownload() {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + state.csv.csv], { type: 'text/csv;charset=utf-8' }));
      a.download = state.csv.name;
      document.body.appendChild(a); a.click(); a.remove();
      toast('Jika fail tidak dimuat turun, gunakan butang Salin');
    } catch (e) { toast('Muat turun tidak dibenarkan di sini. Gunakan butang Salin.'); }
  }
  async function csvCopy() {
    try { await navigator.clipboard.writeText(state.csv.csv); toast('CSV disalin'); }
    catch (e) { const t = $('#modal textarea'); if (t) { t.select(); } toast('Pilih semua teks dan salin secara manual'); }
  }

  // ---------- Pendengar acara ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const fn = A[el.dataset.a];
    if (!fn) return;
    if (el.tagName === 'A' && el.dataset.a === 'closeModal') { closeModal(); return; }
    e.preventDefault();
    fn(el);
  });
  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.file) {
      const files = [...el.files]; const field = el.dataset.file, cap = el.dataset.cap;
      for (const f of files) {
        try { state.draft[field].push({ img: await compressImage(f), cap }); }
        catch (err) { toast(err.message); }
      }
      refreshPhotos(field);
      return;
    }
    if (el.dataset && el.dataset.aChange && CHANGE[el.dataset.aChange]) CHANGE[el.dataset.aChange](el);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    const fn = FORMS[form.dataset.form];
    if (fn) fn(fd, form);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal')) closeModal(); });
  window.addEventListener('hashchange', () => { state.menuBuka = false; render(); });
  window.addEventListener('online', () => scheduleRender());
  window.addEventListener('offline', () => scheduleRender());
  document.addEventListener('focusout', () => { if (state.pendingRender) setTimeout(scheduleRender, 50); });

  // Lukis semula bila data awan berubah, tanpa mengganggu borang yang sedang diisi.
  function scheduleRender() {
    clearTimeout(scheduleRender._t);
    scheduleRender._t = setTimeout(() => {
      const ae = document.activeElement;
      const typing = ae && ae.closest && ae.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
      const onForm = /^#?(laporan|belian|vo|hadir|mohon)(-|$)/.test(location.hash.replace(/^#/, '')) && state.draft;
      if (typing || onForm) { state.pendingRender = true; return; }
      state.pendingRender = false;
      if ($('form[data-form]')) rerenderKeepForm(); else render();
    }, 120);
  }

  const AUTH_MSG = {
    'auth/invalid-credential': 'Emel atau kata laluan salah', 'auth/wrong-password': 'Emel atau kata laluan salah', 'auth/user-not-found': 'Emel atau kata laluan salah',
    'auth/invalid-email': 'Format emel tidak sah', 'auth/too-many-requests': 'Terlalu banyak cubaan. Cuba sebentar lagi.', 'auth/network-request-failed': 'Tiada sambungan internet',
    'auth/email-already-in-use': 'Emel / ID ini sudah didaftarkan', 'kaiser/id-wujud': 'ID pekerja ini sudah digunakan', 'kaiser/pin': 'PIN mesti 6 digit', 'auth/requires-recent-login': 'Sila log keluar dan masuk semula, kemudian cuba lagi', 'auth/weak-password': 'Kata laluan terlalu lemah (sekurang-kurangnya 6 aksara)', 'auth/operation-not-allowed': 'Log masuk emel belum dihidupkan dalam Firebase',
  };
  function authMsg(e) { return AUTH_MSG[e && e.code] || ('Ralat: ' + ((e && (e.code || e.message)) || 'tidak diketahui')); }

  // Pengarah mendaftar pengguna baharu menggunakan apps Firebase kedua, supaya sesi Pengarah tidak terputus.
  async function createCloudUser(fd) {
    const sec = firebase.apps.find((a) => a.name === 'daftar') || firebase.initializeApp(CFG, 'daftar');
    const sa = sec.auth();
    await sa.setPersistence(firebase.auth.Auth.Persistence.NONE);
    const cred = await sa.createUserWithEmailAndPassword(fd.email.trim(), fd.password);
    const u = { id: cred.user.uid, nama: fd.nama.trim(), peranan: fd.peranan, email: fd.email.trim().toLowerCase(), aktif: true, tarikhMula: fd.tarikhMula || '', pengarahUtama: fd.peranan === 'pengarah', kumpulanId: (kumpulanList()[0] || {}).id || '' };
    await sa.signOut();
    await fs.collection('users').doc(u.id).set(clean(Object.assign({}, u, { id: undefined })));
    commit('tambah pengguna', u.email);
  }

  // Pekerja / penyelia: log masuk dengan ID + PIN. Akaun Firebase menggunakan emel dalaman yang dijana daripada ID.
  async function createPinUser(fd) {
    const id = normId(fd.staffId);
    const exist = await fs.collection('idmap').doc(id).get();
    if (exist.exists) throw { code: 'kaiser/id-wujud', message: `ID ${id} sudah digunakan` };
    const sec = firebase.apps.find((a) => a.name === 'daftar') || firebase.initializeApp(CFG, 'daftar');
    const sa = sec.auth();
    await sa.setPersistence(firebase.auth.Auth.Persistence.NONE);
    const email = pinEmail(id, 1);
    const cred = await sa.createUserWithEmailAndPassword(email, fd.pin);
    await sa.signOut();
    const profil = 'P' + uid();
    const b = fs.batch();
    b.set(fs.collection('users').doc(profil), { nama: fd.nama.trim(), peranan: fd.peranan, staffId: id, authUid: cred.user.uid, ver: 1, aktif: true, tarikhMula: fd.tarikhMula || '' });
    b.set(fs.collection('akses').doc(cred.user.uid), { profil, staffId: id });
    b.set(fs.collection('idmap').doc(id), { email });
    await b.commit();
    commit('tambah pekerja', id);
  }
  // Set semula PIN: cipta akaun log masuk baharu (versi seterusnya) dan pautkan kepada profil yang sama.
  async function resetPinUser(u, pin) {
    if (!/^[0-9]{6}$/.test(pin || '')) throw { code: 'kaiser/pin', message: 'PIN mesti 6 digit' };
    const ver = (num(u.ver) || 1) + 1, email = pinEmail(u.staffId, ver);
    const sec = firebase.apps.find((a) => a.name === 'daftar') || firebase.initializeApp(CFG, 'daftar');
    const sa = sec.auth();
    await sa.setPersistence(firebase.auth.Auth.Persistence.NONE);
    const cred = await sa.createUserWithEmailAndPassword(email, pin);
    await sa.signOut();
    const b = fs.batch();
    b.set(fs.collection('akses').doc(cred.user.uid), { profil: u.id, staffId: u.staffId });
    if (u.authUid) b.delete(fs.collection('akses').doc(u.authUid));
    b.set(fs.collection('idmap').doc(u.staffId), { email });
    b.update(fs.collection('users').doc(u.id), { authUid: cred.user.uid, ver });
    await b.commit();
    commit('set semula PIN', u.staffId);
  }

  async function bootstrapSystem(nama) {
    const au = state.authUser;
    try {
      const b1 = fs.batch();
      b1.set(fs.collection('users').doc(au.uid), { nama, peranan: 'pengarah', email: (au.email || '').toLowerCase(), aktif: true });
      b1.set(fs.collection('meta').doc('bootstrap'), { by: au.uid, t: new Date().toISOString() });
      await b1.commit();
      const b2 = fs.batch();
      b2.set(fs.collection('settings').doc('main'), DEFAULT_SETTINGS);
      [['CV', 'Kerja sivil am', 'sivil'], ['EL', 'Kerja elektrik am', 'elektrik'], ['MK', 'Kerja mekanikal am', 'mekanikal'], ['AC', 'Servis dan pembaikan penghawa dingin', 'ac'], ['FB', 'Fabrikasi dan struktur keluli', 'fabrikasi'], ['CT', 'Pengecatan dan sand blasting', 'cat'], ['PM', 'Penyelenggaraan fasiliti', 'fasiliti'], ['TK', 'Bekalan tenaga kerja', 'tenaga']]
        .forEach(([c, p, sk]) => { const id = uid(); b2.set(fs.collection('kod').doc(id), { kod: `${DEFAULT_SETTINGS.prefix}-${c}-001`, penerangan: p, skop: sk, jenis: 'Kontrak', bajet: 0, status: 'Aktif', tarikh: today(), userId: au.uid }); });
      await b2.commit();
      await onSignedIn(au);
      toast('Sistem disediakan. Tambah pengguna dalam Tetapan.');
    } catch (e) { console.error(e); toast('Gagal sediakan sistem: ' + (e.code || e.message)); }
  }

  async function onSignedIn(user) {
    state.authUser = user;
    try {
      // Akaun PIN dipetakan kepada profil pekerja yang tetap (supaya rekod kekal bila PIN diset semula).
      let pid = user.uid, ak = null;
      try { const a = await fs.collection('akses').doc(user.uid).get(); if (a.exists) { ak = a.data(); pid = ak.profil; } } catch (e) { /* tiada pemetaan */ }
      // PIN sementara: tamat selepas 7 hari, atau wajib ditukar (log masuk pertama).
      if (ak && ak.sementara) {
        if ((ak.tamatMs || 0) < Date.now()) { state.userId = null; state.screen = 'tamat'; render(); return; }
        if (APP === 'pekerja') {
          let nama = '';
          try { const s0 = await fs.collection('users').doc(pid).get(); if (s0.exists) nama = s0.data().nama; } catch (e) { /* abaikan */ }
          state.userId = null; state.pertama = { profil: pid, staffId: ak.staffId, nama }; state.screen = 'pertama'; render(); return;
        }
      }
      const snap = await fs.collection('users').doc(pid).get();
      if (snap.exists && snap.data().aktif !== false) {
        const prof = Object.assign({ id: pid }, snap.data());
        if ((APP === 'pekerja' && !isField(prof) && !utama(prof)) || (APP === 'urus' && !isAdmin(prof))) {
          db.users = [prof]; state.userId = null; state.screen = 'wrongapp'; render(); return;
        }
        // Apps Pekerja: satu telefon untuk satu pekerja.
        if (APP === 'pekerja' && !utama(prof)) {
          const sekat = await semakPeranti(prof);
          if (sekat) { state.userId = null; state.screen = sekat; render(); return; }
        }
        db.users = [prof].concat(db.users.filter((x) => x.id !== pid));
        state.userId = pid; state.screen = null; state.loginPengarah = false;
        Cloud.subscribe(prof);
        catatKemasukan();
        const h = location.hash.replace(/^#/, '');
        if (!h || h === 'mula') location.hash = APP === 'pekerja' ? '#home' : '#a-dash';
        render();
        return;
      }
      if (APP === 'pekerja') { state.userId = null; state.screen = 'notreg'; render(); return; }
      let boot = true;
      try { boot = (await fs.collection('meta').doc('bootstrap').get()).exists; } catch (e) { boot = true; }
      state.userId = null; state.screen = boot ? 'notreg' : 'bootstrap'; render();
    } catch (e) {
      console.error(e); state.screen = null; toast('Gagal memuatkan profil: ' + (e.code || e.message)); render();
    }
  }

  // Apps Pekerja: pilih sesi. Pengarah Utama yang sudah log masuk di Apps Pengurusan (pelayar yang sama)
  // terus masuk ke Apps Pekerja tanpa ID / PIN. Tiada kata laluan dihantar antara apps.
  async function pilihSesi() {
    const tunggu = (a) => new Promise((r) => { let siap = false; a.onAuthStateChanged((u) => { if (!siap) { siap = true; r(u); } }); });
    const dariUrus = /[?&]pengarah=1/.test(location.search);
    if (dariUrus) {
      try { localStorage.removeItem(TANPA_PENGARAH); } catch (e) { /* abaikan */ }
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* abaikan */ }
    }
    let tolak = false; try { tolak = !!localStorage.getItem(TANPA_PENGARAH); } catch (e) { /* abaikan */ }
    const [uP, uU] = await Promise.all([tunggu(fbPekerja.auth()), tunggu(fbUtama.auth())]);
    if (uU && (dariUrus || (!uP && !tolak))) {
      try {
        const fsU = fbUtama.firestore();
        const d = await fsU.collection('users').doc(uU.uid).get();
        if (d.exists && d.data().aktif !== false && utama(d.data())) { gunaSesi(fbUtama, false); state.sesiPengarah = true; return; }
      } catch (e) { console.error('sesi pengarah', e); }
    }
    gunaSesi(fbPekerja, true);
  }

  if (CLOUD) {
    render();
    (APP === 'pekerja' ? pilihSesi() : Promise.resolve()).then(() => auth.onAuthStateChanged((user) => {
      if (!user) { Cloud.stop(); db = emptyDb(); state.userId = null; state.authUser = null; state.screen = null; render(); return; }
      onSignedIn(user);
    }));
  } else {
    if (!Store.load()) Store.save(db);
    render();
  }

  // Pasang service worker untuk kegunaan luar talian (hanya di https / localhost, bukan dalam iframe pratonton).
  try {
    if ('serviceWorker' in navigator && window.top === window.self && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) { /* abaikan */ }
})();
