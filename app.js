/**
 * REPASSE CENTRAL — app.js
 * Filtros: busca + loja + tipo + ordenação
 */

// URL da API — use relativo "" se o frontend e backend estiverem no mesmo servidor
const API_URL = "";

const EXEMPLO = [
    { id: "e1", tipo: "post", store: "@repassesgr", title: "Chevrolet Zafira Elite 2012", description: "⭐ Zafira Elite completa! Teto solar, automática, bancos em couro. Raridade!", price: "R$ 38.900", image: "", url: "https://www.instagram.com/repassesgr/", date: "15/03/2026", likes: 87, keywords: ["zafira", "chevrolet", "7lugares", "automatica"] },
    { id: "e2", tipo: "post", store: "@cwb.repasse_", title: "Toyota Corolla XEI 2018", description: "✅ Corolla XEI 2.0 — único dono, revisões em dia. Repasse direto!", price: "R$ 89.900", image: "", url: "https://www.instagram.com/cwb.repasse_/", date: "14/03/2026", likes: 120, keywords: ["corolla", "toyota", "xei", "sedan"] },
    { id: "e3", tipo: "post", store: "@autopar.repasses", title: "VW Gol 1.6 GIV 2015", description: "🚗 Gol completo! Ar, direção hidráulica, vidros elétricos. Ótimo estado.", price: "R$ 34.500", image: "", url: "https://www.instagram.com/autopar.repasses/", date: "13/03/2026", likes: 54, keywords: ["gol", "vw", "volkswagen", "hatch"] },
    { id: "e4", tipo: "post", store: "@repassesgr", title: "Honda Civic G10 EXL 2017", description: "🔥 Civic G10 EXL painel digital, couro, multimídia completa. Procedência!", price: "R$ 98.900", image: "", url: "https://www.instagram.com/repassesgr/", date: "12/03/2026", likes: 203, keywords: ["civic", "honda", "exl", "g10"] },
    { id: "e5", tipo: "post", store: "@cwb.repasse_", title: "Hyundai HB20 Comfort 2021", description: "🏁 HB20 1.0 Flex 2021, apenas 38.000km. Completo, sem detalhes.", price: "R$ 58.500", image: "", url: "https://www.instagram.com/cwb.repasse_/", date: "11/03/2026", likes: 76, keywords: ["hb20", "hyundai", "hatch", "economico"] },
    { id: "e6", tipo: "post", store: "@autopar.repasses", title: "Fiat Strada Freedom CD 2023", description: "🛻 Strada Cabine Dupla 2023 nova geração, garantia de fábrica!", price: "R$ 97.000", image: "", url: "https://www.instagram.com/autopar.repasses/", date: "10/03/2026", likes: 98, keywords: ["strada", "fiat", "pickup", "cabinedupla"] },
    { id: "e7", tipo: "post", store: "@repassesgr", title: "Jeep Renegade Sport 2020", description: "🌟 Renegade Sport 1.8 flex, completo, laudo GR! SUV com ótimo custo-benefício.", price: "R$ 89.000", image: "", url: "https://www.instagram.com/repassesgr/", date: "09/03/2026", likes: 145, keywords: ["jeep", "renegade", "suv", "sport"] },
    { id: "e8", tipo: "story", store: "@repassesgr", title: "Story — @repassesgr", description: "📸 Story capturado. Acesse antes de expirar!", price: "Consulte", image: "", url: "https://www.instagram.com/repassesgr/", date: "15/03/2026", likes: 0, keywords: ["story", "repassesgr"] },
    { id: "e9", tipo: "story", store: "@cwb.repasse_", title: "Story — @cwb.repasse_", description: "📸 Story capturado. Acesse antes de expirar!", price: "Consulte", image: "", url: "https://www.instagram.com/cwb.repasse_/", date: "15/03/2026", likes: 0, keywords: ["story", "cwb"] },
];

const STORE_COLORS = {
    "@repassesgr": { bg: "rgba(99,102,241,.15)", text: "#a5b4fc" },
    "@cwb.repasse_": { bg: "rgba(16,185,129,.15)", text: "#6ee7b7" },
    "@autopar.repasses": { bg: "rgba(251,146,60,.15)", text: "#fed7aa" },
};
const cor = s => STORE_COLORS[s] || { bg: "rgba(148,163,184,.15)", text: "#cbd5e1" };

// Elementos
const grid = document.getElementById("carGrid");
const fBusca = document.getElementById("fBusca");
const fLoja = document.getElementById("fLoja");
const fOrdem = document.getElementById("fOrdem");
const btnLimpar = document.getElementById("btnLimpar");
const statusEl = document.getElementById("statusInfo");
const countEl = document.getElementById("resultCount");
const noticeEl = document.getElementById("notice");
const btnAtual = document.getElementById("btnAtualizar");
const tabs = document.querySelectorAll(".tabs .tab");
const btnLinkCliente = document.getElementById("btnLinkCliente");

let DATA = [];
let tipoAtivo = "todos";

// Modo Admin só com ?admin=1 — padrão é modo cliente
const inIframe = window.self !== window.top;
const isModoAdmin = new URLSearchParams(window.location.search).has("admin") ||
    sessionStorage.getItem("modo-admin") === "1";
const isModoCliente = !isModoAdmin;

if (isModoCliente) {
    document.body.classList.add("modo-cliente");
}

if (btnLinkCliente) {
    btnLinkCliente.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.delete("admin");
        navigator.clipboard.writeText(url.toString());
        alert("Link de cliente copiado!");
    });
}

// ── Carga de dados ─────────────────────────────────────────
async function carregar() {
    try {
        const r = await fetch(API_URL + "/api/posts");
        if (!r.ok) throw new Error();
        const d = await r.json();
        // Garante que keywords e outros campos sejam interpretados corretamente do Banco
        DATA = d.map(item => ({
            ...item,
            keywords: typeof item.keywords === 'string' ? JSON.parse(item.keywords) : (item.keywords || [])
        }));

        DATA = DATA.length ? DATA : fallback();
        if (DATA === EXEMPLO) noticeEl.style.display = "block";
        else noticeEl.style.display = "none";

        const st = await fetch(API_URL + "/api/status").then(x => x.json()).catch(() => null);
        if (st && statusEl) {
            const rodando = st.rodando;
            statusEl.innerHTML = `<span class="dot ${rodando ? "dot-y" : "dot-g"}"></span>
        ${rodando ? "Coletando agora..." :
                    `Atualizado: ${st.ultima_coleta || "—"} &nbsp;|&nbsp; ${st.total_posts || 0} posts, ${st.total_stories || 0} stories`}`;
        }
    } catch {
        DATA = fallback();
        if (statusEl) statusEl.innerHTML = `<span class="dot dot-gr"></span> Modo offline — dados de exemplo`;
        noticeEl.style.display = "block";
    }
    atualizar();
}

function fallback() {
    if (typeof CAR_DATA !== "undefined" && CAR_DATA.length) return CAR_DATA;
    return EXEMPLO;
}

// ── Filtrar + ordenar ──────────────────────────────────────
function removerAcentos(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function filtrar() {
    const termo = removerAcentos(fBusca.value.trim());
    const loja = fLoja.value;
    const ordem = fOrdem.value;

    let lista = DATA.filter(c => {
        if (tipoAtivo === "posts" && c.tipo !== "post") return false;
        if (tipoAtivo === "stories" && c.tipo !== "story") return false;
        if (isModoCliente && c.tipo === "story") return false;
        if (isModoCliente && c.tipo === "post" && !/\b(19|20)\d{2}\b/.test(c.title)) return false;
        if (loja && c.store !== loja) return false;
        if (!termo) return true;

        // Procura o termo ignorando acentos no título, descrição e loja
        return removerAcentos(c.title).includes(termo)
            || removerAcentos(c.description).includes(termo)
            || removerAcentos(c.store).includes(termo)
            || (c.keywords || []).some(k => removerAcentos(k).includes(termo));
    });

    // Ordenação
    if (ordem === "menor-preco" || ordem === "maior-preco") {
        lista = lista.sort((a, b) => {
            const va = parseFloat((a.price || "").replace(/[^\d,]/g, "").replace(",", ".")) || 9e9;
            const vb = parseFloat((b.price || "").replace(/[^\d,]/g, "").replace(",", ".")) || 9e9;
            return ordem === "menor-preco" ? va - vb : vb - va;
        });
    }

    return lista;
}

// ── Render cards ───────────────────────────────────────────
function render(lista) {
    grid.innerHTML = "";
    if (countEl) countEl.textContent = `${lista.length} resultado${lista.length !== 1 ? "s" : ""}`;

    if (!lista.length) {
        grid.innerHTML = `<div class="empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <p>Nenhum resultado encontrado.</p><p class="sub">Tente outro termo ou filtro.</p></div>`;
        return;
    }

    lista.forEach((c, i) => {
        const cl = cor(c.store);
        const isS = c.tipo === "story";
        const img = c.image && (c.image.startsWith("data:image") || c.image.startsWith("http") || c.image.startsWith("/api/"))
            ? c.image
            : c.image ? `/api/imagens/${c.image.split(/[/\\]/).pop()}`
                : isS ? "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&q=80&w=800"
                    : "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800";

        let btnText = isS ? 'Ver Story ↗' : 'Ver Post ↗';
        let btnHref = c.url;

        if (isModoCliente) {
            btnText = "ACESSAR DETALHES 🚀";
            const zapMsg = encodeURIComponent(`Olá! Gostaria de ter acesso aos detalhes deste veículo que vi no Repasse Central:\n\n🚗 *${c.title}*\n🏪 Loja: ${c.store}\n💰 Preço aprox: ${c.price}`);
            btnHref = `https://wa.me/5541991211030?text=${zapMsg}`;
        }

        const el = document.createElement("div");
        el.className = "card" + (isS ? " story-card" : "");
        el.style.animationDelay = `${i * .06}s`;
        el.innerHTML = `
      <div class="card-img">
        <img src="${img}" alt="${c.title}"
             onerror="this.src='https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800'">
        <span class="badge badge-store" style="background:${cl.bg};color:${cl.text}">${c.store}</span>
        <span class="type-flag ${isS ? 'flag-story' : 'flag-post'}">${isS ? '📸 Story' : '🖼️ Post'}</span>
        ${isS ? '<div class="timer-24">⏳ 24h</div>' : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title">${c.title}</h3>
        <p class="card-desc">${c.description}</p>
        <div class="card-footer">
          <span class="price">${c.price}</span>
          <a href="${btnHref}" target="_blank" class="ver-btn">${btnText}</a>
        </div>
        <div class="card-meta"><span>📅 ${c.date}</span>${c.likes ? `<span>❤️ ${c.likes}</span>` : ''}</div>
      </div>`;
        grid.appendChild(el);
    });
}

function atualizar() { render(filtrar()); }

// ── Eventos ────────────────────────────────────────────────
[fBusca, fLoja, fOrdem].forEach(el => el.addEventListener("input", atualizar));

tabs.forEach(t => {
    t.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        tipoAtivo = t.dataset.f;
        atualizar();
    });
});

btnLimpar.addEventListener("click", () => {
    fBusca.value = ""; fLoja.value = ""; fOrdem.value = "recente";
    tipoAtivo = "todos";
    tabs.forEach(t => t.classList.toggle("active", t.dataset.f === "todos"));
    atualizar();
});

if (btnAtual) {
    btnAtual.addEventListener("click", async () => {
        btnAtual.disabled = true; btnAtual.textContent = "⏳ Iniciando...";
        try {
            await fetch(API_URL + "/api/atualizar", { method: "POST" });
            btnAtual.textContent = "⏳ Coletando...";
            setTimeout(() => { carregar(); btnAtual.disabled = false; btnAtual.textContent = "🔄 Atualizar agora"; }, 8000);
        } catch {
            btnAtual.disabled = false; btnAtual.textContent = "🔄 Atualizar agora";
        }
    });
}

// ── Gerenciamento de Lojas ─────────────────────────────────
const btnAbrirLojas = document.getElementById("btnGerenciarLojas");
const btnFecharLojas = document.getElementById("fecharModal");
const modalLojas = document.getElementById("modalLojas");
const inputNovaLoja = document.getElementById("inputNovaLoja");
const btnAdicionarLoja = document.getElementById("btnAdicionarLoja");
const listaLojasEl = document.getElementById("listaLojas");
const lojasPillContainer = document.getElementById("lojasPillContainer");

let lojasCadastradas = ["repassesgr", "cwb.repasse_", "autopar.repasses"]; // default fallback

function renderLojasUI() {
    // Atualiza Pills do Cabeçalho
    if (lojasPillContainer) {
        lojasPillContainer.innerHTML = lojasCadastradas.map(loja => {
            const c = cor("@" + loja);
            return `<span style="background:${c.bg};color:${c.text};padding:0.25rem 0.8rem;border-radius:999px;font-size:0.75rem;font-weight:700">@${loja}</span>`;
        }).join("");
    }

    // Atualiza Select de Filtros
    if (fLoja) {
        const arr = ['<option value="">Todas as lojas</option>'];
        lojasCadastradas.forEach(loja => arr.push(`<option value="@${loja}">@${loja}</option>`));
        fLoja.innerHTML = arr.join("");
    }

    // Atualiza Lista do Modal
    if (listaLojasEl) {
        if (lojasCadastradas.length === 0) {
            listaLojasEl.innerHTML = `<li style="justify-content:center;color:#64748b">Nenhuma loja cadastrada</li>`;
        } else {
            listaLojasEl.innerHTML = lojasCadastradas.map(loja => `
        <li>
          <span>@${loja}</span>
          <button class="btn-remover" onclick="removerLoja('${loja}')">Remover</button>
        </li>
      `).join("");
        }
    }
}

async function carregarLojas() {
    try {
        const res = await fetch(API_URL + "/api/lojas");
        if (res.ok) {
            lojasCadastradas = await res.json();
            renderLojasUI();
        }
    } catch (err) {
        renderLojasUI(); // carrega fallback offline
    }
}

// Eventos Modal
if (btnAbrirLojas) btnAbrirLojas.addEventListener("click", () => { carregarLojas(); modalLojas.style.display = "flex"; });
if (btnFecharLojas) btnFecharLojas.addEventListener("click", () => modalLojas.style.display = "none");
if (modalLojas) {
    modalLojas.addEventListener("click", (e) => {
        if (e.target === modalLojas) modalLojas.style.display = "none";
    });
}

// Adicionar Loja
if (btnAdicionarLoja) {
    btnAdicionarLoja.addEventListener("click", async () => {
        const val = inputNovaLoja.value.trim();
        if (!val) return;

        // Suporta vários @ separados por vírgula, espaço ou quebra de linha
        const perfis = val.split(/[\n, ]+/).map(p => p.trim()).filter(p => p);

        btnAdicionarLoja.disabled = true;
        btnAdicionarLoja.textContent = "⏳";
        try {
            const r = await fetch(API_URL + "/api/lojas/add", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ perfis: perfis })
            });
            const data = await r.json();
            if (r.ok) {
                lojasCadastradas = data.lojas;
                renderLojasUI();
                inputNovaLoja.value = "";
            } else {
                alert(data.erro || "Erro ao adicionar");
            }
        } catch (e) {
            alert("Erro na comunicação com a API");
        }
        btnAdicionarLoja.disabled = false;
        btnAdicionarLoja.textContent = "Adicionar";
    });
}

// Remover Loja
window.removerLoja = async function (perfil) {
    if (!confirm(`Tem certeza que deseja remover @${perfil}?`)) return;

    try {
        const r = await fetch(API_URL + "/api/lojas/remove", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ perfil })
        });
        if (r.ok) {
            const data = await r.json();
            lojasCadastradas = data.lojas;
            renderLojasUI();
        }
    } catch (e) {
        alert("Erro na comunicação com a API");
    }
};

// Start Initialize do app.js
carregarLojas();
carregar();
setInterval(carregar, 5 * 60 * 1000); // auto-refresh 5 min
