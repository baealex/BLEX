import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { glob } from 'glob';
import type { Plugin } from 'vite';

interface CollectStylesOptions {
    templatesDir: string;
    includePatterns?: string[];
}

interface StyleEntry {
    id: string;
    path: string;
}

export function collectTemplateStyles(options: CollectStylesOptions = { templatesDir: '../src/board/templates/board' }): Plugin {
    const {
        templatesDir,
        includePatterns = ['**/*.scss', '**/*.css']
    } = options;

    // 템플릿 디렉토리에서 스타일 파일들 수집
    function collectStyleFiles(): StyleEntry[] {
        const styleEntries: StyleEntry[] = [];
        const templatesPath = resolve(templatesDir);

        // 각 include pattern에 대해 파일 검색
        includePatterns.forEach(pattern => {
            const styleFiles = glob.sync(join(templatesPath, pattern));

            styleFiles.forEach(stylePath => {
                // 템플릿 디렉토리 기준 상대 경로에서 고유 ID 생성
                const relativePath = stylePath.replace(templatesPath, '').replace(/^[/\\]/, '');
                const id = relativePath
                    .replace(/[/\\]/g, '_')
                    .replace(/\.[^.]+$/, '')
                    .replace(/[^a-zA-Z0-9_-]/g, '_');

                styleEntries.push({
                    id: `template_${id}`,
                    path: stylePath
                });
            });
        });

        return styleEntries;
    }

    // Vite의 input에 추가할 엔트리들 생성
    function generateInputEntries(): Record<string, string> {
        const styleFiles = collectStyleFiles();
        const entries: Record<string, string> = {};

        styleFiles.forEach(({ id, path }) => {
            entries[id] = path;
        });

        return entries;
    }

    return {
        name: 'collect-template-styles',

        config(config) {
            const templateStyleEntries = generateInputEntries();

            if (Object.keys(templateStyleEntries).length > 0) {
                console.log(`📋 Found ${Object.keys(templateStyleEntries).length} template style files`);

                // Vite의 build.rollupOptions.input에 추가
                if (!config.build) config.build = {};
                if (!config.build.rollupOptions) config.build.rollupOptions = {};
                if (!config.build.rollupOptions.input) config.build.rollupOptions.input = {};

                const existingInput = config.build.rollupOptions.input as Record<string, string>;

                // 기존 엔트리와 템플릿 스타일 엔트리 합치기
                config.build.rollupOptions.input = {
                    ...existingInput,
                    ...templateStyleEntries
                };
            }
        },

        buildStart() {
            const styleFiles = collectStyleFiles();
            console.log(`🎨 Collecting ${styleFiles.length} template style files...`);

            // 각 스타일 파일 존재 여부 확인
            styleFiles.forEach(({ path }) => {
                if (!existsSync(path)) {
                    console.warn(`⚠️ Template style file not found: ${path}`);
                }
            });
        }
    };
}
