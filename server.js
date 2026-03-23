const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ── Banco de dados ─────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || "";
const IMAGENS_DIR = path.join(__dirname, "imagens");
if (!fs.existsSync(IMAGENS_DIR)) fs.mkdirSync(IMAGENS_DIR);

let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  pool.query("SELECT 1")
    .then(() => console.log("✅ Conectado ao PostgreSQL"))
    .catch((e) => {
      console.error("⚠️ PostgreSQL indisponível:", e.message);
      pool = null;
    });
}

// ── Init tabelas ───────────────────────────────────────────────
async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lojas (
      perfil TEXT PRIMARY KEY
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id          TEXT PRIMARY KEY,
      tipo        TEXT DEFAULT 'post',
      store       TEXT,
      title       TEXT,
      description TEXT,
      price       TEXT DEFAULT 'Consulte',
      image       TEXT,
      url         TEXT,
      date        TEXT,
      likes       INTEGER DEFAULT 0,
      keywords    TEXT,
      created_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `);
  // Lojas padrão
  const { rows } = await pool.query("SELECT COUNT(*) as c FROM lojas");
  if (parseInt(rows[0].c) === 0) {
    const defaults = ["repassesgr", "cwb.repasse_", "autopar.repasses"];
    for (const p of defaults) {
      await pool.query("INSERT INTO lojas (perfil) VALUES ($1) ON CONFLICT DO NOTHING", [p]);
    }
  }
  console.log("✅ Tabelas prontas");
}

// ── Helpers imagem ─────────────────────────────────────────────
function salvarImagemB64(postId, b64) {
  try {
    const buf = Buffer.from(b64, "base64");
    const fname = crypto.createHash("md5").update(postId).digest("hex") + ".jpg";
    fs.writeFileSync(path.join(IMAGENS_DIR, fname), buf);
    return `/api/imagens/${fname}`;
  } catch (e) {
    console.error("⚠️ Erro ao salvar imagem:", e.message);
    return null;
  }
}

// ── Rotas estáticas ────────────────────────────────────────────
app.use("/api/imagens", express.static(IMAGENS_DIR));
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ── API Lojas ──────────────────────────────────────────────────
app.get("/api/lojas", async (req, res) => {
  if (!pool) return res.json([]);
  const { rows } = await pool.query("SELECT perfil FROM lojas ORDER BY perfil");
  res.json(rows.map((r) => r.perfil));
});

app.post("/api/lojas/add", async (req, res) => {
  if (!pool) return res.status(503).json({ erro: "Banco indisponível" });
  const data = req.body || {};
  let perfis = [];
  if (Array.isArray(data.perfis)) perfis = data.perfis;
  else if (data.perfil) perfis = [data.perfil];

  if (!perfis.length) return res.status(400).json({ erro: "Nenhum perfil informado" });

  let adicionados = 0;
  for (const p of perfis) {
    const limpo = p.trim().replace("@", "").replace("https://www.instagram.com/", "").replace("/", "").toLowerCase();
    if (limpo) {
      await pool.query("INSERT INTO lojas (perfil) VALUES ($1) ON CONFLICT DO NOTHING", [limpo]);
      adicionados++;
    }
  }
  const { rows } = await pool.query("SELECT perfil FROM lojas ORDER BY perfil");
  res.json({ msg: `${adicionados} lojas adicionadas!`, lojas: rows.map((r) => r.perfil) });
});

app.post("/api/lojas/remove", async (req, res) => {
  if (!pool) return res.status(503).json({ erro: "Banco indisponível" });
  const perfil = (req.body.perfil || "").trim().replace("@", "").toLowerCase();
  await pool.query("DELETE FROM lojas WHERE perfil = $1", [perfil]);
  const { rows } = await pool.query("SELECT perfil FROM lojas ORDER BY perfil");
  res.json({ msg: `@${perfil} removido!`, lojas: rows.map((r) => r.perfil) });
});

// ── API Posts ──────────────────────────────────────────────────
app.get("/api/dados", async (req, res) => {
  if (!pool) return res.json([]);
  try {
    const { rows } = await pool.query("SELECT * FROM posts ORDER BY created_at DESC");
    const result = rows.map((r) => {
      const d = { ...r };
      d.keywords = JSON.parse(d.keywords || "[]");
      delete d.created_at;
      return d;
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

app.post("/api/posts/add", async (req, res) => {
  if (!pool) return res.status(503).json({ erro: "Banco indisponível" });
  const data = req.body || {};
  const titulo = (data.title || "").trim();
  if (!titulo) return res.status(400).json({ erro: "Campo 'title' obrigatório" });

  let imageUrl = data.image || "";
  if (data.image_b64) {
    const postId = data.id || `ext_${Date.now()}`;
    const saved = salvarImagemB64(postId, data.image_b64);
    if (saved) imageUrl = saved;
  }

  const post = {
    id: data.id || `ext_${Date.now()}`,
    tipo: data.tipo || "post",
    store: data.store || "@externo",
    title: titulo,
    description: data.description || "",
    price: data.price || "Consulte",
    image: imageUrl,
    url: data.url || "",
    date: data.date || new Date().toLocaleDateString("pt-BR"),
    likes: data.likes || 0,
    keywords: JSON.stringify(data.keywords || titulo.toLowerCase().split(" ")),
  };

  try {
    await pool.query(
      `INSERT INTO posts (id, tipo, store, title, description, price, image, url, date, likes, keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [post.id, post.tipo, post.store, post.title, post.description, post.price, post.image, post.url, post.date, post.likes, post.keywords]
    );
    res.status(201).json({ msg: "Post adicionado!", id: post.id });
  } catch (e) {
    if (e.code === "23505") return res.json({ msg: "Post já existe", id: post.id });
    res.status(500).json({ erro: e.message });
  }
});

app.post("/api/posts/sync", async (req, res) => {
  if (!pool) return res.status(503).json({ erro: "Banco indisponível" });
  const lista = req.body;
  if (!Array.isArray(lista)) return res.status(400).json({ erro: "Esperado uma lista de posts" });

  await pool.query("DELETE FROM posts");
  for (const post of lista) {
    let imageUrl = post.image || "";
    if (post.image_b64) {
      const saved = salvarImagemB64(post.id || `ext_${Date.now()}`, post.image_b64);
      if (saved) imageUrl = saved;
    }
    const keywords = JSON.stringify(post.keywords || []);
    try {
      await pool.query(
        `INSERT INTO posts (id, tipo, store, title, description, price, image, url, date, likes, keywords)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [post.id, post.tipo || "post", post.store, post.title, post.description, post.price || "Consulte", imageUrl, post.url, post.date, post.likes || 0, keywords]
      );
    } catch (e) {
      console.error("Erro ao inserir post:", e.message);
    }
  }
  res.json({ msg: `${lista.length} posts sincronizados!` });
});

app.get("/api/status", (req, res) => {
  res.json({ rodando: false, ultima_coleta: null, total_posts: 0, total_stories: 0, erro: null });
});

// ── WhatsApp via Z-API + Make ──────────────────────────────────
app.post("/api/whatsapp", async (req, res) => {
  if (!pool) return res.status(503).json({ erro: "Banco indisponível" });

  const data = req.body || {};
  const image = data.image || {};
  const caption = image.caption || data.text || "";
  const imageUrl = image.url || image.imageUrl || "";
  const imageB64 = image.imageBase64 || image.base64 || "";

  if (!caption && !imageUrl && !imageB64) {
    return res.status(400).json({ erro: "Mensagem sem conteúdo útil" });
  }

  // Extrai preço da legenda (ex: R$45.000 ou R$ 45.000)
  const precoMatch = caption.match(/R\$\s?[\d.,]+/i);
  const price = precoMatch ? precoMatch[0].replace(/\s/, "") : "Consulte";

  // Primeira linha como título
  const linhas = caption.split("\n").map(l => l.trim()).filter(l => l);
  const titulo = linhas[0] || "Veículo via WhatsApp";

  const postId = `wpp_${Date.now()}`;

  // Salva imagem se vier em base64
  let finalImageUrl = imageUrl;
  if (imageB64) {
    const saved = salvarImagemB64(postId, imageB64);
    if (saved) finalImageUrl = saved;
  }

  const keywords = caption.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const post = {
    id: postId,
    tipo: "post",
    store: data.senderName ? `@${data.senderName.replace(/\s+/g, "").toLowerCase()}` : "@whatsapp",
    title: titulo,
    description: caption,
    price,
    image: finalImageUrl,
    url: "",
    date: new Date().toLocaleDateString("pt-BR"),
    likes: 0,
    keywords: JSON.stringify(keywords),
  };

  try {
    await pool.query(
      `INSERT INTO posts (id, tipo, store, title, description, price, image, url, date, likes, keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [post.id, post.tipo, post.store, post.title, post.description, post.price, post.image, post.url, post.date, post.likes, post.keywords]
    );
    console.log(`✅ Post WhatsApp salvo: ${post.title}`);
    res.status(201).json({ msg: "Post salvo!", id: post.id });
  } catch (e) {
    console.error("Erro ao salvar post WhatsApp:", e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚗 Repasse Central rodando na porta ${PORT}`);
  });
});
