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
const COURSES_TABLE_NAME = "Courses";

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
  const courses = [];

  await base(COURSES_TABLE_NAME)
    .select({
      fields: ["Course Title", "Slack ID", "Survey Datetime"],
      filterByFormula:
        "AND(NOT({Course Title} = ''), NOT({Slack ID} = ''), NOT({Survey Datetime} = ''))",
    })

    //retrieve the relevant data for each course
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const course_data = {
          course_title: record.get("Course Title"),
          student_slack_ids: record.get("Slack ID"),
          survey_date: record.get("Survey Datetime"),
        };
        courses.push(course_data);
      });
      fetchNextPage();
    })

    .then(() => {
      courses.forEach((course) => {
        const course_title = course.course_title;
        const slack_ids = course.student_slack_ids;
        const message_date = new Date(course.survey_date); //watch out for DST

        slack_ids.forEach((user_id) => {
          const message_date_epoch_secs = message_date.getTime() / 1000;
          const datestring = message_date.toLocaleString(); //schedule date of current message so it doesn't get lost in async
          message_date.setSeconds(message_date.getSeconds() + 2); //increment the time when the next message is schedule for

          //scheduled message containing link to feedback form
          const scheduled_bot_message = {
            token: SLACK_BOT_TOKEN_HCCOMMUNITY,
            channel: user_id,
            post_at: message_date_epoch_secs,
            link_names: true,
            as_user: false, //make this true for message to appear in feedbackbot DM
            attachments: [
              {
                text: `Hi <@${user_id}>, I'm Andrew. I collect feedback from HC students so we can learn how to continue improving your course. Can you take 20 secs to let me know how ${course_title} went today?`,
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
                  `Message scheduled for ${user_id} in ${course_title} at ${datestring}`
                );
                wait(1000); //wait 1 second between each message schedule to avoid rate limiting
              })
              .catch((err) => {
                console.log(err);
              });
          })();
        });
      });
    })

    .catch((err) => {
      console.log(err);
    });
};

//call to main function to schedule messages
scheduleMessages();
