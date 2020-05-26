/*
 * message_scheduler.js
 *
 * Launch student information from Airtable and schedule feedback surveys in Slack. Must be scheduled for dates
 * in the future in GMT. The time comes from Airtable
 *
 * by Camille Cooper
 * for HackCville, Inc.
 *
 * May 2020
 *
 * Adapted from code originally developed by Camille Cooper and Forrest Feaser
 */

require("dotenv").config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID_PROD = process.env.AIRTABLE_BASE_ID_PROD;
const SLACK_BOT_TOKEN_HCCOMMUNITY = process.env.SLACK_BOT_TOKEN_HCCOMMUNITY;
const TABLE_NAME = "Launch Students";

const { WebClient } = require("@slack/web-api");
const web = new WebClient(SLACK_BOT_TOKEN_HCCOMMUNITY);

const Airtable = require("airtable");
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
  AIRTABLE_BASE_ID_PROD
);

//for staggering messages, but doesn't work with async
const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

//not the best way to do this in practice but it's the only thing that works with async
const wait = (milliseconds) => {
  const now = new Date().getTime();
  while (new Date().getTime() < now + milliseconds) {}
};

const scheduleMessages = async () => {
  const EveryStudentInfo = [];
  const messageTime = new Date("2020-05-25T21:10:00Z");

  await base(TABLE_NAME)
    .select({
      fields: ["Track", "Slack ID"],
      view: "Camille View",
      filterByFormula:
        "AND(NOT({Track} = ''), NOT({Slack ID} = ''),NOT({Track} = 'Advanced Softwared Engineering'), NOT({Track} = 'Advanced Data Science') )",
    })
    //collect all the slack ids with its corresponding track
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const individualStudentInfo = {
          track: record.get("Track"),
          slackId: record.get("Slack ID"),
        };
        EveryStudentInfo.push(individualStudentInfo);
      });
      fetchNextPage();
    })
    .then(() => {
      EveryStudentInfo.forEach((student) => {
        const message_date_epoch_secs = messageTime.getTime() / 1000;
        const datestring = messageTime.toLocaleString(); //schedule date of current message so it doesn't get lost in async
        messageTime.setSeconds(messageTime.getSeconds() + 2); //increment the time when the next message is schedule for

        //scheduled message containing link to feedback form
        const scheduled_bot_message = {
          token: SLACK_BOT_TOKEN_HCCOMMUNITY,
          channel: student.slackId,
          post_at: message_date_epoch_secs,
          link_names: true,
          as_user: false, //make this true for message to appear in feedbackbot DM
          attachments: [
            {
              text: `Hi <@${student.slackId}>, I'm Andrew. I collect feedback from HC students. We want to make your Launch experience the best possible. Could you please take ~20 sec to say how ${student.track} went today?`,
              callback_id: "feedback_form_open",
              color: "#3149EC",
              attachment_type: "default",
              actions: [
                {
                  name: "feedback_button",
                  text: "Begin Survey!",
                  type: "button",
                  value: "feedback",
                },
              ],
            },
          ],
        };

        (async () => {
          //https://api.slack.com/methods/chat.scheduleMessage
          await web.chat
            .scheduleMessage(scheduled_bot_message)
            .then(() => {
              console.log(
                `Message scheduled for ${student.slackId} in ${student.track} at ${datestring}`
              );
              wait(1000); //wait 1 second between each message schedule to avoid rate limiting
            })
            .catch((err) => {
              console.log(err);
            });
        })();
      });
    })

    .catch((err) => {
      console.log(err);
    });
};

//call to main function to schedule messages
scheduleMessages();
