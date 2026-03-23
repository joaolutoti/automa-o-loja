const express = require("express");
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const IMAGENS_DIR = path.resolve(process.cwd(), "imagens");
if (!fs.existsSync(IMAGENS_DIR)) fs.mkdirSync(IMAGENS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "200mb" }));

// ── Banco MySQL ────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "u221220547_jonatancgi",
  password: process.env.DB_PASS || "2Art9Cm#TUxYUC6",
  database: process.env.DB_NAME || "u221220547_jcmotors",
  waitForConnections: true,
  connectionLimit: 10,
});

async function init() {
  try {
    const conn = await pool.getConnection();
    await conn.query(`CREATE TABLE IF NOT EXISTS posts (
      id VARCHAR(100) PRIMARY KEY,
      tipo VARCHAR(50),
      store VARCHAR(100),
      title TEXT,
      description TEXT,
      price VARCHAR(50),
      image TEXT,
      url TEXT,
      date VARCHAR(50),
      likes INT DEFAULT 0,
      keywords TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS lojas (
      perfil VARCHAR(100) PRIMARY KEY
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Lojas padrão
    const [rows] = await conn.query("SELECT COUNT(*) as c FROM lojas");
    if (rows[0].c === 0) {
      for (const p of ["repassesgr", "cwb.repasse_", "autopar.repasses"]) {
        await conn.query("INSERT IGNORE INTO lojas (perfil) VALUES (?)", [p]);
      }
    }
    conn.release();
    console.log("✅ Banco MySQL pronto");
  } catch (e) {
    console.error("❌ Erro banco:", e.message);
  }
}

// ── Salvar imagem (base64 ou URL) ──────────────────────────────
async function saveImg(id, source) {
  if (!source) return source;
  const filename = `img_${crypto.createHash("md5").update(id).digest("hex")}.jpg`;
  const fullPath = path.join(IMAGENS_DIR, filename);

  if (source.includes("base64,")) {
    try {
      const buffer = Buffer.from(source.split(",")[1], "base64");
      fs.writeFileSync(fullPath, buffer);
      return `/api/imagens/${filename}`;
    } catch { return source; }
  }

  if (typeof source === "string" && source.startsWith("http")) {
    try {
      const resp = await axios.get(source, { responseType: "arraybuffer", timeout: 8000 });
      fs.writeFileSync(fullPath, resp.data);
      return `/api/imagens/${filename}`;
    } catch { return source; }
  }

  return source;
}

// ── Imagens estáticas ──────────────────────────────────────────
app.get("/api/imagens/:name", (req, res) => {
  const file = path.join(IMAGENS_DIR, req.params.name);
  if (fs.existsSync(file)) res.sendFile(file);
  else res.status(404).send("Imagem não encontrada");
});

// ── Lojas ──────────────────────────────────────────────────────
app.get("/api/lojas", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT perfil FROM lojas ORDER BY perfil");
    res.json(rows.map(r => r.perfil));
  } catch (e) {
    res.json(["repassesgr", "cwb.repasse_", "autopar.repasses"]);
  }
});

app.post("/api/lojas/add", async (req, res) => {
  const data = req.body || {};
  let perfis = Array.isArray(data.perfis) ? data.perfis : data.perfil ? [data.perfil] : [];
  if (!perfis.length) return res.status(400).json({ erro: "Nenhum perfil informado" });

  for (const p of perfis) {
    const limpo = p.trim().replace("@", "").toLowerCase();
    if (limpo) await pool.query("INSERT IGNORE INTO lojas (perfil) VALUES (?)", [limpo]);
  }
  const [rows] = await pool.query("SELECT perfil FROM lojas ORDER BY perfil");
  res.json({ msg: `${perfis.length} lojas adicionadas!`, lojas: rows.map(r => r.perfil) });
});

app.post("/api/lojas/remove", async (req, res) => {
  const perfil = (req.body.perfil || "").trim().replace("@", "").toLowerCase();
  await pool.query("DELETE FROM lojas WHERE perfil = ?", [perfil]);
  const [rows] = await pool.query("SELECT perfil FROM lojas ORDER BY perfil");
  res.json({ msg: `@${perfil} removido!`, lojas: rows.map(r => r.perfil) });
});

// ── Posts ──────────────────────────────────────────────────────
app.get("/api/dados", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM posts ORDER BY created_at DESC LIMIT 600");
    res.json(rows.map(r => ({ ...r, keywords: JSON.parse(r.keywords || "[]") })));
  } catch (e) {
    res.json([]);
  }
});

// Alias para compatibilidade
app.get("/api/posts", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM posts ORDER BY created_at DESC LIMIT 600");
    res.json(rows.map(r => ({ ...r, keywords: JSON.parse(r.keywords || "[]") })));
  } catch (e) {
    res.json([]);
  }
});

app.post("/api/posts/add", async (req, res) => {
  const data = req.body || {};
  const titulo = (data.title || "").trim();
  if (!titulo) return res.status(400).json({ erro: "Campo 'title' obrigatório" });

  const postId = data.id || `ext_${Date.now()}`;
  const imageUrl = await saveImg(postId, data.image_b64 || data.image || "");

  try {
    await pool.query(
      `INSERT INTO posts (id, tipo, store, title, description, price, image, url, date, likes, keywords)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [postId, data.tipo || "post", data.store || "@externo", titulo,
       data.description || "", data.price || "Consulte", imageUrl,
       data.url || "", data.date || new Date().toLocaleDateString("pt-BR"),
       data.likes || 0, JSON.stringify(data.keywords || titulo.toLowerCase().split(" "))]
    );
    res.status(201).json({ msg: "Post adicionado!", id: postId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.json({ msg: "Post já existe", id: postId });
    res.status(500).json({ erro: e.message });
  }
});

app.post("/api/posts/sync", async (req, res) => {
  const lista = req.body;
  if (!Array.isArray(lista)) return res.status(400).json({ erro: "Esperado lista" });

  await pool.query("DELETE FROM posts");
  let ok = 0;
  for (const p of lista) {
    try {
      const imgPath = await saveImg(p.id, p.image_b64 || p.image || "");
      await pool.query(
        `INSERT INTO posts (id, tipo, store, title, description, price, image, url, date, likes, keywords)
         VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title), image=VALUES(image)`,
        [p.id, p.tipo || "post", p.store, p.title, p.description,
         p.price || "Consulte", imgPath, p.url, p.date, p.likes || 0,
         JSON.stringify(p.keywords || [])]
      );
      ok++;
    } catch (e) {
      console.error("Erro sync:", e.message);
    }
  }
  res.json({ msg: `${ok} posts sincronizados!` });
});

// ── WhatsApp via Z-API + Make ──────────────────────────────────
app.post("/api/whatsapp", async (req, res) => {
  const data = req.body || {};
  const image = typeof data.image === "object" ? data.image : {};
  const caption = image.caption || data.text || "";
  const imageSource = image.url || image.imageUrl || image.base64 || "";

  if (!caption && !imageSource) {
    return res.status(400).json({ erro: "Mensagem sem conteúdo útil" });
  }

  const precoMatch = caption.match(/R\$\s?[\d.,]+/i);
  const price = precoMatch ? precoMatch[0].replace(/\s/, "") : "Consulte";
  const linhas = caption.split("\n").map(l => l.trim()).filter(l => l);
  const titulo = linhas[0] || "Veículo via WhatsApp";
  const postId = `wpp_${Date.now()}`;
  const finalImage = await saveImg(postId, imageSource);
  const keywords = caption.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const store = data.senderName ? `@${data.senderName.replace(/\s+/g, "").toLowerCase()}` : "@whatsapp";

  try {
    await pool.query(
      `INSERT INTO posts (id, tipo, store, title, description, price, image, url, date, likes, keywords)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [postId, "post", store, titulo, caption, price, finalImage, "",
       new Date().toLocaleDateString("pt-BR"), 0, JSON.stringify(keywords)]
    );
    console.log(`✅ WhatsApp: ${titulo}`);
    res.status(201).json({ msg: "Post salvo!", id: postId });
  } catch (e) {
    console.error("Erro WhatsApp:", e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── Status ─────────────────────────────────────────────────────
app.get("/api/status", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) as t FROM posts");
    res.json({ rodando: false, total_posts: rows[0].t, ultima_coleta: new Date().toLocaleString() });
  } catch {
    res.json({ rodando: false, total_posts: 0, ultima_coleta: null });
  }
});

// ── Frontend ───────────────────────────────────────────────────
app.use(express.static(process.cwd()));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(process.cwd(), "index.html"));
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚗 Repasse Central na porta ${PORT}`);
  init();
});
