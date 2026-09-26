function mostrarMensagem(texto, tipo) {
    const el = document.getElementById("mensagem");
    if (!el) return;
    el.hidden = false;
    el.textContent = texto;
    el.className = "mensagem " + (tipo === "erro" ? "erro" : "sucesso");
}

function limparMensagem() {
    const el = document.getElementById("mensagem");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.className = "mensagem";
}

function emailValido(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function quantidadeValida(valor) {
    if (valor === null || valor === undefined) return false;
    const texto = String(valor).trim();
    if (texto === "") return false;
    if (texto.includes(".") || texto.includes(",")) return false;
    const n = Number(texto);
    if (!Number.isInteger(n)) return false;
    return n > 0;
}

async function lerResposta(res) {
    try {
        return await res.json();
    } catch (e) {
        return {};
    }
}

async function carregarPainel() {
    limparMensagem();
    const colS = document.getElementById("col-solicitado");
    const colE = document.getElementById("col-em-separacao");
    const colR = document.getElementById("col-recebido");
    if (!colS || !colE || !colR) return;

    colS.innerHTML = "<p class='texto-vazio'>Carregando...</p>";
    colE.innerHTML = "";
    colR.innerHTML = "";

    try {
        const res = await fetch("/api/pedidos");
        const dados = await lerResposta(res);
        if (!res.ok) {
            mostrarMensagem(dados.erro || "Não foi possível carregar os pedidos.", "erro");
            colS.innerHTML = "";
            return;
        }
        if (dados.length === 0) {
            colS.innerHTML = "<p class='texto-vazio'>Nenhum pedido.</p>";
            return;
        }
        colS.innerHTML = "";
        colE.innerHTML = "";
        colR.innerHTML = "";

        dados.forEach((p) => {
            const card = criarCard(p);
            if (p.status === "solicitado") colS.appendChild(card);
            else if (p.status === "em separacao") colE.appendChild(card);
            else if (p.status === "recebido") colR.appendChild(card);
        });

        [["col-solicitado"], ["col-em-separacao"], ["col-recebido"]].forEach(([id]) => {
            const el = document.getElementById(id);
            if (el && el.children.length === 0) {
                el.innerHTML = "<p class='texto-vazio'>Nenhum pedido.</p>";
            }
        });
    } catch (e) {
        mostrarMensagem("Erro de conexão com o servidor. Verifique se o backend está rodando.", "erro");
        colS.innerHTML = "";
    }
}

function criarCard(p) {
    const div = document.createElement("div");
    div.className = "card";

    const urgClass = p.urgencia === "alta" ? "urgencia-alta" : "";

    div.innerHTML =
        "<p><strong>Medicamento:</strong> " + escaparHtml(p.medicamento) + "</p>" +
        "<p><strong>Quantidade:</strong> " + escaparHtml(String(p.quantidade)) + "</p>" +
        "<p><strong>Categoria:</strong> " + escaparHtml(p.categoria) + "</p>" +
        "<p><strong>Urgência:</strong> <span class='" + urgClass + "'>" + escaparHtml(p.urgencia) + "</span></p>" +
        "<p><strong>Funcionário:</strong> " + escaparHtml(p.funcionario) + "</p>";

    const acoes = document.createElement("div");
    acoes.className = "acoes";

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className = "btn-editar";
    btnEditar.onclick = () => {
        window.location.href = "/pedidos?id=" + p.id_pedido;
    };

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-excluir";
    btnExcluir.onclick = () => excluirPedido(p.id_pedido);

    const selectStatus = document.createElement("select");
    ["solicitado", "em separacao", "recebido"].forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        if (s === p.status) opt.selected = true;
        selectStatus.appendChild(opt);
    });

    const btnStatus = document.createElement("button");
    btnStatus.textContent = "Alterar status";
    btnStatus.className = "btn-status";
    btnStatus.onclick = () => alterarStatus(p.id_pedido, selectStatus.value);

    acoes.appendChild(btnEditar);
    acoes.appendChild(btnExcluir);
    acoes.appendChild(selectStatus);
    acoes.appendChild(btnStatus);
    div.appendChild(acoes);

    return div;
}

function escaparHtml(texto) {
    const d = document.createElement("div");
    d.textContent = texto;
    return d.innerHTML;
}

async function excluirPedido(id) {
    const confirma = confirm("Tem certeza que deseja excluir este pedido?");
    if (!confirma) return;

    try {
        const res = await fetch("/api/pedidos/" + id, { method: "DELETE" });
        const dados = await lerResposta(res);
        if (!res.ok) {
            alert(dados.erro || "Não foi possível excluir o pedido.");
            return;
        }
        carregarPainel();
    } catch (e) {
        alert("Erro de conexão com o servidor.");
    }
}

async function alterarStatus(id, novoStatus) {
    try {
        const res = await fetch("/api/pedidos/" + id + "/status", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: novoStatus })
        });
        const dados = await lerResposta(res);
        if (!res.ok) {
            alert(dados.erro || "Não foi possível atualizar o status.");
            return;
        }
        carregarPainel();
    } catch (e) {
        alert("Erro de conexão com o servidor.");
    }
}

async function initPaginaFuncionarios() {
    const form = document.getElementById("form-funcionario");
    form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        limparMensagem();

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();

        if (!nome || !email) {
            mostrarMensagem("Nome e e-mail são obrigatórios.", "erro");
            return;
        }
        if (!emailValido(email)) {
            mostrarMensagem("E-mail inválido. Verifique o formato digitado.", "erro");
            return;
        }

        try {
            const res = await fetch("/api/funcionarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email })
            });
            const dados = await lerResposta(res);
            if (!res.ok) {
                mostrarMensagem(dados.erro || "Não foi possível cadastrar.", "erro");
                return;
            }
            mostrarMensagem("cadastro concluído com sucesso", "sucesso");
            form.reset();
            carregarListaFuncionarios();
        } catch (e) {
            mostrarMensagem("Erro de conexão com o servidor.", "erro");
        }
    });

    carregarListaFuncionarios();
}

async function carregarListaFuncionarios() {
    const ul = document.getElementById("lista-funcionarios");
    if (!ul) return;
    try {
        const res = await fetch("/api/funcionarios");
        const dados = await lerResposta(res);
        if (!res.ok) return;
        ul.innerHTML = "";
        dados.forEach((f) => {
            const li = document.createElement("li");
            li.textContent = f.nome + " — " + f.email;
            ul.appendChild(li);
        });
    } catch (e) {
        ul.innerHTML = "";
    }
}

async function initPaginaPedidos() {
    await carregarSelectFuncionarios();

    const params = new URLSearchParams(window.location.search);
    const idEdicao = params.get("id");

    if (idEdicao) {
        try {
            const res = await fetch("/api/pedidos");
            const dados = await lerResposta(res);
            if (res.ok) {
                const pedido = dados.find((p) => String(p.id_pedido) === String(idEdicao));
                if (pedido) {
                    document.getElementById("id_pedido").value = pedido.id_pedido;
                    document.getElementById("medicamento").value = pedido.medicamento;
                    document.getElementById("quantidade").value = pedido.quantidade;
                    document.getElementById("categoria").value = pedido.categoria;
                    document.getElementById("id_funcionario").value = pedido.id_funcionario;
                    document.getElementById("urgencia").value = pedido.urgencia;
                    document.getElementById("titulo-pedido").textContent = "Editar Pedido";
                    document.getElementById("btn-salvar-pedido").textContent = "Salvar alterações";
                } else {
                    mostrarMensagem("Pedido não encontrado.", "erro");
                }
            }
        } catch (e) {
            mostrarMensagem("Erro de conexão com o servidor.", "erro");
        }
    }

    const form = document.getElementById("form-pedido");
    form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        limparMensagem();

        const idPedido = document.getElementById("id_pedido").value;
        const medicamento = document.getElementById("medicamento").value.trim();
        const quantidade = document.getElementById("quantidade").value;
        const categoria = document.getElementById("categoria").value.trim();
        const id_funcionario = document.getElementById("id_funcionario").value;
        const urgencia = document.getElementById("urgencia").value;

        if (!medicamento || !quantidade || !categoria || !id_funcionario || !urgencia) {
            mostrarMensagem("Todos os campos são obrigatórios.", "erro");
            return;
        }
        if (!quantidadeValida(quantidade)) {
            mostrarMensagem("Quantidade inválida. Informe um número inteiro maior que zero.", "erro");
            return;
        }
        if (!["baixa", "media", "alta"].includes(urgencia)) {
            mostrarMensagem("Urgência inválida. Escolha: baixa, media ou alta.", "erro");
            return;
        }

        const corpo = {
            medicamento,
            quantidade: Number(String(quantidade).trim()),
            categoria,
            id_funcionario: Number(id_funcionario),
            urgencia
        };

        try {
            let res;
            if (idPedido) {
                res = await fetch("/api/pedidos/" + idPedido, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(corpo)
                });
            } else {
                res = await fetch("/api/pedidos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(corpo)
                });
            }
            const dados = await lerResposta(res);
            if (!res.ok) {
                mostrarMensagem(dados.erro || "Não foi possível salvar.", "erro");
                return;
            }
            if (idPedido) {
                mostrarMensagem("Pedido atualizado com sucesso.", "sucesso");
                setTimeout(() => { window.location.href = "/"; }, 800);
            } else {
                mostrarMensagem("cadastro concluído com sucesso", "sucesso");
                form.reset();
            }
        } catch (e) {
            mostrarMensagem("Erro de conexão com o servidor.", "erro");
        }
    });
}

async function carregarSelectFuncionarios() {
    const select = document.getElementById("id_funcionario");
    if (!select) return;
    try {
        const res = await fetch("/api/funcionarios");
        const dados = await lerResposta(res);
        if (!res.ok) {
            mostrarMensagem("Não foi possível carregar os funcionários.", "erro");
            return;
        }
        dados.forEach((f) => {
            const opt = document.createElement("option");
            opt.value = f.id_funcionario;
            opt.textContent = f.nome;
            select.appendChild(opt);
        });
    } catch (e) {
        mostrarMensagem("Erro de conexão com o servidor.", "erro");
    }
}
