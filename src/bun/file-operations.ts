import { readdir, readFile, writeFile, mkdir, stat, copyFile, rename, rm } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import type { FileEntry } from "../shared/types";

/**
 * Recursively read a directory and return file entries for .md files.
 */
async function getDirectoryEntries(dirPath: string): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];

    try {
        const items = await readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            // Skip hidden files and directories
            if (item.name.startsWith(".")) continue;

            const fullPath = join(dirPath, item.name);

            if (item.isDirectory()) {
                const children = await getDirectoryEntries(fullPath);
                // Only include directories that contain .md files (directly or nested)
                if (children.length > 0) {
                    entries.push({
                        name: item.name,
                        path: fullPath,
                        isDirectory: true,
                        children,
                    });
                }
            } else if (extname(item.name).toLowerCase() === ".md") {
                entries.push({
                    name: item.name,
                    path: fullPath,
                    isDirectory: false,
                });
            }
        }
    } catch (error) {
        console.error(`Failed to read directory: ${dirPath}`, error);
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });

    return entries;
}

/**
 * Safely ensures a directory exists.
 * Helps avoid 'EEXIST' errors on some Windows environments where recursive mkdir might fail on existing components.
 */
async function ensureDir(dirPath: string) {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (error: any) {
        if (error.code === 'EEXIST') {
            // Check if it's actually a directory
            try {
                const s = await stat(dirPath);
                if (s.isDirectory()) return;
            } catch (ignore) {}
        }
        throw error;
    }
}

// @ts-ignore
import * as nfd from "nativefiledialog-for-bun";
import { BrowserWindow, Utils } from "electrobun/bun";
import { withDpiContext, getWindowHandle } from "./platform-dpi";

// バンドル環境での DLL 探索パスを設定（ユーザーによる 0.3.2 での追加機能）
if (process.platform === 'win32') {
    // 実行ファイル (Resources/app/bun/index.js) から見た相対パス
    // electrobun.config.ts で DLL を bin/win32/x64/nfd.dll にコピーしているため、
    // そのフォルダを指定する。 import.meta.dir は Resources/app/bun を指す。
    const libPath = join(import.meta.dir, '..', 'bin', 'win32', 'x64');
    // @ts-ignore
    nfd.setLibraryPath(libPath);
    console.log(`[nfd] Library path set to: ${libPath} (Mode: ${nfd.getBackendName()})`);
}

let mainWindow: BrowserWindow | null = null;
let mainWindowHwnd: any = null;

function getHwnd(): any {
    if (mainWindowHwnd) return mainWindowHwnd;
    if (mainWindow) {
        mainWindowHwnd = getWindowHandle(mainWindow.title);
    }
    return mainWindowHwnd;
}

/**
 * メインウィンドウの参照を設定します。
 * ダイアログを表示する際の親ウィンドウ（HWND）として使用されます。
 */
export function setMainWindow(win: BrowserWindow) {
    mainWindow = win;
}

/**
 * File operation handlers for RPC requests from the Webview.
 */
export const handleFileOperations = {
    setMainWindow,

    openFolder: async () => {
        console.log("[openFolder] Starting native folder dialog...");
        return await withDpiContext(async () => {
            try {
                console.log("[openFolder] Calling nfd.pickFolder...");
                const folderPath = await nfd.pickFolder({
                    parentWindow: getHwnd()
                });
                console.log("[openFolder] Result:", folderPath);
                return folderPath;
            } catch (error) {
                console.error("[openFolder] Error:", error);
                return null;
            }
        });
    },

    readDirectory: async ({ dirPath }: { dirPath: string }) => {
        return getDirectoryEntries(dirPath);
    },

    readFile: async ({ filePath }: { filePath: string }) => {
        try {
            const content = await readFile(filePath, "utf-8");
            return content;
        } catch (error) {
            console.error(`Failed to read file: ${filePath}`, error);
            throw new Error(`Cannot read file: ${filePath}`);
        }
    },

    writeFile: async ({
        filePath,
        content,
    }: {
        filePath: string;
        content: string;
    }) => {
        try {
            // Ensure parent directory exists
            const dir = dirname(filePath);
            await ensureDir(dir);
            await writeFile(filePath, content, "utf-8");
            return true;
        } catch (error) {
            console.error(`[writeFile] Failed: ${filePath}`, error);
            return false;
        }
    },

    createFile: async ({
        dirPath,
        fileName,
    }: {
        dirPath: string;
        fileName: string;
    }) => {
        const safeName = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
        const filePath = join(dirPath, safeName);

        try {
            // Ensure directory exists
            await ensureDir(dirPath);
            // Create empty file
            await writeFile(filePath, "", "utf-8");
            return filePath;
        } catch (error) {
            console.error(`Failed to create file: ${filePath}`, error);
            throw new Error(`Cannot create file: ${filePath}`);
        }
    },

    createDirectory: async ({
        dirPath,
        dirName,
    }: {
        dirPath: string;
        dirName: string;
    }) => {
        const newDirPath = join(dirPath, dirName);
        try {
            await ensureDir(newDirPath);
            return newDirPath;
        } catch (error) {
            console.error(`Failed to create directory: ${newDirPath}`, error);
            throw new Error(`Cannot create directory: ${newDirPath}`);
        }
    },

    showSaveFileDialog: async (params: { defaultPath?: string; title?: string; filter?: string }) => {
        const fullDefaultPath = params.defaultPath || "";
        let defaultPath = "";
        let defaultName = "";

        if (fullDefaultPath) {
            // If it's a directory, use it as defaultPath. If it has a filename, split it.
            if (fullDefaultPath.endsWith("/") || fullDefaultPath.endsWith("\\")) {
                defaultPath = fullDefaultPath;
            } else {
                defaultPath = dirname(fullDefaultPath);
                defaultName = basename(fullDefaultPath);
            }
        }

        // Note: filters format is [{ name: 'Markdown', extensions: ['md'] }]
        const filters = params.filter ? 
            params.filter.split('|').filter((_, i) => i % 2 === 0).map(s => {
                const name = s.split('(')[0].trim();
                const ext = s.match(/\*\.([a-zA-Z0-9]+)/)?.[1] || "";
                return { name, extensions: [ext] };
            }).filter(f => f.extensions[0] !== "") :
            [{ name: "Markdown Files", extensions: ["md"] }];

        return await withDpiContext(async () => {
            try {
                console.log("[showSaveFileDialog] Calling nfd.saveFile...");
                const resultPath = await nfd.saveFile({
                    defaultPath,
                    defaultName,
                    filters,
                    parentWindow: getHwnd()
                });
                
                console.log("[showSaveFileDialog] Result:", resultPath);
                return resultPath;
            } catch (err) {
                console.error("[showSaveFileDialog] NFD Error:", err);
                return null;
            }
        });
    },

    showFolderBrowserDialog: async (params: { defaultPath?: string; title?: string }) => {
        const defaultPath = params.defaultPath || "";

        return await withDpiContext(async () => {
            try {
                console.log("[showFolderBrowserDialog] Calling nfd.pickFolder...");
                const resultPath = await nfd.pickFolder({
                    defaultPath,
                    parentWindow: getHwnd()
                });
                
                console.log("[showFolderBrowserDialog] Result:", resultPath);
                return resultPath;
            } catch (err) {
                console.error("[showFolderBrowserDialog] NFD Error:", err);
                return null;
            }
        });
    },

    saveImage: async ({ targetDir, fileName, base64Data }: { targetDir: string; fileName: string; base64Data: string }) => {
        try {
            const assetsDir = join(targetDir, "assets");
            await ensureDir(assetsDir);

            // Strip base64 prefix if exists (data:image/png;base64,...)
            const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Content, 'base64');
            
            const uniqueFileName = `${Date.now()}-${fileName}`;
            const filePath = join(assetsDir, uniqueFileName);
            await writeFile(filePath, buffer);
            
            // Return URL-friendly relative path (always using / even on Windows)
            return { success: true, relativePath: "assets/" + uniqueFileName };
        } catch (error: any) {
            console.error("[saveImage] Failed:", error);
            return { success: false, relativePath: "", error: error.message };
        }
    },

    copyImage: async ({ targetDir, sourcePath }: { targetDir: string; sourcePath: string }) => {
        try {
            const assetsDir = join(targetDir, "assets");
            await ensureDir(assetsDir);

            const fileName = `${Date.now()}-${basename(sourcePath)}`;
            const destPath = join(assetsDir, fileName);
            
            await copyFile(sourcePath, destPath);
            
            // Return URL-friendly relative path (always using / even on Windows)
            return { success: true, relativePath: "assets/" + fileName };
        } catch (error: any) {
            console.error("[copyImage] Failed:", error);
            return { success: false, relativePath: "", error: error.message };
        }
    },

    readImageAsDataUrl: async ({ filePath }: { filePath: string }) => {
        try {
            const data = await readFile(filePath);
            const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
            const base64 = Buffer.from(data).toString('base64');
            return { dataUrl: `data:${mimeType};base64,${base64}` };
        } catch (error) {
            console.error("Error reading image as data URL:", error);
            return { dataUrl: null };
        }
    },

        renameEntry: async ({ oldPath, newName }: { oldPath: string; newName: string }) => {
        try {
            const dir = dirname(oldPath);
            const newPath = join(dir, newName);
            await rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error: any) {
            console.error("[renameEntry] Failed:", error);
            return { success: false, newPath: "", error: error.message };
        }
    },

    deleteEntry: async ({ path }: { path: string }) => {
        try {
            await rm(path, { recursive: true, force: true });
            return { success: true };
        } catch (error: any) {
            console.error("[deleteEntry] Failed:", error);
            return { success: false, error: error.message };
        }
    },

    moveEntry: async ({ oldPath, newParentDir }: { oldPath: string; newParentDir: string }) => {
        try {
            const name = basename(oldPath);
            const newPath = join(newParentDir, name);
            await rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error: any) {
            console.error("[moveEntry] Failed:", error);
            return { success: false, newPath: "", error: error.message };
        }
    },

    getLicenses: async () => {

        return [
            {
                name: "ElectroBun",
                type: "MIT",
                copyright: "Copyright (c) 2024 Blackboard Technologies inc.",
                text: `MIT License

Copyright (c) 2024 Blackboard Technologies inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.`
            },
            {
                name: "DOMPurify",
                type: "Apache 2.0 / MPL 2.0",
                copyright: "Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53",
                text: `DOMPurify
Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53

DOMPurify is free software; you can redistribute it and/or modify it under the
terms of either:

a) the Apache License Version 2.0, or
b) the Mozilla Public License Version 2.0

-----------------------------------------------------------------------------

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any`
            },
            {
                name: "KaTeX",
                type: "MIT",
                copyright: "Copyright (c) 2014-2021 Khan Academy and other contributors",
                text: `The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
            },
            {
                name: "Markdown-It",
                type: "MIT",
                copyright: "Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin",
                text: `Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.`
            },
            {
                name: "Mermaid",
                type: "MIT",
                copyright: "Copyright (c) 2014-2022 Knut Sveidqvist",
                text: `The MIT License (MIT)

Copyright (c) 2014 - 2022 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
            },
            {
                name: "Turndown",
                type: "MIT",
                copyright: "Copyright (c) 2017 Dom Christie",
                text: `MIT License

Copyright (c) 2017 Dom Christie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
            },
            {
                name: "Bun",
                type: "MIT",
                copyright: "Copyright (c) 2023 oven.sh",
                text: `Bun itself is MIT-licensed.

## JavaScriptCore
Bun statically links JavaScriptCore (and WebKit) which is LGPL-2 licensed. WebCore files from WebKit are also licensed under LGPL2. Per LGPL2:

> (1) If you statically link against an LGPL’d library, you must also provide your application in an object (not necessarily source) format, so that a user has the opportunity to modify the library and relink the application.

You can find the patched version of WebKit used by Bun here: https://github.com/oven-sh/webkit. If you would like to relink Bun with changes:

- \`git submodule update --init --recursive\`
- \`make jsc\`
- \`zig build\`

This compiles JavaScriptCore, compiles Bun’s \`.cpp\` bindings for JavaScriptCore (which are the object files using JavaScriptCore) and outputs a new \`bun\` binary with your changes.

## Linked libraries
Bun statically links these libraries:

| Library | License |
|---------|---------|
| \`boringssl\` | several licenses |
| \`brotli\` | MIT |
| \`libarchive\` | several licenses |
| \`lol-html\` | BSD 3-Clause |
| \`mimalloc\` | MIT |
| \`picohttp\` | dual-licensed under the Perl License or the MIT License |
| \`zstd\` | dual-licensed under the BSD License or GPLv2 license |
| \`simdutf\` | Apache 2.0 |
| \`tinycc\` | LGPL v2.1 |
| \`uSockets\` | Apache 2.0 |
| \`zlib-cloudflare\` | zlib |
| \`c-ares\` | MIT licensed |
| \`libicu\` 72 | license here |
| \`libbase64\` | BSD 2-Clause |
| \`libuv\` (on Windows) | MIT |
| \`libdeflate\` | MIT |
| \`uucode\` | MIT |
| A fork of \`uWebsockets\` | Apache 2.0 licensed |
| Parts of Tigerbeetle's IO code | Apache 2.0 licensed |

## Polyfills
For compatibility reasons, the following packages are embedded into Bun's binary and injected if imported.

| Package | License |
|---------|---------|
| \`assert\` | MIT |
| \`browserify-zlib\` | MIT |
| \`buffer\` | MIT |
| \`constants-browserify\` | MIT |
| \`crypto-browserify\` | MIT |
| \`domain-browser\` | MIT |
| \`events\` | MIT |
| \`https-browserify\` | MIT |
| \`os-browserify\` | MIT |
| \`path-browserify\` | MIT |
| \`process\` | MIT |
| \`punycode\` | MIT |
| \`querystring-es3\` | MIT |
| \`stream-browserify\` | MIT |
| \`stream-http\` | MIT |
| \`string_decoder\` | MIT |
| \`timers-browserify\` | MIT |
| \`tty-browserify\` | MIT |
| \`url\` | MIT |
| \`util\` | MIT |
| \`vm-browserify\` | MIT |

## Additional credits
- Bun's JS transpiler, CSS lexer, and Node.js module resolver source code is a Zig port of @evanw’s esbuild project.
- Credit to @kipply for the name "Bun"!`
            }
        ];
    },
};
