import { ArrayNotEmpty, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateModelDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  description: string;

  @ArrayNotEmpty()
  tags: string[];

  @IsOptional()
  metadata: { [key: string]: string };
}
