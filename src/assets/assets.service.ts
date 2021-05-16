import { Injectable } from '@nestjs/common';
import { FileInfo } from 'src/models/dto/create-model.dto';
import * as fs from 'fs';
import * as validator from 'gltf-validator';
const bytes = require('bytes');

interface validateGltfPayloadResponse {
  totalTriangleCount: number;
  totalVertexCount: number;
  errors: string[];
}

@Injectable()
export class AssetsService {
  async validateGltfPayload(
    gltfFiles: FileInfo[],
  ): Promise<validateGltfPayloadResponse> {
    const filePaths = gltfFiles.map(
      (fileInfo) =>
        `${process.env.TEMP_UPLOAD_DIRECTORY}/${fileInfo.id}_${fileInfo.name}`,
    );
    const gltfFilePath = filePaths.find((path) => path.endsWith('.gltf'));
    const gltfArrayBuffer = await fs.promises.readFile(gltfFilePath);
    const result = await validator.validateBytes(
      new Uint8Array(gltfArrayBuffer),
      {
        externalResourceFunction: (uri) =>
          new Promise(async (resolve, reject) => {
            const splitURI = uri.split('/');
            const resource = gltfFiles.find(
              (fileInfo) => fileInfo.name === splitURI[splitURI.length - 1],
            );
            if (resource) {
              const resourceArrayBuffer = await fs.promises.readFile(
                `${process.env.TEMP_UPLOAD_DIRECTORY}/${resource.id}_${resource.name}`,
              );
              resolve(new Uint8Array(resourceArrayBuffer));
            } else {
              reject(
                `${uri} is referenced in the GLTF object but it was not selected by the user.`,
              );
            }
          }),
      },
    );
    if (result.issues.numErrors === 0) {
      return {
        totalTriangleCount: result.info.totalTriangleCount,
        totalVertexCount: result.info.totalVertexCount,
        errors: undefined,
      };
    } else {
      const errors = result.issues.messages.map((msgObj) => msgObj.message);
      return {
        totalTriangleCount: undefined,
        totalVertexCount: undefined,
        errors: errors,
      };
    }
  }

  async moveFiles(
    filesInfo: FileInfo[],
    destinationDir: fs.PathLike,
  ): Promise<{ name: string; size: string }[]> {
    await fs.promises.mkdir(destinationDir, { recursive: true });
    const files: { name: string; size: string }[] = [];
    for (let i = 0; i < filesInfo.length; i++) {
      const file = filesInfo[i];
      const filePath = `${process.env.TEMP_UPLOAD_DIRECTORY}/${file.id}_${file.name}`;
      try {
        const size = (await fs.promises.stat(filePath)).size;
        await fs.promises.rename(filePath, `${destinationDir}/${file.name}`);
        files.push({ name: file.name, size: bytes(size) });
      } catch (error) {
        console.log(error);
        throw new Error(error.message);
      }
    }
    return files;
  }
}