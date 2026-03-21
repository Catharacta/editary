import { Electroview } from "electrobun/view";
import { type EditaryRPCType } from "../../shared/types";
import { state } from "../state/workspace";
import { renderOpenTabs } from "../workspace/file-ops";
import { updateTitleBar } from "../utils/dom";

export const rpc = Electroview.defineRPC<EditaryRPCType>({
    maxRequestTime: 300000, // 5 minutes (must match Bun side — native dialogs block until user acts)
    handlers: {
        requests: {},
        messages: {
            fileSaved: ({ filePath }) => {
                const tab = state.openTabs.get(filePath);
                if (tab) {
                    tab.isDirty = false;
                    renderOpenTabs();
                    if (state.currentFilePath === filePath) {
                        updateTitleBar();
                    }
                }
            },
        },
    },
});

export const electroview = new Electroview({ rpc });
