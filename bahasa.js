/* Kaiser · bahasa.js — dwibahasa (Bahasa Melayu / English).
 * Apps ditulis dalam Bahasa Melayu. Bila English dipilih, teks pada skrin diterjemah selepas dilukis,
 * menggunakan kamus EN (padanan tepat) dan POLA (teks yang mengandungi nombor / nama).
 * Data yang dimasukkan pengguna (nama, catatan, memo) tidak diterjemah.
 */
(function () {
  'use strict';
  const EN = window.KAISER_EN || {};
  const POLA = (window.KAISER_EN_POLA || []).map(([r, t]) => [new RegExp('^' + r + '$'), t]);
  const ATTR = ['placeholder', 'title', 'aria-label', 'alt'];
  // Nama hari & bulan dalam tarikh.
  const KATA = { Isnin: 'Monday', Selasa: 'Tuesday', Rabu: 'Wednesday', Khamis: 'Thursday', Jumaat: 'Friday', Sabtu: 'Saturday', Ahad: 'Sunday', Januari: 'January', Februari: 'February', Mac: 'March', Mei: 'May', Julai: 'July', Ogos: 'August', Oktober: 'October', Disember: 'December', Ogo: 'Aug', Okt: 'Oct', Dis: 'Dec', hari: 'days', jam: 'hrs' };
  const KATA_RE = new RegExp('\\b(' + Object.keys(KATA).join('|') + ')\\b', 'g');
  function teks(s) {
    if (!s) return s;
    const t = s.trim();
    if (!t) return s;
    let out = EN[t];
    if (out === undefined) {
      for (const [r, rep] of POLA) { if (r.test(t)) { out = t.replace(r, rep); break; } }
      // Terjemah juga bahagian yang dipisahkan dengan " · " (cth. "Cuti submitted · Lewat").
      if (out !== undefined) out = out.split(' · ').map((seg) => { const m = /^(.*) \(sample\)$/.exec(seg); if (m && EN[m[1]]) return EN[m[1]] + ' (sample)'; const w = /^(.+) submitted$/.exec(seg); if (w && EN[w[1]]) return EN[w[1]] + ' submitted'; return EN[seg] !== undefined ? EN[seg] : seg; }).join(' · ');
    }
    if (out === undefined && /\b(19|20)\d\d\b|^(Isnin|Selasa|Rabu|Khamis|Jumaat|Sabtu|Ahad)\b/.test(t)) {
      const r = t.replace(KATA_RE, (w) => KATA[w]);
      if (r !== t) out = r;
    }
    if (out === undefined) return s;
    return s.replace(t, out);
  }
  function terjemah(root, lang) {
    if (lang !== 'en' || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName) || p.closest('[data-asal]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach((n) => { const v = teks(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
    root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach((el) => {
      ATTR.forEach((a) => { const v = el.getAttribute(a); if (v) { const t2 = teks(v); if (t2 !== v) el.setAttribute(a, t2); } });
    });
  }
  // Teks yang ditambah selepas skrin dilukis (status GPS, mesej, butang sahkan) turut diterjemah.
  const aktifEN = () => { try { return localStorage.getItem('kaiser_bahasa') === 'en'; } catch (e) { return false; } };
  if (window.MutationObserver) {
    new MutationObserver((muts) => {
      if (!aktifEN()) return;
      muts.forEach((m) => {
        if (m.type === 'characterData') { const n = m.target; const p = n.parentElement; if (p && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName)) { const v = teks(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } }
        m.addedNodes.forEach((n) => { if (n.nodeType === 3) { const v = teks(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } else if (n.nodeType === 1 && n.id !== 'app') terjemah(n, 'en'); });
      });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  window.KaiserBahasa = { terjemah, teks };
})();
