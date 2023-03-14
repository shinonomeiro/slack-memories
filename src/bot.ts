import { ChannelInfo, RawMessage, Message, PopularMessagesIndexed } from '../@types/global';
import { setYear, getUnixTime, startOfDay, endOfDay } from 'date-fns/fp';
import { compose, filter, take, map, reduce, add, isEmpty, toString, partition, sortBy, reverse } from 'lodash/fp'
import invariant from 'tiny-invariant';
import { stripIndents } from 'common-tags';
import { WebClient } from '@slack/web-api';
import * as utils from './utils';
import * as config from '../config.json';

export interface Options {
  toChannel: ChannelInfo
  fromChannel: ChannelInfo
  date: Date
}

export default class MemoriesBot {
  private service: WebClient;

  constructor(service: WebClient) {
    this.service = service;
  }

  run = async ({ toChannel, fromChannel, date }: Options) => {
    invariant(!isEmpty(fromChannel.id), "Source channel ID cannot be an empty string");
    invariant(!isEmpty(toChannel.id), "Target channel ID cannot be an empty string");
    
    return this.fetchPastMostPopularMessages(fromChannel, date)
      .then(this.buildMessage(date))
      .then(this.postMessage(toChannel));
  };
  
  private discardChannelJoinLeaveEvents = (
    filter<RawMessage>(message => (
      !message.subtype?.match(/channel_join|channel_leave/)
    ))
  );

  private mapMessages = (
    map<RawMessage, Message>(message => ({
      ts: message.ts || '', // Under what circumstances is this undefined? 🤔
      reactionCount: message.reactions
        ? reduce((total, reaction) => add(total, reaction.count ?? 0), 0, message.reactions)
        : 0,
      hasFiles: !isEmpty(message.files ?? []),
    }))
  );

  private sortMessagesByLevelOfInterest = (messages: Message[]) => (
    compose(
      ([withReactions, withoutReactions]) => [
        ...compose(
          reverse,
          sortBy(message => message.reactionCount),
          filter<Message>(message => message.hasFiles),
        )(withReactions),
        ...compose(
          reverse,
          sortBy(message => message.reactionCount),
          filter<Message>(message => !message.hasFiles),
        )(withReactions),
        ...filter<Message>(message => message.hasFiles)(withoutReactions),
        ...filter<Message>(message => !message.hasFiles)(withoutReactions),
      ],
      partition<Message>(message => message.reactionCount > 0),
    )(messages)
  );

  private fetchPastMostPopularMessages = async (fromChannel: ChannelInfo, date: Date) => {
    const res: PopularMessagesIndexed = [fromChannel, []];
    const [, yearData] = res;

    for (let i = 1; i <= date.getFullYear() - config.startYear; i++) {
      const year = date.getFullYear() - i;
      const sameDayOnThatYearStart = compose(startOfDay, setYear(year))(date);
      const sameDayOnThatYearEnd = endOfDay(sameDayOnThatYearStart);

      console.log([
        `Looking up popular messages from ${fromChannel.name}`,
        `on ${utils.formatInTimeZone(config.timezone, 'yyyy/MM/dd')(sameDayOnThatYearStart)}`,
      ].join(' '));

      const { ok, error, messages = [] } = await this.service.conversations.history({
        channel: fromChannel.id,
        oldest: compose(toString, getUnixTime)(sameDayOnThatYearStart),
        latest: compose(toString, getUnixTime)(sameDayOnThatYearEnd)
      });

      if (ok) {
        const popularMessages = compose(
          take(config.messagesPerYear),
          this.sortMessagesByLevelOfInterest,
          this.mapMessages,
          this.discardChannelJoinLeaveEvents,
        )(messages);

        if (popularMessages.length > 0) {
          yearData.push([year, popularMessages]);
        }

        console.log(popularMessages.length > 0 ? ` ... ${popularMessages.length} message(s)` : ' ... none');
      } else {
        // TODO: Retry on error
        throw Error(`Failed to fetch chat history: ${error}`);
      }
    }

    return res;
  };

  private buildMessage = (date: Date) => async (messagesByYear: PopularMessagesIndexed) => {
    const [fromChannel, yearData] = messagesByYear;
    const messagesToSend = [];

    messagesToSend.push(`⭐️⭐️⭐️ Memories of ${fromChannel.name} for today ⭐️⭐️⭐️`);

    for (let i = 0; i < yearData.length; i++) {
      const [year, messages] = yearData[i];
      const yearCount = date.getFullYear() - year;

      if (messages.length > 0) {
        messagesToSend.push(stripIndents`
          💭 ${yearCount} year${yearCount > 1 ? 's' : ''} ago, on ${compose(utils.formatInTimeZone(config.timezone, 'yyyy/MM/dd'), setYear(year))(date)}... 💭
        `);
      }

      const results = await Promise.allSettled(
        messages.map(async message => (
          await this.service.chat.getPermalink({
            channel: fromChannel.id,
            message_ts: message.ts,
          })
        ))
      );

      const permalinks = results
        .reduce<string[]>((links, result) => {
          // Permalinks can be undefined it seems, no idea in what exact circumstances though
          // Maybe for deleted messages? However in our case we confirmed their existence in the previous step
          if (result.status != 'fulfilled' || !result.value.permalink) {
            return links;
          }

          return [...links, result.value.permalink];
        }, [])
        .join('\n');

      results
        .forEach((result, i) => {
          if (result.status == 'rejected') {
            // TODO: Retry on error
            console.error(`Failed to get permalink for message ${messages[i].ts}, skipped. Reason: ${result.reason}`);
          }
        });

      messagesToSend.push(permalinks);
    }

    if (yearData.length > 0) {
      messagesToSend.push('👋 And that\'s it for today! See you again tomorrow! 👋');
    } else {
      messagesToSend.push('😭 Alas I couldn\'t find any. Come back tomorrow! 😭');
    }

    return messagesToSend;
  };

  private sleep = (interval: number) => new Promise(resolve => {
    setTimeout(resolve, interval);
  });

  private postMessage = (toChannel: ChannelInfo) => async (messages: string[]) => {
    console.log(`Posting to ${toChannel.name}...`);
    console.log(`Preview:\n\n${messages.join('\n')}`);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      try {
        const { error } = await this.service.chat.postMessage({
          channel: toChannel.id,
          text: messages[i],
        });

        if (error) throw new Error(error);
      } catch (error) {
        // TODO: Retry on error
        console.error(stripIndents`
          Failed to post to channel ${toChannel.name}, skipped. ${error}
          Message: ${message}
        `);

        continue;
      }

      await this.sleep(config.throttle);
    }

    console.log(`Done`);
  };
}
