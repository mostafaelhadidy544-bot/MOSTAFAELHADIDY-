// ============ Countdown ============
(function(){
  const el = document.getElementById('countdown');
  if (!el) return;
  // Countdown to end of registration window — set ~30 days out
  const KEY = 'reg_deadline_v1';
  let deadline = parseInt(localStorage.getItem(KEY) || '0', 10);
  if (!deadline || deadline < Date.now()) {
    deadline = Date.now() + 1000 * 60 * 60 * 24 * 21; // 21 days
    localStorage.setItem(KEY, String(deadline));
  }
  function tick(){
    const diff = Math.max(0, deadline - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `⏰ ${d}ي : ${String(h).padStart(2,'0')}س : ${String(m).padStart(2,'0')}د : ${String(s).padStart(2,'0')}ث`;
  }
  tick(); setInterval(tick, 1000);
})();

// ============ Reveal on scroll ============
(function(){
  const targets = document.querySelectorAll('.section-head, .trust-card, .loc-card, .reg-form, .reg-left, .about-grid, .step, .subj, .testi-card, .faq-item, .quote-grid');
  targets.forEach(t => t.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach(t => io.observe(t));
})();

// ============ Form Submit ============
(function(){
  const form = document.getElementById('regForm');
  const btn = document.getElementById('submitBtn');
  const modal = document.getElementById('successModal');
  const waNext = document.getElementById('waNext');
  const closeBtn = document.getElementById('modalClose');
  if (!form) return;

  closeBtn?.addEventListener('click', () => modal.classList.remove('show'));
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.classList.add('loading');
    btn.disabled = true;

    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'حدث خطأ');

      // success
      waNext.href = json.whatsapp;
      modal.classList.add('show');
      form.reset();

      // auto-open WhatsApp after brief delay (user-initiated submit -> allowed)
      setTimeout(() => {
        try { window.open(json.whatsapp, '_blank', 'noopener'); } catch (_) {}
      }, 1200);
    } catch (err) {
      alert(err.message || 'حدث خطأ، حاول مرة أخرى');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
})();

// ============ Smooth scroll for in-page anchors ============
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const t = document.getElementById(id);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
