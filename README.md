# Slack Memories

Facebook Memories-like feature for any channel.

A simple app that reposts once a day on a given channel messages that were sent on the very same day years past on another channel. Messages are filtered based on the number of reactions received, sorted in descending order, and the number of messages per year is configurable. Messages without any reactions are ignored.

Example output:
```
⭐️⭐️⭐️ Memories of #from for today ⭐️⭐️⭐️
💭 5 years ago, on 2018/01/01... 💭
link1
link2
💭 7 years ago, on 2016/01/01... 💭
link3
link4
link5
👋 And that's it for today! See you again tomorrow! 👋
```

The links are expected to be auto-expanded by Slack, so there is no need to fetch the message content themselves.

If there happen to be no memories for that day, the following messages are posted:

```
⭐️⭐️⭐️ Memories of #from for today ⭐️⭐️⭐️
😭 Alas I couldn't find any. Come back tomorrow! 😭
```

## Environment

This app is setup to be deployed as a Firebase function. The scheduling is currently hardcoded to `0 10 * * *` (every day at 10 am), but still modifiable after deployment from the Cloud Scheduler dashboard. The timezone used both for the cron job and timestamps in the output messages to Slack can be set in `config.json`. The default is `Asia/Tokyo`.

The following environment variables are required for successful operation:

```zsh
$ export SLACK_TOKEN=<access token for your Slack workspace>

$ export FROM_CHANNEL_ID=<source channel id>
$ export FROM_CHANNEL_NAME=<source channel name>
$ export TO_CHANNEL_ID=<target channel id>
$ export TO_CHANNEL_NAME=<target channel name>
```

For security reasons, `SLACK_TOKEN` only must be set through Google Cloud's Secret Manager panel. The other variables are stored in `functions/.env` and automatically deployed along with the function.

These are the three API endpoints used by the bot:
- https://api.slack.com/methods/conversations.history
- https://api.slack.com/methods/chat.getPermalink
- https://api.slack.com/methods/chat.postMessage

The required OAuth2 scopes are:
- [channels:history](https://api.slack.com/scopes/channels:history)
- [chat:write](https://api.slack.com/scopes/chat:write)

The channel IDs can be easily retrieved with the URL bar if you're on a browser. Just copy-paste the string after the last `/`.

![image](https://user-images.githubusercontent.com/97494405/221216941-e98122d3-7176-40fb-8afb-4f0a9afe81e5.png)

Channel names for the env variables are purely arbitrary and only for a more user-friendly output, but try to use the actual names.

## Run function locally

TODO

## Commands

Refer to `scripts` in `functions/package.json`.

### Run tests
`yarn test`
