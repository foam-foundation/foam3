/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.konvajs',
    name: 'ParserDemos',
    extends: 'foam.u2.Controller',

    documentation: 'Top-level menu for Parser Demos',

    requires: [
        'foam.u2.borders.CardBorder',
        'org.konvajs.ParserDemoView',
        'org.konvajs.EmailParserDemoView'
    ],

    css: `
        ^ {
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: 'Inter', system-ui, sans-serif;
            background: #f5f7fa;
        }
        ^header {
            background: #fff;
            border-bottom: 2px solid #e1e4e8;
            padding: 20px 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        ^header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
        }
        ^nav {
            display: flex;
            gap: 12px;
            margin-top: 16px;
        }
        ^nav-btn {
            padding: 10px 20px;
            background: #fff;
            border: 2px solid #e1e4e8;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            color: #24292e;
            transition: all 0.2s;
        }
        ^nav-btn:hover {
            background: #f6f8fa;
            border-color: #0366d6;
            color: #0366d6;
        }
        ^nav-btn-active {
            background: #0366d6;
            border-color: #0366d6;
            color: #fff;
        }
        ^content {
            flex: 1;
            overflow: hidden;
        }
    `,

    properties: [
        {
            class: 'String',
            name: 'currentDemo',
            value: 'expression',
            postSet: function (_, n) {
                this.loadDemo(n);
            }
        },
        {
            name: 'currentView',
            documentation: 'Currently displayed demo view'
        }
    ],

    methods: [
        function render() {
            this.SUPER();
            var self = this;

            this.addClass()
                .start().addClass(this.myClass('header'))
                .start('h1').add('FOAM Parser Visualizer').end()
                .start().addClass(this.myClass('nav'))
                .start('button')
                .addClass(this.myClass('nav-btn'))
                .enableClass(this.myClass('nav-btn-active'), this.currentDemo$.map(d => d === 'expression'))
                .add('Expression Parser')
                .on('click', () => self.currentDemo = 'expression')
                .end()
                .start('button')
                .addClass(this.myClass('nav-btn'))
                .enableClass(this.myClass('nav-btn-active'), this.currentDemo$.map(d => d === 'email'))
                .add('Email Parser')
                .on('click', () => self.currentDemo = 'email')
                .end()
                .end()
                .end()
                .start().addClass(this.myClass('content'))
                .add(this.slot(function (currentView) {
                    return currentView || this.E('div').add('Loading...');
                }))
                .end();

            this.loadDemo(this.currentDemo);
        },

        function loadDemo(type) {
            if (this.currentView) {
                this.currentView.remove();
            }

            // Created in this view's context so their own requires and
            // imports resolve against the application, not the global context.
            switch (type) {
                case 'expression':
                    this.currentView = this.ParserDemoView.create(null, this);
                    break;
                case 'email':
                    this.currentView = this.EmailParserDemoView.create(null, this);
                    break;
            }
        }
    ]
});
