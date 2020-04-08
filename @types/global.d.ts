// 具体例は添付の sample.json を要参照

export interface ChannelInfo {
  id: string,
  name: string,
}

export interface SlackMessagePartial {
  ts: string,
  reactions: { count: number }[],
}

export interface MessageData {
  ts: string,
  reactionCount: number,
}

export type ChannelData = [
  ChannelInfo,
  MessageData[],
]

export type YearData = [
  number,
  ChannelData[],
]

export type PopularMessagesIndexed = YearData[];
