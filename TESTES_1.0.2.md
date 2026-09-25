# Testes Executados — Versão 1.0.2

**Data:** 25 de setembro de 2026  
**Pipeline de referência:** GitHub Actions — `Validate pull request`

## Estado

A validação final da branch `release/1.0.2-status-livre` está em execução. Este documento será atualizado com os resultados efetivamente observados antes do merge.

## Cobertura específica incluída

Foram adicionados ou ajustados testes para:
- transição direta entre quaisquer situações ativas;
- igualdade de liberdade de transição entre Administrador, Gestor e Atendente;
- retirada de `Duplicada` das situações ativas;
- compatibilidade de leitura com `Duplicada` legada;
- reabertura de situação final para qualquer situação não final;
- resolução direta de `Recebida`;
- reabertura direta de `Resolvida` para `Em atendimento`;
- pausa de SLA ao ir diretamente para `Aguardando material`;
- sincronização de situação livre em agrupamento apensado;
- seletor do Atendente com todas as situações ativas e sem `Duplicada`;
- identidade de release 1.0.2;
- nome canônico da imagem `olhos-do-campus-api` no wrapper de deploy.

## Testes externos

As suítes com Firebase Emulator e integrações reais EWS/R2/Resend não fazem parte do workflow padrão de pull request e somente serão declaradas como executadas se houver evidência de execução.
