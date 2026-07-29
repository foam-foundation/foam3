/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.konvajs',
    name: 'EmailParserDemoView',
    extends: 'org.konvajs.ParserDemoView',

    documentation: 'Email address parser demo with labelled and simple address support',

    properties: [
        {
            class: 'String',
            name: 'grammarCode',
            factory: function () {
                return `// Email Address Parser Grammar
// Supports: john@email.com or John Doe <john@email.com>
{
  START: sym('address'),

  addressList: repeat(sym('address'), seq(',', repeat(' '))),

  address: alt(sym('labelledAddress'), sym('simpleAddress')),

  labelledAddress: seq(repeat(notChars('<,')), '<', sym('simpleAddress'), '>'),

  simpleAddress: seq(repeat(notChars('@')), '@', repeat(notChars('\\r>,'))),
}`;
            }
        },
        {
            class: 'String',
            name: 'grammarActions',
            factory: function () {
                return `// Email Parser Semantic Actions
{
  labelledAddressAction: function(v) { 
    return { 
      type: 'LabelledEmail', 
      label: v[0].join('').trim(), 
      email: v[2] 
    }; 
  },

  simpleAddressAction: function(v) { 
    return { 
      type: 'SimpleEmail', 
      email: v[0].join('') + v[1] + v[2].join('') 
    }; 
  }
}`;
            }
        },
        {
            class: 'String',
            name: 'inputText',
            factory: function () { return 'John Doe <john@email.com>'; }
        },
        {
            name: 'demoTitle',
            value: 'Email Address Parser'
        },
        {
            // Whitespace is significant here: stripping it would collapse the
            // label to 'JohnDoe' and permanently break addressList's
            // repeat(' ') separator.
            name: 'stripWhitespace',
            value: false
        }
    ]
});
