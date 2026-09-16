# Dados de referência — versão 0.6.0

## 1. Campus

A versão 0.6.0 opera somente no **IFES — Campus Barra de São Francisco**, identificador estável `ifes-bsf`. Não há interface de múltiplos campi.

A fonte institucional dos ambientes é `eSPAÇOS.docx`, recebida com a especificação da versão. O documento não informa pavimentos; por isso o sistema não inventa pavimentos. A compatibilidade estrutural é mantida por um nó técnico `sem-pavimento` cujo nome é vazio e não é apresentado como pavimento ao público.

## 2. Ambientes iniciais

### Bloco 01 — 28

1. DIREÇÃO DE ENSINO
2. SALA DA COORDENAÇÃO DO BACHARELADO EM ADMINISTRAÇÃO
3. COORDENADORIA DE GESTÃO PEDAGÓGICA
4. COORDENADORIA DE REGISTROS ACADÊMICOS
5. COORDENAÇÕES DE CURSOS TÉCNICOS
6. COORDENADORIA DE ATENDIMENTO MULTIDISCIPLINAR
7. COPA
8. COORDENADORIA DE APOIO AO ENSINO
9. SALA DOS PROFESSORES
10. NÚCLEO DE ATENDIMENTO ÀS PESSOAS COM NECESSIDADES ESPECÍFICAS
11. SALA DE APOIO AO LABORATÓRIO
12. NÚCLEO DE ARTE E CULTURA
13. COORDENADORIA DO CURSO TÉCNICO EM AGROPECUÁRIA
14. SALA DE ATENDIMENTO
15. SALA DE AULA 1
16. SALA DE AULA 2
17. SALA DE AULA 3
18. SALA DE AULA 4
19. SALA DE AULA 5
20. SALA DE AULA 6
21. AUDITÓRIO
22. SALA DE APOIO DA LIMPEZA
23. BANHEIRO FEMININO PCD
24. BANHEIRO MASCULINO PCD
25. BANHEIRO FEMININO ALUNOS
26. BANHEIRO MASCULINO ALUNOS
27. CORREDORES
28. OUTROS

### Bloco 02 — 26

1. DIRETORIA GERAL
2. MINIAUDITÓRIO
3. COORDENAÇÃO GERAL DE ADMINISTRAÇÃO / ENGENHARIA
4. DIREÇÃO DE ADMINISTRAÇÃO E PLANEJAMENTO
5. COPA
6. COORDENADORIA DO ALMOXARIFADO
7. COORDENADORIA DE COMUNICAÇÃO E EVENTOS
8. COORDENADORIA GERAL DE GESTÃO DE PESSOAS
9. DIRETORIA DE PESQUISA, PÓS-GRADUAÇÃO, EXTENSÃO E INOVAÇÃO
10. COORDENADORIA GERAL DE GESTÃO DO CAMPO
11. PROJETO INTEGRACAR
12. SALA DE AULA 7
13. SALA DE AULA 8
14. SALA DE AULA 9
15. LABORATÓRIO DE SOLO
16. SALA DE MULTIMEIOS
17. LABORATORIO DE INFORMÁTICA
18. COORDENADORIA DE TECNOLOGIA DA INFORMAÇÃO
19. GABINETE DA DIREÇÃO GERAL
20. BIBLIOTECA
21. BANHEIRO FEMININO PCD
22. BANHEIRO MASCULINO PCD
23. BANHEIRO FEMININO ALUNOS
24. BANHEIRO MASCULINO ALUNOS
25. CORREDORES
26. OUTROS

### Bloco 03 — 2

1. SALA MODULAR 01
2. SALA MODULAR 02

### Externo — 4

1. GUARITA
2. PÁTIO DE ALIMENTAÇÃO
3. ESTACIONAMENTO
4. OUTROS

**Total: 60 ambientes.** A grafia `LABORATORIO DE INFORMÁTICA` é preservada exatamente como constou da fonte institucional recebida; não foi normalizada silenciosamente.

## 3. Categorias e SLA-base inicial

| Categoria | SLA-base (h úteis) |
|---|---:|
| Limpeza e conservação | 30 |
| Segurança física | 40 |
| Instalações elétricas | 50 |
| Instalações hidráulicas | 50 |
| Pragas e animais | 50 |
| Iluminação | 60 |
| Acessibilidade | 80 |
| Portas e janelas | 80 |
| Climatização | 100 |
| Sinalização | 100 |
| Equipamentos instalados | 120 |
| Mobiliário | 120 |
| Estrutura predial | 160 |
| Áreas externas | 160 |
| Outros | 120 |

Os IDs de categoria permanecem estáveis. Alterar o nome do catálogo não altera snapshots históricos das ocorrências.

## 4. Prioridade inicial

- sem risco imediato: `Normal`;
- com risco imediato informado: `Urgente`;
- `Emergencial` somente por decisão administrativa posterior.

## 5. Calendário e primeira resposta

Calendário inicial: segunda a sexta, 09:00–19:00; sábado/domingo fechados; `America/Sao_Paulo`.

Primeira resposta: Baixa 30h, Normal 20h, Alta 10h, Urgente 4h, Emergencial 2h úteis.

Multiplicadores: Baixa 1,50; Normal 1,00; Alta 0,80; Urgente 0,60; Emergencial 0,40.

## 6. Seeds

- `npm run firebase:seed-reference-data`: referências gerais;
- `npm run firebase:seed-campus-spaces -- --dry-run`: conferência dos 60 ambientes;
- `npm run firebase:seed-campus-spaces -- --apply`: aplicação explícita.

O seed de espaços é aditivo/idempotente: não remove, não renomeia silenciosamente e não duplica um ID institucional já existente.
