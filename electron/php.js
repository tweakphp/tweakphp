import { exec } from 'child_process'

export const path = async (event, args) => {

  exec('which php', (error, stdout, stderr) => {

    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    
    const phpPath = stdout.toString().trim();

    event.reply('php.path.reply', {
      path: phpPath,
      type: args.type || 'INITIAL'
    });
  });
};

