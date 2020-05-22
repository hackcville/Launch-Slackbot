/*
 * record.js
 *
 * This is the file that should be run from the command line to test changes in recording
 * in Airtable. Designed to assist in the debugging process by isolatiing the singular
 * step of creating new Airtable records. Uses Camille's slack ID to do so. The tester
 * SlackID can be changed as long as it exists in the table.
 *
 * by Camille Cooper
 * for HackCville, Inc.
 *
 * May 2020
 *
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_LIVE;
const TABLE_NAME = "Launch 2020 Student Feedback";

var Airtable = require("airtable");
var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

//static data that replicates how slack would pass the info. this is what gets recorded
var payload = {
  user: { id: "UETEHA6NN" },
  submission: {
    pace: 3,
    combo: 3,
    lecture: 3,
    understanding: 3,
    enjoyment: 3,
  },
};

var student_name = "";
var student_link = [];

base("Launch Students")
  .select({
    maxRecords: 1,
    view: "Camille View",
    filterByFormula: "{Slack ID}= '" + payload.user.id + "'",
  })
  .eachPage((records, fetchNextPage) => {
    records.forEach((record) => {
      console.log("Retrieved", record.get("Student Name"));
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
            // "Group Rating": Number(payload.submission.group),
            "Enjoyment Rating": Number(payload.submission.enjoyment),
            //   Strength: payload.submission.strength,
            //   Weakness: payload.submission.weakness,
            //   "Student Link": student_link,
          },
        },
      ],
      function (err, records) {
        if (err) {
          console.error(err);
          return;
        }
      }
    );
  });
