/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Sends changed classes into a running JVM over JDWP (JDI). Started by tools/JavaTooling.js
// with the server's own JVM, as a single source file:
//   java HotSwap.java <debugPort> <classesDir> <manifest>
// The manifest lists class files (relative to classesDir), one per line: the ones the build wrote.
// Exit 0 swapped or nothing to do, 2 the JVM refused, 3 could not attach. Any other exit is a failure of this helper.
import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

public class HotSwap {
  public static void main(String[] a) throws Exception {
    int port = Integer.parseInt(a[0]);
    Path root = Paths.get(a[1]);
    List<String> files = Files.readAllLines(Paths.get(a[2])).stream().filter(s -> ! s.isBlank()).collect(Collectors.toList());

    VirtualMachine vm;
    try {
      AttachingConnector c = Bootstrap.virtualMachineManager().attachingConnectors().stream()
        .filter(x -> x.transport().name().equals("dt_socket")).findFirst().get();
      Map<String, Connector.Argument> args = c.defaultArguments();
      args.get("hostname").setValue("127.0.0.1");
      args.get("port").setValue(String.valueOf(port));
      vm = c.attach(args);
    } catch ( Exception e ) {
      System.out.println("cannot attach to the debug port 127.0.0.1:" + port + " (is the server running with --hot-swap? another debugger may be attached): " + e.getMessage());
      System.exit(3);
      return;
    }

    try {
      if ( ! vm.canRedefineClasses() ) {
        System.out.println("this JVM cannot redefine classes: start the server with --hot-swap on a JetBrains Runtime");
        System.exit(2);
      }
      Map<ReferenceType, byte[]> swap = new LinkedHashMap<>();
      Map<ReferenceType, Set<String>> before = new HashMap<>();
      int notLoaded = 0, gone = 0;
      for ( String rel : files ) {
        String name = rel.substring(0, rel.length() - ".class".length()).replace('/', '.');
        // A class listed earlier and gone since (its source was removed): nothing to send.
        if ( ! Files.exists(root.resolve(rel)) ) { gone++; continue; }
        byte[] bytes = Files.readAllBytes(root.resolve(rel));
        // Every class loader may hold the class: redefine each copy.
        List<ReferenceType> types = vm.classesByName(name);
        if ( types.isEmpty() ) { notLoaded++; continue; }
        for ( ReferenceType t : types ) {
          swap.put(t, bytes);
          before.put(t, members(t));
        }
      }
      if ( swap.isEmpty() ) {
        System.out.println("nothing to swap: " + files.size() + " listed classes, none loaded in the server (" + gone + " no longer exist)");
        return;
      }
      try {
        vm.redefineClasses(swap);
      } catch ( UnsupportedOperationException | LinkageError | InternalException | ClassNotPreparedException e ) {
        // For example a changed class hierarchy or schema, or classes built for a newer Java than the server runs.
        String hint = String.valueOf(e).contains("Error: 113") ? " (JDWP 113: the classes may be built for a newer Java than the server runs, see --java-release)" : "";
        System.out.println("the JVM refused the swap, restart the server: " + e + hint);
        System.exit(2);
      }
      List<String> changed = new ArrayList<>();
      for ( ReferenceType t : swap.keySet() ) {
        Set<String> now = members(t), was = before.get(t);
        if ( ! now.equals(was) ) changed.add(t.name());
      }
      System.out.println("swapped " + swap.size() + " classes (" + notLoaded + " changed ones not loaded yet" + ( gone > 0 ? ", " + gone + " listed ones no longer exist" : "" ) + ")");
      if ( ! changed.isEmpty() ) {
        System.out.println("WARNING: these classes got or lost fields or methods: " + String.join(", ", changed));
        System.out.println("Static initializers do not run again, so FOAM class info and property constants may be stale. Restart the server after a model property change.");
      }
    } finally {
      vm.dispose();
    }
  }

  // The fields and methods a class declares, as name+signature.
  static Set<String> members(ReferenceType t) {
    Set<String> s = new TreeSet<>();
    for ( Field f : t.fields() ) s.add("f " + f.name() + f.signature());
    // Lambda bodies are synthetic methods whose names shift with any edit: not a change of the class's shape.
    for ( Method m : t.methods() ) if ( ! m.isSynthetic() && ! m.name().startsWith("lambda$") ) s.add("m " + m.name() + m.signature());
    return s;
  }
}
