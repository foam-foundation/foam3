/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JournalNestedFirstPropertyTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A change whose first written property is a nested object must journal as a
    line the parser can read. Editing a Cron's schedule writes schedule before
    id, and the nested-object header used to put a comma straight after the
    opening brace: p({,schedule:...}). Replay skipped that line, so the edit was
    lost on restart and the cron went back to its repo schedule.
  `,

  javaImports: [
    'foam.core.cron.Cron',
    'foam.core.cron.IntervalSchedule',
    'foam.core.cron.TimeHMS',
    'foam.dao.MDAO',
    'foam.lib.StoragePropertyPredicate',
    'foam.lib.formatter.JSONFObjectFormatter'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // Repo-style schedule (every 6 hours), then the UI edit to every 15 minutes.
        int REPO_HOUR   = 6;
        int EDIT_HOUR   = 0;
        int EDIT_MINUTE = 15;
        String id   = "nested-first-1";
        String file = "nestedFirstPropertyJournal" + System.currentTimeMillis();

        // Plain MDAO under the journal, so nothing but the schedule changes between the two puts.
        foam.dao.java.JDAO dao = new foam.dao.java.JDAO();
        dao.setX(x);
        dao.setFilename(file);
        dao.setDelegate(new MDAO(Cron.getOwnClassInfo()));

        Cron cron = new Cron(x);
        cron.setId(id);
        cron.setSchedule(schedule(x, REPO_HOUR, 0));
        dao.put(cron);

        Cron stored = (Cron) dao.find(id);
        Cron edited = (Cron) stored.fclone();
        edited.setSchedule(schedule(x, EDIT_HOUR, EDIT_MINUTE));
        dao.put(edited);

        // Formatter level, same settings the journal uses.
        JSONFObjectFormatter fmt = new JSONFObjectFormatter();
        fmt.setPropertyPredicate(new StoragePropertyPredicate());
        fmt.setOutputShortNames(true);
        fmt.setOutputDefaultClassNames(false);
        fmt.setX(x);
        boolean wrote = fmt.maybeOutputDelta(stored, edited, null, Cron.getOwnClassInfo());
        String delta = fmt.builder().toString();
        test(wrote, "formatter reports a delta for a schedule change");
        test(delta.indexOf("schedule") >= 0 && delta.indexOf("schedule") < delta.indexOf("id:"),
          "schedule is the first property written, before id, got: " + delta);
        test(delta.startsWith("{schedule:"),
          "the delta opens with {schedule: and no comma, got: " + delta);

        // Replay into a fresh DAO reading the same journal.
        foam.dao.java.JDAO replayed = new foam.dao.java.JDAO();
        replayed.setX(x);
        replayed.setFilename(file);
        replayed.setDelegate(new MDAO(Cron.getOwnClassInfo()));

        Cron after = (Cron) replayed.find(id);
        test(after != null, "cron survives the replay");
        TimeHMS duration = after == null ? null : ((IntervalSchedule) after.getSchedule()).getDuration();
        expect(duration == null ? -1 : duration.getHour(),   EDIT_HOUR,   "edited hour survives the replay");
        expect(duration == null ? -1 : duration.getMinute(), EDIT_MINUTE, "edited minute survives the replay");
      `
    },
    {
      name: 'schedule',
      args: 'foam.lang.X x, int hour, int minute',
      type: 'foam.core.cron.IntervalSchedule',
      javaCode: `
        TimeHMS duration = new TimeHMS(x);
        duration.setHour(hour);
        duration.setMinute(minute);
        IntervalSchedule s = new IntervalSchedule(x);
        s.setDuration(duration);
        return s;
      `
    }
  ]
});
