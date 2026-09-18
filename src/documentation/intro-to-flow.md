<flow name="intro-to-flow" category="DOC/DEV" spid="foam"/>

# Introduction to FLOW

<section name="intro">

FLOW is a text markup language for live documents in the
FOAM system.  It is a subset of HTML with added support for FOAM specific features.

</section>
<section name="features">

## Features

A quick rundown of the features in FLOW

- &lt;i&gt;*italics*&lt;/i&gt;
- &lt;b&gt;**bold**&lt;/b&gt;
- &lt;p&gt;Paragraph tags&lt;/p&gt;
- HTML entities: &amp;amp; -> &amp;
- ### Headers
- Various lists, including: 

  </li>
  <li>
    [Links!](#nspec)
  </li>
  <li>
  Embedded FOAM tags &lt;foam class="com.google.foam.demos.bubbles.Bubbles"/&gt;

  <foam class="com.google.foam.demos.bubbles.Bubbles"/>
  </li>
  <li>Code tags:
  
```
/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.demo.relationship',
  name: 'Student',
  ids: [ 'studentId' ],
  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'Long',
      name: 'studentId'
    }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.demo.relationship.Student',
  targetModel: 'foam.core.demo.relationship.Course',
  cardinality: '*:*',
  forwardName: 'courses',
  inverseName: 'students'
});
```

</li>
<li>Image support:

<img src="/src/foam/core/controller/foam_red.png"/></li>
</ul>

</section>

<section name="todo">

## Items still to implement

- Table of Contents support
- More robust linking for linking
- Native support for android/iOS
- Tables
- Any other formatting tags we decide we want
- Syntax highlighting for code tags
- Naming and references of objects defined by FOAM tags to build more complete "applications"
- Additional markup formats like Markdown or Org mode
- PDF or other printable format rendering
- Online editing with split/alt view of markup vs rendered document.
- Online editing with a rich text editor

</section>
