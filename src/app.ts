import * as dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';
import MemoriesBot from './bot';

dotenv.config();

const fromChannelID = process.env.FROM_CHANNEL_ID ?? '';
const fromChannelName = process.env.FROM_CHANNEL_NAME ?? '';
const toChannelID = process.env.TO_CHANNEL_ID ?? '';
const toChannelName = process.env.TO_CHANNEL_NAME ?? '';

const service = new WebClient(process.env.SLACK_TOKEN);
const bot = new MemoriesBot(service);

(async () => {
  try {
    const toChannel = { id: toChannelID, name: toChannelName }
    const fromChannel = { id: fromChannelID, name: fromChannelName }
    await bot.run({ toChannel, fromChannel, date: new Date() });
  } catch (error) {
    console.error('Oops, an error has occurred: ', error);
    console.error('Terminated');
    process.exitCode = 1;
  }
})();
