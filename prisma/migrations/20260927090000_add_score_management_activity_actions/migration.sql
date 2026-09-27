-- ActivityAction: nouvelles valeurs pour la journalisation des actions de
-- gestion du système de points (modification/suppression jusque-là non
-- couvertes : modifier une condition, supprimer un tableau/une équipe,
-- retirer un membre d'une équipe).
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_CONDITION_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_BOARD_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TEAM_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE 'SCORE_TEAM_MEMBER_REMOVED';
