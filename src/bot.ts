import { ChannelInfo, RawMessage, Message, PopularMessagesIndexed, YearData } from '../@types/global';
import { WebClient } from '@slack/web-api';
import { setYear, getUnixTime, addDays, addSeconds, format } from 'date-fns/fp';
import { compose, sortBy, reverse, filter, take, map, reduce, add } from 'lodash/fp'
import { stripIndents } from 'common-tags';
import * as config from '../config.json';

export class TkrbOmoideBot {
  private client: WebClient;

  private today: Date = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );

  private startYear: number = 2014;
  private messagesPerChannel: number = 3;

  constructor(slackToken: string) {
    this.client = new WebClient(slackToken);
  }

  setToday = (date: Date) => {
    this.today = date;
  }

  setStartYear = (year: number) => {
    this.startYear = year;
  }

  setMessagesPerChannel = (count: number) => {
    this.messagesPerChannel = count;
  }

  run = async (toChannel: ChannelInfo, fromChannels: ChannelInfo[]) => (
    await this.postMessages(
      toChannel, 
      await this.fetchPastMostPopularMessages(fromChannels),
    )
  );

  private mapMessagesByReactionCount = (
    map<RawMessage, Message>(message => ({
      ts: message.ts || '',
      reactionCount: message.reactions
        ? reduce((total, reaction) => add(total, reaction.count ?? 0), 0, message.reactions)
        : 0,
    }))
  );

  private filterMessagesByMostReacted = (limit: number) => {
    return compose(
      sortBy<Message>(message => Number.parseFloat(message.ts)),
      take(limit),
      filter<Message>(message => message.reactionCount > 0),
      reverse,
      sortBy<Message>(message => message.reactionCount)
    )
  }

  private fetchPastMostPopularMessages = async (fromChannels: ChannelInfo[]) => {
    const res: PopularMessagesIndexed = [];
  
    for (let i = 1; i <= this.today.getFullYear() - this.startYear; i++) {
      const year = this.today.getFullYear() - i;
      const sameDayOnThatYearStart = compose(getUnixTime, setYear(year))(this.today);
      const sameDayOnThatYearEnd = compose(getUnixTime, addSeconds(-1), addDays(1), setYear(year))(this.today);
  
      // console.log('Same day in year (start)', year , new Date(sameDayOnThatYearStart * 1000));
      // console.log('Same day in year (end)', year, new Date(sameDayOnThatYearEnd * 1000));
  
      const yearData: YearData = [year, []];
      const [, channels] = yearData;
  
      for (let j = 0; j < fromChannels.length; j++) {
        const channel = fromChannels[j];

        process.stdout.write([
          `Looking up popular messages from #${channel.name}`,
          `on ${format('yyyy/MM/dd', new Date(sameDayOnThatYearStart * 1000))}`,
        ].join(' '));
  
        const { ok, error, messages } = await this.client.conversations.history({
          channel: channel.id,
          oldest: sameDayOnThatYearStart.toString(),
          latest: sameDayOnThatYearEnd.toString(),
        });
  
        if (ok && messages) {
          const popularMessages = compose(
            this.filterMessagesByMostReacted(this.messagesPerChannel),
            this.mapMessagesByReactionCount,
          )(messages);
  
          // そのチャンネルに注目の投稿が特になければスキップ
          if (popularMessages.length > 0) {
            channels.push([channel, popularMessages]);
          }

          console.log(popularMessages.length > 0 ? ` ... ${popularMessages.length} message(s)` : ' ... none');
        } else {
          throw Error(`Failed to fetch from Slack archives: ${error}`);
        }
      }
  
      // その年に注目の投稿が特になければスキップ
      if (channels.length > 0) {
        res.push(yearData);
      }
    }
  
    return res;
  };

  private outputToConsole = (text: string) => {
    return new Promise(resolve => {
      console.log('Output: ', text);
      resolve(null);
    })
  };

  private outputToSlack = (channel: ChannelInfo) => async (text: string) => {
    const res = await this.client.chat.postMessage({
      channel: channel.id,
      text,
    });

    const { ok, error } = res;

    if (!ok) {
      console.error(stripIndents`
        Failed to post to Slack channel #${channel.name}, skipped. ${error}
        Text: ${text}
      `);
    }

    return res;
  };

  private sleep = (interval: number) => new Promise(resolve => {
    setTimeout(resolve, interval)
  });

  private postMessages = async (toChannel: ChannelInfo, messagesByYear: PopularMessagesIndexed) => {
    console.log(`Posting to #${toChannel.name}...`);

    const messagesToSend = ['*☀️ みなさんおはようございます ☀️*'];

    if (messagesByYear.length > 0) {
      messagesToSend.push('*💭 さて、過去のこの日の思い出を振り返ってみましょう 💭*');
    } else {
      messagesToSend.push('*残念ながら今日は特に思い出はありません 😢 また明日きてね〜*');
    }

    for (let i = 0; i < messagesByYear.length; i++) {
      const [year, channels] = messagesByYear[i];

      if (channels.length > 0) {
        messagesToSend.push(stripIndents`
          *====================================*
          *✨✨✨ ${this.today.getFullYear() - year}年前（${compose(format('yyyy年M月d日'), setYear(year))(this.today)}） ✨✨✨*
          *====================================*
        `);
      }

      for (let j = 0; j < channels.length; j++) {
        const [channel, messages] = channels[j];

        messagesToSend.push(`*...from #${channel.name} 👀*`);

        for (let k = 0; k < messages.length; k++) {
          const message = messages[k];

          const { ok, error, permalink } = await this.client.chat.getPermalink({
            channel: channel.id,
            message_ts: message.ts,
          });

          if (ok) {
            messagesToSend.push(`🔹 ${permalink as string}`);
          } else {
            console.error(`Failed to get permalink for message ${message.ts}, skipped. ${error}`);
          }
        }
      }
    }

    // 指定のチャンネルに投稿する

    const outputMessage = !config.debug
      ? this.outputToSlack(toChannel)
      : this.outputToConsole;

    for (let i = 0; i < messagesToSend.length; i++) {
      await outputMessage(messagesToSend[i]);
      // https://api.slack.com/docs/rate-limits
      // 回数制限があるらしいが、一瞬だけなら許容範囲らしい
      // ただ、前後する可能性があるので少しスリープさせておく
      await this.sleep(100);
    }

    console.log(`Done`);
  };
}
