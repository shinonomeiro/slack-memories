import { Message as ConversationsHistoryResponseMessage } from '@slack/web-api/dist/response/ConversationsHistoryResponse';

export type RawMessage = Pick<ConversationsHistoryResponseMessage, 'subtype' | 'ts' | 'reactions' | 'files' >

export interface Message { ts: string, reactionCount: number, hasFiles: boolean }

export type YearData = [number, Message[]]

export interface ChannelInfo { id: string, name: string }

export type PopularMessagesIndexed = [ChannelInfo, YearData[]];
