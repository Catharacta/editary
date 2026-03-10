import { Utils } from "electrobun/bun";

async function main() {
    console.log("Testing openFileDialog for saving...");
    const paths = await Utils.openFileDialog({
        canChooseFiles: true,
        canChooseDirectory: false,
        allowsMultipleSelection: false
    });
    console.log("Result:", paths);
    process.exit(0);
}
main();
