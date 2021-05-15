import { ArrayNotEmpty, IsNotEmpty, IsOptional } from 'class-validator';
import { FileInfo } from './create-model.dto';

export class UpdateModelDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  description: string;

  @ArrayNotEmpty()
  tags: string[];

  @IsOptional()
  metadata: { [key: string]: string };

  @IsOptional()
  images: FileInfo[];

  @IsOptional()
  models: FileInfo[];

  @IsOptional()
  gltf: FileInfo[];
}
