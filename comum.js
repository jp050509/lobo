"use strict";

/* Código compartilhado entre index.html e painel.html */

const CHAVE_USUARIOS = "usuariosChurrascaria";
const CHAVE_SESSAO = "usuarioLogado";
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000; // 8 horas
const CARGOS = ["Dono", "Gerente", "Chef", "Garçom"];
const CARGOS_ANTIGOS = { "Chef de cozinha": "Chef" };


/* localStorage pode falhar (modo privado, JSON corrompido): nunca quebrar a página */
function lerJSON(chave, padrao) {
    try {
        const valor = localStorage.getItem(chave);
        return valor ? JSON.parse(valor) : padrao;
    } catch {
        return padrao;
    }
}

function gravarJSON(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
        return true;
    } catch {
        return false;
    }
}

/* ========== Segurança: senha com salt + PBKDF2 (nunca em texto puro) ========== */
const paraHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

const deHex = (hex) =>
    new Uint8Array(hex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));

/* sha256-inicio */
const sha256 = (() => {
    const K = [];
    const H0 = [];
    const fracao = (x) => ((x % 1) * 4294967296) >>> 0;
    for (let n = 2; K.length < 64; n++) {
        let primo = true;
        for (let d = 2; d * d <= n; d++)
            if (n % d === 0) primo = false;
        if (!primo) continue;
        K.push(fracao(Math.cbrt(n)));
        if (H0.length < 8) H0.push(fracao(Math.sqrt(n)));
    }
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));

    return (bytes) => {
        const tam = bytes.length;
        const total = (((tam + 8) >> 6) + 1) << 6;
        const m = new Uint8Array(total);
        m.set(bytes);
        m[tam] = 0x80;
        const dv = new DataView(m.buffer);
        dv.setUint32(total - 4, (tam * 8) >>> 0);
        const w = new Uint32Array(64);
        let hh = H0.slice();

        for (let off = 0; off < total; off += 64) {
            for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }
            let [a, b, c, d, e, f, g, h] = hh;
            for (let i = 0; i < 64; i++) {
                const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
                const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
                h = g;
                g = f;
                f = e;
                e = (d + t1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) >>> 0;
            }
            hh = hh.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) >>> 0);
        }
        return hh.map((v) => v.toString(16).padStart(8, "0")).join("");
    };
})();
/* sha256-fim */

/* Usa PBKDF2 (Web Crypto) quando disponível; senão, SHA-256 em JS puro.
   Web Crypto só existe em localhost/HTTPS, por isso o plano B. */
async function gerarHash(senha, saltHex, alg) {
    const sal = saltHex ? deHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const usarPbkdf2 = alg ? alg === "pbkdf2" : Boolean(crypto.subtle);

    if (usarPbkdf2) {
        const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: sal, iterations: 150000, hash: "SHA-256" },
            chave,
            256
        );
        return { sal: paraHex(sal), hash: paraHex(bits), alg: "pbkdf2" };
    }

    const texto = new TextEncoder();
    let h = paraHex(sal) + senha;
    for (let i = 0; i < 5000; i++) h = sha256(texto.encode(h + senha));
    return { sal: paraHex(sal), hash: h, alg: "sha256" };
}


/* ========== Sessão com expiração ========== */
function obterSessao() {
    const sessao = lerJSON(CHAVE_SESSAO, null);
    if (!sessao) return null;

    if (Date.now() > sessao.expiraEm || !CARGOS.includes(sessao.funcao)) {
        localStorage.removeItem(CHAVE_SESSAO);
        return null;
    }
    return sessao;
}


/* ========== Cardápio e permissões ========== */
const PODE_EDITAR_CARDAPIO = ["Dono", "Gerente", "Chef"];
const CATEGORIAS = { carnes: "Carnes", acompanhamentos: "Acompanhamentos", sobremesas: "Sobremesas", bebidas: "Bebidas" };
const CHAVE_CARDAPIO_EXTRA = "cardapioExtraChurrascaria";

function lerCardapioExtra() {
    const lista = lerJSON(CHAVE_CARDAPIO_EXTRA, []);
    return Array.isArray(lista) ? lista : [];
}

const salvarCardapioExtra = (lista) => gravarJSON(CHAVE_CARDAPIO_EXTRA, lista);

function podeEditarCardapio() {
    const sessao = obterSessao();
    return Boolean(sessao && PODE_EDITAR_CARDAPIO.includes(sessao.funcao));
}

/* ========== Cadastro e login (usados por index.html e painel.html) ========== */
async function cadastrarUsuario({ nome, email, funcao, senha }) {
    if (!CARGOS.includes(funcao)) return { ok: false, erro: "Escolha um cargo válido." };

    const usuarios = lerJSON(CHAVE_USUARIOS, []);
    if (usuarios.some((u) => u.email === email)) return { ok: false, erro: "Este e-mail já está cadastrado." };

    try {
        const { sal, hash, alg } = await gerarHash(senha);
        usuarios.push({ nome, email, funcao, sal, hash, alg });
    } catch {
        return { ok: false, erro: "Não foi possível proteger a senha neste navegador. Abra o site pelo Live Server." };
    }

    if (!gravarJSON(CHAVE_USUARIOS, usuarios)) return { ok: false, erro: "Não foi possível salvar o cadastro." };
    return { ok: true };
}

async function autenticar(email, senha) {
    const usuarios = lerJSON(CHAVE_USUARIOS, []);
    const usuario = usuarios.find((u) => u.email === email);

    let valido = false;
    try {
        if (usuario && usuario.hash) {
            const { hash } = await gerarHash(senha, usuario.sal, usuario.alg || "pbkdf2");
            valido = hash === usuario.hash;
        } else if (usuario && usuario.senha) {
            /* Conta da versão antiga (senha em texto puro): confere e converte para hash */
            valido = usuario.senha === senha;
            if (valido) {
                Object.assign(usuario, await gerarHash(senha));
                delete usuario.senha;
                gravarJSON(CHAVE_USUARIOS, usuarios);
            }
        }
    } catch {
        return { ok: false, erro: "Não foi possível verificar a senha neste navegador. Abra o site pelo Live Server." };
    }

    if (!valido) return { ok: false, erro: "E-mail ou senha inválidos." };

    const cargo = CARGOS.includes(usuario.funcao) ? usuario.funcao : CARGOS_ANTIGOS[usuario.funcao];
    if (!cargo) return { ok: false, erro: "Este cargo não existe mais. Faça um novo cadastro." };

    const sessao = { nome: usuario.nome, email: usuario.email, funcao: cargo, expiraEm: Date.now() + DURACAO_SESSAO_MS };
    gravarJSON(CHAVE_SESSAO, sessao);
    return { ok: true, sessao };
}

function encerrarSessao() {
    localStorage.removeItem(CHAVE_SESSAO);
}