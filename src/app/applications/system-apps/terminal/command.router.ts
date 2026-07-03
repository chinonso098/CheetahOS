import { Constants } from 'src/app/system-files/constants';
import { ITerminalCommandHost, TerminalCommand } from './model/terminal.types';
import { TerminalCommandProcessor } from './terminal.commands';


/**
 * Routes a parsed terminal command to the matching method on the
 * TerminalCommandProcessor and writes the result back onto the supplied
 * TerminalCommand. Extracted verbatim from TerminalComponent.processCommand
 * so the component stays focused on view concerns; behaviour is unchanged.
 */
export class TerminalCommandRouter {

  constructor(private readonly processor: TerminalCommandProcessor) {}

  async route(terminalCmd: TerminalCommand, host: ITerminalCommandHost): Promise<void> {
    const cmdStringArr = terminalCmd.getCommand.split(Constants.BLANK_SPACE);
    const rootCmd = cmdStringArr[0].toLowerCase();

    if(!host.isValidCommand(rootCmd)){
      terminalCmd.setResponseCode = host.Fail;
      terminalCmd.setCommandOutput = `${terminalCmd.getCommand}: command not found. Type 'help', or 'help -verbose' to view a list of available commands.`;
      return;
    }

    if(rootCmd == "cat"){
      const result = await this.processor.cat(terminalCmd.getCommand);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result.response;
    }

    if(rootCmd == "cd"){
      const result = await this.processor.cd(cmdStringArr[1]);

      if(result.result){
        terminalCmd.setResponseCode = host.Success;
        terminalCmd.setCommandOutput = result.response;
      }else{
        terminalCmd.setResponseCode = host.Fail;
        terminalCmd.setCommandOutput = result.response;
      }
    }

    if(rootCmd == "clear"){
      host.clearScreen();
    }

    if(rootCmd == "close"){
      const result = this.processor.close(cmdStringArr[1], cmdStringArr[2]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if (rootCmd == "cp"){
      const option = cmdStringArr[1];
      const source = cmdStringArr[2];
      const destination = cmdStringArr[3];

      const result = await this.processor.cp(option, source, destination, terminalCmd.getCommandID);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "curl"){
      const result = await this.processor.curl(cmdStringArr);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "date"){
      const result = this.processor.date();
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "download"){
      const result = await this.processor.download(cmdStringArr[1], cmdStringArr[2], cmdStringArr[3], terminalCmd.getCommandID);
      terminalCmd.setResponseCode = (result.result)? host.Success : host.Fail;
      terminalCmd.setCommandOutput = result.response;
    }

    if(rootCmd == "exit"){
      this.processor.exit(host.processId);
    }

    if(rootCmd == "help"){
      const result = this.processor.help(host.echoCommands, host.utilityCommands, cmdStringArr[1]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "list"){
      const result = this.processor.list(cmdStringArr[1], cmdStringArr[2]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "ls"){
      const str = 'string';
      const strArr = 'string[]';
      const result = await this.processor.ls(cmdStringArr[1]);
      terminalCmd.setResponseCode = host.Success;

      if(result.type === str){
        terminalCmd.setCommandOutput = result.result;
        host.setDoesDirExist(false);
      }
      else if(result.type === strArr){
        terminalCmd.setCommandOutput = result.result.join(Constants.BLANK_SPACE);
        host.setFetchedDirectoryList([...result.result]);
      }
    }

    if(rootCmd == "mkdir"){
      const result = await this.processor.mkdir(cmdStringArr[1], cmdStringArr[2]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "mv"){
      const result = await this.processor.mv(cmdStringArr[1], cmdStringArr[2], cmdStringArr[3], terminalCmd.getCommandID);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "open"){
      const result = this.processor.open(cmdStringArr[1], cmdStringArr[2]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "pwd"){
      const result = this.processor.pwd();
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "rm"){
      const result = await this.processor.rm(cmdStringArr[1], cmdStringArr[2], terminalCmd.getCommandID);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "touch"){
      const result = await this.processor.touch(cmdStringArr[1]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result.response;
    }

    if(rootCmd == "version"){
      const result = this.processor.version(host.versionNum);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "whoami"){
      const result = this.processor.whoami();
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "sysmetric"){
      const result = this.processor.sysmetric();
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "weather"){
      const result = await this.processor.weather(cmdStringArr[1]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "hostname"){
      const result = this.processor.hostname();
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "sysrestart"){
      const result = await this.processor.sysrestart(cmdStringArr[1]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "syssdwn"){
      const result = await this.processor.syssdwn(cmdStringArr[1]);
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }

    if(rootCmd == "sysreset"){
      const result = await this.processor.sysreset();
      terminalCmd.setResponseCode = host.Success;
      terminalCmd.setCommandOutput = result;
    }
  }
}