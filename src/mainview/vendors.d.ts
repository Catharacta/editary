declare module "turndown-plugin-gfm" {
    import TurndownService from "turndown";
    export function gfm(service: TurndownService): void;
    export function tables(service: TurndownService): void;
    export function taskListItems(service: TurndownService): void;
    export function strikethrough(service: TurndownService): void;
}

declare module "markdown-it-task-lists" {
    import MarkdownIt from "markdown-it";
    interface TaskListsOptions {
        enabled?: boolean;
        label?: boolean;
        labelAfter?: boolean;
    }
    function taskLists(md: MarkdownIt, options?: TaskListsOptions): void;
    export = taskLists;
}
