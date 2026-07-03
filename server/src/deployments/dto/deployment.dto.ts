export class CreateDeploymentDto {
  repoUrl!: string;
  branch!: string;
  commitSha!: string;
  commitMessage?: string;
  trigger?: 'manual' | 'webhook' | 'rollback';
}
