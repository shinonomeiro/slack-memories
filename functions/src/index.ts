import * as functions from 'firebase-functions';
import 'firebase-functions/logger/compat';
import { WebClient } from '@slack/web-api';
import MemoriesBot from '../../src/bot';
import { timezone } from '../../config.json';

export const postSlackMemories = functions
.runWith({ secrets: ['SLACK_TOKEN'] })
.pubsub
.schedule('0 10 * * *')
.timeZone(timezone)
.onRun((async () => {
  console.log('Starting job');

  const fromChannelID = process.env.FROM_CHANNEL_ID ?? '';
  const fromChannelName = process.env.FROM_CHANNEL_NAME ?? '';
  const toChannelID = process.env.TO_CHANNEL_ID ?? '';
  const toChannelName = process.env.TO_CHANNEL_NAME ?? '';

  const service = new WebClient(process.env.SLACK_TOKEN);
  const bot = new MemoriesBot(service);
  
  const toChannel = { id: toChannelID, name: toChannelName };
  const fromChannel = { id: fromChannelID, name: fromChannelName };

  try {
    await bot.run({ toChannel, fromChannel, date: new Date() });
    console.log('Finished job');
  } catch (error) {
    console.error('Oops, an error has occurred: ', error);
    console.error('Terminated');
    process.exitCode = 1;
  }
}));
