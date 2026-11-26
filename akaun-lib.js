/* Kaiser · akaun-lib.js — SEMUA operasi akaun log masuk pekerja di satu tempat.
 *
 * Pilihan A (sekarang, pelan Spark): apps mencipta akaun Firebase melalui apps Firebase kedua ('daftar'),
 * supaya sesi pendaftar tidak terputus. Firestore rules memastikan pendaftar hanya menyentuh pekerja
 * tanpa kuasa dalam skop kumpulannya.
 *
 * Pilihan B (selepas Blaze): gantikan isi fungsi `daftar`, `setSemulaPin` dan `lepaskanPeranti` dengan
 * panggilan Cloud Functions (firebase.functions().httpsCallable('...')). Antara muka (nama fungsi,
 * parameter dan nilai pulangan) KEKAL sama, jadi app.js tidak perlu diubah.
 */
(function () {
  'use strict';
  const PIN_DOMAIN = 'pekerja.kaiser-apps.app';
  const HARI_SEMENTARA = 7; // PIN sementara tamat selepas 7 hari
  const normId = (id) => String(id || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pinEmail = (id, ver) => `${normId(id).toLowerCase()}.v${ver || 1}@${PIN_DOMAIN}`;
  const pinRawak = () => {
    const a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a);
    return String(a[0] % 1000000).padStart(6, '0');
  };

  function buat(ctx) {
    // ctx: { fs, CFG, firebase }
    const { fs, CFG } = ctx;
    const fb = ctx.firebase;
    const Ts = () => fb.firestore.Timestamp;
    const tamatBaru = () => { const ms = Date.now() + HARI_SEMENTARA * 864e5; return { ms, ts: Ts() ? Ts().fromMillis(ms) : ms }; };

    async function authKedua() {
      const sec = fb.apps.find((a) => a.name === 'daftar') || fb.initializeApp(CFG, 'daftar');
      const sa = sec.auth();
      await sa.setPersistence(fb.auth.Auth.Persistence.NONE);
      return sa;
    }
    async function ciptaAkaunLogMasuk(email, pin) {
      const sa = await authKedua();
      const cred = await sa.createUserWithEmailAndPassword(email, pin);
      await sa.signOut();
      return cred.user.uid;
    }

    return {
      HARI_SEMENTARA, pinRawak, normId,

      // Daftar pekerja baharu. profil = medan users (tanpa id). sulit = IC/gaji/bank (hanya Pengarah Utama), boleh null.
      // Pulangan: { profilId, staffId, pin, tamatMs }
      async daftar(profil, sulit) {
        const id = normId(profil.staffId);
        if (!id) throw { code: 'kaiser/id', message: 'ID pekerja diperlukan' };
        const ada = await fs.collection('idmap').doc(id).get();
        if (ada.exists) throw { code: 'kaiser/id-wujud', message: `ID ${id} sudah digunakan` };
        const pin = pinRawak();
        const email = pinEmail(id, 1);
        const authUid = await ciptaAkaunLogMasuk(email, pin);
        const profilId = 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const t = tamatBaru();
        const b = fs.batch();
        b.set(fs.collection('users').doc(profilId), Object.assign({}, profil, {
          staffId: id, authUid, ver: 1, aktif: true,
          akaunApps: { status: 'sementara', peranti: null, tamatMs: t.ms },
        }));
        b.set(fs.collection('akses').doc(authUid), { profil: profilId, staffId: id, sementara: true, tamat: t.ts, tamatMs: t.ms });
        b.set(fs.collection('idmap').doc(id), { email, profil: profilId });
        if (sulit) b.set(fs.collection('sulit').doc(profilId), sulit);
        await b.commit();
        return { profilId, staffId: id, pin, tamatMs: t.ms };
      },

      // Set semula PIN: akaun log masuk baharu (versi seterusnya) dipautkan ke profil yang sama, jadi rekod kekal.
      // Telefon turut dilepaskan supaya pekerja boleh masuk dari telefon baharu jika perlu.
      async setSemulaPin(u) {
        const pin = pinRawak();
        const ver = (Number(u.ver) || 1) + 1;
        const email = pinEmail(u.staffId, ver);
        const authUid = await ciptaAkaunLogMasuk(email, pin);
        const t = tamatBaru();
        const b = fs.batch();
        b.set(fs.collection('akses').doc(authUid), { profil: u.id, staffId: u.staffId, sementara: true, tamat: t.ts, tamatMs: t.ms });
        if (u.authUid) b.delete(fs.collection('akses').doc(u.authUid));
        b.set(fs.collection('idmap').doc(u.staffId), { email, profil: u.id });
        const pr = u.akaunApps && u.akaunApps.peranti;
        if (pr && pr.id) b.delete(fs.collection('peranti').doc(pr.id));
        b.update(fs.collection('users').doc(u.id), { authUid, ver, akaunApps: { status: 'sementara', peranti: null, tamatMs: t.ms } });
        await b.commit();
        return { staffId: u.staffId, pin, tamatMs: t.ms };
      },

      // Lepaskan kunci telefon supaya pekerja boleh masuk dari telefon lain.
      async lepaskanPeranti(u) {
        const a = Object.assign({}, u.akaunApps || {});
        const pr = a.peranti;
        a.peranti = null;
        const b = fs.batch();
        if (pr && pr.id) b.delete(fs.collection('peranti').doc(pr.id));
        b.update(fs.collection('users').doc(u.id), { akaunApps: a });
        await b.commit();
      },
    };
  }

  window.KaiserAkaun = { buat, normId, pinEmail, pinRawak, HARI_SEMENTARA };
})();
