const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const ExcelJS = require('exceljs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'mostafa2027';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '201097655763'; // intl format
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', etag: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'mostafa-elhadidi-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 }
}));

// view helpers
const renderFile = (name, ctx = {}) => {
  let html = fs.readFileSync(path.join(__dirname, 'views', name), 'utf8');
  for (const [k, v] of Object.entries(ctx)) {
    html = html.replaceAll(`{{${k}}}`, v == null ? '' : String(v));
  }
  return html;
};

// ============ Public routes ============
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderFile('landing.html', {
    SITE_URL,
    WHATSAPP_NUMBER
  }));
});

app.post('/api/register', (req, res) => {
  try {
    const name = (req.body.name || '').toString().trim();
    const phone = (req.body.phone || '').toString().trim();
    const grade = (req.body.grade || '').toString().trim();
    const location = (req.body.location || '').toString().trim();
    const notes = (req.body.notes || '').toString().trim();
    if (!name || !phone || !grade || !location) {
      return res.status(400).json({ ok: false, error: 'يرجى إكمال جميع الحقول المطلوبة' });
    }
    if (!/^[0-9+\-\s]{8,20}$/.test(phone)) {
      return res.status(400).json({ ok: false, error: 'رقم الهاتف غير صحيح' });
    }
    const id = db.insertLead({ name, phone, grade, location, notes });
    const msg =
`السلام عليكم

الاسم:
${name}

رقم الهاتف:
${phone}

الصف الدراسي:
${grade}

المقر:
${location}${notes ? `\n\nملاحظات:\n${notes}` : ''}`;
    const wa = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    res.json({ ok: true, id, whatsapp: wa });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'حدث خطأ، حاول مرة أخرى' });
  }
});

// ============ SEO ============
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>`);
});

// ============ Admin ============
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const err = req.query.e ? '<div class="err">بيانات الدخول غير صحيحة</div>' : '';
  res.send(renderFile('admin-login.html', { ERROR: err }));
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?e=1');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString();
  const grade = (req.query.grade || '').toString();
  const location = (req.query.location || '').toString();
  const leads = db.listLeads({ q, grade, location });
  const stats = db.stats();
  const rows = leads.map(l => `
    <tr data-id="${l.id}">
      <td>${l.id}</td>
      <td>${escapeHtml(l.name)}</td>
      <td><a href="tel:${escapeHtml(l.phone)}">${escapeHtml(l.phone)}</a></td>
      <td>${escapeHtml(l.grade)}</td>
      <td>${escapeHtml(l.location)}</td>
      <td class="notes">${escapeHtml(l.notes || '')}</td>
      <td>${l.created_at}</td>
      <td class="actions">
        <a class="btn-sm wa" target="_blank" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('السلام عليكم ' + l.name)}">واتساب</a>
        <button class="btn-sm edit" data-id="${l.id}">تعديل</button>
        <button class="btn-sm del" data-id="${l.id}">حذف</button>
      </td>
    </tr>`).join('');
  const byGrade = stats.byGrade.map(g => `<li><span>${escapeHtml(g.grade)}</span><b>${g.c}</b></li>`).join('');
  const byLoc = stats.byLocation.map(g => `<li><span>${escapeHtml(g.location)}</span><b>${g.c}</b></li>`).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderFile('admin.html', {
    TOTAL: stats.total,
    TODAY: stats.today,
    WEEK: stats.week,
    ROWS: rows || '<tr><td colspan="8" style="text-align:center;padding:30px;color:#888">لا توجد حجوزات بعد</td></tr>',
    BY_GRADE: byGrade || '<li><span>—</span><b>0</b></li>',
    BY_LOC: byLoc || '<li><span>—</span><b>0</b></li>',
    Q: escapeHtml(q),
    GRADE: escapeHtml(grade),
    LOCATION: escapeHtml(location)
  }));
});

app.get('/admin/api/lead/:id', requireAuth, (req, res) => {
  const lead = db.getLead(req.params.id);
  if (!lead) return res.status(404).json({ ok: false });
  res.json({ ok: true, lead });
});

app.post('/admin/api/lead/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  if (!db.getLead(id)) return res.status(404).json({ ok: false });
  db.updateLead(id, {
    name: req.body.name,
    phone: req.body.phone,
    grade: req.body.grade,
    location: req.body.location,
    notes: req.body.notes
  });
  res.json({ ok: true });
});

app.post('/admin/api/lead/:id/delete', requireAuth, (req, res) => {
  db.deleteLead(req.params.id);
  res.json({ ok: true });
});

app.get('/admin/export/csv', requireAuth, (req, res) => {
  const leads = db.listLeads({
    q: req.query.q || '',
    grade: req.query.grade || '',
    location: req.query.location || ''
  });
  const header = ['ID', 'الاسم', 'الهاتف', 'الصف', 'المقر', 'ملاحظات', 'التاريخ'];
  const rows = leads.map(l => [l.id, l.name, l.phone, l.grade, l.location, l.notes || '', l.created_at]);
  const csv = [header, ...rows].map(r =>
    r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  // BOM for Excel Arabic
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);
  res.send('\ufeff' + csv);
});

app.get('/admin/export/xlsx', requireAuth, async (req, res) => {
  const leads = db.listLeads({
    q: req.query.q || '',
    grade: req.query.grade || '',
    location: req.query.location || ''
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('الحجوزات', { views: [{ rightToLeft: true }] });
  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'الاسم', key: 'name', width: 28 },
    { header: 'الهاتف', key: 'phone', width: 18 },
    { header: 'الصف', key: 'grade', width: 22 },
    { header: 'المقر', key: 'location', width: 22 },
    { header: 'ملاحظات', key: 'notes', width: 30 },
    { header: 'التاريخ', key: 'created_at', width: 22 }
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A3D91' } };
  leads.forEach(l => ws.addRow(l));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
