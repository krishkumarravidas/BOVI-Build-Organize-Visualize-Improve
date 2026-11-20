/**
 * The attendance file format BOVI imports, with a short fictional example and a ready-made prompt that
 * turns screenshots of a college attendance portal into that file using an AI chat app.
 */

export const EXAMPLE_ATTENDANCE = {
  source: 'College attendance portal screenshots',
  generated_on: '2026-11-19',
  subjects: [
    {
      subject_code: 'CS305',
      subject_name: 'Data Structures and Algorithms',
      faculty: 'Prof. A. Example',
      classes_conducted: 25,
      classes_present: 20,
      classes_absent: 5,
      classes_remaining: 24,
      attendance_percent: 80.0,
      absent_records: [
        { date: '2026-11-04', time: '10:40-11:35' },
        { date: '2026-10-21', time: '09:25-10:20' },
      ],
    },
    {
      subject_code: 'CSL306',
      subject_name: 'Data Structures Laboratory',
      classes_conducted: 8,
      classes_present: 7,
      classes_absent: 1,
      classes_remaining: 26,
      attendance_percent: 87.5,
      absent_records: [{ date: '2026-10-09', time: '08:30-10:20' }],
    },
  ],
};

export const EXAMPLE_ATTENDANCE_JSON = JSON.stringify(EXAMPLE_ATTENDANCE, null, 2);

/** Paste into ChatGPT / Claude / Gemini together with the screenshots. */
export const ATTENDANCE_PROMPT = `I'm attaching screenshots of my college attendance portal, one or more per subject.
Read every screenshot and give me ONE JSON file in exactly this format, and nothing else:

{
  "source": "College attendance portal screenshots",
  "generated_on": "YYYY-MM-DD",
  "subjects": [
    {
      "subject_code": "course code as shown, e.g. CS305",
      "subject_name": "full subject name as shown",
      "faculty": "teacher's name if shown, otherwise leave this field out",
      "classes_conducted": 0,
      "classes_present": 0,
      "classes_absent": 0,
      "classes_remaining": 0,
      "attendance_percent": 0.0,
      "absent_records": [
        { "date": "YYYY-MM-DD", "time": "HH:MM-HH:MM" }
      ]
    }
  ]
}

Rules:
- "generated_on" is the "last updated" date shown on the portal (or today's date if none is shown).
- One entry per subject (labs are separate subjects). Don't merge or skip any.
- Numbers must be plain numbers, copied exactly from the screenshots. Don't calculate or guess.
- Leave out "classes_remaining" if the portal doesn't show it.
- List every absent class you can see in "absent_records", with dates as YYYY-MM-DD and 24-hour times. Use an empty list if none are shown.
- Reply with only the JSON (no explanation), so I can save it as attendance.json.`;

/** Steps shown on the import screen. */
export const ATTENDANCE_STEPS = [
  'Open your college attendance portal (website or app).',
  'Take a screenshot of each subject’s attendance page — the one with classes conducted, attended and the absent dates. Scroll and take more if the list is long.',
  'Put all the screenshots in one folder (or just keep them in your gallery).',
  'Open ChatGPT (or Claude / Gemini), attach all the screenshots, and paste the prompt below.',
  'Copy the JSON it replies with and paste it here — or save it as a file called attendance.json and open it with the button.',
  'Check the preview, then tap “Use these figures”. Repeat whenever the portal updates.',
];
