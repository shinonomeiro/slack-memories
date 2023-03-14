import { RawMessage } from '../@types/global';

export const today = new Date(2023, 0, 1);

export function getMessagesFor(year: number): RawMessage[] {
  if (year == 2016) {
    return [
      {
        ts: "1",
        reactions: [
          { name: "emojiA", count: 1 },
          { name: "emojiB", count: 1 },
        ],
      },
      {
        ts: "2",
        reactions: [
          { name: "emojiA", count: 1 },
          { name: "emojiB", count: 2 },
        ],
      },
      {
        ts: "3",
      },
    ];
  }
  
  if (year == 2017) {
    return [
      {
        ts: "10",
      },
      {
        ts: "20",
        files: [{}],
      },
      {
        ts: "30",
      },
      {
        ts: "40",
        subtype: "channel_join",
        reactions: [
          { name: "emojiA", count: 10 },
        ]
      }
    ];
  }
  
  if (year == 2018) {
    return [
      {
        ts: "100",
        reactions: [
          { name: "emojiA", count: 1 },
          { name: "emojiB", count: 1 },
        ],
      },
      {
        ts: "200",
        reactions: [
          { name: "emojiA", count: 1 },
          { name: "emojiB", count: 1 },
        ],
      },
      {
        ts: "300",
      },
      {
        ts: "400",
        reactions: [
          { name: "emojiA", count: 2 },
        ],
        files: [{}]
      },
    ];
  }
  
  if (year == 2019) {
    return [];
  }
  
  return [];
}

export function getPermalinkFor(ts: string) {
  switch (ts) {
    case '1': return "link1";
    case '2': return "link2";
    case '3': return "link3";

    case '10': return "link10";
    case '20': return "link20";
    case '30': return "link30";
    case '40': return "link40";

    case '100': return "link100";
    case '200': return "link200";
    case '300': return "link300";
    case '400': return "link400";
  }
  
  return "";
}
