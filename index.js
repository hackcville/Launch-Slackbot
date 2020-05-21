/*
 * index.js
 *
 * Express server on Heroku to recieve events/actions from Slack and respond
 * to feed back surveys and record responses in Airtable
 *
 * by Camille Cooper
 * for HackCville, Inc.
 *
 * May 2020
 *
 *  * Adapted from code originally developed by Camille Cooper and Forrest Feaser
 */

require("dotenv").config();

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_LIVE;
const TABLE_NAME = "Launch 2020 Student Feedback";

const Airtable = require("airtable");
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

const express = require("express");
const { WebClient } = require("@slack/web-api");
const { createEventAdapter } = require("@slack/events-api");
const { createMessageAdapter } = require("@slack/interactive-messages");

const slackEvents = createEventAdapter(SLACK_SIGNING_SECRET);
const slackInteractions = createMessageAdapter(SLACK_SIGNING_SECRET);
const web = new WebClient(SLACK_BOT_TOKEN);

const port = process.env.PORT || 3000;
const app = express();

app.use("/slack/events", slackEvents.requestListener());
app.use("/slack/actions", slackInteractions.requestListener());

app.listen(port, () => {
  console.log(`Listening for actions/events on port ${port}...`);
});

//the following message is for testing in the tech-team slack group
//https://api.slack.com/events/app_mention
slackEvents.on("app_mention", (event) => {
  //template for message with button to survey
  const bot_feedback_message = {
    token: SLACK_BOT_TOKEN,
    channel: event.channel,
    text: `Hey <@${event.user}>`,
    link_names: true,
    attachments: [
      {
        text:
          "We want to make your Launch experience the best possible. Could you please answer a few questions?",
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
    // https://api.slack.com/methods/chat.postMessage
    const res = await web.chat
      .postMessage(bot_feedback_message)
      .catch((err) => {
        console.log(err);
      });
  })();
});

slackInteractions.action({ type: "button" }, (payload) => {
  //template for feedback survey
  const feedback_dialog = {
    token: SLACK_BOT_TOKEN,
    trigger_id: payload.trigger_id,
    dialog: JSON.stringify({
      title: "Feedback Form",
      callback_id: "feedback_form_open",
      submit_label: "Submit",
      elements: [
        {
          label: "The pace of the material so far has been...",
          type: "select",
          name: "pace",
          placeholder: "1-5, 1 = Too slow, 5 = Too fast",
          options: [
            { label: "1", value: 1 },
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
            { label: "5", value: 5 },
          ],
        // },
        // {
        //   label: "The combo of lecture and reading materials has been...",
        //   type: "select",
        //   name: "combo",
        //   placeholder: "1-5, 1 = Too much lecture, 5 = Too much reading",
        //   options: [
        //     { label: "1", value: 1 },
        //     { label: "2", value: 2 },
        //     { label: "3", value: 3 },
        //     { label: "4", value: 4 },
        //     { label: "5", value: 5 },
        //   ],
        // },
        // {
        //   label: "The lecture length has been...",
        //   type: "select",
        //   name: "lecture",
        //   placeholder: "1-5, 1 = Too long, 5 = Too short",
        //   options: [
        //     { label: "1", value: 1 },
        //     { label: "2", value: 2 },
        //     { label: "3", value: 3 },
        //     { label: "4", value: 4 },
        //     { label: "5", value: 5 },
        //   ],
        // },
        // {
        //   label: "My own understanding of the material is...",
        //   type: "select",
        //   name: "understanding",
        //   placeholder: "1-5, 1 = I'm totally lost, 5 = I could teach this,",
        //   options: [
        //     { label: "1", value: 1 },
        //     { label: "2", value: 2 },
        //     { label: "3", value: 3 },
        //     { label: "4", value: 4 },
        //     { label: "5", value: 5 },
        //   ],
        // },
        // {
        //   label: "My group has been working together...",
        //   type: "select",
        //   name: "group",
        //   placeholder: "1-5, 1 = horribly, 5 = perfectly",
        //   options: [
        //     { label: "1", value: 1 },
        //     { label: "2", value: 2 },
        //     { label: "3", value: 3 },
        //     { label: "4", value: 4 },
        //     { label: "5", value: 5 },
        //   ],
        // },
        // {
        //   label: "How much are you enjoying Launch?",
        //   type: "select",
        //   name: "enjoyment",
        //   placeholder: "1-5, 5 = I’m loving it, 1 = I’m hating it",
        //   options: [
        //     { label: "1", value: 1 },
        //     { label: "2", value: 2 },
        //     { label: "3", value: 3 },
        //     { label: "4", value: 4 },
        //     { label: "5", value: 5 },
        //   ],
        // },
        // {
        //   label: "I feel strong on...",
        //   type: "textarea",
        //   name: "strength",
        //   hint: "Be honest :)",
        // },
        // {
        //   label: "I feel weak/confused about...",
        //   type: "textarea",
        //   name: "weakness",
        //   hint: "Be honest :)",
        // },
      ],
    }),
  };

  (async () => {
    //https://api.slack.com/methods/dialog.open
    const res = await web.dialog.open(feedback_dialog).catch((err) => {
      console.log(err);
    });
  })();
});

slackInteractions.action({ type: "dialog_submission" }, (payload) => {
  //retrieve student records from Airtable
  var student_name = "";
  var student_track = "";
  var student_link = [];
  base("Launch Students")
    .select({
      maxRecords: 1,
      view: "Grid view - don't touch",
      filterByFormula: "{Slack ID}= '" + payload.user.id + "'",
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        student_name = record.get("Student Name");
        student_link.push(record.id);
      });
      fetchNextPage();
    })
    .then(() => {
      //record the dialog response in Airtable
      base(TABLE_NAME).create(
        [
          {
            fields: {
              Name: student_name,
              SlackID: payload.user.id,
              "Pace Rating": Number(payload.submission.pace),
              "Lecture/Reading Rating": Number(payload.submission.combo),
              "Lecture Length Rating": Number(payload.submission.lecture),
              "Understanding Rating": Number(payload.submission.understanding),
              "Group Rating": Number(payload.submission.group),
              "Enjoyment Rating": Number(payload.submission.enjoyment),
              Strength: payload.submission.strength,
              Weakness: payload.submission.weakness,
              "Student Link": student_link,
            },
          },
        ],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    });

  //template for bot response to completed form
  const bot_response_message = {
    token: SLACK_BOT_TOKEN,
    channel: payload.channel.id,
    text: `Thanks! <@${payload.user.id}>`,
    link_names: true,
  };

  (async () => {
    //https://api.slack.com/methods/chat.postMessage
    const res = await web.chat
      .postMessage(bot_response_message)
      .catch((err) => {
        console.log(err);
      });
  })();
});
