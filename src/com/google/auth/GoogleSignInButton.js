/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'com.google.auth',
  name: 'GoogleSignInButton',
  extends: "foam.u2.Element",
  css: `
  <<{
    display: grid;
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, .25);
    margin: 0 2px 4px 0;
    color: #757575;
    grid-template-columns: 36px 1fr;
    place-items: center;
    background: white;
    height: 36px;
    width: 120px;
  }
  
  <<:active {
    background: #eee;
  }
  
  <<icon {
  }
  
  <<text {
    font-family: Roboto, arial, sans-serif;
    font-size: 14px;
    font-weight: $font-regular;
  }
  `,
  methods: [
    function render() {
      this
        .addClass()
        .start('img')
        .addClass(this.myClass('icon'))
        .attrs({ src: '/images/google.svg' })
        .end()
        .start('span')
        .addClass(this.myClass('text'))
        .add('Sign in')
        .end()
    }
  ]
});
