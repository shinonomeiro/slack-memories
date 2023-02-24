import { Message as ConversationsHistoryResponseMessage } from '@slack/web-api/dist/response/ConversationsHistoryResponse';

export type RawMessage = Pick<ConversationsHistoryResponseMessage, 'ts' | 'reactions'>

export interface Message { ts: string, reactionCount: number }

export type YearData = [number, Message[]]

export interface ChannelInfo { id: string, name: string }

export type PopularMessagesIndexed = [ChannelInfo, YearData[]];
