/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.controller',
  name: 'AppStyles',
  extends: 'foam.u2.View',

  documentation: 'Generic CSS that can be included into the top level controller of foam app. Implement to foam class to use.',

  css: `
    :root{
      --max-height: calc(100vh - env(safe-area-inset-top, 0) - env(safe-area-inset-bottom, 0));
    }

    body {
      margin: 0;
      padding-top: env(safe-area-inset-top, 0);
      padding-right: env(safe-area-inset-right, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
      padding-left: env(safe-area-inset-left, 0);
      overscroll-behavior-y: none;
    }

    blockquote{
      border-left-color: $borderDefault;
      border-left-style: solid;
      margin: 0;
      margin-left: 2ch;
      padding-left: 1ch;
    }

    /* SHADOWS */
    .base-shadow {
      box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
    } 

    .md-shadow {
      box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.06), 0px 4px 6px rgba(0, 0, 0, 0.1);
    }

    .lg-shadow {
      box-shadow: 0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05);
    }

    .xl-shadow {
      box-shadow: 0px 20px 25px rgba(0, 0, 0, 0.1), 0px 10px 10px rgba(0, 0, 0, 0.04);
    }

    .2xl-shadow {
      box-shadow: 0px 25px 50px rgba(0, 0, 0, 0.25);
    }

    .inner-shadow {
      box-shadow: inset 0px 2px 4px rgba(0, 0, 0, 0.06);
    }

    .New {
      width: 35px;
      height: 20px;
      border-radius: 100px;
      background-color: $yellow400;
    }
    .Updated {
      width: 60px;
      height: 20px;
      border-radius: 100px;
      background-color: $backgroundInverse;
    }
    .Open {
      width: 49px;
      height: 20px;
      border-radius: 100px;
      background-color: $red200;
    }
    .Pending {
      width: 55px;
      height: 20px;
      border-radius: 100px;
      background-color: $blue100;
    }
    .Solved {
      width: 50px;
      height: 20px;
      border-radius: 100px;
      background-color: $grey400;
    }
    textarea:focus{
      outline: none;
    }
    input:focus{
      outline: none;
    }
    .horizontal-flip {
    -moz-transform: scale(-1, 1);
    -webkit-transform: scale(-1, 1);
    -o-transform: scale(-1, 1);
    -ms-transform: scale(-1, 1);
    transform: scale(-1, 1);
    margin-right: 10px;
  }
  .inline-block {
    display: inline-block;
  }

  /* Box sizing rules */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* Remove list styles on ul, ol elements with a list role, which suggests default styling will be removed */
  ul[role='list'],
  ol[role='list'] {
    list-style: none;
  }

  /* Set core root defaults */
  html:focus-within {
    scroll-behavior: smooth;
  }

  /* Set core body defaults */
  body {
    min-height: var(--max-height, 100vh);
    min-height: -webkit-fill-available;
    line-height: 1.5;
  }

  /* A elements that don't have a class get default styles */
  a:not([class]) {
    text-decoration-skip-ink: auto;
  }

  /* Make images easier to work with */
  img,
  picture {
    max-width: 100%;
    display: block;
  }

  /* Remove all animations, transitions and smooth scroll for people that prefer not to see them */
  @media (prefers-reduced-motion: reduce) {
    html:focus-within {
      scroll-behavior: auto;
    }
    
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  .flexCenter {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* safari svg foreignObject support: need to use static positioning */
  .safari-svg-pos-support {
    position: static !important;
  }
  `
});
