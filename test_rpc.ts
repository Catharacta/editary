import { spawn } from "bun";

async function showSaveFileDialog(params: { defaultPath?: string; title?: string; filter?: string }) {
    const defaultPath = params.defaultPath || "";
    const title = params.title || "ファイルを保存";
    const filter = params.filter || "Markdown Files (*.md)|*.md|All Files (*.*)|*.*";

    const safePath = defaultPath.replace(/"/g, '""');

    const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.SaveFileDialog
        $dialog.Filter = "${filter}"
        $dialog.Title = "${title}"
        if ("${safePath}") {
            $dialog.FileName = "${safePath}"
        }
        $result = $dialog.ShowDialog()
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $dialog.FileName
        }
    `;

    try {
        console.log("[showSaveFileDialog] Spawning PowerShell...");
        const ps = spawn(["powershell.exe", "-NoProfile", "-Sta", "-Command", script]);
        const output = await new Response(ps.stdout).text();
        const resultPath = output.trim();
        if (resultPath) {
            return resultPath;
        }
        return null;
    } catch (err) {
        console.error("[showSaveFileDialog] PowerShell Error:", err);
        return null;
    }
}

async function main() {
    console.log("Starting test...");
    const res = await showSaveFileDialog({ defaultPath: "C:\\Users\\test.md" });
    console.log("RAW RESULT: ", JSON.stringify(res));
    process.exit(0);
}

main();
