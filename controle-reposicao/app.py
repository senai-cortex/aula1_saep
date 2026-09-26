import os
import re
from flask import Flask, jsonify, request, render_template
import mysql.connector
from mysql.connector import Error

app = Flask(__name__)

DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "controle_reposicao_medicamentos"),
}

URGENCIAS_VALIDAS = ("baixa", "media", "alta")
STATUS_VALIDOS = ("solicitado", "em separacao", "recebido")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_conexao():
    return mysql.connector.connect(**DB_CONFIG)


@app.route("/")
def painel():
    return render_template("index.html")


@app.route("/funcionarios")
def pagina_funcionarios():
    return render_template("funcionarios.html")


@app.route("/pedidos")
def pagina_pedidos():
    return render_template("pedidos.html")


@app.route("/api/funcionarios", methods=["GET"])
def listar_funcionarios():
    try:
        conn = get_conexao()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id_funcionario, nome, email FROM funcionario ORDER BY nome;"
        )
        dados = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(dados), 200
    except Error:
        return jsonify({"erro": "Não foi possível carregar os funcionários. Verifique a conexão com o banco."}), 500


@app.route("/api/funcionarios", methods=["POST"])
def cadastrar_funcionario():
    dados = request.get_json(silent=True) or {}
    nome = (dados.get("nome") or "").strip()
    email = (dados.get("email") or "").strip()

    if not nome or not email:
        return jsonify({"erro": "Nome e e-mail são obrigatórios."}), 400
    if not EMAIL_REGEX.match(email):
        return jsonify({"erro": "E-mail inválido. Verifique o formato digitado."}), 400

    try:
        conn = get_conexao()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO funcionario (nome, email) VALUES (%s, %s);",
            (nome, email),
        )
        conn.commit()
        novo_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"mensagem": "cadastro concluído com sucesso", "id_funcionario": novo_id}), 201
    except Error:
        return jsonify({"erro": "Não foi possível cadastrar. Tente novamente."}), 500


SQL_LISTAR_PEDIDOS = """
SELECT
    p.id_pedido,
    p.medicamento,
    p.quantidade,
    p.categoria,
    p.urgencia,
    p.data_solicitacao,
    p.status,
    p.id_funcionario,
    f.nome AS funcionario
FROM pedido_reposicao p
INNER JOIN funcionario f ON p.id_funcionario = f.id_funcionario
ORDER BY
    CASE p.urgencia WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
    p.data_solicitacao DESC;
"""


@app.route("/api/pedidos", methods=["GET"])
def listar_pedidos():
    try:
        conn = get_conexao()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(SQL_LISTAR_PEDIDOS)
        dados = cursor.fetchall()
        for item in dados:
            if item.get("data_solicitacao") is not None:
                item["data_solicitacao"] = item["data_solicitacao"].strftime("%Y-%m-%d %H:%M:%S")
        cursor.close()
        conn.close()
        return jsonify(dados), 200
    except Error:
        return jsonify({"erro": "Não foi possível carregar os pedidos. Verifique a conexão com o banco."}), 500


def validar_pedido(dados):
    medicamento = (dados.get("medicamento") or "").strip()
    categoria = (dados.get("categoria") or "").strip()
    urgencia = (dados.get("urgencia") or "").strip()
    id_funcionario = dados.get("id_funcionario")
    quantidade = dados.get("quantidade")

    if not medicamento or not categoria or not urgencia or id_funcionario is None or quantidade is None or quantidade == "":
        return False, "Todos os campos são obrigatórios."

    try:
        if isinstance(quantidade, bool):
            return False, "Quantidade inválida. Informe um número inteiro maior que zero."
        if isinstance(quantidade, float):
            return False, "Quantidade inválida. Informe um número inteiro maior que zero."
        if isinstance(quantidade, str):
            q = quantidade.strip()
            if q == "" or "." in q or "," in q:
                return False, "Quantidade inválida. Informe um número inteiro maior que zero."
            quantidade = int(q)
        else:
            quantidade = int(quantidade)
    except (ValueError, TypeError):
        return False, "Quantidade inválida. Informe um número inteiro maior que zero."

    if quantidade <= 0:
        return False, "Quantidade inválida. Informe um número inteiro maior que zero."

    if urgencia not in URGENCIAS_VALIDAS:
        return False, "Urgência inválida. Escolha: baixa, media ou alta."

    try:
        int(id_funcionario)
    except (ValueError, TypeError):
        return False, "Funcionário inválido."

    return True, ""


@app.route("/api/pedidos", methods=["POST"])
def cadastrar_pedido():
    dados = request.get_json(silent=True) or {}
    valido, mensagem = validar_pedido(dados)
    if not valido:
        return jsonify({"erro": mensagem}), 400

    medicamento = dados["medicamento"].strip()
    categoria = dados["categoria"].strip()
    urgencia = dados["urgencia"].strip()
    id_funcionario = int(dados["id_funcionario"])
    quantidade = int(str(dados["quantidade"]).strip())

    try:
        conn = get_conexao()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM funcionario WHERE id_funcionario = %s;", (id_funcionario,))
        if cursor.fetchone() is None:
            cursor.close()
            conn.close()
            return jsonify({"erro": "Funcionário não encontrado."}), 404

        cursor.execute(
            """INSERT INTO pedido_reposicao
               (id_funcionario, medicamento, quantidade, categoria, urgencia, data_solicitacao, status)
               VALUES (%s, %s, %s, %s, %s, NOW(), 'solicitado');""",
            (id_funcionario, medicamento, quantidade, categoria, urgencia),
        )
        conn.commit()
        novo_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"mensagem": "cadastro concluído com sucesso", "id_pedido": novo_id}), 201
    except Error:
        return jsonify({"erro": "Não foi possível cadastrar o pedido. Tente novamente."}), 500


@app.route("/api/pedidos/<int:id_pedido>", methods=["PUT"])
def editar_pedido(id_pedido):
    dados = request.get_json(silent=True) or {}
    valido, mensagem = validar_pedido(dados)
    if not valido:
        return jsonify({"erro": mensagem}), 400

    medicamento = dados["medicamento"].strip()
    categoria = dados["categoria"].strip()
    urgencia = dados["urgencia"].strip()
    id_funcionario = int(dados["id_funcionario"])
    quantidade = int(str(dados["quantidade"]).strip())

    try:
        conn = get_conexao()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM pedido_reposicao WHERE id_pedido = %s;", (id_pedido,))
        if cursor.fetchone() is None:
            cursor.close()
            conn.close()
            return jsonify({"erro": "Pedido não encontrado."}), 404

        cursor.execute("SELECT 1 FROM funcionario WHERE id_funcionario = %s;", (id_funcionario,))
        if cursor.fetchone() is None:
            cursor.close()
            conn.close()
            return jsonify({"erro": "Funcionário não encontrado."}), 404

        cursor.execute(
            """UPDATE pedido_reposicao
               SET id_funcionario = %s, medicamento = %s, quantidade = %s,
                   categoria = %s, urgencia = %s
               WHERE id_pedido = %s;""",
            (id_funcionario, medicamento, quantidade, categoria, urgencia, id_pedido),
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensagem": "Pedido atualizado com sucesso."}), 200
    except Error:
        return jsonify({"erro": "Não foi possível atualizar o pedido. Tente novamente."}), 500


@app.route("/api/pedidos/<int:id_pedido>", methods=["DELETE"])
def excluir_pedido(id_pedido):
    try:
        conn = get_conexao()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM pedido_reposicao WHERE id_pedido = %s;", (id_pedido,))
        if cursor.fetchone() is None:
            cursor.close()
            conn.close()
            return jsonify({"erro": "Pedido não encontrado."}), 404

        cursor.execute("DELETE FROM pedido_reposicao WHERE id_pedido = %s;", (id_pedido,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensagem": "Pedido excluído com sucesso."}), 200
    except Error:
        return jsonify({"erro": "Não foi possível excluir o pedido. Tente novamente."}), 500


@app.route("/api/pedidos/<int:id_pedido>/status", methods=["PUT"])
def alterar_status(id_pedido):
    dados = request.get_json(silent=True) or {}
    novo_status = (dados.get("status") or "").strip()

    if novo_status not in STATUS_VALIDOS:
        return jsonify({"erro": "Status inválido. Escolha: solicitado, em separacao ou recebido."}), 400

    try:
        conn = get_conexao()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM pedido_reposicao WHERE id_pedido = %s;", (id_pedido,))
        if cursor.fetchone() is None:
            cursor.close()
            conn.close()
            return jsonify({"erro": "Pedido não encontrado."}), 404

        cursor.execute(
            "UPDATE pedido_reposicao SET status = %s WHERE id_pedido = %s;",
            (novo_status, id_pedido),
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensagem": "Status atualizado com sucesso."}), 200
    except Error:
        return jsonify({"erro": "Não foi possível atualizar o status. Tente novamente."}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
