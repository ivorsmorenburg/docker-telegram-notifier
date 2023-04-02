const Bottleneck = require('bottleneck');
const Docker = require('dockerode');
const docker = new Docker();
const templates = require('./templates');
const Counter = require('./counter');
const { Telegraf, session } = require('telegraf');
const { telegrafThrottler } = require('telegraf-throttler');

const toBeSentMessagesCounter = new Counter();
const sentMessagesCounter = new Counter();
const failedMessagesCounter = new Counter();

// Default Error Handler
const defaultErrorHandler = async (ctx, next, error) => {
  return console.warn(`Inbound ${ctx.from?.id || ctx.chat?.id} | ${error.message}`)
};

const bot = new Telegraf(process.env.TELEGRAM_NOTIFIER_BOT_TOKEN);
const chatId = process.env.TELEGRAM_NOTIFIER_CHAT_ID;
const topicId = process.env.TELEGRAM_NOTIFIER_TOPIC_ID | "" ;
const isDebug = process.env.DEBUG ?  true : false ;

bot.use(session());
// bot.use(telegrafThrottler(limiter))

const dockerMachineName = process.env.DOCKER_MACHINE_NAME | "default" ;

const reservoir = process.env.BN_RESERVOIR | 2 ;
const reservoirIncreaseInterval = process.env.BN_RESERVOIR_INCREASE_INTERVAL | 2000;
const reservoirRefreshInterval = process.env.BN_RESERVOIR_REFRESH_INTERVAL |  60 * 1000;
const reservoirIncreaseAmount = process.env.BN_RESERVOIR_INCREASE_AMOUNT | 2;
const maxBufferSize = process.env.BN_RESERVOIR_MAX_BUFFER_SIZE | 50 ;
const minTime =  process.env.BN_MIN_TIME | 5000  ;
const maxConcurrent = process.env.BN_MAX_CONCURRENT | 1;
const id = process.env.BN_ID != undefined ? `${dockerMachineName}_${process.env.BN_ID}` : `${dockerMachineName}_telegram-throttler`;

const limiter = new Bottleneck({
  maxConcurrent: maxConcurrent, // process only 1 message at a time
  minTime: minTime, // wait at least 2 seconds between processing each message
  reservoir: reservoir, // allow up to 20 messages to be processed immediately
  reservoirRefreshInterval:reservoirRefreshInterval, // reset reservoir every 60 seconds
  reservoirRefreshAmount: reservoirIncreaseAmount, // refill reservoir with 20 tokens every refresh interval
  maxBufferSize: maxBufferSize, // queue up to 50 messages
  strategy: Bottleneck.strategy.LEAK // slowly refill tokens in the reservoir
});

limiter.on('failed', function(error, jobInfo) {
  console.error('Job failed:', error);
});

limiter.on('retry', function(error, jobInfo) {
  console.warn('Retrying job:', error);
});

async function printStatusLogs(){
  console.log(`
  ========================================
  - - - - - - - - STATUS - - - - - - - - -
  Docker Machine: ${dockerMachineName}
  DEBUG: ${isDebug}
  Messages On Queue: ${await toBeSentMessagesCounter.getValue() - await sentMessagesCounter.getValue()}
  Messages Sent: ${await sentMessagesCounter.getValue()}
  Messages Failed: ${await failedMessagesCounter.getValue()}
  - - - - - - - - Telegram - - - - - - - -
  Chat id:  ${chatId}
  Topic id:  ${topicId}
  - - - - - - - - Bottleneck - - - - - - -
  Id: ${id}
  Reservoir: ${reservoir}
  Reservoir Increase Interval: ${reservoirIncreaseInterval}
  Reservoir Refresh Interval: ${reservoirRefreshInterval}
  Reservoir Increase Ammount: ${reservoirIncreaseAmount}
  maxBufferSize: ${maxBufferSize}
  Min Time: ${minTime}
  Max Concurrent: ${maxConcurrent}
  ========================================
  `)
}

function sendTelegramMessage(bot, chatId, message, options = {}) {
  return limiter.schedule(() => 
    bot.telegram.sendMessage(chatId, message, options)
      .then(() => {
        console.log("Sent Message:" + message);
        sentMessagesCounter.increment();
        printStatusLogs();
      })
      .catch((error) => {
        sentMessagesCounter.decrement();
        failedMessagesCounter.increment();
        console.error('Failed to send Telegram message:', error);
        throw error;
      })
  );
}

function queueTelegramMessage(bot, chatId, message, options = {}) {
  return limiter.schedule(() => 
    bot.telegram.sendMessage(chatId, message, options) 
    .then(() => {
      console.log("Sent Message:" + message);
      sentMessagesCounter.increment();
      printStatusLogs();
    })
  ).catch((error) => {
    sentMessagesCounter.decrement();
    failedMessagesCounter.increment();
    console.error('Failed to send Telegram message:', error);
    throw error;
  });
}

function sendDockerEventMessage(bot, chatId, event) {
  let message = `Docker event: ${event.Type} ${event.Action} ${event.Actor.Attributes.name}`;
  const template = templates[`${event.Type}_${event.Action}`];

  console.info(message);

  if (template) {
    const label = event.Actor && event.Actor.Attributes && event.Actor.Attributes['telegram-notifier.monitor'];
    const shouldMonitor = label === undefined ? undefined : label.toLowerCase().trim() !== 'false';
    
    if (shouldMonitor || !process.env.ONLY_WHITELIST && shouldMonitor !== false) {
      const attachment = template(event);
      const options = { 
        parse_mode: 'HTML',
        disable_web_page_preview: true
      };
      if (topicId) {
        options.message_thread_id = topicId;
      }
      toBeSentMessagesCounter.increment();
      queueTelegramMessage(bot, chatId, attachment, options);
    }
  }
}

async function main(){
  // Docker event listener
  docker.getEvents((err, stream) => {
    if (err) {
      console.error(err);
      return;
    }

    stream.on('data', (chunk) => {
      const event = JSON.parse(chunk.toString());
      // if(isDebug) console.debug(event);
      sendDockerEventMessage(bot, chatId, event);
    });

    stream.on('error', (err) => {
      console.error(err);
      main();
    });
  });
}

async function healthcheck() {
  try {
    await docker.version();
  } catch (e) {
    console.error(e);
    console.error("Docker is unavailable");
    process.exit(101);
  }

  limiter.schedule(() => 
    console.log(bot.telegram.getMe())
  ).catch((error) => {
    console.error(error);
    console.error("Telegram API is unavailable");
    process.exit(102);
  });

  printStatusLogs();

  console.log("OK");
  process.exit(0);
}

function handleError(e) {
  console.error(e);
  sendTelegramMessage(bot, chatId, e)
}

if (process.argv.includes("healthcheck")) {
  healthcheck();
} else {
  printStatusLogs();
  main().catch(handleError);
}
