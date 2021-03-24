import { ArrayNotEmpty, IsNotEmpty } from 'class-validator';

export class CreateModelDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  description: string;

  @ArrayNotEmpty()
  tags: string[];
}
