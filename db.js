const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'leads.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    grade TEXT NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leads_grade ON leads(grade);
  CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(location);
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
`);

module.exports = {
  insertLead(data) {
    const stmt = db.prepare(`INSERT INTO leads (name, phone, grade, location, notes) VALUES (?, ?, ?, ?, ?)`);
    const info = stmt.run(data.name, data.phone, data.grade, data.location, data.notes || '');
    return info.lastInsertRowid;
  },
  getLead(id) {
    return db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id);
  },
  updateLead(id, data) {
    const stmt = db.prepare(`UPDATE leads SET name=?, phone=?, grade=?, location=?, notes=? WHERE id=?`);
    return stmt.run(data.name, data.phone, data.grade, data.location, data.notes || '', id);
  },
  deleteLead(id) {
    return db.prepare(`DELETE FROM leads WHERE id = ?`).run(id);
  },
  listLeads({ q = '', grade = '', location = '' } = {}) {
    const where = [];
    const params = [];
    if (q) {
      where.push(`(name LIKE ? OR phone LIKE ? OR notes LIKE ?)`);
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (grade) { where.push('grade = ?'); params.push(grade); }
    if (location) { where.push('location = ?'); params.push(location); }
    const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
    return db.prepare(sql).all(...params);
  },
  stats() {
    const total = db.prepare(`SELECT COUNT(*) AS c FROM leads`).get().c;
    const byGrade = db.prepare(`SELECT grade, COUNT(*) AS c FROM leads GROUP BY grade ORDER BY c DESC`).all();
    const byLocation = db.prepare(`SELECT location, COUNT(*) AS c FROM leads GROUP BY location ORDER BY c DESC`).all();
    const today = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE date(created_at) = date('now')`).get().c;
    const week = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE created_at >= datetime('now','-7 days')`).get().c;
    return { total, byGrade, byLocation, today, week };
  }
};
