/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'PhaseBench',
  extends: 'foam.core.test.Test',
  abstract: true,

  documentation: `Measurement harness for benchmarks that report per-phase heap,
    wall time, CPU time and GC activity.

    Every phase emits one key=value line, so two runs can be diffed
    mechanically rather than read. A heap reading is only meaningful if nothing
    ran between the allocation being measured and the reading, so settleHeap
    forces collections and is called on both sides of the phase being sized.`,

  javaImports: [
    'java.lang.management.GarbageCollectorMXBean',
    'java.lang.management.ManagementFactory'
  ],

  properties: [
    { class: 'Long', name: 'gcCount_', transient: true, hidden: true },
    { class: 'Long', name: 'gcTime_',  transient: true, hidden: true },
    { class: 'Long', name: 'cpu0_',    transient: true, hidden: true },
    { class: 'Long', name: 'wall0_',   transient: true, hidden: true }
  ],

  methods: [
    {
      name: 'settleHeap',
      documentation: 'Force a few collections so a heap reading is comparable.',
      type: 'Long',
      javaCode: `
        for ( int i = 0 ; i < 3 ; i++ ) {
          System.gc();
          try { Thread.sleep(300); } catch ( InterruptedException e ) {}
        }
        Runtime rt = Runtime.getRuntime();
        return rt.totalMemory() - rt.freeMemory();
      `
    },
    {
      name: 'startPhase',
      javaCode: `
        long c = 0, t = 0;
        for ( GarbageCollectorMXBean b : ManagementFactory.getGarbageCollectorMXBeans() ) {
          c += b.getCollectionCount();
          t += b.getCollectionTime();
        }
        setGcCount_(c);
        setGcTime_(t);
        setCpu0_(ManagementFactory.getThreadMXBean().getCurrentThreadCpuTime());
        setWall0_(System.nanoTime());
      `
    },
    {
      name: 'endPhase',
      documentation: 'Emit one BENCH line for the phase started by startPhase.',
      args: 'String phase, String extra',
      javaCode: `
        long wallMs = ( System.nanoTime() - getWall0_() ) / 1000000;
        long cpuMs  = ( ManagementFactory.getThreadMXBean().getCurrentThreadCpuTime()
                        - getCpu0_() ) / 1000000;
        long c = 0, t = 0;
        for ( GarbageCollectorMXBean b : ManagementFactory.getGarbageCollectorMXBeans() ) {
          c += b.getCollectionCount();
          t += b.getCollectionTime();
        }
        System.out.println("BENCH phase=" + phase
          + " wallMs=" + wallMs
          + " cpuMs=" + cpuMs
          + " gcCount=" + ( c - getGcCount_() )
          + " gcTimeMs=" + ( t - getGcTime_() )
          + ( extra == null ? "" : " " + extra ));
      `
    },
    {
      name: 'classHistogram',
      documentation: `Instance count and retained bytes per class, filtered to
        the given substrings, read from the live JVM via jcmd. This is the only
        way to size one class of object directly rather than inferring it from a
        heap total, and it needs no instrumentation in the measured code.`,
      args: 'String label, String[] match',
      javaCode: `
        try {
          long pid = ProcessHandle.current().pid();
          Process p = new ProcessBuilder("jcmd", String.valueOf(pid), "GC.class_histogram")
            .redirectErrorStream(true).start();

          java.io.BufferedReader r = new java.io.BufferedReader(
            new java.io.InputStreamReader(p.getInputStream()));

          String line;
          while ( ( line = r.readLine() ) != null ) {
            for ( int i = 0 ; i < match.length ; i++ ) {
              if ( line.contains(match[i]) ) {
                System.out.println("HISTO " + label + " |" + line);
                break;
              }
            }
          }
          p.waitFor();
        } catch ( Exception e ) {
          System.out.println("HISTO " + label + " | unavailable: " + e);
        }
      `
    }
  ]
});
