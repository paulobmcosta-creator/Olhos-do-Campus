import { describe, expect, it } from 'vitest';
import { INITIAL_INTAKE_TEAM } from '../server/repositories/referenceSeedData';
import {
  executeMigrationOnMemory,
  planMigration080,
  type OperationalTeamData,
} from '../scripts/migrate080';

describe('Migração 0.8.0 e Unicidade do Setor Inicial CGAO (C1-F002)', () => {
  function countActiveInitialTeams(teams: OperationalTeamData[]): number {
    return teams.filter((t) => t.active !== false && t.isInitialIntakeTeam === true).length;
  }

  function getActiveInitialTeam(teams: OperationalTeamData[]): OperationalTeamData | undefined {
    return teams.find((t) => t.active !== false && t.isInitialIntakeTeam === true);
  }

  it('1. nenhuma equipe existente: cria CGAO e garante exatamente 1 inicial ativa', () => {
    const input: OperationalTeamData[] = [];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.cgaoExists).toBe(false);
    expect(plan.teamUpdates).toHaveLength(1);
    expect(plan.teamUpdates[0]!.isCreate).toBe(true);
    expect(plan.teamUpdates[0]!.id).toBe(INITIAL_INTAKE_TEAM.id);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
    expect(getActiveInitialTeam(post)?.name).toBe(INITIAL_INTAKE_TEAM.name);
    expect(getActiveInitialTeam(post)?.notificationEmail).toBe('cgao.bsf@ifes.edu.br');
    expect(getActiveInitialTeam(post)?.schemaVersion).toBe(2);
  });

  it('2. CGAO ausente em banco com outras equipes: cria CGAO e atualiza outras equipes para isInitialIntakeTeam=false', () => {
    const input: OperationalTeamData[] = [
      { id: 'team-manutencao', name: 'Manutenção', active: true, isInitialIntakeTeam: true, schemaVersion: 1 },
      { id: 'team-ti', name: 'TI', active: true, isInitialIntakeTeam: false, schemaVersion: 1 },
    ];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.cgaoExists).toBe(false);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
    expect(post.find((t) => t.id === 'team-manutencao')?.isInitialIntakeTeam).toBe(false);
    expect(post.find((t) => t.id === 'team-manutencao')?.schemaVersion).toBe(2);
    expect(post.find((t) => t.id === 'team-ti')?.schemaVersion).toBe(2);
  });

  it('3. CGAO já correta: nenhuma alteração necessária na CGAO', () => {
    const input: OperationalTeamData[] = [
      {
        id: 'team-cgao',
        name: INITIAL_INTAKE_TEAM.name,
        notificationEmail: 'cgao.bsf@ifes.edu.br',
        isInitialIntakeTeam: true,
        active: true,
        schemaVersion: 2,
        memberAdminUserIds: ['user-1'],
      },
    ];
    const plan = planMigration080(input, [], 'DRY_RUN');
    expect(plan.cgaoExists).toBe(true);
    expect(plan.cgaoActive).toBe(true);
    expect(plan.cgaoNameCorrect).toBe(true);
    expect(plan.cgaoEmailCorrect).toBe(true);
    expect(plan.cgaoSchemaCorrect).toBe(true);
    expect(plan.teamUpdatesCount).toBe(0);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.memberAdminUserIds).toEqual(['user-1']);
  });

  it('4. CGAO existente e inativa: reativa CGAO e garante que seja o único acolhimento inicial ativo', () => {
    const input: OperationalTeamData[] = [
      {
        id: 'team-cgao',
        name: INITIAL_INTAKE_TEAM.name,
        notificationEmail: 'cgao.bsf@ifes.edu.br',
        isInitialIntakeTeam: false,
        active: false,
        schemaVersion: 1,
      },
    ];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.cgaoActive).toBe(false);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
    expect(getActiveInitialTeam(post)?.active).toBe(true);
    expect(getActiveInitialTeam(post)?.isInitialIntakeTeam).toBe(true);
  });

  it('5. CGAO com e-mail incorreto: corrige e-mail institucional e preserva membros', () => {
    const input: OperationalTeamData[] = [
      {
        id: 'team-cgao',
        name: INITIAL_INTAKE_TEAM.name,
        notificationEmail: 'email-antigo@ifes.edu.br',
        isInitialIntakeTeam: true,
        active: true,
        schemaVersion: 2,
        memberAdminUserIds: ['user-cgao-1', 'user-cgao-2'],
      },
    ];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.cgaoEmailCorrect).toBe(false);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    const cgao = getActiveInitialTeam(post)!;
    expect(cgao.notificationEmail).toBe('cgao.bsf@ifes.edu.br');
    expect(cgao.memberAdminUserIds).toEqual(['user-cgao-1', 'user-cgao-2']);
  });

  it('6. CGAO sem flag inicial (isInitialIntakeTeam === false): adiciona a flag', () => {
    const input: OperationalTeamData[] = [
      {
        id: 'team-cgao',
        name: INITIAL_INTAKE_TEAM.name,
        notificationEmail: 'cgao.bsf@ifes.edu.br',
        isInitialIntakeTeam: false,
        active: true,
        schemaVersion: 2,
      },
    ];
    const plan = planMigration080(input, [], 'APPLY');

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
  });

  it('7. outra equipe marcada como inicial: desmarca outra equipe e marca CGAO', () => {
    const input: OperationalTeamData[] = [
      {
        id: 'team-cgao',
        name: INITIAL_INTAKE_TEAM.name,
        notificationEmail: 'cgao.bsf@ifes.edu.br',
        isInitialIntakeTeam: false,
        active: true,
        schemaVersion: 2,
      },
      {
        id: 'team-outra',
        name: 'Outra Equipe',
        notificationEmail: 'outra@ifes.edu.br',
        isInitialIntakeTeam: true,
        active: true,
        schemaVersion: 2,
      },
    ];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.currentInitialIntakeCount).toBe(1);
    expect(plan.currentInitialIntakeTeamIds).toEqual(['team-outra']);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
    expect(post.find((t) => t.id === 'team-outra')?.isInitialIntakeTeam).toBe(false);
    expect(post.find((t) => t.id === 'team-outra')?.active).toBe(true);
  });

  it('8. duas outras equipes marcadas como iniciais: desmarca ambas e estabelece CGAO', () => {
    const input: OperationalTeamData[] = [
      { id: 'team-1', name: 'Equipe 1', isInitialIntakeTeam: true, active: true, schemaVersion: 1 },
      { id: 'team-2', name: 'Equipe 2', isInitialIntakeTeam: true, active: true, schemaVersion: 1 },
    ];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.currentInitialIntakeCount).toBe(2);
    expect(plan.currentInitialIntakeTeamIds).toEqual(['team-1', 'team-2']);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
    expect(post.find((t) => t.id === 'team-1')?.isInitialIntakeTeam).toBe(false);
    expect(post.find((t) => t.id === 'team-2')?.isInitialIntakeTeam).toBe(false);
  });

  it('9. CGAO + outra equipe ambas com isInitialIntakeTeam === true: remove flag da outra equipe', () => {
    const input: OperationalTeamData[] = [
      {
        id: 'team-cgao',
        name: INITIAL_INTAKE_TEAM.name,
        notificationEmail: 'cgao.bsf@ifes.edu.br',
        isInitialIntakeTeam: true,
        active: true,
        schemaVersion: 2,
      },
      {
        id: 'team-engenharia',
        name: 'Engenharia',
        isInitialIntakeTeam: true,
        active: true,
        schemaVersion: 2,
      },
    ];
    const plan = planMigration080(input, [], 'APPLY');
    expect(plan.currentInitialIntakeCount).toBe(2);

    const post = executeMigrationOnMemory(input, plan);
    expect(countActiveInitialTeams(post)).toBe(1);
    expect(getActiveInitialTeam(post)?.id).toBe('team-cgao');
    expect(post.find((t) => t.id === 'team-engenharia')?.isInitialIntakeTeam).toBe(false);
    expect(post.find((t) => t.id === 'team-engenharia')?.active).toBe(true);
  });

  it('10. execução repetida é idempotente: segunda execução gera zero alterações pendentes', () => {
    const input: OperationalTeamData[] = [
      { id: 'team-engenharia', name: 'Engenharia', isInitialIntakeTeam: true, active: true, schemaVersion: 1 },
    ];
    const plan1 = planMigration080(input, [], 'APPLY');
    const post1 = executeMigrationOnMemory(input, plan1);

    expect(countActiveInitialTeams(post1)).toBe(1);
    expect(getActiveInitialTeam(post1)?.id).toBe('team-cgao');

    // Segunda execução sobre a base já migrada
    const plan2 = planMigration080(post1, [], 'DRY_RUN');
    expect(plan2.teamUpdatesCount).toBe(0);
    expect(plan2.cgaoExists).toBe(true);
    expect(plan2.cgaoActive).toBe(true);
    expect(plan2.cgaoNameCorrect).toBe(true);
    expect(plan2.cgaoEmailCorrect).toBe(true);
    expect(plan2.cgaoSchemaCorrect).toBe(true);
    expect(plan2.currentInitialIntakeCount).toBe(1);

    const post2 = executeMigrationOnMemory(post1, plan2);
    expect(post2).toEqual(post1);
  });
});
