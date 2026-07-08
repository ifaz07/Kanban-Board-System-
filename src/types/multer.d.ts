// Forces TypeScript to load @types/multer's global `Express.Multer` augmentation.
// Without a real import somewhere in the compiled source tree, some setups skip
// auto-loading ambient @types packages that are only referenced via
// `Express.Multer.File` (never `import 'multer'` directly), causing TS2694.
import 'multer';
