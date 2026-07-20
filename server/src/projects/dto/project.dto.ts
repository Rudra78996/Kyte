import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const GITHUB_REPOSITORY_PATTERN =
  /^(?:https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git)$/;
const BRANCH_PATTERN =
  /^(?!.*(?:\.\.|\/\/|@\{|\\))(?![./])(?!.*[./]$)[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const RELATIVE_DIRECTORY_PATTERN =
  /^(?![A-Za-z]:[\\/])(?![/\\])(?!.*(?:^|[/\\])\.\.(?:[/\\]|$))(?!.*\0).{1,200}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class EnvironmentVariableDto {
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/)
  key!: string;

  @IsString()
  @MaxLength(16_384)
  value!: string;
}

export class CreateProjectDto {
  @IsString()
  @Length(1, 80)
  @Matches(/\S/, { message: 'name must contain a visible character' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(300)
  @Matches(GITHUB_REPOSITORY_PATTERN, {
    message: 'repoUrl must be a valid GitHub HTTPS or SSH repository URL',
  })
  repoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preset?: string;

  @IsOptional()
  @IsString()
  @Matches(RELATIVE_DIRECTORY_PATTERN, {
    message: 'rootDirectory must be a safe relative path',
  })
  rootDirectory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  buildCommand?: string;

  @IsOptional()
  @IsString()
  @Matches(RELATIVE_DIRECTORY_PATTERN, {
    message: 'outputDirectory must be a safe relative path',
  })
  outputDirectory?: string;

  @IsOptional()
  @IsString()
  @Matches(BRANCH_PATTERN, { message: 'branch is not a valid Git branch name' })
  branch?: string;

  @IsString()
  @Matches(ID_PATTERN)
  organizationId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((variable: EnvironmentVariableDto) => variable.key)
  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  environmentVariables?: EnvironmentVariableDto[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/\S/, { message: 'name must contain a visible character' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(GITHUB_REPOSITORY_PATTERN)
  repoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preset?: string;

  @IsOptional()
  @IsString()
  @Matches(RELATIVE_DIRECTORY_PATTERN)
  rootDirectory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  buildCommand?: string;

  @IsOptional()
  @IsString()
  @Matches(RELATIVE_DIRECTORY_PATTERN)
  outputDirectory?: string;

  @IsOptional()
  @IsString()
  @Matches(BRANCH_PATTERN)
  branch?: string;
}

export class EnvironmentVariablesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((variable: EnvironmentVariableDto) => variable.key)
  @ValidateNested({ each: true })
  @Type(() => EnvironmentVariableDto)
  variables!: EnvironmentVariableDto[];
}

export class DomainDto {
  @IsString()
  @Length(1, 253)
  domainName!: string;
}
