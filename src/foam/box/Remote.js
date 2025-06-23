/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box',
  name: 'Remote',

  documentation: `
    Marker interface for objects that can be remoted over the network.
    Remoted objects aren't Serialized when sent across the network,
    but are instead replaced with a ClientStub which calls back to
    a ServerSkeleton registered to receive network calls for the original
    Remote object.

    Useful for general P2P programming, but currently only used when
    performing dao.listen(sink) over a WebSocket.
  `,

  properties: [
    {
      class: 'String',
      name: 'clientClass'
    }
  ],

  methods: [
    function installInClass(cls) {
      var clientClass = this.clientClass || cls.getAxiomsByClass(foam.lang.Implements)[0].path;

      cls.installAxiom(foam.lang.Method.create({
        name: 'outputJSON',
        code: function(outputter) {
          var cls = this.__context__.maybeLookup(clientClass);

          if ( ! cls ) {
            throw new Error('Could not find ' + clientClass + ' to serialize ' + this.cls_.id);
          }

          if ( ! foam.lang.Stub.isInstance(cls.getAxiomByName('delegate')) ) {
            throw new Error('Expected stub property to be named "delegate" for ' + cls.id);
          }

          // Use a special ReplyBox that register a subBox and serializes to a return box when being sent
          var X = this.__subContext__;
          var obj = cls.create({
            delegate: foam.box.ReplyBox2.create({
              delegate: foam.box.SkeletonBox.create({ data: this }, X),
              once: false
            })
          }, X);

          outputter.output(obj);
        }
      }));
    }
  ]
});
