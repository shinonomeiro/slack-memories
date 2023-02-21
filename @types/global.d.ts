import { Message as ConversationsHistoryResponseMessage } from '@slack/web-api/dist/response/ConversationsHistoryResponse';

type RawMessage = Pick<ConversationsHistoryResponseMessage, 'ts' | 'reactions'>

export interface ChannelInfo {
  id: string,
  name: string,
}

export interface Message {
  ts: string,
  reactionCount: number,
}

export type ChannelData = [
  ChannelInfo,
  Message[],
]

export type YearData = [
  number,
  ChannelData[],
]

export type PopularMessagesIndexed = YearData[];
