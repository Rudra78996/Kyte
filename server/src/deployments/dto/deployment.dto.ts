import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDeploymentDto {
  @IsOptional()
  @IsString()
  @Matches(/^(?:HEAD|[a-fA-F0-9]{7,40})$/, {
    message: 'commitSha must be HEAD or a 7–40 character hexadecimal SHA',
  })
  commitSha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commitMessage?: string;
}
