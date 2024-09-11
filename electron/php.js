import { exec } from 'child_process'

export const path = async event => {
  exec('which php', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    const phpPath = stdout.toString().trim();
    const escapedPath = phpPath.replace(/ /g, '\\ ');
    event.reply('php.path.reply', escapedPath);
  });
};

