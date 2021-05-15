import { ArrayNotEmpty, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class FileInfo {
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsNotEmpty()
  name: string;
}

export class CreateModelDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  description: string;

  @ArrayNotEmpty()
  tags: string[];

  @IsOptional()
  metadata: { [key: string]: string };

  @ArrayNotEmpty()
  images: FileInfo[];

  @ArrayNotEmpty()
  models: FileInfo[];

  @ArrayNotEmpty()
  gltf: FileInfo[];
}
