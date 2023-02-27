import { ChannelInfo, RawMessage, Message, PopularMessagesIndexed } from '../@types/global';
import { setYear, addDays, addSeconds, format, getUnixTime } from 'date-fns/fp';
import { compose, sortBy, reverse, filter, take, map, reduce, add, isEmpty, toString } from 'lodash/fp'
import invariant from 'tiny-invariant';
import { stripIndents } from 'common-tags';
import { WebClient } from '@slack/web-api';
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
    
    const today = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    return this.fetchPastMostPopularMessages(fromChannel, today)
      .then(this.buildMessage(today))
      .then(this.postMessage(toChannel));
  };

  private mapMessagesByReactionCount = (
    map<RawMessage, Message>(message => ({
      ts: message.ts || '', // Under what circumstances is this undefined? 🤔
      reactionCount: message.reactions
        ? reduce((total, reaction) => add(total, reaction.count ?? 0), 0, message.reactions)
        : 0,
    }))
  );

  private filterMessagesByMostReacted = (limit: number) => {
    return compose(
      take(limit),
      filter<Message>(message => message.reactionCount > 0),
      reverse,
      sortBy<Message>(message => message.reactionCount)
    );
  };

  private fetchPastMostPopularMessages = async (fromChannel: ChannelInfo, today: Date) => {
    const res: PopularMessagesIndexed = [fromChannel, []];
    const [, yearData] = res;

    for (let i = 1; i <= today.getFullYear() - config.startYear; i++) {
      const year = today.getFullYear() - i;
      const sameDayOnThatYearStart = setYear(year)(today);
      const sameDayOnThatYearEnd = compose(addSeconds(-1), addDays(1), setYear(year))(today);

      console.log([
        `Looking up popular messages from ${fromChannel.name}`,
        `on ${format('yyyy/MM/dd', sameDayOnThatYearStart)}`,
      ].join(' '));

      const { ok, error, messages = [] } = await this.service.conversations.history({
        channel: fromChannel.id,
        oldest: compose(toString, getUnixTime)(sameDayOnThatYearStart),
        latest: compose(toString, getUnixTime)(sameDayOnThatYearEnd)
      });

      if (ok) {
        const popularMessages = compose(
          this.filterMessagesByMostReacted(config.messagesPerYear),
          this.mapMessagesByReactionCount,
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

  private buildMessage = (today: Date) => async (messagesByYear: PopularMessagesIndexed) => {
    const [fromChannel, yearData] = messagesByYear;
    const messagesToSend = [];

    messagesToSend.push(`⭐️⭐️⭐️ Memories of ${fromChannel.name} for today ⭐️⭐️⭐️`);

    for (let i = 0; i < yearData.length; i++) {
      const [year, messages] = yearData[i];
      const yearCount = today.getFullYear() - year;

      if (messages.length > 0) {
        messagesToSend.push(stripIndents`
          💭 ${yearCount} year${yearCount > 1 ? 's' : ''} ago, on ${compose(format('yyyy/MM/dd'), setYear(year))(today)}... 💭
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
        .reduce((links, result) => (
          // Permalinks can be undefined it seems, no idea in what exact circumstances though
          // Maybe for deleted messages? However in our case we confirmed their existence in the previous step
          result.status == 'fulfilled' ? [...links, result.value.permalink] : links
        ), [])
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
