/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'StubMethod',
  extends: 'Method',

  properties: [
    'boxPropName',
    {
      name: 'code',
      factory: function() {
        var type              = this.type;
        var isContextOriented = this.args.length >= 1 && this.args[0].type == 'Context'
        var boxPropName       = this.boxPropName;
        var name              = this.name;

        return function() {
          var rpcReturnBox  = this.RPCReturnBox.create();
          var ret           = rpcReturnBox.promise;
          
          // Automatically wrap RPCs that return a "PromisedAbc" or similar
          // TODO: Move this into RPCReturnBox ?
          var cls = this.__context__.maybeLookup(type);
          if ( cls && ! cls.name.startsWith('Promised') ) {
            var promiseType = `${cls.package}.Promised${cls.name}`;
            cls = this.__context__.maybeLookup(promiseType);
          }
          ret = cls ? cls.create({ delegate: ret }) : ret;

          var args = Array.from(arguments);

          // Don't try to marshal context across network They are not
          // serializable and the server will assign its own notion of
          // what context the request should be handled in.
          if ( isContextOriented ) args[0] = null;
          
          this[boxPropName].send(foam.box.Envelope.create({
            message: this.RPCMessage.create({ name, args }),
            replyBox: rpcReturnBox
          }));

          return ret;
        };
      }
    }
  ]
});
