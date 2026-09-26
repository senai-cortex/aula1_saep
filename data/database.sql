DROP DATABASE IF EXISTS controle_reposicao_medicamentos;
CREATE DATABASE controle_reposicao_medicamentos
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE controle_reposicao_medicamentos;

CREATE TABLE funcionario (
    id_funcionario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE pedido_reposicao (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_funcionario INT NOT NULL,
    medicamento VARCHAR(150) NOT NULL,
    quantidade INT NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    urgencia VARCHAR(10) NOT NULL,
    data_solicitacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'solicitado',

    CONSTRAINT fk_pedido_funcionario
        FOREIGN KEY (id_funcionario)
        REFERENCES funcionario (id_funcionario)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_quantidade
        CHECK (quantidade > 0),

    CONSTRAINT chk_urgencia
        CHECK (urgencia IN ('baixa', 'media', 'alta')),

    CONSTRAINT chk_status
        CHECK (status IN ('solicitado', 'em separacao', 'recebido'))
) ENGINE=InnoDB;

INSERT INTO funcionario (nome, email) VALUES
('Rafael Silva', 'rafael@email.com'),
('Mariana Souza', 'mariana@email.com'),
('Carlos Oliveira', 'carlos@email.com');

INSERT INTO pedido_reposicao
(id_funcionario, medicamento, quantidade, categoria, urgencia, status) VALUES
(1, 'Paracetamol 500mg', 50, 'generico', 'alta', 'solicitado'),
(2, 'Dipirona 500mg', 30, 'generico', 'media', 'solicitado'),
(3, 'Amoxicilina 500mg', 20, 'referencia', 'alta', 'em separacao'),
(1, 'Vitamina C 1g', 40, 'higiene', 'baixa', 'solicitado'),
(2, 'Ibuprofeno 600mg', 25, 'generico', 'media', 'recebido');
