foam.CLASS({
  package: 'foam.box',
  name: 'ReplyBox2',
  extends: 'foam.box.ProxyBox',
  properties: [
    {
      class: 'Boolean',
      name: 'once',
      value: true
    },
    {
      name: 'exported',
      transient: true,
      hidden: true,
      generateJava: false,
      documentation: 'The SubBox this box was last sent as: its name is how the far side addresses it.'
    }
  ],
  methods: [
    function outputJSON(outputter) {
      this.exported = outputter.__context__.subBox(this, this.once);
      outputter.output(this.exported);
    }
  ]
});
