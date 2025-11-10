/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'CSSTokens',
  documentation: 'Provides defaults tokens for styling FObjects, should be replaced in ctx or refined',

  /**
   * TODO:
   * Use the color generator to create these
  */
  cssTokens: [
    { name: 'blue50', value: '#D7E4FF' },
    { name: 'blue100', value: '#96B8F9' },
    { name: 'blue200', value: '#6795EE' },
    { name: 'blue300', value: '#366EDC' },
    { name: 'blue400', value: '#0A4AC6' },
    { name: 'blue500', value: '#04338D' },
    { name: 'blue600', value: '#022568' },
    { name: 'blue700', value: '#011B4E' },

    { name: 'yellow100', value: '#FFF3BF' },
    { name: 'yellow200', value: '#FFEFAC' },
    { name: 'yellow300', value: '#F9E48B' },
    { name: 'yellow400', value: '#F5DB6B' },
    { name: 'yellow500', value: '#DCC252' },
    { name: 'yellow600', value: '#BF9C06' },
    { name: 'yellow700', value: '#846B02' },
    { name: 'yellow50', value: '#FFFCEC' },

    { name: 'orange50', value: '#FFEEE2' },
    { name: 'orange100', value: '#FFC499' },
    { name: 'orange200', value: '#F9A264' },
    { name: 'orange300', value: '#F79651' },
    { name: 'orange400', value: '#FC7F27' },
    { name: 'orange500', value: '#EC6D14' },
    { name: 'orange600', value: '#B04A01' },
    { name: 'orange700', value: '#773100' },

    { name: 'purple50', value: '#F5EEFF' },
    { name: 'purple100', value: '#CEAFF6' },
    { name: 'purple200', value: '#B98AF5' },
    { name: 'purple300', value: '#9863DD' },
    { name: 'purple400', value: '#8843DF' },
    { name: 'purple500', value: '#702AC8' },
    { name: 'purple600', value: '#4D1299' },
    { name: 'purple700', value: '#2B0061' },

    { name: 'green50', value: '#E8FFED' },
    { name: 'green100', value: '#9AECAC' },
    { name: 'green200', value: '#77D98D' },
    { name: 'green300', value: '#59D374' },
    { name: 'green400', value: '#34CF56' },
    { name: 'green500', value: '#06A92A' },
    { name: 'green600', value: '#02801D' },
    { name: 'green700', value: '#005112' },

    { name: 'red50', value: '#FFEFF0' },
    { name: 'red100', value: '#FA9095' },
    { name: 'red200', value: '#F05B63' },
    { name: 'red300', value: '#E93F48' },
    { name: 'red400', value: '#E11721' },
    { name: 'red500', value: '#C40610' },
    { name: 'red600', value: '#96060D' },
    { name: 'red700', value: '#650005' },

    { name: 'grey50', value: '#F5F7FA' },
    { name: 'grey100', value: '#F0F2F5' },
    { name: 'grey200', value: '#E0E2E5' },
    { name: 'grey300', value: '#DADDE2' },
    { name: 'grey400', value: '#B2B6BD' },
    { name: 'grey500', value: '#6B778C' },
    { name: 'grey600', value: '#4B5768' },
    { name: 'grey700', value: '#494F59' },

    { name: 'warmGrey50', value: '#FBF9F6' },
    { name: 'warmGrey100', value: '#EDEAE5' },
    { name: 'warmGrey200', value: '#E7E4DF' },
    { name: 'warmGrey300', value: '#D1CDC5' },
    { name: 'warmGrey400', value: '#B1AEA7' },
    { name: 'warmGrey500', value: '#969289' },
    { name: 'warmGrey600', value: '#747067' },
    { name: 'warmGrey700', value: '#545048' },

    { name: 'black50', value: '#373737' },
    { name: 'black100', value: '#292929' },
    { name: 'black200', value: '#202020' },
    { name: 'black300', value: '#1B1B1B' },
    { name: 'black400', value: '#1C1C1C' },
    { name: 'black500', value: '#0F0F0F' },
    { name: 'black600', value: '#0C0C0C' },
    { name: 'black700', value: '#0D0D0D' },

    { name: 'primary50', value: '$blue50' },
    { name: 'primary100', value: '$blue100' },
    { name: 'primary200', value: '$blue200' },
    { name: 'primary300', value: '$blue300' },
    { name: 'primary400', value: '$blue400' },
    { name: 'primary500', value: '$blue500' },
    { name: 'primary600', value: '$blue600' },
    { name: 'primary700', value: '$blue700' },

    { name: 'destructive50', value: '$red50' },
    { name: 'destructive100', value: '$red100' },
    { name: 'destructive200', value: '$red200' },
    { name: 'destructive300', value: '$red300' },
    { name: 'destructive400', value: '$red400' },
    { name: 'destructive500', value: '$red500' },
    { name: 'destructive600', value: '$red600' },
    { name: 'destructive700', value: '$red700' },

    { name: 'success50', value: '$green50' },
    { name: 'success100', value: '$green100' },
    { name: 'success200', value: '$green200' },
    { name: 'success300', value: '$green300' },
    { name: 'success400', value: '$green400' },
    { name: 'success500', value: '$green500' },
    { name: 'success600', value: '$green600' },
    { name: 'success700', value: '$green700' },

    { name: 'warn50', value: '$yellow50' },
    { name: 'warn100', value: '$yellow100' },
    { name: 'warn200', value: '$yellow200' },
    { name: 'warn300', value: '$yellow300' },
    { name: 'warn400', value: '$yellow400' },
    { name: 'warn500', value: '$yellow500' },
    { name: 'warn600', value: '$yellow600' },
    { name: 'warn700', value: '$yellow700' },

    { name: 'white', value: '#FFFFFF' },
    { name: 'black', value: '#000000' },

    { name: 'destructive', value: '#E11721' },
    { name: 'info', value: '#FC7F27' },
    { name: 'warn', value: '#F5DB6B' },
    { name: 'success', value: '#34CF56' },

    // SEMANTIC TOKENS
    // For semantic tokens we use the term brand instead of primary for two reasons: 
    // 1. Default, secondary, and tertiary are three variations of the semantic tokens so primary might cause confusion
    // 2. When theme semantic tokens are overriden, brand colour might be a mix of various random tokens that might be set up so "brand" offers a consistent easy to understand name

    // BG
    { name: 'backgroundDefault', value: '$white', variants: { dark: { value: '$black500' } } },
    { name: 'backgroundSecondary', value: '$grey50', variants: { dark: { value: '$black100' } } },
    { name: 'backgroundTertiary', value: '$grey100', variants: { dark: { value: '$black200' } } },
    { name: 'backgroundHover', value: '$backgroundTertiary' },

    { name: 'backgroundBrand', value: '$primary400' },
    { name: 'backgroundBrandSecondary', value: '$primary600', variants: { dark: { value: '$primary200' } } },
    { name: 'backgroundBrandTertiary', value: '$primary50', variants: { dark: { value: '$primary700' } } },

    { name: 'backgroundInverse', value: '$black700', variants: { dark: { value: '$grey50' } } },
    { name: 'backgroundInverseSecondary', value: '$grey500', variants: { dark: { value: '$grey200' } } },
    { name: 'backgroundInverseTertiary', value: '$grey400', variants: { dark: { value: '$black300' } } },

    { name: 'backgroundDestructive', value: '$destructive400' },
    { name: 'backgroundDestructiveSecondary', value: '$destructive500' },
    { name: 'backgroundDestructiveTertiary', value: '$destructive50' },

    // TEXT
    { name: 'textDefault', value: '$black', variants: { dark: { value: '$grey100' } } },
    { name: 'textSecondary', value: '$grey700', variants: { dark: { value: '$grey200' } } },
    { name: 'textTertiary', value: '$grey500',variants: { dark: { value: '$grey400' } } },
    { name: 'dropdownIcon', value: 'currentColor'},

    { name: 'textBrand', value: '$primary400' },
    { name: 'textBrandSecondary', value: '$primary700', variants: { dark: { value: '$primary50' } } },
    { name: 'textBrandTertiary', value: '$primary50', variants: { dark: { value: '$primary500' } } },

    { name: 'textDestructive', value: '$destructive400' },

    { name: 'textOnBrand', value: '$white' },

    { name: 'textOnInverse', value: '$white', variants: { dark: { value: '$black' } } },

    { name: 'textOnDestructive', value: '$white' },

    { name: 'link', value: '$blue200' },

    // BORDER COLOR
    { name: 'borderXLight', value: '$grey50', variants: { dark: { value: '$black400' } } },
    { name: 'borderLight', value: '$grey200', variants: { dark: { value: '$black300' } } },
    { name: 'borderDefault', value: '$grey400', variants: { dark: { value: '$black100' } } },
    { name: 'borderStrong', value: '$grey700', variants: { dark: { value: '$grey500' } } },

    { name: 'borderBrandXLight', value: '$primary50', variants: { dark: { value: '$primary700' } } },
    { name: 'borderBrandLight', value: '$primary100', variants: { dark: { value: '$primary400' } } },
    { name: 'borderBrand', value: '$primary400', variants: { dark: { value: '$primary200' } } },
    { name: 'borderBrandStrong', value: '$primary700', variants: { dark: { value: '$primary100' } } }
  ].map(v => { v.class = 'foam.u2.ColorToken'; return v; }) // Add corresponding ColorToken classes for each token
    // Concat additional tokens that are not ColorTokens
  .concat([
    // GENERAL STYLE TOKENS
    { name: 'inputHeight', value: '34px' },
    { name: 'inputHorizontalPadding', value: '8px' },
    { name: 'inputVerticalPadding', value: '8px' },
    { name: 'inputBorderRadius', value: '4px' },

    // FONT
    { name: 'font1', value: `'Source Sans Pro', sans-serif` },
    { name: 'font-extra-light', value: '200' }, /* also 100 */
    { name: 'font-light', value: '300' },
    { name: 'font-normal', value: 'normal' }, /* 400 */
    { name: 'font-regular', value: '500' },
    { name: 'font-medium', value: '600' },
    { name: 'font-semi-bold', value: '700' },
    { name: 'font-bold', value: '800' },
    { name: 'font-extra-bold', value: '900' },

    { name: 'header-xl', value: '3.5rem' },
    { name: 'header-lg', value: '3rem' },
    { name: 'header-md', value: '2.4rem' },
    { name: 'header-sm', value: '2rem' },
    { name: 'header-xs', value: '1.6rem' },
    { name: 'header-xxs', value: '1.4rem' },
    { name: 'header-xxxs', value: '1.2rem' }
  ])
});
