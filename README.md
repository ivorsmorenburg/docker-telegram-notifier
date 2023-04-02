# Docker Telegram Notifier 

[![Create & Publish Docker image](https://github.com/ivorsmorenburg/docker-telegram-notifier/actions/workflows/deploy-docker.yml/badge.svg)](https://github.com/ivorsmorenburg/docker-telegram-notifier/actions/workflows/deploy-docker.yml)

This container contains a Telegram integration to notify about Docker events. 

This service notifies about container `start`, `stop`, `restart` events, and changes of Docker `healthcheck status`. If you wish you can add more event notifications in `templates.js` file.

This branch was created to patch some security vulnerabilities as well as adding builds for `linux/arm64` and `linux/arm/v7`.

If you spot any problems, feel free to fix it and open a [pull request](https://github.com/ivorsmorenburg/docker-telegram-notifier/pulls) or open a new [issue](https://github.com/ivorsmorenburg/docker-telegram-notifier/issues).

## 🐳 Run Docker Container

1. [Set up a telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot) and get the `Bot Token`. then add the bot to a group and make it admin and [extract the Chat ID](https://stackoverflow.com/a/32572159/882223).

2. Run a container:
```sh
# docker run
docker run -d --env TELEGRAM_NOTIFIER_BOT_TOKEN=token --env TELEGRAM_NOTIFIER_CHAT_ID=chat_id --volume /var/run/docker.sock:/var/run/docker.sock:ro ghcr.io/ivorsmorenburg/docker-telegram-notifier
```
```yml
# docker compose
version: "2.2"

services:
  notifier:
    image: ghcr.io/ivorsmorenburg/docker-telegram-notifier:main
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro # for local instance
      # - ./certs:/certs # for remote instance
    environment:
      # How to create bot: https://core.telegram.org/bots#3-how-do-i-create-a-bot
      # How to get chat id: https://stackoverflow.com/questions/32423837/telegram-bot-how-to-get-a-group-chat-id/32572159#32572159
      TELEGRAM_NOTIFIER_BOT_TOKEN:
      TELEGRAM_NOTIFIER_CHAT_ID:
      # optional args
      # TELEGRAM_NOTIFIER_TOPIC_ID: # Can be provided to specify a topic withing the group
      # ONLY_WHITELIST: true

#  example:
#    image: hello-world
#    labels:
#       telegram-notifier.monitor: true  # always monitor
#       telegram-notifier.monitor: false # never monitor
#       # no label = monitor only when not using whitelist
#    # example docker healthcheck
#    healthcheck:
#      test: curl -sS http://127.0.0.1:8545 || exit 1
#      interval: 30s
#      timeout: 10s
#      retries: 3
```

## Telegram Rate Limit
Respects Telegram Rate Limit using [BottleNeck](https://lkcozy.github.io/code-notes/jsbottleneck), you can provide some optional enviorment variables
```
  BN_RESERVOIR | 2 ;
  BN_RESERVOIR_INCREASE_INTERVAL | 2000;
  BN_RESERVOIR_REFRESH_INTERVAL |  60 * 1000;
  BN_RESERVOIR_INCREASE_AMOUNT | 2;
  BN_RESERVOIR_MAX_BUFFER_SIZE | 50 ;
  BN_MIN_TIME | 5000  ;
  BN_MAX_CONCURRENT | 1;
  BN_ID
```
## Debug
Show more logs and traces
```
  DEBUG | false;
```
## Blacklist and Whitelist
You can suppress notifications from certain containers by adding a label `--label telegram-notifier.monitor=false` to them. 

If you want to receive notifications only from whitelisted containers, set `--env ONLY_WHITELIST=true` environment variable on the notifier instance, and `--label telegram-notifier.monitor=true` label on the containers you want to monitor.

## Remote docker instance

By default notifier connects to a local docker instance (don't forget to specify `--volume /var/run/docker.sock:/var/run/docker.sock:ro` for this case). But if you have monitoring and the service on the same host, you will not receive notifications if the host goes down. So I recommend to have monitoring separately.

## Credits

This container is based off the [container by poma](https://hub.docker.com/r/poma/docker-telegram-notifier), originally an idea of [arefaslani](https://github.com/arefaslani).
