import * as dotenv from 'dotenv';
import { TkrbOmoideBot } from './bot';
import { startYear, fromChannels, toChannel, messagesPerChannel } from '../config.json';

dotenv.config();

(async () => {
  try {  
    const bot = new TkrbOmoideBot(process.env.SLACK_TOKEN as string);
    bot.setStartYear(startYear);
    bot.setMessagesPerChannel(messagesPerChannel);
    await bot.run(toChannel, fromChannels);
  } catch (error) {
    console.error('Oops, an error has occurred: ', error);
    console.error('Terminated');
    process.exitCode = 1;
  }
})();
