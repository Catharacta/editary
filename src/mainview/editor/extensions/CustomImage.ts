import Image from "@tiptap/extension-image";
import { electroview } from "../../ipc";
import { state } from "../../state/workspace";

/**
 * Custom Image extension that handles lazy loading of local files via Electrobun RPC.
 */
export const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            "data-original-src": { default: null },
        };
    },

    renderHTML({ HTMLAttributes }) {
        const container = document.createElement("div");
        container.className = "image-container";
        
        const src = HTMLAttributes.src;
        const img = document.createElement("img");
        img.className = "neo-image";
        
        // If it's a relative path, use lazy loading
        const isRelative = src && !src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("views:");
        
        if (isRelative) {
            img.src = "";
            img.style.opacity = "0.3";
            
            if (typeof IntersectionObserver !== 'undefined') {
                const observer = new IntersectionObserver(async (entries) => {
                    for (const entry of entries) {
                        if (entry.isIntersecting) {
                            observer.disconnect();
                            
                            if (state.currentFilePath && electroview.rpc) {
                                // Calculate full path relative to the current file
                                const baseDir = state.currentFilePath.replace(/[\\/][^\\/]*$/, "") || ".";
                                const separator = baseDir.includes("\\") ? "\\" : "/";
                                const fullPath = baseDir + (baseDir.endsWith(separator) ? "" : separator) + src;

                                try {
                                    const response = await electroview.rpc.request.readImageAsDataUrl({ filePath: fullPath });
                                    if (response?.dataUrl) {
                                        img.src = response.dataUrl;
                                        img.setAttribute("data-original-src", src);
                                        img.style.opacity = "1";
                                    }
                                } catch (e) {
                                    console.error(`Failed to load lazy image: ${fullPath}`, e);
                                }
                            }
                        }
                    }
                }, { rootMargin: "200px" });
                
                window.requestAnimationFrame(() => observer.observe(container));
            }
        } else {
            img.src = src;
        }

        container.appendChild(img);
        return container;
    }
});
