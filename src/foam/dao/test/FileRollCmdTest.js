/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'FileRollCmdTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.dao.F3FileJournal',
    'foam.dao.FileRollCmd',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.util.SafetyUtil',
    'java.io.File',
    'java.io.IOException'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = x.put(Storage.class, x.get(FileSystemStorage.class));
      setX(x);

      // create File, write to it, roll it.
      F3FileJournal journal = new F3FileJournal.Builder(x)
        .setFilename("filerollcmdtest")
        .build();

      journal.getWriter().append("one");
      journal.getWriter().newLine();
      journal.getWriter().flush();

      File file = x.get(Storage.class).get(journal.getFilename());
      test( file.exists(), "Original file exists");

      FileRollCmd cmd = new FileRollCmd();
      cmd = (FileRollCmd) journal.cmd(x, cmd);
      test ( ! SafetyUtil.isEmpty(cmd.getRolledFilename()), "File rolled");

      file = x.get(Storage.class).get(cmd.getRolledFilename());
      test( file.exists(), "Renamed file exists, "+cmd.getRolledFilename());
      test( file.getName().endsWith(".1"), "Frozen as generation 1");

      journal.getWriter().append("two");
      journal.getWriter().newLine();
      journal.getWriter().flush();

      file = x.get(Storage.class).get(journal.getFilename());
      test( file.exists(), "New file exists");
      test( file.length() > 0, "New file has data");

      cmd.setRolledFilename(null);
      cmd = (FileRollCmd) journal.cmd(x, cmd);
      test ( ! SafetyUtil.isEmpty(cmd.getRolledFilename()), "File rolled");

      file = x.get(Storage.class).get(cmd.getRolledFilename());
      test( file.exists(), "Renamed file exists, "+cmd.getRolledFilename());
      test( file.getName().endsWith(".2"), "Frozen as generation 2");

      journal.getWriter().append("three");
      journal.getWriter().newLine();
      journal.getWriter().flush();

      file = x.get(Storage.class).get(journal.getFilename());
      test( file.exists(), "New file exists");
      test( file.length() > 0, "New file has data");
      `
    }
  ]
});
