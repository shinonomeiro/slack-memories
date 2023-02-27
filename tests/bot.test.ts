import { jest, expect, it, beforeEach, afterEach } from '@jest/globals'
import { WebClient } from '@slack/web-api';
import { fromUnixTime } from 'date-fns';
import { compose } from 'lodash/fp';
import MemoriesBot from '../src/bot';
import * as mockData from './mock-data';

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    conversations: {
      history: jest.fn(),
    },
    chat: {
      getPermalink: jest.fn(),
      postMessage: jest.fn(),
    },
  })),
}));

const service = new WebClient('token');
let historyMock = service.conversations.history as jest.Mock<typeof service.conversations.history>;
let getPermalinkMock = service.chat.getPermalink as jest.Mock<typeof service.chat.getPermalink>;
let postMessageMock = service.chat.postMessage as jest.Mock<typeof service.chat.postMessage>;

beforeEach(() => {
  historyMock.mockImplementation(async options => {
    let date = compose(fromUnixTime, parseFloat)(options!.oldest!);
    return { ok: true, messages: mockData.getMessagesFor(date.getFullYear()) };
  });
  
  getPermalinkMock.mockImplementation(async options => {
    const permalink = mockData.getPermalinkFor(options!.message_ts);
    return { ok: true, permalink: permalink };
  });
  
  postMessageMock.mockImplementation(async () => ({ ok: true }));
});

afterEach(() => {
  historyMock.mockReset();
  getPermalinkMock.mockReset();
  postMessageMock.mockReset();
});

const bot = new MemoriesBot(service);

it("throws if any channel ID is an empty string", async () => {
  let fromChannel = { id: '', name: '' }
  let toChannel = { id: '', name: '' }

  await expect(bot.run({ toChannel, fromChannel, date: mockData.today })).rejects.toThrow();
});

it("picks the messages with the most reactions for each year and posts them to the target channel", async () => {
  let fromChannel = { id: 'abc', name: '#from' }
  let toChannel = { id: 'def', name: '#to' }

  await bot.run({ toChannel, fromChannel, date: mockData.today });
  
  expect(postMessageMock).toHaveBeenCalledTimes(6);
  expect(postMessageMock).toHaveBeenNthCalledWith(1, { channel: 'def', text: '⭐️⭐️⭐️ Memories of #from for today ⭐️⭐️⭐️' });
  expect(postMessageMock).toHaveBeenNthCalledWith(2, { channel: 'def', text: '💭 5 years ago, on 2018/01/01... 💭' });
  expect(postMessageMock).toHaveBeenNthCalledWith(3, { channel: 'def', text: 'link200\nlink100' });
  expect(postMessageMock).toHaveBeenNthCalledWith(4, { channel: 'def', text: '💭 7 years ago, on 2016/01/01... 💭' });
  expect(postMessageMock).toHaveBeenNthCalledWith(5, { channel: 'def', text: 'link4\nlink2\nlink1' });
  expect(postMessageMock).toHaveBeenNthCalledWith(6, { channel: 'def', text: '👋 And that\'s it for today! See you again tomorrow! 👋' });
});

it('has no memories to post for today', async () => {
  let fromChannel = { id: 'abc', name: '#from' }
  let toChannel = { id: 'def', name: '#to' }
  
  historyMock.mockImplementation(async () => ({ ok: true }));

  await bot.run({ toChannel, fromChannel, date: mockData.today });
  
  expect(postMessageMock).toHaveBeenCalledTimes(2);
  expect(postMessageMock).toHaveBeenNthCalledWith(1, { channel: 'def', text: '⭐️⭐️⭐️ Memories of #from for today ⭐️⭐️⭐️' });
  expect(postMessageMock).toHaveBeenNthCalledWith(2, { channel: 'def', text: '😭 Alas I couldn\'t find any. Come back tomorrow! 😭' });
});
