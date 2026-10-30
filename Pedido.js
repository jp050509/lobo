"use strict";

/* Usa script.js ($, abrirModal, fecharModal, mostrarMensagem, mostrarNotificacao)
   e comum.js (lerJSON, gravarJSON, obterSessao). */

const CHAVE_COMANDAS = "comandasChurrascaria";
const CHAVE_PEDIDOS = "pedidosChurrascaria";
const NUMERO_DE_MESAS = 20; // altere aqui para o número de mesas do restaurante
const BALCAO = "Balcão";
const PIX_DEMO = "00020126580014br.gov.bcb.pix0136demonstracao-sabor-do-sul5204000053039865802BR5909SABOR SUL6009FORTALEZA62070503***6304DEMO";
const FORMAS = { pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito", dinheiro: "Dinheiro" };

const moeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const apenasDigitos = (texto) => texto.replace(/\D/g, "");

/* ===== Permissões por função =====
   alterar: abrir pedido, adicionar/remover itens | finalizar: receber e fechar a conta */
const PERMISSOES = {
    "Dono": { alterar: true, finalizar: true },
    "Gerente": { alterar: true, finalizar: true },
    "Chef": { alterar: true, finalizar: false },
    "Garçom": { alterar: true, finalizar: true }
};

function pode(acao) {
    const sessao = obterSessao();
    return Boolean(sessao && PERMISSOES[sessao.funcao] && PERMISSOES[sessao.funcao][acao]);
}

function mensagemPermissao() {
    const sessao = obterSessao();
    if (!sessao) return "Entre com a conta da equipe para abrir e finalizar pedidos.";
    if (!pode("alterar")) return `O perfil ${sessao.funcao} não pode alterar nem finalizar pedidos.`;
    if (!pode("finalizar")) return `O perfil ${sessao.funcao} pode alterar o pedido, mas só dono, gerente ou garçom pode finalizá-lo.`;
    return "";
}

/* ===== Estado: um pedido aberto por mesa =====
   estado = { mesaAtiva: "Mesa 5", comandas: { "Mesa 5": { itens: [...], atendente, abertaEm } } } */
function lerEstado() {
    const salvo = lerJSON(CHAVE_COMANDAS, null);
    const comandas = {};
    if (salvo && salvo.comandas && typeof salvo.comandas === "object") {
        Object.keys(salvo.comandas).forEach((mesa) => {
            const c = salvo.comandas[mesa];
            if (c && Array.isArray(c.itens)) comandas[mesa] = c;
        });
    }
    return { mesaAtiva: comandas[salvo && salvo.mesaAtiva] ? salvo.mesaAtiva : null, comandas };
}

let estado = lerEstado();

const comandaAtual = () => (estado.mesaAtiva ? estado.comandas[estado.mesaAtiva] : null);
const itensAtuais = () => (comandaAtual() ? comandaAtual().itens : []);
const total = () => itensAtuais().reduce((soma, i) => soma + i.preco * i.qtd, 0);
const contarItens = (comanda) => comanda.itens.reduce((soma, i) => soma + i.qtd, 0);

function salvarEstado() {
    gravarJSON(CHAVE_COMANDAS, estado);
    renderizar();
}

/* Depois de fechar ou cancelar, passa para outra mesa aberta (se houver) */
function fecharComanda(mesa) {
    delete estado.comandas[mesa];
    estado.mesaAtiva = Object.keys(estado.comandas)[0] || null;
}

/* ===== Novo pedido da mesa ===== */
function novoPedido() {
    const mensagem = $("mensagemPedido");
    if (!pode("alterar")) {
        mostrarMensagem(mensagem, mensagemPermissao(), "erro");
        return;
    }

    const mesa = $("mesaNova").value;
    if (!mesa) {
        mostrarMensagem(mensagem, "Escolha a mesa do pedido.", "erro");
        return;
    }
    mensagem.textContent = "";

    if (estado.comandas[mesa]) {
        estado.mesaAtiva = mesa;
        salvarEstado();
        mostrarNotificacao(`${mesa} já tem um pedido aberto. Continuando nele.`);
        return;
    }

    estado.comandas[mesa] = { itens: [], atendente: obterSessao().nome, abertaEm: new Date().toISOString() };
    estado.mesaAtiva = mesa;
    salvarEstado();
    mostrarNotificacao(`Novo pedido aberto: ${mesa}.`);
}

function cancelarPedido() {
    const mesa = estado.mesaAtiva;
    if (!mesa || !pode("alterar")) return;
    if (!confirm(`Cancelar o pedido da ${mesa}? Os itens serão descartados.`)) return;

    fecharComanda(mesa);
    salvarEstado();
    mostrarNotificacao(`Pedido da ${mesa} cancelado.`);
}

/* ===== Itens do pedido ===== */
function adicionar(nome, preco) {
    if (!pode("alterar")) {
        mostrarNotificacao("Somente dono, gerente, chef e garçom podem alterar o pedido. Entre com sua conta.");
        return;
    }

    const comanda = comandaAtual();
    if (!comanda) {
        mostrarNotificacao("Abra um pedido primeiro: escolha a mesa e toque em “Novo pedido”.");
        abrirModal($("modalPedido"), $("abrirCarrinho"));
        return;
    }

    const existente = comanda.itens.find((i) => i.nome === nome);
    if (existente) existente.qtd++;
    else comanda.itens.push({ nome, preco, qtd: 1 });
    salvarEstado();
    mostrarNotificacao(`${nome} adicionado à ${estado.mesaAtiva}.`);
}

function alterarQtd(nome, delta) {
    const comanda = comandaAtual();
    if (!comanda || !pode("alterar")) return;
    const item = comanda.itens.find((i) => i.nome === nome);
    if (!item) return;
    item.qtd += delta;
    if (item.qtd <= 0) comanda.itens = comanda.itens.filter((i) => i !== item);
    salvarEstado();
}

function criarBotaoQtd(texto, rotulo, acao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = texto;
    botao.disabled = !pode("alterar");
    botao.setAttribute("aria-label", rotulo);
    botao.addEventListener("click", acao);
    return botao;
}

/* ===== Tela ===== */
function preencherSeletorDeMesas() {
    const select = $("mesaNova");
    const atual = select.value;
    select.replaceChildren(new Option("Escolha a mesa…", ""));

    const mesas = Array.from({ length: NUMERO_DE_MESAS }, (_, i) => `Mesa ${i + 1}`).concat(BALCAO);
    mesas.forEach((mesa) => {
        select.add(new Option(estado.comandas[mesa] ? `${mesa} (aberta)` : mesa, mesa));
    });
    select.value = atual;
}

function renderizarMesasAbertas() {
    const caixa = $("mesasAbertas");
    const mesas = Object.keys(estado.comandas);
    caixa.replaceChildren();
    caixa.classList.toggle("oculto", mesas.length === 0);

    mesas.forEach((mesa) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "chip-mesa";
        botao.dataset.mesa = mesa;
        botao.setAttribute("role", "tab");
        botao.setAttribute("aria-selected", String(mesa === estado.mesaAtiva));
        botao.textContent = `${mesa} (${contarItens(estado.comandas[mesa])})`;
        caixa.appendChild(botao);
    });
}

function renderizarItens(itens) {
    const lista = $("listaPedido");
    lista.replaceChildren();

    itens.forEach((item) => {
        const linha = document.createElement("li");
        linha.className = "linha-pedido";

        const nome = document.createElement("span");
        nome.textContent = item.nome;

        const controles = document.createElement("span");
        controles.className = "qtd";
        const quantidade = document.createElement("b");
        quantidade.textContent = item.qtd;
        controles.append(
            criarBotaoQtd("−", `Diminuir ${item.nome}`, () => alterarQtd(item.nome, -1)),
            quantidade,
            criarBotaoQtd("+", `Aumentar ${item.nome}`, () => alterarQtd(item.nome, 1))
        );

        const subtotal = document.createElement("strong");
        subtotal.textContent = moeda(item.preco * item.qtd);

        linha.append(nome, controles, subtotal);
        lista.appendChild(linha);
    });
}

function renderizar() {
    const comanda = comandaAtual();
    const itens = itensAtuais();

    $("qtdCarrinho").textContent = Object.values(estado.comandas).reduce((soma, c) => soma + contarItens(c), 0);
    $("blocoNovoPedido").classList.toggle("oculto", !pode("alterar"));
    preencherSeletorDeMesas();
    renderizarMesasAbertas();

    $("pedidoDaMesa").classList.toggle("oculto", !comanda);
    $("pedidoVazio").textContent = comanda ?
        "Este pedido ainda não tem itens. Toque em “Adicionar” no cardápio." :
        "Nenhum pedido aberto. Escolha a mesa acima e toque em “Novo pedido”.";
    $("pedidoVazio").classList.toggle("oculto", itens.length > 0);

    if (comanda) {
        const hora = new Date(comanda.abertaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        $("tituloMesa").textContent = estado.mesaAtiva;
        $("infoMesa").textContent = `Aberta por ${comanda.atendente} às ${hora}`;
    }
    $("botaoCancelarPedido").classList.toggle("oculto", !pode("alterar"));
    $("blocoPagamento").classList.toggle("oculto", !comanda || itens.length === 0 || !pode("finalizar"));

    const aviso = $("avisoPermissao");
    aviso.textContent = mensagemPermissao();
    aviso.classList.toggle("oculto", !aviso.textContent);

    $("totalPedido").textContent = moeda(total());
    renderizarItens(itens);
}

/* ===== Pagamento ===== */
const ehCartao = (forma) => forma === "credito" || forma === "debito";

function mostrarCampos() {
    const forma = $("formaPagamento").value;
    $("camposPix").classList.toggle("oculto", forma !== "pix");
    $("camposCartao").classList.toggle("oculto", !ehCartao(forma));
    $("camposDinheiro").classList.toggle("oculto", forma !== "dinheiro");
    ["numeroCartao", "nomeCartao", "validadeCartao", "cvvCartao"].forEach((id) => {
        $(id).required = ehCartao(forma);
    });
}

function luhnValido(numero) {
    let soma = 0;
    let dobrar = false;
    for (let i = numero.length - 1; i >= 0; i--) {
        let digito = Number(numero[i]);
        if (dobrar) {
            digito *= 2;
            if (digito > 9) digito -= 9;
        }
        soma += digito;
        dobrar = !dobrar;
    }
    return soma % 10 === 0;
}

function validadeValida(texto) {
    const partes = /^(\d{2})\/(\d{2})$/.exec(texto);
    if (!partes) return false;
    const mes = Number(partes[1]);
    const ano = 2000 + Number(partes[2]);
    return mes >= 1 && mes <= 12 && new Date(ano, mes, 1) > new Date();
}

/* Máscaras dos campos */
$("numeroCartao").addEventListener("input", (e) => {
    e.target.value = apenasDigitos(e.target.value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
});

$("validadeCartao").addEventListener("input", (e) => {
    const d = apenasDigitos(e.target.value).slice(0, 4);
    e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
});

$("cvvCartao").addEventListener("input", (e) => {
    e.target.value = apenasDigitos(e.target.value).slice(0, 4);
});

$("formaPagamento").addEventListener("change", mostrarCampos);

$("formPedido").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const mensagem = $("mensagemPedido");
    const erro = (texto) => mostrarMensagem(mensagem, texto, "erro");

    const comanda = comandaAtual();
    if (!comanda) return erro("Abra um pedido antes de finalizar.");
    if (!comanda.itens.length) return erro("O pedido desta mesa está vazio.");
    if (!pode("finalizar")) return erro("Somente dono, gerente ou garçom pode finalizar o pedido.");

    const forma = $("formaPagamento").value;
    let pagamento = FORMAS[forma];

    if (ehCartao(forma)) {
        const numero = apenasDigitos($("numeroCartao").value);
        if (numero.length < 13 || !luhnValido(numero)) return erro("Número de cartão inválido.");
        if (!validadeValida($("validadeCartao").value)) return erro("Validade inválida ou cartão vencido.");
        if (!/^\d{3,4}$/.test($("cvvCartao").value)) return erro("CVV inválido.");
        pagamento += ` (final ${numero.slice(-4)})`;
    }

    if (forma === "dinheiro") {
        const troco = parseFloat($("trocoPara").value.replace(",", "."));
        if (troco && troco < total()) return erro("O valor do troco é menor que o total.");
        if (troco) pagamento += ` (troco para ${moeda(troco)})`;
    }

    /* Dados do cartão nunca são salvos: só a forma de pagamento e os 4 últimos dígitos */
    const sessao = obterSessao();
    const mesa = estado.mesaAtiva;
    const pedido = {
        id: String(Date.now()).slice(-6),
        mesa,
        cliente: $("nomePedido").value.trim() || "Não informado",
        itens: comanda.itens,
        total: total(),
        pagamento,
        abertoPor: comanda.atendente,
        abertoEm: comanda.abertaEm,
        atendente: sessao.nome,
        funcaoAtendente: sessao.funcao,
        status: "Recebido",
        data: new Date().toISOString()
    };

    const pedidos = lerJSON(CHAVE_PEDIDOS, []);
    pedidos.push(pedido);
    gravarJSON(CHAVE_PEDIDOS, pedidos);

    fecharComanda(mesa);
    salvarEstado();
    $("formPedido").reset();
    $("codigoPix").value = PIX_DEMO;
    mostrarCampos();

    mostrarMensagem(mensagem, `Pedido nº ${pedido.id} da ${mesa} finalizado! Total: ${moeda(pedido.total)}.`, "sucesso");
    mostrarNotificacao(`${mesa}: pedido nº ${pedido.id} finalizado.`);

    setTimeout(() => {
        fecharModal($("modalPedido"));
        mensagem.textContent = "";
    }, 2800);
});

/* ===== Eventos ===== */
$("botaoNovoPedido").addEventListener("click", novoPedido);
$("botaoCancelarPedido").addEventListener("click", cancelarPedido);

$("mesasAbertas").addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chip-mesa");
    if (!botao) return;
    estado.mesaAtiva = botao.dataset.mesa;
    salvarEstado();
});

$("abrirCarrinho").addEventListener("click", () => abrirModal($("modalPedido"), $("abrirCarrinho")));

document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-nome]");
    if (botao) adicionar(botao.dataset.nome, Number(botao.dataset.preco));
});

/* Atualiza permissões quando alguém entra ou sai da conta, e sincroniza entre abas */
document.addEventListener("sessao-alterada", renderizar);
window.addEventListener("storage", (e) => {
    if (e.key === CHAVE_COMANDAS) {
        estado = lerEstado();
        renderizar();
    }
});

/* ===== Inicialização ===== */
$("codigoPix").value = PIX_DEMO;
mostrarCampos();
renderizar();