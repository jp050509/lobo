"use strict";

/* Usa comum.js: obterSessao, cadastrarUsuario, autenticar, encerrarSessao,
   podeEditarCardapio, lerCardapioExtra, salvarCardapioExtra, CATEGORIAS. */

const $ = (id) => document.getElementById(id);
const moeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let timerNotificacao = null;

function mostrarMensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = `mensagem-formulario ${tipo}`;
}

function notificar(texto) {
    clearTimeout(timerNotificacao);
    $("notificacao").textContent = texto;
    $("notificacao").classList.add("ativa");
    timerNotificacao = setTimeout(() => $("notificacao").classList.remove("ativa"), 3000);
}

/* ===== Abas entrar / cadastrar ===== */
function trocarAba(aba) {
    const entrando = aba === "login";
    $("formLogin").classList.toggle("oculto", !entrando);
    $("formCadastro").classList.toggle("oculto", entrando);
    $("abaLogin").setAttribute("aria-selected", String(entrando));
    $("abaCadastro").setAttribute("aria-selected", String(!entrando));
}

$("abaLogin").addEventListener("click", () => trocarAba("login"));
$("abaCadastro").addEventListener("click", () => trocarAba("cadastro"));

/* ===== Cadastro ===== */
$("formCadastro").addEventListener("submit", async(evento) => {
    evento.preventDefault();
    const mensagem = $("mensagemCadastro");

    const dados = {
        nome: $("nomeCadastro").value.trim(),
        email: $("emailCadastro").value.trim().toLowerCase(),
        funcao: $("funcaoCadastro").value,
        senha: $("senhaCadastro").value
    };

    if (dados.senha !== $("confirmarSenha").value) {
        mostrarMensagem(mensagem, "As senhas não são iguais.", "erro");
        return;
    }

    const resultado = await cadastrarUsuario(dados);
    if (!resultado.ok) {
        mostrarMensagem(mensagem, resultado.erro, "erro");
        return;
    }

    $("formCadastro").reset();
    mensagem.textContent = "";
    trocarAba("login");
    $("emailLogin").value = dados.email;
    mostrarMensagem($("mensagemLogin"), "Cadastro realizado! Agora é só entrar.", "sucesso");
    $("senhaLogin").focus();
});

/* ===== Login e saída ===== */
$("formLogin").addEventListener("submit", async(evento) => {
    evento.preventDefault();

    const resultado = await autenticar($("emailLogin").value.trim().toLowerCase(), $("senhaLogin").value);
    if (!resultado.ok) {
        mostrarMensagem($("mensagemLogin"), resultado.erro, "erro");
        return;
    }

    $("formLogin").reset();
    $("mensagemLogin").textContent = "";
    atualizarTela();
    notificar(`Bem-vindo, ${resultado.sessao.nome}!`);
});

$("botaoSair").addEventListener("click", () => {
    encerrarSessao();
    atualizarTela();
    notificar("Sessão encerrada.");
});

/* ===== Gestão do cardápio ===== */
function atualizarTela() {
    const sessao = obterSessao();
    $("telaAcesso").classList.toggle("oculto", Boolean(sessao));
    $("telaGestao").classList.toggle("oculto", !sessao);
    if (!sessao) return;

    $("saudacao").textContent = `Olá, ${sessao.nome.split(" ")[0]}!`;
    $("cargoAtual").textContent = sessao.funcao;

    const pode = podeEditarCardapio();
    $("avisoSemPermissao").classList.toggle("oculto", pode);
    $("blocoCardapio").classList.toggle("oculto", !pode);
    if (pode) renderizarLista();
}

function renderizarLista() {
    const itens = lerCardapioExtra().sort(
        (a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome)
    );
    const lista = $("listaItens");
    lista.replaceChildren();
    $("listaVazia").classList.toggle("oculto", itens.length > 0);

    itens.forEach((item) => {
        const linha = document.createElement("li");
        linha.className = "linha-pedido";

        const nome = document.createElement("span");
        nome.textContent = `${item.icone} ${item.nome}`;
        const categoria = document.createElement("small");
        categoria.className = "etiqueta-categoria";
        categoria.textContent = CATEGORIAS[item.categoria] || item.categoria;
        nome.append(" ", categoria);

        const preco = document.createElement("strong");
        preco.textContent = moeda(item.preco);

        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "botao-add botao-remover";
        remover.textContent = "Remover";
        remover.dataset.id = item.id;
        remover.setAttribute("aria-label", `Remover ${item.nome}`);

        linha.append(nome, preco, remover);
        lista.appendChild(linha);
    });
}

$("formItem").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const mensagem = $("mensagemItem");
    const erro = (texto) => mostrarMensagem(mensagem, texto, "erro");

    const sessao = obterSessao();
    if (!podeEditarCardapio()) return erro("Seu cargo não pode alterar o cardápio.");

    const categoria = $("categoriaItem").value;
    const nome = $("nomeItem").value.trim();
    const preco = Math.round(Number($("precoItem").value.replace(",", ".")) * 100) / 100;

    if (!CATEGORIAS[categoria]) return erro("Escolha uma categoria válida.");
    if (!(preco > 0 && preco < 10000)) return erro("Informe um preço válido, como 49,90.");

    const lista = lerCardapioExtra();
    if (lista.some((i) => i.categoria === categoria && i.nome.toLowerCase() === nome.toLowerCase())) {
        return erro("Este item já foi incluído nessa categoria.");
    }

    lista.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        categoria,
        nome,
        descricao: $("descricaoItem").value.trim(),
        preco,
        icone: $("iconeItem").value,
        autor: sessao.nome,
        criadoEm: new Date().toISOString()
    });

    if (!salvarCardapioExtra(lista)) return erro("Não foi possível salvar o item.");

    $("formItem").reset();
    mostrarMensagem(mensagem, `“${nome}” incluído no cardápio.`, "sucesso");
    renderizarLista();
    notificar(`${nome} já aparece no cardápio.`);
});

$("listaItens").addEventListener("click", (evento) => {
    const botao = evento.target.closest(".botao-remover");
    if (!botao || !podeEditarCardapio()) return;
    if (!confirm("Remover este item do cardápio?")) return;

    salvarCardapioExtra(lerCardapioExtra().filter((i) => i.id !== botao.dataset.id));
    renderizarLista();
    notificar("Item removido.");
});

atualizarTela();