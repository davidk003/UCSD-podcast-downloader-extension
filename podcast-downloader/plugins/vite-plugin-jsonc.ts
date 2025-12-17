import { parse } from 'jsonc-parser';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

interface JsoncPluginOptions {
  filename: string; // The file to look for (e.g., 'config.jsonc')
  outDir?: string;  // Optional: override dist folder (default: 'dist')
}

export function jsoncToJSON(options: JsoncPluginOptions): Plugin {
  return {
    name: 'vite-plugin-jsonc-to-json',
    closeBundle: async () => {
      const outDir = options.outDir || 'dist';
      const fileName = options.filename;

      const filePath = path.resolve(outDir, fileName);
      const targetPath = path.resolve(outDir, fileName.replace('.jsonc', '.json'));

      if (fs.existsSync(filePath)) {
        try {
          const jsoncContent = fs.readFileSync(filePath, 'utf-8');
          
          // Parse using jsonc-parser (strips comments/trailing commas)
          const data = parse(jsoncContent);
          fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
          // Remove the original .jsonc
          fs.unlinkSync(filePath);
          
          console.log(`\n[jsonc-plugin] Converted ${fileName} to JSON.`);
        } catch (error) {
          console.error(`\n[jsonc-plugin] Failed to convert ${fileName}:`, error);
        }
      }
    }
  };
}