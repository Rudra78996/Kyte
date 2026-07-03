export class CreateProjectDto {
  name!: string;
  description?: string;
  repoUrl!: string;
}

export class UpdateProjectDto {
  name?: string;
  description?: string;
}
