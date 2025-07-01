
You can add any FObject to a Flow document by doing this:

addValue(foam.audio.Speak.create({}, this));

which will add to both the document itself and the PropertySheet, or if you only want to add
to the PropertySheet, do:

addValue(foam.audio.Speak.create({}, this), false);

To add to just the document, you can do:

this.currentBlock.tag(foam.audio.Speak)