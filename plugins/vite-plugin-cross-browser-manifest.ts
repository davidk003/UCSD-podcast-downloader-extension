import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

interface ManifestCleanerOptions {
  filename: string;
  outDir?: string;
  target?: string;
}

// Fix export name to match file
export function crossBrowserManifest(options: ManifestCleanerOptions): Plugin {
  return {
    name: 'vite-plugin-cross-browser-manifest',
    closeBundle: async () => {
      if (!options.target) return;

      const outDir = options.outDir || 'dist';
      const fileName = options.filename;
      const filePath = path.resolve(outDir, fileName);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const manifest = JSON.parse(content);

          let modified = false;

          if (options.target === 'chrome') {
            if (manifest.sidebar_action) {
              delete manifest.sidebar_action;
              modified = true;
              console.log(`\n[manifest-cleaner] Removed 'sidebar_action' for Chrome build.`);
            }
          } else if (options.target === 'firefox') {
             // Firefox supports sidebar_action, but might complain about side_panel or other things?
             // Currently side_panel is Chrome-specific (Manifest V3), but Firefox is adopting it.
             // For now, we leave side_panel unless we know it causes issues.
             // If we wanted to be strict:
             /*
             if (manifest.side_panel) {
               delete manifest.side_panel;
               modified = true;
                console.log(`\n[manifest-cleaner] Removed 'side_panel' for Firefox build.`);
             }
             */
          }

          if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
            console.log(`[manifest-cleaner] Updated ${fileName} for target: ${options.target}`);
          }
        } catch (error) {
          console.error(`\n[manifest-cleaner] Failed to clean ${fileName}:`, error);
        }
      }
    }
  };
}
