
You can add any FObject to a Flow document by doing this:

addValue(foam.audio.Speak.create({}, this));

which will add to both the document itself and the PropertySheet, or if you only want to add
to the PropertySheet, do:

addValue(foam.audio.Speak.create({}, this), true);

To add to just the document, you can do:

tag(foam.audio.Speak);
log('Hello World!');
out.add(block.flowName$, ',', block.cmd$); '';

this.findFlowChildByName('error1').del();
find('error1').del(); block.del();

h1("H1");h2("H2");h3("H3");block.flowName = 'subsubBlock';block.shown = false;