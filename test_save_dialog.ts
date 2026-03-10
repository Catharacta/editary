import { spawn } from "bun";

async function showSaveDialog(defaultPath = "") {
    const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.SaveFileDialog
        $dialog.Filter = "Markdown Files (*.md)|*.md|All Files (*.*)|*.*"
        $dialog.Title = "ファイルを保存"
        if ("${defaultPath}") {
            $dialog.FileName = "${defaultPath}"
        }
        $result = $dialog.ShowDialog()
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $dialog.FileName
        }
    `;

    const ps = spawn(["powershell.exe", "-NoProfile", "-Sta", "-Command", script]);
    const output = await new Response(ps.stdout).text();
    return output.trim();
}

async function main() {
    console.log("Opening Save Dialog...");
    const result = await showSaveDialog("C:\\Users\\test.md");
    console.log("Selected:", result);
}
main();
