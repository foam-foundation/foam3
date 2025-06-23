foam.CLASS({
  package: 'foam.box',
  name: 'ReplyBox2',
  extends: 'foam.box.ProxyBox',
  properties: [
    {
      class: 'Boolean',
      name: 'once',
      value: true
    }
  ],
  methods: [
    function outputJSON(outputter) {
      outputter.output(outputter.__context__.subBox(this, this.once));
    }
  ]
});
