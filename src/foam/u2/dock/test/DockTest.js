/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dock.test',
  name: 'DockTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.u2.dock.Dock',
    'foam.u2.dock.test.TestDockItem',
    'foam.u2.dock.test.TestDockView'
  ],

  methods: [
    async function runTest(x) {
      var added    = [];
      var notified = [];
      var subX = x.createSubContext({
        // stand-ins, so the cards are not added to the test page
        ctrl:   { add: function(v) { added.push(v); } },
        notify: function(msg) { notified.push(msg); }
      });
      var dock  = this.Dock.create(null, subX);
      var agent = this.TestDockItem.create({ title: 'Agent', statusMsg: 'Reading the file', running: true, startTime: new Date(), holdsPage: true, openable: true }, subX);
      var load  = this.TestDockItem.create({ title: 'svcA', statusMsg: 'loading', running: true, showProgress: true, progress: 40 }, subX);

      dock.dock(agent);
      dock.dock(agent);
      var seen = 0;
      dock.items$.sub(function() { seen++; });
      dock.dock(load);
      x.test(dock.items.length === 2, 'docking the same item twice shows one card');
      x.test(seen === 1, 'a change to the docked items reaches the Dock\'s listeners, which redraw the cards');
      x.test(added.length === 1 && added[0] === dock, 'the dock adds itself to ctrl once, on the first item');
      x.test(!! dock.timer_, 'the running time counts while a running item has a startTime');

      var prevented = false;
      var event = { preventDefault: function() { prevented = true; } };
      dock.onBeforeUnload(event);
      x.test(prevented, 'leaving the page asks first while an item holds the page');

      agent.statusMsg = 'Format saved';
      agent.running   = false;
      x.test(notified.length === 1 && notified[0] === 'Agent: Format saved', 'an item that stops running notifies once with its title and status, got ' + JSON.stringify(notified));
      x.test(! dock.timer_, 'the running time stops when no running item has a startTime');

      prevented = false;
      agent.holdsPage = false;
      dock.onBeforeUnload(event);
      x.test(! prevented, 'leaving the page does not ask once no item holds it');

      dock.undock(load);
      load.running = false;
      x.test(notified.length === 1, 'an undocked item no longer notifies');

      var view = this.TestDockView.create({ title: 'Panel', running: true, cardHidden: true }, subX);
      dock.dock(view);
      x.test(added.indexOf(view) != -1, 'an item that is a view is added to the app shell when it docks');
      view.statusMsg = 'Done';
      view.running   = false;
      x.test(notified.length === 1, 'an item whose own view shows (cardHidden) does not notify');
      dock.undock(view);
      x.test(! view.element_ || ! view.element_.isConnected, 'an undocked view leaves the app shell');

      var line = dock.statusText(foam.u2.Element.create(null, subX), this.TestDockItem.create({ statusMsg: 'Reading' }, subX));
      x.test(line.get() === 'Reading', 'statusText shows the status alone when the item has no running time, got ' + line.get());

      dock.collapsed_ = true;
      dock.undock(agent);
      x.test(dock.items.length === 0 && ! dock.collapsed_, 'the dock opens expanded again once it empties');
    }
  ]
});
