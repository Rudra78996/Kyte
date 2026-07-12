export class CreateProjectDto {
  name!: string;
  description?: string;
  repoUrl!: string;
  preset?: string;
  rootDirectory?: string;
  buildCommand?: string;
  outputDirectory?: string;
  branch?: string;
}

export class UpdateProjectDto {
  name?: string;
  description?: string;
  repoUrl?: string;
  preset?: string;
  rootDirectory?: string;
  buildCommand?: string;
  outputDirectory?: string;
  branch?: string;
}
