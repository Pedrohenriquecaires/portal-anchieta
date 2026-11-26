/* Dados de demonstração gravados no banco na primeira execução (e no "Restaurar demo").
   Para mudar os dados iniciais, edite aqui e use o botão "Restaurar dados de demonstração"
   na tela Banco de dados (coordenação). */
export default {
  "users": [
    {
      "id": "u-admin",
      "nome": "Vanderlei Ienne",
      "login": "admin",
      "ra": "",
      "cpf": "",
      "senha": "Admin@123",
      "email": "vanderlei.ienne@anchieta.edu.br",
      "telefone": "(11) 90000-0000",
      "role": "admin",
      "meta": "Coordenação do curso",
      "locked": true
    },
    {
      "id": "u-prof",
      "nome": "Daniel Feitoza",
      "login": "",
      "ra": "230526",
      "cpf": "23052600000",
      "senha": "23052600000",
      "email": "daniel.feitoza@anchieta.edu.br",
      "telefone": "",
      "role": "professor",
      "meta": "Docente · Design",
      "locked": false
    },
    {
      "id": "u-aluno",
      "nome": "Gustavo Henrique Mira",
      "login": "",
      "ra": "2609681",
      "cpf": "46580142898",
      "senha": "46580142898",
      "email": "gustavo.mira@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2609681",
      "locked": false
    },
    {
      "id": "u-aluno-2",
      "nome": "Pedro Caires",
      "login": "",
      "ra": "2505471",
      "cpf": "46201414886",
      "senha": "46201414886",
      "email": "pedro.caires@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2505471",
      "locked": false
    },
    {
      "id": "u-aluno-3",
      "nome": "Abimael Jabez",
      "login": "",
      "ra": "2524073",
      "cpf": "25240730000",
      "senha": "25240730000",
      "email": "abimael.jabez@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2524073",
      "locked": false
    },
    {
      "id": "u-aluno-4",
      "nome": "Juliano Albuquerque",
      "login": "",
      "ra": "2521476",
      "cpf": "25214760000",
      "senha": "25214760000",
      "email": "juliano.albuquerque@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2521476",
      "locked": false
    },
    {
      "id": "u-aluno-5",
      "nome": "Adrian Mello",
      "login": "",
      "ra": "2520269",
      "cpf": "25202690000",
      "senha": "25202690000",
      "email": "adrian.mello@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2520269",
      "locked": false
    },
    {
      "id": "u-aluno-6",
      "nome": "Lucas Boscardin",
      "login": "",
      "ra": "2506119",
      "cpf": "25061190000",
      "senha": "25061190000",
      "email": "lucas.boscardin@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2506119",
      "locked": false
    },
    {
      "id": "u-aluno-7",
      "nome": "Eduardo Scarpinelli",
      "login": "",
      "ra": "2509329",
      "cpf": "25093290000",
      "senha": "25093290000",
      "email": "eduardo.scarpinelli@anchieta.edu.br",
      "telefone": "",
      "role": "aluno",
      "meta": "RA 2509329",
      "locked": false
    }
  ],
  "turmas": [
    {
      "id": "t-demo-mdf",
      "nome": "Material Design Framework",
      "codigo": "MDF-A",
      "professorId": "u-prof",
      "professorRa": "230526",
      "professorNome": "Daniel Feitoza",
      "horario": "Seg/Qua 19:00–20:40",
      "alunosIds": [
        "u-aluno",
        "u-aluno-2",
        "u-aluno-3",
        "u-aluno-4",
        "u-aluno-5",
        "u-aluno-6",
        "u-aluno-7"
      ]
    },
    {
      "id": "t-demo-ux",
      "nome": "UX Research e Prototipação",
      "codigo": "UXR-B",
      "professorId": "u-prof",
      "professorRa": "230526",
      "professorNome": "Daniel Feitoza",
      "horario": "Ter/Qui 21:00–22:40",
      "alunosIds": [
        "u-aluno",
        "u-aluno-2",
        "u-aluno-3",
        "u-aluno-4"
      ]
    }
  ],
  "notas": [
    {
      "id": "n-demo-1",
      "turmaId": "t-demo-mdf",
      "alunoId": "u-aluno",
      "valor": 8.5,
      "tipo": "P1",
      "observacao": "Prova parcial — boa aplicação dos tokens",
      "professorId": "u-prof",
      "createdAt": "2026-09-15T20:00:00.000Z"
    },
    {
      "id": "n-demo-2",
      "turmaId": "t-demo-mdf",
      "alunoId": "u-aluno",
      "valor": 9,
      "tipo": "Trabalho",
      "observacao": "Entrega do redesign do dashboard",
      "professorId": "u-prof",
      "createdAt": "2026-10-10T20:00:00.000Z"
    },
    {
      "id": "n-demo-3",
      "turmaId": "t-demo-mdf",
      "alunoId": "u-aluno",
      "valor": 7.5,
      "tipo": "Atividade",
      "observacao": "Quiz de componentes Material",
      "professorId": "u-prof",
      "createdAt": "2026-10-20T20:00:00.000Z"
    },
    {
      "id": "n-demo-4",
      "turmaId": "t-demo-ux",
      "alunoId": "u-aluno",
      "valor": 8,
      "tipo": "P1",
      "observacao": "Entrevista e mapa de empatia",
      "professorId": "u-prof",
      "createdAt": "2026-09-22T21:00:00.000Z"
    },
    {
      "id": "n-demo-5",
      "turmaId": "t-demo-mdf",
      "alunoId": "u-aluno-2",
      "valor": 7,
      "tipo": "P1",
      "observacao": "",
      "professorId": "u-prof",
      "createdAt": "2026-09-15T20:00:00.000Z"
    }
  ],
  "atividades": [
    {
      "id": "a-demo-1",
      "turmaId": "t-demo-mdf",
      "titulo": "Auditoria UX da tela original",
      "descricao": "Liste 5 problemas de interface com evidência, impacto e solução Material.",
      "prazo": "2026-11-25",
      "tipo": "atividade",
      "professorId": "u-prof",
      "createdAt": "2026-11-01T12:00:00.000Z"
    },
    {
      "id": "a-demo-2",
      "turmaId": "t-demo-mdf",
      "titulo": "Protótipo mobile 360px",
      "descricao": "Entregue o wireframe e o HTML responsivo da home do aluno.",
      "prazo": "2026-12-05",
      "tipo": "atividade",
      "professorId": "u-prof",
      "createdAt": "2026-11-10T12:00:00.000Z"
    },
    {
      "id": "a-demo-3",
      "turmaId": "t-demo-ux",
      "titulo": "Roteiro de teste com usuário",
      "descricao": "Prepare 5 tarefas e métricas de sucesso para o portal acadêmico.",
      "prazo": "2026-11-28",
      "tipo": "atividade",
      "professorId": "u-prof",
      "createdAt": "2026-11-08T12:00:00.000Z"
    }
  ],
  "faltas": [
    {
      "id": "f-demo-1",
      "turmaId": "t-demo-mdf",
      "alunoId": "u-aluno",
      "data": "2026-10-06",
      "motivo": "Atraso justificado",
      "professorId": "u-prof",
      "createdAt": "2026-10-06T22:00:00.000Z"
    }
  ],
  "provas": [
    {
      "id": "p-demo-1",
      "turmaId": "t-demo-mdf",
      "titulo": "P1 — Fundamentos Material Design",
      "descricao": "Componentes, hierarquia visual, tokens e estados de interface.",
      "data": "2026-10-01",
      "peso": 4,
      "status": "aplicada",
      "professorId": "u-prof",
      "createdAt": "2026-08-20T12:00:00.000Z"
    },
    {
      "id": "p-demo-2",
      "turmaId": "t-demo-mdf",
      "titulo": "PROVA P2 - APRESENTAÇÃO PROJETO",
      "descricao": "Apresentação do projeto final: redesign do portal com Material Design.",
      "data": "2026-11-26",
      "peso": 4,
      "status": "agendada",
      "professorId": "u-prof",
      "createdAt": "2026-11-26T12:41:10.811Z"
    },
    {
      "id": "p-demo-3",
      "turmaId": "t-demo-ux",
      "titulo": "P1 — Métodos de pesquisa",
      "descricao": "Entrevistas, personas e jornada do usuário.",
      "data": "2026-09-22",
      "peso": 3,
      "status": "aplicada",
      "professorId": "u-prof",
      "createdAt": "2026-08-25T12:00:00.000Z"
    }
  ],
  "entregas": [
    {
      "id": "e-demo-1",
      "atividadeId": "a-demo-1",
      "alunoId": "u-aluno",
      "texto": "Enviei a tabela com 5 problemas e prints do antes/depois.",
      "createdAt": "2026-11-12T18:30:00.000Z"
    }
  ]
};
