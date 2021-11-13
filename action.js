const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('@actions/core');
const io = require('@actions/io');
const exec = require('@actions/exec');

var state = core.getState("state");

if(!state) {
    state = "pre";
    core.saveState("state", "main");
} else if(state === "main") {
    core.saveState("state", "post");
}

var _if = core.getInput(state + "-if");
if(_if && !JSON.parse(_if)) {
    process.exit(0);
}

var script = core.getMultilineInput(state);
if(!script) {
    process.exit(0);
}

var shell = core.getInput(state + "-shell") || core.getInput("shell");
var shellext = core.getInput(state + "-shell-ext") || core.getInput("shell-ext");
var shellnewline = JSON.parse(core.getInput(state + "-shell-newline") || core.getInput("shell-newline") || "\"\"");

switch(shell) {
    case "bash":
        shell = "bash --noprofile --norc -e -o pipefail {0}";
        shellext = ".sh";
    break;
    case "sh":
        shell = "sh -e -c {0}";
        shellext = ".sh";
    break;
    case "pwsh":
        shell = "pwsh -command . '{0}'";
        shellext = ".ps1";
    break;
    case "powershell":
        shell = "pwsh -command . '{0}'";
        shellext = ".ps1";
    break;
    case "python":
        shell = "python {0}";
        shellext = ".py";
    break;
    case "cmd":
        shell = "cmd /D /E:ON /V:OFF /S /C \"CALL \"{0}\"\"";
        shellext = ".cmd";
        shellnewline = "\r\n";
    case "node":
        shellext = ".js";
    break;
}
if(!shellnewline) {
    shellnewline = "\n";
}

var scriptpath = path.join(os.tmpdir(), "actionscript-" + process.pid + (shellext || ""));
fs.writeFileSync(scriptpath, script.join(shellnewline));
if(shell === "node") {
   (async function() {
        var code = await exec.exec(process.argv0, [scriptpath]);
        await io.rmRF(scriptpath);
        process.exit(code);
    })()
} else {
    var finalcmdline = shell.replace(/\{0\}/g, scriptpath);
    (async function() {
        var code = await exec.exec(finalcmdline);
        await io.rmRF(scriptpath);
        process.exit(code);
    })()
}
