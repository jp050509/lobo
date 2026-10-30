"use strict";

/* Cada item: [ícone, nome, descrição, preço, destaque?] */
const CARDAPIO = {
    carnes: [
        ["🔥", "Picanha", "Corte nobre com capa de gordura dourada.", 69.9, true],
        ["🥩", "Fraldinha", "Macia, suculenta e assada no ponto escolhido.", 49.9],
        ["🍖", "Costela bovina", "Assada lentamente até desmanchar.", 59.9],
        ["🥩", "Alcatra", "Corte macio, preparado na brasa.", 54.9],
        ["🥩", "Maminha", "Suculenta, com sabor marcante e maciez.", 52.9],
        ["🥩", "Contrafilé", "Corte clássico, com a gordura na medida.", 57.9],
        ["🥩", "Filé mignon", "O corte mais macio da casa.", 74.9],
        ["🥩", "Ancho", "Marmoreio generoso e sabor intenso.", 79.9],
        ["🍖", "Cupim", "Assado por horas, fatiado na hora.", 56.9],
        ["🍖", "Costelinha suína", "Temperada e assada com molho barbecue.", 49.9],
        ["🥓", "Pernil suíno", "Macio por dentro, crocante por fora.", 44.9],
        ["🍗", "Frango na brasa", "Meio frango temperado com ervas.", 39.9],
        ["🍗", "Coração de frango", "Espeto clássico, bem temperado.", 24.9],
        ["🌭", "Linguiça artesanal", "Temperada e grelhada.", 29.9],
        ["🧀", "Queijo coalho", "Dourado na brasa, com melaço.", 19.9],
        ["🧀", "Provolone na brasa", "Derretido, com orégano.", 27.9],
        ["🥖", "Pão de alho", "Crocante, com manteiga de ervas.", 14.9]
    ],
    acompanhamentos: [
        ["🍚", "Arroz branco", "Soltinho, feito na hora.", 10],
        ["🍚", "Arroz carreteiro", "Com charque desfiado e temperos.", 18],
        ["🫘", "Feijão tropeiro", "Receita tradicional e bem temperada.", 12],
        ["🥗", "Salada de maionese", "Cremosa e preparada diariamente.", 15],
        ["🌽", "Farofa da casa", "Crocante, com bacon e cebola.", 8],
        ["🍟", "Batata frita", "Dourada e crocante.", 12],
        ["🥔", "Mandioca frita", "Sequinha por fora, macia por dentro.", 14],
        ["🥔", "Purê de batata", "Cremoso, com manteiga.", 13],
        ["🌽", "Polenta frita", "Crocante, com queijo ralado.", 14],
        ["🥗", "Vinagrete", "Tomate, cebola e pimentão frescos.", 9],
        ["🥬", "Salada verde", "Folhas, tomate e cenoura.", 12],
        ["🥦", "Legumes na manteiga", "Salteados na hora.", 13]
    ],
    sobremesas: [
        ["🍮", "Pudim de leite", "Calda de caramelo e textura aveludada.", 14],
        ["🍫", "Petit gâteau", "Com sorvete de creme.", 22],
        ["🍍", "Abacaxi na brasa", "Com canela e açúcar caramelizado.", 16],
        ["🍨", "Sorvete com calda", "Duas bolas à escolha.", 13],
        ["🥭", "Mousse de maracujá", "Leve, cremosa e azedinha.", 12],
        ["🍬", "Brigadeiro de colher", "Chocolate belga e granulado.", 11]
    ],
    bebidas: [
        ["🥤", "Refrigerante", "Lata gelada de 350 ml.", 5],
        ["🍺", "Cerveja long neck", "Servida bem gelada.", 8],
        ["🍺", "Chope", "Tulipa de 300 ml, cremoso.", 12],
        ["🍊", "Suco natural", "Feito na hora com frutas frescas.", 6],
        ["🍋", "Limonada suíça", "Com leite condensado e gelo.", 9],
        ["🥥", "Água de coco", "Gelada, direto do coco.", 7],
        ["💧", "Água mineral", "Com ou sem gás.", 4],
        ["🍹", "Caipirinha", "Limão, cachaça artesanal e gelo.", 18],
        ["🍷", "Vinho tinto (taça)", "Seleção da casa.", 24],
        ["🥃", "Cachaça artesanal", "Dose de 50 ml.", 10],
        ["☕", "Café expresso", "Para fechar a refeição.", 5]
    ]
};

const formatarPreco = (valor) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function criarItem([icone, nome, descricao, preco, destaque]) {
    const item = document.createElement("article");
    item.className = "item-cardapio" + (destaque ? " destaque" : "");
    item.dataset.busca = `${nome} ${descricao}`.toLowerCase();

    if (destaque) {
        const selo = document.createElement("span");
        selo.className = "mais-pedido";
        selo.textContent = "Mais pedida";
        item.appendChild(selo);
    }

    const iconeEl = document.createElement("div");
    iconeEl.className = "icone";
    iconeEl.textContent = icone;

    const texto = document.createElement("div");
    const titulo = document.createElement("h3");
    titulo.textContent = nome;
    const desc = document.createElement("p");
    desc.textContent = descricao;
    texto.append(titulo, desc);

    const precoEl = document.createElement("strong");
    precoEl.textContent = formatarPreco(preco);

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao-add";
    botao.textContent = "Adicionar";
    botao.dataset.nome = nome;
    botao.dataset.preco = preco;
    botao.setAttribute("aria-label", `Adicionar ${nome} ao pedido`);

    const rodape = document.createElement("div");
    rodape.className = "rodape-item";
    rodape.append(precoEl, botao);

    item.append(iconeEl, texto, rodape);
    return item;
}

function renderizarCardapio() {
    const extras = lerCardapioExtra();

    Object.entries(CARDAPIO).forEach(([categoria, itens]) => {
        const grade = document.getElementById(`grade-${categoria}`);
        const novos = extras
            .filter((x) => x.categoria === categoria)
            .map((x) => [x.icone, x.nome, x.descricao || "Novidade da casa.", x.preco]);
        if (grade) grade.replaceChildren(...[...itens, ...novos].map(criarItem));
    });
}

function filtrarCardapio(termo) {
    const busca = termo.trim().toLowerCase();
    let total = 0;

    document.querySelectorAll(".secao-cardapio").forEach((secao) => {
        let visiveis = 0;
        secao.querySelectorAll(".item-cardapio").forEach((item) => {
            const mostrar = item.dataset.busca.includes(busca);
            item.classList.toggle("oculto", !mostrar);
            if (mostrar) visiveis++;
        });
        secao.classList.toggle("oculto", visiveis === 0);
        total += visiveis;
    });

    document.getElementById("semResultado").classList.toggle("oculto", total > 0);
}

renderizarCardapio();
window.addEventListener("storage", (e) => {
    if (e.key === CHAVE_CARDAPIO_EXTRA) renderizarCardapio();
});
document.getElementById("busca").addEventListener("input", (e) => filtrarCardapio(e.target.value));