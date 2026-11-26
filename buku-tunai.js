/* Kaiser · buku-tunai.js — Buku Petty Cash (Peringkat 1).
 *
 * Modul berasingan supaya app.js tidak bertambah besar. app.js menghantar "ctx" (pembantu dan data) melalui
 * window.KaiserBuku.buat(ctx), dan mendapat semula paparan, borang, tindakan serta kuasa.
 *
 * Koleksi Firestore:
 *   bukuTunai  : satu baris = satu transaksi (jenis: masuk | keluar | buka). Tidak boleh dipadam.
 *                Pembetulan dibuat melalui entri songsang. Status: dihantar -> disahkan | dikembalikan.
 *   bopa       : daftar Blanket Order Purchase Award (BOPA). Belian bahan dikaitkan dengan no. BOPA.
 *   settings/main : bukuKategori[], bukuPembekal[], bukuLokasi[] (senarai pilihan, diurus Pengarah Utama).
 *
 * Kuasa:
 *   rekod  : Pengarah Utama, 💵 tunaiTapak (Site Manager), atau 💵 adminTunai (Admin).
 *   semak  : Pengarah Utama atau ✅ adminSemak (Operations Manager). Tidak boleh sahkan rekod sendiri.
 *   BOPA   : Pengarah Utama, 🏗 projek atau 🧩 adminKumpulan.
 *   B/F, tetapan senarai, import: Pengarah Utama sahaja.
 */
(function () {
  'use strict';

  const KATEGORI0 = ['Petrol', 'Makan', 'Hardware', 'Elektrik', 'Kenderaan', 'Top-up', 'Lain-lain'];
  const PEMBEKAL0 = ['Focus', 'Petron', 'DIY', 'MK Hardware', 'Cowboy', 'MTU'];
  const LOKASI0 = ['Balok'];
  const KATEGORI_BAHAN = ['Hardware', 'Elektrik']; // belian bahan: wajib dikaitkan dengan BOPA
  const ID_BUKA = 'buka-awal';

  // Pembaca CSV ringkas (sokong petikan dan BOM).
  function parseCsv(teks) {
    const rows = []; let row = [], cur = '', q = false;
    const s = String(teks || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row);
    return rows;
  }

  function buat(c) {
    const { esc, uid, today, num, rm, fmtDate } = c;
    const db = () => c.db();
    const state = c.state;
    const list = () => { const d = db(); d.bukuTunai = d.bukuTunai || []; return d.bukuTunai; };
    const bopaList = () => { const d = db(); d.bopa = d.bopa || []; return d.bopa; };
    const tetap = () => db().settings || {};
    const pilih = (k, asal) => (Array.isArray(tetap()[k]) && tetap()[k].length ? tetap()[k] : asal);
    const kategori = () => pilih('bukuKategori', KATEGORI0);
    const pembekal = () => pilih('bukuPembekal', PEMBEKAL0);
    const lokasi = () => pilih('bukuLokasi', LOKASI0);

    // ---------- Kuasa (mesti sepadan dengan firestore.rules) ----------
    const bolehRekod = (u) => !!u && (c.utama(u) || c.adaKuasa(u, 'tunaiTapak') || c.adaAdmin(u, 'adminTunai'));
    const bolehSemak = (u) => !!u && (c.utama(u) || c.adaAdmin(u, 'adminSemak'));
    const bolehLihat = (u) => bolehRekod(u) || bolehSemak(u);
    const bolehBopa = (u) => !!u && (c.utama(u) || c.adaKuasa(u, 'projek') || c.adaAdmin(u, 'adminKumpulan'));

    // ---------- Pengiraan ----------
    const hidup = (e) => e.status !== 'dikembalikan';
    const masukOf = (e) => (e.jenis === 'keluar' ? 0 : num(e.jumlah));
    const keluarOf = (e) => (e.jenis === 'keluar' ? num(e.jumlah) : 0);
    function lajur() {
      const disongsang = new Set(list().filter((e) => e.songsangDari && hidup(e)).map((e) => e.songsangDari));
      let baki = 0;
      // B/F sentiasa baris pertama (baki pembukaan), tidak kira tarikh yang ditulis.
      const dahulu = (e) => (e.jenis === 'buka' ? 0 : 1);
      return list().slice().sort((a, b) => dahulu(a) - dahulu(b) || (a.tarikh || '').localeCompare(b.tarikh || '') || (a.masa || '').localeCompare(b.masa || ''))
        .map((e) => {
          const masuk = masukOf(e), keluar = keluarOf(e);
          if (hidup(e)) baki += masuk - keluar;
          return { e, masuk, keluar, baki, songsang: disongsang.has(e.id) };
        });
    }
    function bendera(e) {
      const f = [];
      if (e.jenis === 'keluar') {
        if (!(e.resit && e.resit.length)) f.push('Bil belum ada');
        if ((KATEGORI_BAHAN.includes(e.kategori) || e.bopaTanda) && !e.noBOPA) f.push('Pilih no. BOPA');
      }
      if ((e.tarikh || '') > today()) f.push('Tarikh akan datang');
      return f;
    }
    const bulanNama = (ym) => { const [y, m] = ym.split('-'); return `${['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'][Number(m) - 1]} ${y}`; };

    function shell(body) {
      if (c.APP === 'pekerja') return `${c.topbar('Buku Petty Cash', '#home')}<main class="wrap"><div class="stack">${body}</div></main>`;
      return c.adminShell('buku', body);
    }

    // ---------- Paparan ----------
    function baris(r, u) {
      const e = r.e, fl = bendera(e);
      const meta = [e.kategori, e.pembekal, e.lokasi, e.noBOPA ? 'BOPA ' + e.noBOPA : ''].filter(Boolean).map(esc).join(' · ');
      const thumb = (e.resit || [])[0]
        ? `<img ${c.imgAttr(e.resit[0])} alt="Resit" data-a="zoom" style="width:36px;height:36px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:6px;cursor:zoom-in">` : '';
      const btn = [];
      if (bolehSemak(u) && e.status === 'dihantar' && e.oleh !== u.id) {
        btn.push(`<button class="btn sm primary" data-a="bukuSemak" data-v="sahkan" data-id="${e.id}">Sahkan</button>`);
        btn.push(`<button class="btn sm" data-a="bukuSemak" data-v="kembali" data-id="${e.id}">Kembalikan</button>`);
      }
      if (e.oleh === u.id && e.status !== 'disahkan' && e.jenis === 'keluar') btn.push(`<button class="btn sm" data-a="bukuResit" data-id="${e.id}">+ Resit</button>`);
      if (e.status === 'disahkan' && e.jenis !== 'buka' && !e.songsangDari && !r.songsang && bolehRekod(u)) btn.push(`<button class="btn sm" data-a="bukuSongsang" data-id="${e.id}">Songsang</button>`);
      const gaya = e.status === 'dikembalikan' ? 'opacity:.55;' : '';
      return `<tr style="${gaya}">
        <td>${fmtDate(e.tarikh)}</td>
        <td>${thumb}<b>${esc(e.butiran)}</b>${r.songsang ? ' <span class="pill p-dikembalikan">disongsangkan</span>' : ''}
          <div class="muted tiny">${meta || '—'}${e.noResit ? ' · Resit ' + esc(e.noResit) : ''}${e.sumber === 'import' ? ' · import' : ''}</div>
          ${fl.map((x) => `<span class="ftag">${esc(x)}</span>`).join('')}
          ${e.status === 'dikembalikan' && e.nota ? `<div class="tiny" style="color:var(--bad)">Nota: ${esc(e.nota)}</div>` : ''}
          ${e.catatan ? `<div class="muted tiny">${esc(e.catatan)}</div>` : ''}</td>
        <td class="n">${r.masuk ? rm(r.masuk) : ''}</td>
        <td class="n">${r.keluar ? rm(r.keluar) : ''}</td>
        <td class="n"><b style="${r.baki < 0 ? 'color:var(--bad)' : ''}">${rm(r.baki)}</b></td>
        <td>${c.pill(e.status)}<div class="muted tiny">${esc(c.userName(e.oleh))}</div></td>
        <td>${btn.join(' ')}</td></tr>`;
    }

    function borangBaru() {
      if (!state.draft || state.draft._form !== 'buku') state.draft = { _form: 'buku', resit: [] };
      const kods = (db().kod || []).filter((k) => k.status === 'Aktif');
      const opt = (arr) => arr.map((x) => `<option value="${esc(x)}">`).join('');
      return `<form class="card stack" data-form="bukuBaru"><h2>Tambah rekod</h2>
        <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          <label class="f">Tarikh<input class="i" type="date" name="tarikh" value="${today()}" required></label>
          <label class="f">Jenis<select class="i" name="jenis"><option value="keluar">Keluar (bayaran)</option><option value="masuk">Masuk (top-up)</option></select></label>
          <label class="f">Jumlah (RM)<input class="i" name="jumlah" type="number" min="0.01" step="0.01" required inputmode="decimal"></label>
        </div>
        <label class="f">Butiran<input class="i" name="butiran" required placeholder="Contoh: Petrol lori TV7885"></label>
        <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          <label class="f">Kategori<select class="i" name="kategori">${kategori().map((k) => `<option>${esc(k)}</option>`).join('')}</select></label>
          <label class="f">Pembekal<input class="i" name="pembekal" list="dl-pembekal" autocomplete="off"><datalist id="dl-pembekal">${opt(pembekal())}</datalist></label>
          <label class="f">Lokasi<input class="i" name="lokasi" list="dl-lokasi" autocomplete="off"><datalist id="dl-lokasi">${opt(lokasi())}</datalist></label>
        </div>
        <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          <label class="f">No. BOPA<select class="i" name="noBOPA"><option value="">— tiada —</option>${bopaList().filter((b) => b.status !== 'Ditutup').map((b) => `<option value="${esc(b.no)}">${esc(b.no)}${b.penerangan ? ' · ' + esc(b.penerangan) : ''}</option>`).join('')}</select></label>
          <label class="f">No. resit<input class="i" name="noResit"></label>
          <label class="f">Kod kerja (pilihan)<select class="i" name="kodId"><option value="">—</option>${kods.map((k) => `<option value="${k.id}">${esc(k.kod)} · ${esc(k.penerangan)}</option>`).join('')}</select></label>
        </div>
        <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Gambar resit ${c.photoGrid('resit', [''], 'environment')}</div>
        <div class="muted tiny">Bayaran tanpa resit diterima, tetapi ditanda "Bil belum ada" sehingga resit dimuat naik. Belian bahan (Hardware, Elektrik) mesti dikaitkan dengan no. BOPA.</div>
        <button class="btn primary" type="submit">Simpan rekod</button></form>`;
    }

    function ringkasBopa() {
      const keluar = list().filter((e) => hidup(e) && e.jenis === 'keluar');
      const tanpa = keluar.filter((e) => (KATEGORI_BAHAN.includes(e.kategori) || e.bopaTanda) && !e.noBOPA);
      const u = c.me();
      const baris2 = bopaList().map((b) => {
        const k = keluar.filter((e) => e.noBOPA === b.no);
        return `<tr><td><b>${esc(b.no)}</b></td><td>${esc(b.penerangan || '')}</td><td class="n">${b.nilai ? rm(b.nilai) : '—'}</td><td class="n">${k.length}</td><td class="n">${rm(k.reduce((s, e) => s + num(e.jumlah), 0))}</td><td>${esc(b.status || 'Aktif')}${bolehBopa(u) ? ` <button class="btn sm" data-a="bukuBopaToggle" data-id="${b.id}">${b.status === 'Ditutup' ? 'Buka' : 'Tutup'}</button>` : ''}</td></tr>`;
      }).join('');
      return `<section class="card stack"><h2>Ringkasan BOPA</h2>
        <div class="muted small">Jumlah belian bahan bagi setiap BOPA, untuk tuntutan kepada klien.</div>
        ${tanpa.length ? `<div class="notice"><b>${tanpa.length} rekod bahan belum dikaitkan dengan no. BOPA</b> (${rm(tanpa.reduce((s, e) => s + num(e.jumlah), 0))}).</div>` : ''}
        <div class="tbl"><table><thead><tr><th>No. BOPA</th><th>Penerangan</th><th class="n">Nilai award</th><th class="n">Rekod</th><th class="n">Belanja</th><th>Status</th></tr></thead><tbody>${baris2 || '<tr><td colspan="6" class="muted">Belum ada BOPA. Tambah di bawah.</td></tr>'}</tbody></table></div>
        ${bolehBopa(u) ? `<form class="row" data-form="bukuBopaBaru" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
          <label class="f" style="flex:1;min-width:140px">No. BOPA<input class="i" name="no" required></label>
          <label class="f" style="flex:2;min-width:180px">Penerangan<input class="i" name="penerangan"></label>
          <label class="f" style="flex:1;min-width:120px">Nilai award (RM)<input class="i" name="nilai" type="number" step="0.01" min="0"></label>
          <button class="btn" type="submit">Tambah BOPA</button></form>` : ''}
      </section>`;
    }

    function panelPengarah() {
      const buka = list().find((e) => e.id === ID_BUKA);
      return `<section class="card stack"><h2>👑 Tetapan Pengarah Utama</h2>
        <form class="stack" data-form="bukuBuka"><h3 style="margin:0">Baki bawa hadapan (B/F)</h3>
          <div class="muted small">Sekali sahaja. Boleh diubah selagi diperlukan. Baki negatif dibenarkan.</div>
          <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
            <label class="f">Tarikh<input class="i" type="date" name="tarikh" value="${esc(buka ? buka.tarikh : today())}" required></label>
            <label class="f">Jumlah B/F (RM)<input class="i" type="number" step="0.01" name="jumlah" value="${buka ? esc(buka.jumlah) : '0'}" required></label>
          </div><button class="btn primary" type="submit">${buka ? 'Kemas kini B/F' : 'Tetapkan B/F'}</button></form>
        <form class="stack" data-form="bukuTetapan"><h3 style="margin:0">Senarai pilihan (satu baris satu item)</h3>
          <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
            <label class="f">Kategori<textarea class="i" name="kategori" rows="6">${esc(kategori().join('\n'))}</textarea></label>
            <label class="f">Pembekal<textarea class="i" name="pembekal" rows="6">${esc(pembekal().join('\n'))}</textarea></label>
            <label class="f">Lokasi<textarea class="i" name="lokasi" rows="6">${esc(lokasi().join('\n'))}</textarea></label>
          </div><button class="btn" type="submit">Simpan senarai</button></form>
        <div class="stack"><h3 style="margin:0">Import data dari fail CSV</h3>
          <div class="muted small">Lajur: tarikh, butiran, jenis, jumlah, kategori, pembekal, lokasi, noBOPA, bopaTanda, catatan. Rekod import masuk sebagai "Dihantar" dan perlu disahkan oleh Operations Manager.</div>
          <input class="i" type="file" accept=".csv,text/csv" data-a-change="bukuImportFail"></div>
      </section>`;
    }

    function view() {
      const u = c.me();
      if (!bolehLihat(u)) return shell('<div class="notice bad"><b>Tiada akses.</b> Kuasa 💵 tunai atau ✅ semakan diperlukan untuk Buku Petty Cash.</div>');
      const semua = lajur();
      const baki = semua.length ? semua[semua.length - 1].baki : 0;
      const hid = semua.filter((r) => hidup(r.e));
      const masuk = hid.reduce((s, r) => s + r.masuk, 0), keluar = hid.reduce((s, r) => s + r.keluar, 0);
      const menunggu = semua.filter((r) => r.e.status === 'dihantar').length;
      const tanpaBil = hid.filter((r) => r.e.jenis === 'keluar' && !(r.e.resit && r.e.resit.length)).length;
      const bulan = state.bukuBulan || 'semua';
      const bulanSet = new Set([today().slice(0, 7)]); semua.forEach((r) => r.e.tarikh && bulanSet.add(r.e.tarikh.slice(0, 7)));
      const tampil = semua.filter((r) => bulan === 'semua' || (r.e.tarikh || '').slice(0, 7) === bulan);
      return shell(`
        <div class="row between" style="align-items:flex-end;flex-wrap:wrap;gap:8px"><div><h1>Buku Petty Cash</h1>
          <div class="muted small">Masuk, keluar dan baki berjalan. Setiap rekod disemak oleh Operations Manager sebelum disahkan.</div></div>
          <label class="f" style="min-width:170px">Paparan<select class="i" data-a-change="bukuTapis"><option value="semua" ${bulan === 'semua' ? 'selected' : ''}>Semua bulan</option>${[...bulanSet].sort().reverse().map((m) => `<option value="${m}" ${m === bulan ? 'selected' : ''}>${bulanNama(m)}</option>`).join('')}</select></label></div>
        <div class="kpis">
          <div class="card kpi"><div class="l">Baki semasa</div><div class="v" style="${baki < 0 ? 'color:var(--bad)' : ''}">${rm(baki)}</div></div>
          <div class="card kpi"><div class="l">Jumlah masuk</div><div class="v">${rm(masuk)}</div></div>
          <div class="card kpi"><div class="l">Jumlah keluar</div><div class="v">${rm(keluar)}</div></div>
          <div class="card kpi"><div class="l">Menunggu semakan</div><div class="v">${menunggu}</div></div>
          <div class="card kpi"><div class="l">Bil belum ada</div><div class="v">${tanpaBil}</div></div>
        </div>
        ${baki < 0 ? '<div class="notice bad"><b>Baki negatif.</b> Belanja melebihi tunai yang diterima. Semak B/F dan top-up.</div>' : ''}
        ${bolehRekod(u) ? borangBaru() : ''}
        <section class="card stack"><div class="row between"><h2>Rekod</h2><button class="btn sm" data-a="bukuCsv">Eksport CSV</button></div>
          <div class="tbl"><table><thead><tr><th>Tarikh</th><th>Butiran</th><th class="n">Masuk</th><th class="n">Keluar</th><th class="n">Baki</th><th>Status</th><th></th></tr></thead><tbody>
          ${tampil.map((r) => baris(r, u)).join('') || '<tr><td colspan="7" class="muted">Tiada rekod.</td></tr>'}
          </tbody></table></div></section>
        ${ringkasBopa()}
        ${c.utama(u) ? panelPengarah() : ''}`);
    }

    // ---------- Simpan ----------
    const sejarah = (e, act) => { (e.history = e.history || []).push({ t: new Date().toISOString(), by: state.userId, act }); };
    function rekodBaru(d) {
      const e = Object.assign({
        id: uid(), tarikh: today(), butiran: '', jenis: 'keluar', jumlah: 0, kategori: '', pembekal: '', lokasi: '', noBOPA: '', noResit: '',
        resit: [], kodId: '', status: 'dihantar', oleh: state.userId, masa: new Date().toISOString(), versiSkema: 1, history: [],
      }, d);
      sejarah(e, 'Direkod');
      return e;
    }

    const forms = {
      bukuBaru(fd) {
        const jumlah = num(fd.jumlah);
        if (!(jumlah > 0)) { c.toast('Jumlah mesti lebih daripada sifar'); return; }
        if (!(fd.butiran || '').trim()) { c.toast('Isi butiran'); return; }
        const e = rekodBaru({
          tarikh: fd.tarikh || today(), butiran: fd.butiran.trim(), jenis: fd.jenis === 'masuk' ? 'masuk' : 'keluar', jumlah,
          kategori: fd.jenis === 'masuk' ? 'Top-up' : (fd.kategori || ''), pembekal: (fd.pembekal || '').trim(), lokasi: (fd.lokasi || '').trim(),
          noBOPA: fd.noBOPA || '', noResit: (fd.noResit || '').trim(), kodId: fd.kodId || '',
          resit: c.persistPhotos((state.draft && state.draft.resit) || []),
        });
        list().push(e);
        c.commit('buku tunai', e.id, [['bukuTunai', e]]);
        state.draft = null;
        const fl = bendera(e);
        c.toast(fl.length ? `Rekod disimpan. Perhatian: ${fl.join(', ')}` : 'Rekod disimpan');
        c.render();
      },
      bukuKembali(fd, form) {
        const e = list().find((x) => x.id === form.dataset.id); if (!e) return;
        if (e.oleh === state.userId) { c.toast('Tidak boleh memulangkan rekod sendiri'); return; }
        e.status = 'dikembalikan'; e.nota = (fd.nota || '').trim(); e.disemakOleh = state.userId; e.disemakMasa = new Date().toISOString();
        sejarah(e, 'Dikembalikan: ' + e.nota);
        c.commit('kembalikan buku tunai', e.id, [['bukuTunai', e]]); c.closeModal(); c.toast('Rekod dikembalikan'); c.render();
      },
      bukuResit(fd) {
        const d = state.draft; const e = d && list().find((x) => x.id === d._id); if (!e) return;
        const baru = c.persistPhotos(d.resit || []);
        if (!baru.length && !(fd.noResit || '').trim()) { c.toast('Tambah gambar atau no. resit'); return; }
        e.resit = (e.resit || []).concat(baru);
        if ((fd.noResit || '').trim()) e.noResit = fd.noResit.trim();
        e.status = 'dihantar';
        sejarah(e, 'Resit dikemas kini');
        c.commit('resit buku tunai', e.id, [['bukuTunai', e]]); state.draft = null; c.closeModal(); c.toast('Resit disimpan'); c.render();
      },
      bukuBopaBaru(fd) {
        const no = (fd.no || '').trim(); if (!no) return;
        if (bopaList().some((b) => b.no.toLowerCase() === no.toLowerCase())) { c.toast('No. BOPA ini sudah wujud'); return; }
        const b = { id: uid(), no, penerangan: (fd.penerangan || '').trim(), nilai: num(fd.nilai), status: 'Aktif', tarikh: today(), versiSkema: 1 };
        bopaList().push(b); c.commit('tambah BOPA', no, [['bopa', b]]); c.toast('BOPA ditambah'); c.render();
      },
      bukuBuka(fd) {
        if (!c.utama(c.me())) return;
        let e = list().find((x) => x.id === ID_BUKA);
        if (e) { e.tarikh = fd.tarikh; e.jumlah = num(fd.jumlah); sejarah(e, 'B/F dikemas kini'); }
        else { e = rekodBaru({ id: ID_BUKA, tarikh: fd.tarikh, butiran: 'Baki bawa hadapan (B/F)', jenis: 'buka', jumlah: num(fd.jumlah), kategori: 'B/F', status: 'disahkan' }); list().push(e); }
        c.commit('B/F buku tunai', e.id, [['bukuTunai', e]]); c.toast('B/F disimpan'); c.render();
      },
      bukuTetapan(fd) {
        if (!c.utama(c.me())) return;
        const baris2 = (v) => [...new Set(String(v || '').split('\n').map((x) => x.trim()).filter(Boolean))];
        Object.assign(db().settings, { bukuKategori: baris2(fd.kategori), bukuPembekal: baris2(fd.pembekal), bukuLokasi: baris2(fd.lokasi) });
        c.commit('tetapan buku tunai', '', [['settings', Object.assign({ id: 'main' }, db().settings)]]); c.toast('Senarai disimpan'); c.render();
      },
    };

    const actions = {
      bukuSemak(el) {
        const e = list().find((x) => x.id === el.dataset.id); if (!e) return;
        if (e.oleh === state.userId) { c.toast('Tidak boleh sahkan rekod sendiri'); return; }
        if (el.dataset.v === 'kembali') {
          c.openModal(`<h2>Kembalikan rekod</h2><div class="muted small">${esc(e.butiran)} · ${rm(e.jumlah)}</div>
            <form class="stack" data-form="bukuKembali" data-id="${e.id}"><label class="f">Sebab dikembalikan<textarea class="i" name="nota" required placeholder="Contoh: Gambar resit tidak jelas"></textarea></label>
            <div class="row"><button class="btn primary" type="submit">Kembalikan</button><button type="button" class="btn" data-a="closeModal">Batal</button></div></form>`);
          return;
        }
        e.status = 'disahkan'; e.nota = ''; e.disemakOleh = state.userId; e.disemakMasa = new Date().toISOString();
        sejarah(e, 'Disahkan');
        c.commit('sahkan buku tunai', e.id, [['bukuTunai', e]]); c.toast('Rekod disahkan'); c.render();
      },
      bukuResit(el) {
        const e = list().find((x) => x.id === el.dataset.id); if (!e) return;
        state.draft = { _form: 'bukuResit', _id: e.id, resit: [] };
        c.openModal(`<h2>Tambah resit</h2><div class="muted small">${esc(e.butiran)} · ${rm(e.jumlah)}</div>
          <form class="stack" data-form="bukuResit"><label class="f">No. resit<input class="i" name="noResit" value="${esc(e.noResit || '')}"></label>
          <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600">Gambar resit ${c.photoGrid('resit', [''], 'environment')}</div>
          <div class="row"><button class="btn primary" type="submit">Simpan</button><button type="button" class="btn" data-a="closeModal">Batal</button></div></form>`);
      },
      bukuSongsang(el) {
        if (!c.confirmInline(el, 'Tekan sekali lagi untuk songsang')) return;
        const a = list().find((x) => x.id === el.dataset.id); if (!a) return;
        const e = rekodBaru({
          tarikh: today(), butiran: 'SONGSANG: ' + a.butiran, jenis: a.jenis === 'keluar' ? 'masuk' : 'keluar', jumlah: num(a.jumlah),
          kategori: a.kategori, pembekal: a.pembekal, lokasi: a.lokasi, noBOPA: a.noBOPA, songsangDari: a.id,
        });
        list().push(e); c.commit('songsang buku tunai', a.id, [['bukuTunai', e]]);
        c.toast('Entri songsang dihantar untuk semakan'); c.render();
      },
      bukuBopaToggle(el) {
        const b = bopaList().find((x) => x.id === el.dataset.id); if (!b) return;
        b.status = b.status === 'Ditutup' ? 'Aktif' : 'Ditutup';
        c.commit('BOPA ' + b.status, b.no, [['bopa', b]]); c.render();
      },
      bukuCsv() {
        const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        const bulan = state.bukuBulan || 'semua';
        const rows = [['DATE', 'ITEM DESCRIPTION', 'RECEIVED', 'PAYMENT', 'BALANCE', 'KATEGORI', 'PEMBEKAL', 'LOKASI', 'BOPA', 'NO. RESIT', 'STATUS', 'DIREKOD OLEH']]
          .concat(lajur().filter((r) => bulan === 'semua' || (r.e.tarikh || '').slice(0, 7) === bulan)
            .map((r) => [r.e.tarikh, r.e.butiran, r.masuk || '', r.keluar || '', r.baki.toFixed(2), r.e.kategori, r.e.pembekal, r.e.lokasi, r.e.noBOPA, r.e.noResit, r.e.status, c.userName(r.e.oleh)]));
        const csv = rows.map((r) => r.map(q).join(',')).join('\r\n');
        const name = `kaiser-buku-petty-cash-${bulan === 'semua' ? today() : bulan}.csv`;
        state.csv = { csv, name };
        c.openModal(`<h2>${esc(name)}</h2><div class="muted small">${rows.length - 1} baris. Muat turun fail, atau salin dan tampal ke Excel / Google Sheets.</div>
          <textarea class="i" readonly style="min-height:200px;font-family:ui-monospace,monospace;font-size:12px">${esc(csv)}</textarea>
          <div class="row"><button class="btn primary" data-a="csvDownload">Muat turun CSV</button><button class="btn" data-a="csvCopy">Salin</button><button class="btn" data-a="closeModal">Tutup</button></div>`);
      },
      bukuImportSah() {
        if (!c.utama(c.me()) || !state.bukuImport) return;
        const baru = [];
        const ada = (r) => list().some((e) => e.tarikh === r.tarikh && e.butiran === r.butiran && e.jenis === r.jenis && Math.abs(num(e.jumlah) - r.jumlah) < 0.005);
        let langkau = 0;
        state.bukuImport.forEach((r) => { if (ada(r)) { langkau++; return; } const e = rekodBaru(Object.assign({}, r, { sumber: 'import' })); baru.push(e); });
        baru.forEach((e) => list().push(e));
        if (baru.length) c.commit('import buku tunai', `${baru.length} rekod`, baru.map((e) => ['bukuTunai', e]));
        state.bukuImport = null; c.closeModal();
        c.toast(`${baru.length} rekod diimport${langkau ? `, ${langkau} dilangkau (sudah ada)` : ''}. Menunggu semakan.`); c.render();
      },
    };

    const change = {
      bukuTapis(el) { state.bukuBulan = el.value; c.render(); },
      async bukuImportFail(el) {
        const f = el.files && el.files[0]; if (!f) return;
        let teks = ''; try { teks = await f.text(); } catch (e) { c.toast('Fail tidak dapat dibaca'); return; }
        const t = parseCsv(teks); if (t.length < 2) { c.toast('Fail kosong atau format tidak betul'); return; }
        const kepala = t[0].map((x) => x.trim().toLowerCase());
        const idx = (n) => kepala.indexOf(n.toLowerCase());
        const wajib = ['tarikh', 'butiran', 'jenis', 'jumlah'];
        const hilang = wajib.filter((n) => idx(n) < 0);
        if (hilang.length) { c.toast('Lajur tiada: ' + hilang.join(', ')); return; }
        const get = (r, n) => (idx(n) >= 0 ? String(r[idx(n)] || '').trim() : '');
        const baik = [], salah = [];
        t.slice(1).forEach((r, i) => {
          const tarikh = get(r, 'tarikh'), jenis = get(r, 'jenis').toLowerCase(), jumlah = num(get(r, 'jumlah')), butiran = get(r, 'butiran');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(tarikh) || !['masuk', 'keluar'].includes(jenis) || !(jumlah > 0) || !butiran) { salah.push(i + 2); return; }
          baik.push({ tarikh, butiran, jenis, jumlah, kategori: get(r, 'kategori'), pembekal: get(r, 'pembekal'), lokasi: get(r, 'lokasi'), noBOPA: get(r, 'noBOPA'), bopaTanda: /^(ya|y|1|true)$/i.test(get(r, 'bopaTanda')), catatan: get(r, 'catatan') });
        });
        el.value = '';
        if (!baik.length) { c.toast('Tiada baris sah. Semak format tarikh (YYYY-MM-DD) dan jenis (masuk/keluar).'); return; }
        state.bukuImport = baik;
        const m = baik.filter((r) => r.jenis === 'masuk').reduce((s, r) => s + r.jumlah, 0), k = baik.filter((r) => r.jenis === 'keluar').reduce((s, r) => s + r.jumlah, 0);
        c.openModal(`<h2>Semak sebelum import</h2>
          <div class="small"><b>${baik.length}</b> rekod sah · Masuk <b>${rm(m)}</b> · Keluar <b>${rm(k)}</b>${salah.length ? `<div class="notice bad" style="margin-top:8px">Baris dilangkau (tidak sah): ${salah.join(', ')}</div>` : ''}</div>
          <div class="tbl" style="max-height:260px;overflow:auto"><table><thead><tr><th>Tarikh</th><th>Butiran</th><th>Jenis</th><th class="n">RM</th><th>Kategori</th></tr></thead><tbody>
          ${baik.map((r) => `<tr><td>${fmtDate(r.tarikh)}</td><td>${esc(r.butiran)}</td><td>${esc(r.jenis)}</td><td class="n">${r.jumlah.toFixed(2)}</td><td>${esc(r.kategori)}</td></tr>`).join('')}</tbody></table></div>
          <div class="muted tiny">Rekod masuk sebagai "Dihantar". Operations Manager perlu mengesahkan setiap satu. Rekod yang sama (tarikh, butiran, jenis, jumlah) tidak diimport dua kali.</div>
          <div class="row"><button class="btn primary" data-a="bukuImportSah">Import ${baik.length} rekod</button><button class="btn" data-a="closeModal">Batal</button></div>`);
      },
    };

    return { view, forms, actions, change, bolehLihat, bolehRekod, bolehSemak };
  }

  window.KaiserBuku = { buat };
})();
