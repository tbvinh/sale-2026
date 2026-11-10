import { registerPlugin } from '../core/plugins.js';

const SKIPPED_PLUGINS = ['calendar', 'mail', 'tasks', 'people', 'bank', 'general', 'reports'];

// Mỗi thư mục con có index.jsx (export default plugin) sẽ tự được đăng ký
const modules = import.meta.glob('./*/index.jsx', { eager: true });
// Object.values(modules).forEach((m) => registerPlugin(m.default));

Object.entries(modules).forEach(([path, module]) => {
  // path có dạng: "./plugin-a/index.jsx" -> tách lấy tên thư mục "plugin-a"
  const folderName = path.split('/')[1];

  // Nếu nằm trong danh sách bỏ qua thì skip
  if (SKIPPED_PLUGINS.includes(folderName)) {
    return;
  }

  // Đăng ký plugin
  if (module.default) {
    registerPlugin(module.default);
  }
});
