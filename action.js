const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('@actions/core');
const io = require('@actions/io');
const exec = require('@actions/exec');

exports.run = state => {
    var _if = core.getInput(state + "-if");
    if(_if && !JSON.parse(_if)) {
        process.exit(0);
    }

    var script = core.getMultilineInput(state);
    if(!script || script.length === 0) {
        process.exit(0);
    }

    var shell = core.getInput(state + "-shell") || core.getInput("shell");
    var shellext = core.getInput(state + "-shell-ext") || core.getInput("shell-ext");
    var shellnewline = JSON.parse(core.getInput(state + "-shell-newline") || core.getInput("shell-newline") || "\"\"");
    var continueOnError = core.getBooleanInput(state + "-continue-on-error") || core.getBooleanInput("continue-on-error");
    var fixup = content => content;

    switch(shell) {
        case "bash":
            shell = "bash --noprofile --norc -e -o pipefail {0}";
            shellext = ".sh";
        break;
        case "sh":
            shell = "sh -e {0}";
            shellext = ".sh";
        break;
        case "pwsh":
            shell = "pwsh -command \". '{0}'\"";
            shellext = ".ps1";
            fixup = content => `\$ErrorActionPreference = 'stop'${shellnewline}${content}${shellnewline}if ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit \$LASTEXITCODE }`;
        break;
        case "powershell":
            shell = "powershell -command \". '{0}'\"";
            shellext = ".ps1";
            fixup = content => `\$ErrorActionPreference = 'stop'${shellnewline}${content}${shellnewline}if ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit \$LASTEXITCODE }`;
        break;
        case "python":
            shell = "python {0}";
            shellext = ".py";
        break;
        case "cmd":
            shell = "cmd /D /E:ON /V:OFF /S /C \"CALL \"{0}\"\"";
            shellext = ".cmd";
            if(!shellnewline) {
                shellnewline = "\r\n";
            }
            fixup = content => `@echo off${shellnewline}${content}`;
        break;
        case "node":
            shellext = ".js";
        break;
    }
    if(!shellnewline) {
        shellnewline = "\n";
    }

    var scriptpath = path.join(os.tmpdir(), "actionscript-" + process.pid + (shellext || ""));
    fs.writeFileSync(scriptpath, fixup(script.join(shellnewline)));
    if(process.env["NODE_PATH"]) {
        process.env["NODE_PATH"] += path.delimiter + path.join(require.main.path, "node_modules");
    } else {
        process.env["NODE_PATH"] = path.join(require.main.path, "node_modules");
    }
    if(shell === "node") {
        return (async function() {
            var code = 0;
            try {
                code = await exec.exec(process.execPath, [scriptpath]);
            } catch {
                code = 1;
            }
            if(continueOnError) {
                if(state === "main") {
                    core.setOutput("outcome", code === 0 ? "success" : "failure");
                }
                code = 0;
            }
            await io.rmRF(scriptpath);
            process.exit(code);
        })();
    } else {
        var finalcmdline = shell.replace(/\{0\}/g, scriptpath);
        return (async function() {
            var code = 0;
            try {
                code = await exec.exec(finalcmdline);
            } catch {
                code = 1;
            }
            if(continueOnError) {
                if(state === "main") {
                    core.setOutput("outcome", code === 0 ? "success" : "failure");
                }
                code = 0;
            }
            await io.rmRF(scriptpath);
            process.exit(code);
        })();
    }
}
