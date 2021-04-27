export default interface ModelUploadFiles {
  models: Express.Multer.File[];
  images: Express.Multer.File[];
  gltf: Express.Multer.File[];
}
