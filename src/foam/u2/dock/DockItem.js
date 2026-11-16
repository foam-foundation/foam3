/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.u2.dock',
  name: 'DockItem',

  documentation: `
    Anything shown in the Dock while the user works elsewhere in the app: an
    agent reading a file, a long export, a partition loading. The Dock draws
    one card per item from these properties and follows them as they change,
    so an item only keeps its own state up to date:

      item.statusMsg = 'Saving this format';
      item.startTime = new Date();   // the card counts up from here: "2:10"
      item.running   = false;        // finished: the Dock tells the user once

    An item that is itself a view, such as an agent's panel, is added to the
    app shell when it docks, so it exists only once something docked it and
    then outlives the screen that started it.
  `,

  properties: [
    {
      class: 'String',
      name: 'title',
      documentation: 'What the item is, as the card heads it, e.g. a service name or an agent.'
    },
    {
      class: 'String',
      name: 'statusMsg',
      documentation: 'What the item is doing right now, the line under the title.'
    },
    {
      class: 'Boolean',
      name: 'running',
      documentation: `True while the item is working. When it turns false the
        Dock notifies the user with the title and statusMsg, so a result is
        seen even when the item's own view is closed.`
    },
    {
      class: 'Boolean',
      name: 'showProgress',
      documentation: 'Whether the card shows a progress bar.'
    },
    {
      class: 'Int',
      name: 'progress',
      value: -1,
      documentation: `Percent done, 0 to 100, for the progress bar. -1 when no
        honest percent exists: the bar then runs without a value.`
    },
    {
      class: 'DateTime',
      name: 'startTime',
      documentation: 'When the current work started; set it and the card shows how long it has run.'
    },
    {
      class: 'Boolean',
      name: 'holdsPage',
      documentation: `True while leaving or reloading the page would lose this
        item's work, e.g. an agent whose model calls run in this browser. The
        Dock asks the user before the page unloads.`
    },
    {
      class: 'Boolean',
      name: 'cardHidden',
      documentation: `True while the item's own view is showing, e.g. an agent's
        chat is open, so its card would only repeat it. The Dock hides the card
        and does not notify while it is set.`
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'cardView',
      documentation: `The item's own card, for an item that wants its look and
        actions in the Dock, e.g. an agent's face and an End button. Created
        with the item as data, in place of the Dock's plain card; the Dock
        still stacks, collapses and hides it. Unset, the plain card shows.`
    },
    {
      class: 'Boolean',
      name: 'openable',
      documentation: 'Whether a click on the card calls open().'
    }
  ],

  methods: [
    {
      name: 'open',
      documentation: 'Shows the item\'s own view again, e.g. an agent\'s chat. Called on a click on an openable card.'
    }
  ]
});
