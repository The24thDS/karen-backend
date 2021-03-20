import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const multerOptions = (dest: string = './uploads') => {
  return {
    storage: diskStorage({
      destination: dest,
      filename: (_req, file, cb) => {
        //Calling the callback passing the random name generated with the original extension name
        cb(null, `${uuidv4()}${extname(file.originalname)}`);
      },
    }),
  };
};
