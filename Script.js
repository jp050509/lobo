"use strict";

/* ========== Constantes e utilitários ========== */
const $ = (id) => document.getElementById(id);

const modalLogin = $("modalLogin");
const modalCadastro = $("modalCadastro");
const abrirLogin = $("abrirLogin");
const abrirCadastro = $("abrirCadastro");
const formLogin = $("formLogin");
const formCadastro = $("formCadastro");
const mensagemLogin = $("mensagemLogin");
const mensagemCadastro = $("mensagemCadastro");
const painelUsuario = $("painelUsuario");
const nomeUsuario = $("nomeUsuario");
const funcaoUsuario = $("funcaoUsuario");
const acoesPainel = $("acoesPainel");
const botaoSair = $("botaoSair");
const notificacao = $("notificacao");
const menuMobile = $("menuMobile");
const navegacao = $("navegacao");

let ultimoGatilho = null;
let timerNotificacao = null;

/* ========== Modais (com retorno de foco e foco preso) ========== */
function abrirModal(modal, gatilho) {
    ultimoGatilho = gatilho || document.activeElement;
    modal.classList.add("ativo");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-aberto");
    setTimeout(() => {
        const campo = modal.querySelector("input, select");
        if (campo) campo.focus();
    }, 100);
}

function fecharModal(modal) {
    modal.classList.remove("ativo");
    modal.setAttribute("aria-hidden", "true");

    if (!document.querySelector(".modal.ativo")) {
        document.body.classList.remove("modal-aberto");
        if (ultimoGatilho && ultimoGatilho.focus) ultimoGatilho.focus();
    }
}

function prenderFoco(evento) {
    const modal = document.querySelector(".modal.ativo");
    if (!modal || evento.key !== "Tab") return;

    const focaveis = [...modal.querySelectorAll("button, input, select")].filter((el) => el.offsetParent !== null);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
    }
}

/* ========== Feedback ========== */
function mostrarMensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = `mensagem-formulario ${tipo}`;
}

function mostrarNotificacao(texto) {
    clearTimeout(timerNotificacao);
    notificacao.textContent = texto;
    notificacao.classList.add("ativa");
    timerNotificacao = setTimeout(() => notificacao.classList.remove("ativa"), 3000);
}

/* ========== Painel por função ========== */
function avisarSessao() {
    document.dispatchEvent(new Event("sessao-alterada"));
}

const ACOES_POR_FUNCAO = {
    "Dono": [
        ["Visão geral", "Acompanhe vendas e pedidos do dia."],
        ["Equipe", "Veja os cargos e as pessoas cadastradas."],
        ["Cardápio e preços", "Defina os pratos e os valores."]
    ],
    "Gerente": [
        ["Pedidos das mesas", "Monte, altere e acompanhe todos os pedidos."],
        ["Finalizar pedidos", "Receba o pagamento e feche a conta da mesa."],
        ["Equipe e cardápio", "Acompanhe a equipe e a disponibilidade dos pratos."]
    ],
    "Chef": [
        ["Pedidos em preparo", "Acompanhe os pedidos enviados à cozinha."],
        ["Estoque de ingredientes", "Consulte os ingredientes disponíveis."],
        ["Cardápio", "Atualize a disponibilidade dos pratos."]
    ],
    "Garçom": [
        ["Abrir mesa", "Inicie o atendimento de uma nova mesa."],
        ["Registrar pedido", "Envie os pedidos diretamente à cozinha."],
        ["Mesas atendidas", "Acompanhe o andamento dos atendimentos."]
    ]
};

function atualizarPainel(usuario) {
    if (!usuario) {
        painelUsuario.classList.add("oculto");
        abrirLogin.textContent = "Entrar";
        abrirCadastro.classList.remove("oculto");
        $("linkGestao").classList.add("oculto");
        avisarSessao();
        return;
    }

    nomeUsuario.textContent = usuario.nome;
    funcaoUsuario.textContent = usuario.funcao;
    acoesPainel.replaceChildren();

    (ACOES_POR_FUNCAO[usuario.funcao] || []).forEach(([titulo, descricao]) => {
        const cartao = document.createElement("div");
        cartao.className = "acao";

        const tituloAcao = document.createElement("strong");
        tituloAcao.textContent = titulo;

        const descricaoAcao = document.createElement("span");
        descricaoAcao.textContent = descricao;

        cartao.append(tituloAcao, descricaoAcao);
        acoesPainel.appendChild(cartao);
    });

    painelUsuario.classList.remove("oculto");
    abrirLogin.textContent = usuario.nome.split(" ")[0];
    abrirCadastro.classList.add("oculto");
    $("linkGestao").classList.toggle("oculto", !podeEditarCardapio());
    avisarSessao();
}

/* ========== Eventos de abertura/fechamento ========== */
abrirLogin.addEventListener("click", () => {
    if (obterSessao()) {
        painelUsuario.scrollIntoView({ behavior: "smooth" });
        return;
    }
    abrirModal(modalLogin, abrirLogin);
});

abrirCadastro.addEventListener("click", () => abrirModal(modalCadastro, abrirCadastro));

document.querySelectorAll(".fechar-modal").forEach((botao) => {
    botao.addEventListener("click", () => fecharModal(botao.closest(".modal")));
});

document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (evento) => {
        if (evento.target === modal) fecharModal(modal);
    });
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
        document.querySelectorAll(".modal.ativo").forEach(fecharModal);
    }
    prenderFoco(evento);
});

/* ========== Cadastro ========== */
formCadastro.addEventListener("submit", async(evento) => {
    evento.preventDefault();

    const dados = {
        nome: $("nomeCadastro").value.trim(),
        email: $("emailCadastro").value.trim().toLowerCase(),
        funcao: $("funcaoCadastro").value,
        senha: $("senhaCadastro").value
    };

    if (dados.senha !== $("confirmarSenha").value) {
        mostrarMensagem(mensagemCadastro, "As senhas não são iguais.", "erro");
        return;
    }

    const resultado = await cadastrarUsuario(dados);
    if (!resultado.ok) {
        mostrarMensagem(mensagemCadastro, resultado.erro, "erro");
        return;
    }

    mostrarMensagem(mensagemCadastro, "Cadastro realizado com sucesso.", "sucesso");
    formCadastro.reset();

    setTimeout(() => {
        fecharModal(modalCadastro);
        mensagemCadastro.textContent = "";
        $("emailLogin").value = dados.email;
        abrirModal(modalLogin, abrirLogin);
    }, 900);
});

/* ========== Login ========== */
formLogin.addEventListener("submit", async(evento) => {
    evento.preventDefault();

    const resultado = await autenticar($("emailLogin").value.trim().toLowerCase(), $("senhaLogin").value);
    if (!resultado.ok) {
        mostrarMensagem(mensagemLogin, resultado.erro, "erro");
        return;
    }

    atualizarPainel(resultado.sessao);
    formLogin.reset();
    mensagemLogin.textContent = "";
    fecharModal(modalLogin);
    mostrarNotificacao(`Bem-vindo, ${resultado.sessao.nome}!`);
    painelUsuario.scrollIntoView({ behavior: "smooth" });
});

botaoSair.addEventListener("click", () => {
    encerrarSessao();
    atualizarPainel(null);
    mostrarNotificacao("Sessão encerrada.");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ========== Menu mobile ========== */
function definirMenu(aberto) {
    navegacao.classList.toggle("ativo", aberto);
    menuMobile.setAttribute("aria-expanded", String(aberto));
    menuMobile.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    menuMobile.textContent = aberto ? "×" : "☰";
}

menuMobile.addEventListener("click", () => {
    definirMenu(!navegacao.classList.contains("ativo"));
});

navegacao.querySelectorAll("a, button").forEach((item) => {
    item.addEventListener("click", () => definirMenu(false));
});

/* ========== Animação de entrada ========== */
const observador = new IntersectionObserver(
    (entradas) => {
        entradas.forEach((entrada) => {
            if (entrada.isIntersecting) {
                entrada.target.classList.add("visivel");
                observador.unobserve(entrada.target);
            }
        });
    }, { threshold: 0.12 }
);

document.querySelectorAll(".animar").forEach((el) => observador.observe(el));

/* ========== Inicialização ========== */
$("anoAtual").textContent = new Date().getFullYear();
atualizarPainel(obterSessao());