import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';

export const multerOptions = (dest: string = './uploads') => {
  return {
    storage: diskStorage({
      destination: dest,
      filename: (_req, file, cb) => {
        //Calling the callback passing the random name generated with the original extension name
        cb(null, `${uuidv4()}_${file.originalname}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      let isValid;
      switch (file.fieldname) {
        case 'images':
          isValid = file.mimetype.startsWith('image');
          break;
        case 'models':
          isValid = /(\.stl|\.mtl|\.obj|\.zip|\.dae|\.fbx)$/.test(
            file.originalname,
          );
          break;
        case 'gltf':
          isValid =
            /(\.gltf|\.bin)$/.test(file.originalname) ||
            file.mimetype.startsWith('image');
          break;
        default:
          isValid = false;
          break;
      }
      cb(null, isValid);
    },
  };
};
