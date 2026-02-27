import type { SandboxLanguage } from '../types';

export const DEFAULT_CODE: Record<SandboxLanguage, string> = {
  JavaScript: `// Memory API: alloc(label, size) -> id, free(id)
// Allocations not freed will be detected as leaks!

const buf = alloc("buffer", 1024);
const cache = alloc("cache", 512);
const temp = alloc("temp", 256);

free(temp);    // temp is properly freed
free(buf);     // buffer is properly freed

// cache is never freed — leak!
print("Done! Check the visualizer for the leak.");`,

  Python: `# Memory API: alloc(label, size) -> id, free(id)
# Allocations not freed will be detected as leaks!

buf = alloc("buffer", 1024)
cache = alloc("cache", 512)
temp = alloc("temp", 256)

free(temp)    # temp is properly freed
free(buf)     # buffer is properly freed

# cache is never freed — leak!
print("Done! Check the visualizer for the leak.")`,
};
