/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'ColumnParserTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.ColumnParser'
  ],

  methods: [
    async function runTest(x) {
      // Create a test model with various property names, shortNames, and aliases
      foam.CLASS({
        package: 'foam.core.reflow.test',
        name: 'TestModel',
        properties: [
          { name: 'id' },
          { name: 'firstName', shortName: 'fn' },
          { name: 'lastName', aliases: ['surname', 'familyName'] },
          { name: 'elementAttribute' },
          { name: 'parentChildValue' },
          { name: 'level1Level2Level3Value' },
          { name: 'aBc' },
          { name: 'emailAddress', shortName: 'email', aliases: ['mail', 'e_mail'] },
          { name: 'PTest' },
          { name: 'camelCaseTest' }
        ]
      });

      var parser = this.ColumnParser.create({
        of: foam.core.reflow.test.TestModel
      });

      // ============================================
      // PATH 1: Direct Case-Insensitive Lookup
      // ============================================

      // 1.1 Exact property name match
      x.test(
        parser.parseString('firstName')?.name === 'firstName',
        'Direct: Exact match - firstName'
      );
      x.test(
        parser.parseString('id')?.name === 'id',
        'Direct: Exact match - id (short name)'
      );
      x.test(
        parser.parseString('elementAttribute')?.name === 'elementAttribute',
        'Direct: Exact match - elementAttribute (multi-word camelCase)'
      );

      // 1.2 Case variations (no normalization needed)
      x.test(
        parser.parseString('FIRSTNAME')?.name === 'firstName',
        'Direct: Case insensitive - FIRSTNAME'
      );
      x.test(
        parser.parseString('FirstName')?.name === 'firstName',
        'Direct: Case insensitive - FirstName (PascalCase)'
      );
      x.test(
        parser.parseString('firstname')?.name === 'firstName',
        'Direct: Case insensitive - firstname (lowercase)'
      );
      x.test(
        parser.parseString('CAMELCASETEST')?.name === 'camelCaseTest',
        'Direct: Case insensitive - CAMELCASETEST'
      );
      x.test(
        parser.parseString('ID')?.name === 'id',
        'Direct: Case insensitive - ID'
      );

      // 1.3 ShortName lookup
      x.test(
        parser.parseString('fn')?.name === 'firstName',
        'Direct: ShortName exact - fn'
      );
      x.test(
        parser.parseString('FN')?.name === 'firstName',
        'Direct: ShortName uppercase - FN'
      );
      x.test(
        parser.parseString('email')?.name === 'emailAddress',
        'Direct: ShortName exact - email'
      );
      x.test(
        parser.parseString('EMAIL')?.name === 'emailAddress',
        'Direct: ShortName uppercase - EMAIL'
      );

      // 1.4 Alias lookup
      x.test(
        parser.parseString('surname')?.name === 'lastName',
        'Direct: Alias exact - surname'
      );
      x.test(
        parser.parseString('SURNAME')?.name === 'lastName',
        'Direct: Alias uppercase - SURNAME'
      );
      x.test(
        parser.parseString('familyName')?.name === 'lastName',
        'Direct: Alias camelCase - familyName'
      );
      x.test(
        parser.parseString('FAMILYNAME')?.name === 'lastName',
        'Direct: Alias uppercase - FAMILYNAME'
      );
      x.test(
        parser.parseString('mail')?.name === 'emailAddress',
        'Direct: Alias exact - mail'
      );
      x.test(
        parser.parseString('e_mail')?.name === 'emailAddress',
        'Direct: Alias with underscore - e_mail'
      );
      x.test(
        parser.parseString('E_MAIL')?.name === 'emailAddress',
        'Direct: Alias with underscore uppercase - E_MAIL'
      );

      // ============================================
      // PATH 2: Normalized Lookup
      // ============================================

      // 2.1 Underscore → camelCase
      x.test(
        parser.parseString('first_name')?.name === 'firstName',
        'Normalized: Underscore lowercase - first_name'
      );
      x.test(
        parser.parseString('FIRST_NAME')?.name === 'firstName',
        'Normalized: CONSTANT_CASE - FIRST_NAME'
      );
      x.test(
        parser.parseString('First_Name')?.name === 'firstName',
        'Normalized: Mixed case underscore - First_Name'
      );
      x.test(
        parser.parseString('element_attribute')?.name === 'elementAttribute',
        'Normalized: Two words underscore - element_attribute'
      );
      x.test(
        parser.parseString('Element_attribute')?.name === 'elementAttribute',
        'Normalized: Mixed case - Element_attribute'
      );
      x.test(
        parser.parseString('ELEMENT_ATTRIBUTE')?.name === 'elementAttribute',
        'Normalized: CONSTANT_CASE - ELEMENT_ATTRIBUTE'
      );
      x.test(
        parser.parseString('parent_child_value')?.name === 'parentChildValue',
        'Normalized: Three words underscore - parent_child_value'
      );
      x.test(
        parser.parseString('Parent_Child_Value')?.name === 'parentChildValue',
        'Normalized: Mixed three words - Parent_Child_Value'
      );
      x.test(
        parser.parseString('PARENT_CHILD_VALUE')?.name === 'parentChildValue',
        'Normalized: CONSTANT_CASE three words - PARENT_CHILD_VALUE'
      );
      x.test(
        parser.parseString('level1_level2_level3_value')?.name === 'level1Level2Level3Value',
        'Normalized: With numbers - level1_level2_level3_value'
      );
      x.test(
        parser.parseString('LEVEL1_LEVEL2_LEVEL3_VALUE')?.name === 'level1Level2Level3Value',
        'Normalized: CONSTANT_CASE with numbers - LEVEL1_LEVEL2_LEVEL3_VALUE'
      );

      // 2.2 Space → camelCase
      x.test(
        parser.parseString('first name')?.name === 'firstName',
        'Normalized: Space lowercase - first name'
      );
      x.test(
        parser.parseString('FIRST NAME')?.name === 'firstName',
        'Normalized: Space uppercase - FIRST NAME'
      );
      x.test(
        parser.parseString('First Name')?.name === 'firstName',
        'Normalized: Title case space - First Name'
      );
      x.test(
        parser.parseString('element attribute')?.name === 'elementAttribute',
        'Normalized: Two words space - element attribute'
      );
      x.test(
        parser.parseString('ELEMENT ATTRIBUTE')?.name === 'elementAttribute',
        'Normalized: Uppercase two words space - ELEMENT ATTRIBUTE'
      );
      x.test(
        parser.parseString('parent child value')?.name === 'parentChildValue',
        'Normalized: Three words space - parent child value'
      );
      x.test(
        parser.parseString('PARENT CHILD VALUE')?.name === 'parentChildValue',
        'Normalized: Uppercase three words space - PARENT CHILD VALUE'
      );

      // 2.3 Short segments (aBc property)
      x.test(
        parser.parseString('A_B_c')?.name === 'aBc',
        'Normalized: Short segments mixed - A_B_c'
      );
      x.test(
        parser.parseString('a_b_c')?.name === 'aBc',
        'Normalized: Short segments lowercase - a_b_c'
      );
      x.test(
        parser.parseString('A_B_C')?.name === 'aBc',
        'Normalized: Short segments uppercase - A_B_C'
      );
      x.test(
        parser.parseString('a b c')?.name === 'aBc',
        'Normalized: Short segments space - a b c'
      );
      x.test(
        parser.parseString('A B C')?.name === 'aBc',
        'Normalized: Short segments space uppercase - A B C'
      );

      // ============================================
      // EDGE CASES
      // ============================================

      // 3.1 Whitespace handling
      x.test(
        parser.parseString('  firstName  ')?.name === 'firstName',
        'Edge: Leading/trailing spaces trimmed'
      );
      x.test(
        parser.parseString('first  name')?.name === 'firstName',
        'Edge: Multiple spaces between words'
      );
      x.test(
        parser.parseString('  FIRST_NAME  ')?.name === 'firstName',
        'Edge: Spaces around underscore format'
      );
      x.test(
        parser.parseString('  FIRST NAME  ')?.name === 'firstName',
        'Edge: Spaces around space format'
      );

      // 3.2 Underscore edge cases
      x.test(
        parser.parseString('_firstName')?.name === 'firstName',
        'Edge: Leading underscore - _firstName'
      );
      x.test(
        parser.parseString('firstName_')?.name === 'firstName',
        'Edge: Trailing underscore - firstName_'
      );
      x.test(
        parser.parseString('first__name')?.name === 'firstName',
        'Edge: Consecutive underscores - first__name'
      );
      x.test(
        parser.parseString('__first__name__')?.name === 'firstName',
        'Edge: Multiple edge underscores - __first__name__'
      );
      x.test(
        parser.parseString('_element_attribute_')?.name === 'elementAttribute',
        'Edge: Underscores around - _element_attribute_'
      );

      // 3.3 Non-matching / Invalid
      x.test(
        parser.parseString('nonExistent') === undefined,
        'Invalid: Non-existent property returns undefined'
      );
      x.test(
        parser.parseString('') === undefined,
        'Invalid: Empty string returns undefined'
      );
      x.test(
        parser.parseString('   ') === undefined,
        'Invalid: Only spaces returns undefined'
      );
      x.test(
        parser.parseString('___') === undefined,
        'Invalid: Only underscores returns undefined'
      );
      x.test(
        parser.parseString('random_property_name') === undefined,
        'Invalid: Random underscore name returns undefined'
      );

      // ============================================
      // COLUMN LIST PARSING
      // ============================================

      // 4.1 Basic lists
      var list1 = parser.parseString('firstName, lastName', 'columnList');
      x.test(
        list1?.length === 2 && list1[0]?.name === 'firstName' && list1[1]?.name === 'lastName',
        'List: Simple comma-separated - firstName, lastName'
      );

      var list2 = parser.parseString('firstName,lastName', 'columnList');
      x.test(
        list2?.length === 2 && list2[0]?.name === 'firstName' && list2[1]?.name === 'lastName',
        'List: No spaces - firstName,lastName'
      );

      var list3 = parser.parseString('  firstName  ,  lastName  ', 'columnList');
      x.test(
        list3?.length === 2 && list3[0]?.name === 'firstName' && list3[1]?.name === 'lastName',
        'List: Extra whitespace -   firstName  ,  lastName  '
      );

      // 4.2 Mixed format lists
      var list4 = parser.parseString('firstName, LAST_NAME, element_attribute', 'columnList');
      x.test(
        list4?.length === 3 &&
        list4[0]?.name === 'firstName' &&
        list4[1]?.name === 'lastName' &&
        list4[2]?.name === 'elementAttribute',
        'List: Mixed formats - firstName, LAST_NAME, element_attribute'
      );

      var list5 = parser.parseString('FIRST NAME, LAST NAME', 'columnList');
      x.test(
        list5?.length === 2 && list5[0]?.name === 'firstName' && list5[1]?.name === 'lastName',
        'List: Space-separated names - FIRST NAME, LAST NAME'
      );

      var list6 = parser.parseString('fn, surname, email', 'columnList');
      x.test(
        list6?.length === 3 &&
        list6[0]?.name === 'firstName' &&
        list6[1]?.name === 'lastName' &&
        list6[2]?.name === 'emailAddress',
        'List: ShortNames and aliases - fn, surname, email'
      );

      var list7 = parser.parseString('ID, FIRST_NAME, ELEMENT ATTRIBUTE, a_b_c', 'columnList');
      x.test(
        list7?.length === 4 &&
        list7[0]?.name === 'id' &&
        list7[1]?.name === 'firstName' &&
        list7[2]?.name === 'elementAttribute' &&
        list7[3]?.name === 'aBc',
        'List: All format variations - ID, FIRST_NAME, ELEMENT ATTRIBUTE, a_b_c'
      );

      // ============================================
      // normalizeToPropertyName DIRECT TESTS
      // ============================================

      x.test(
        parser.normalizeToPropertyName(null) === null,
        'Normalize: null returns null'
      );
      x.test(
        parser.normalizeToPropertyName('') === '',
        'Normalize: empty string returns empty'
      );
      x.test(
        parser.normalizeToPropertyName('SimpleValue') === 'simpleValue',
        'Normalize: No separator - SimpleValue → simpleValue'
      );
      x.test(
        parser.normalizeToPropertyName('Element_attribute') === 'elementAttribute',
        'Normalize: Basic underscore - Element_attribute → elementAttribute'
      );
      x.test(
        parser.normalizeToPropertyName('A_B_C') === 'aBC',
        'Normalize: Short parts - A_B_C → aBC'
      );
      x.test(
        parser.normalizeToPropertyName('FIRST NAME') === 'firstName',
        'Normalize: Space separator - FIRST NAME → firstName'
      );
      x.test(
        parser.normalizeToPropertyName('_leading') === 'leading',
        'Normalize: Leading underscore - _leading → leading'
      );
      x.test(
        parser.normalizeToPropertyName('trailing_') === 'trailing',
        'Normalize: Trailing underscore - trailing_ → trailing'
      );
      x.test(
        parser.normalizeToPropertyName('multi__under') === 'multiUnder',
        'Normalize: Consecutive underscores - multi__under → multiUnder'
      );
      x.test(
        parser.normalizeToPropertyName('  spaced  ') === 'spaced',
        'Normalize: Multiple spaces - "  spaced  " → spaced'
      );
      x.test(
        parser.normalizeToPropertyName('CONSTANT_CASE_VALUE') === 'constantCaseValue',
        'Normalize: CONSTANT_CASE - CONSTANT_CASE_VALUE → constantCaseValue'
      );
      x.test(
        parser.normalizeToPropertyName('Mixed_CASE_value') === 'mixedCaseValue',
        'Normalize: Mixed case - Mixed_CASE_value → mixedCaseValue'
      );

      // ============================================
      // SPECIAL CASES (PTest property)
      // ============================================

      x.test(
        parser.parseString('PTest')?.name === 'PTest',
        'Special: PTest exact match'
      );
      x.test(
        parser.parseString('ptest')?.name === 'PTest',
        'Special: ptest lowercase'
      );
      x.test(
        parser.parseString('PTEST')?.name === 'PTest',
        'Special: PTEST uppercase'
      );
      x.test(
        parser.parseString('p_test')?.name === 'PTest',
        'Special: p_test underscore normalized'
      );
      x.test(
        parser.parseString('P_TEST')?.name === 'PTest',
        'Special: P_TEST CONSTANT_CASE'
      );
      x.test(
        parser.parseString('p test')?.name === 'PTest',
        'Special: p test space separated'
      );
      x.test(
        parser.parseString('P TEST')?.name === 'PTest',
        'Special: P TEST space uppercase'
      );

      // ============================================
      // NON-STANDARD PROPERTY NAMES (coder mistakes)
      // Tests that normalization works on BOTH sides
      // ============================================

      // Create a model with non-standard property names (underscore format)
      foam.CLASS({
        package: 'foam.core.reflow.test',
        name: 'NonStandardModel',
        properties: [
          { name: 'user_name' },  // Should be userName - coder mistake
          { name: 'account_balance' },  // Should be accountBalance - coder mistake
          { name: 'CONSTANT_STYLE' },  // CONSTANT_CASE property name
          { name: 'Mixed_Style_Name' },  // Mixed style
          { name: 'normalProp', aliases: ['normal_alias', 'CONSTANT_ALIAS', 'Mixed_Alias'] },
          { name: 'anotherProp', shortName: 'short_name' }  // ShortName with underscore
        ]
      });

      var parser2 = this.ColumnParser.create({
        of: foam.core.reflow.test.NonStandardModel
      });

      // 5.1 Property with underscore name - various input formats
      x.test(
        parser2.parseString('user_name')?.name === 'user_name',
        'NonStandard: Exact match underscore property - user_name'
      );
      x.test(
        parser2.parseString('USER_NAME')?.name === 'user_name',
        'NonStandard: CONSTANT_CASE input for underscore property - USER_NAME'
      );
      x.test(
        parser2.parseString('userName')?.name === 'user_name',
        'NonStandard: camelCase input for underscore property - userName'
      );
      x.test(
        parser2.parseString('UserName')?.name === 'user_name',
        'NonStandard: PascalCase input for underscore property - UserName'
      );
      x.test(
        parser2.parseString('user name')?.name === 'user_name',
        'NonStandard: Space input for underscore property - user name'
      );
      x.test(
        parser2.parseString('USER NAME')?.name === 'user_name',
        'NonStandard: Space uppercase input for underscore property - USER NAME'
      );

      // 5.2 Multi-word underscore property
      x.test(
        parser2.parseString('account_balance')?.name === 'account_balance',
        'NonStandard: Exact match - account_balance'
      );
      x.test(
        parser2.parseString('accountBalance')?.name === 'account_balance',
        'NonStandard: camelCase input - accountBalance'
      );
      x.test(
        parser2.parseString('ACCOUNT_BALANCE')?.name === 'account_balance',
        'NonStandard: CONSTANT_CASE input - ACCOUNT_BALANCE'
      );
      x.test(
        parser2.parseString('account balance')?.name === 'account_balance',
        'NonStandard: Space input - account balance'
      );

      // 5.3 CONSTANT_CASE property name
      x.test(
        parser2.parseString('CONSTANT_STYLE')?.name === 'CONSTANT_STYLE',
        'NonStandard: Exact match CONSTANT property - CONSTANT_STYLE'
      );
      x.test(
        parser2.parseString('constantStyle')?.name === 'CONSTANT_STYLE',
        'NonStandard: camelCase input for CONSTANT property - constantStyle'
      );
      x.test(
        parser2.parseString('constant_style')?.name === 'CONSTANT_STYLE',
        'NonStandard: lowercase underscore input - constant_style'
      );
      x.test(
        parser2.parseString('CONSTANT STYLE')?.name === 'CONSTANT_STYLE',
        'NonStandard: Space uppercase input - CONSTANT STYLE'
      );

      // 5.4 Mixed style property name
      x.test(
        parser2.parseString('Mixed_Style_Name')?.name === 'Mixed_Style_Name',
        'NonStandard: Exact match mixed style - Mixed_Style_Name'
      );
      x.test(
        parser2.parseString('mixedStyleName')?.name === 'Mixed_Style_Name',
        'NonStandard: camelCase input for mixed style - mixedStyleName'
      );
      x.test(
        parser2.parseString('MIXED_STYLE_NAME')?.name === 'Mixed_Style_Name',
        'NonStandard: CONSTANT_CASE input for mixed style - MIXED_STYLE_NAME'
      );

      // 5.5 Aliases with underscores
      x.test(
        parser2.parseString('normal_alias')?.name === 'normalProp',
        'NonStandard: Alias with underscore exact - normal_alias'
      );
      x.test(
        parser2.parseString('normalAlias')?.name === 'normalProp',
        'NonStandard: camelCase input for underscore alias - normalAlias'
      );
      x.test(
        parser2.parseString('NORMAL_ALIAS')?.name === 'normalProp',
        'NonStandard: CONSTANT_CASE input for underscore alias - NORMAL_ALIAS'
      );
      x.test(
        parser2.parseString('normal alias')?.name === 'normalProp',
        'NonStandard: Space input for underscore alias - normal alias'
      );

      // 5.6 CONSTANT_CASE alias
      x.test(
        parser2.parseString('CONSTANT_ALIAS')?.name === 'normalProp',
        'NonStandard: CONSTANT_CASE alias exact - CONSTANT_ALIAS'
      );
      x.test(
        parser2.parseString('constantAlias')?.name === 'normalProp',
        'NonStandard: camelCase input for CONSTANT alias - constantAlias'
      );
      x.test(
        parser2.parseString('constant_alias')?.name === 'normalProp',
        'NonStandard: lowercase underscore input for CONSTANT alias - constant_alias'
      );

      // 5.7 Mixed style alias
      x.test(
        parser2.parseString('Mixed_Alias')?.name === 'normalProp',
        'NonStandard: Mixed style alias exact - Mixed_Alias'
      );
      x.test(
        parser2.parseString('mixedAlias')?.name === 'normalProp',
        'NonStandard: camelCase input for mixed alias - mixedAlias'
      );
      x.test(
        parser2.parseString('MIXED_ALIAS')?.name === 'normalProp',
        'NonStandard: CONSTANT_CASE input for mixed alias - MIXED_ALIAS'
      );

      // 5.8 ShortName with underscore
      x.test(
        parser2.parseString('short_name')?.name === 'anotherProp',
        'NonStandard: ShortName with underscore exact - short_name'
      );
      x.test(
        parser2.parseString('shortName')?.name === 'anotherProp',
        'NonStandard: camelCase input for underscore shortName - shortName'
      );
      x.test(
        parser2.parseString('SHORT_NAME')?.name === 'anotherProp',
        'NonStandard: CONSTANT_CASE input for underscore shortName - SHORT_NAME'
      );
      x.test(
        parser2.parseString('short name')?.name === 'anotherProp',
        'NonStandard: Space input for underscore shortName - short name'
      );

      // 5.9 Column list with non-standard properties
      var list8 = parser2.parseString('userName, ACCOUNT_BALANCE, constantStyle', 'columnList');
      x.test(
        list8?.length === 3 &&
        list8[0]?.name === 'user_name' &&
        list8[1]?.name === 'account_balance' &&
        list8[2]?.name === 'CONSTANT_STYLE',
        'NonStandard List: Mixed input formats for non-standard properties'
      );

      // ============================================
      // EXACT MATCH PRIORITY TESTS
      // Tests that exact aliases take priority over normalized matches
      // This prevents collision when headers normalize to same value
      // ============================================

      // Create model with properties that would collide after normalization
      // e.g., StartDate and Start_date both normalize to startDate
      foam.CLASS({
        package: 'foam.core.reflow.test',
        name: 'CollisionModel',
        properties: [
          {
            name: 'startDate',
            aliases: ['StartDate', 'start_date']
          },
          {
            name: 'startAttrDate',
            aliases: ['Start_date']
          },
          {
            name: 'endDate',
            aliases: ['EndDate', 'end_date']
          },
          {
            name: 'endAttrDate',
            aliases: ['End_date']
          },
          {
            name: 'createdDate',
            aliases: ['CreatedDate']
          },
          {
            name: 'createdAttrDate',
            aliases: ['Created_date']
          }
        ]
      });

      var parser3 = this.ColumnParser.create({
        of: foam.core.reflow.test.CollisionModel
      });

      // 6.1 Exact alias match takes priority
      x.test(
        parser3.parseString('StartDate')?.name === 'startDate',
        'ExactPriority: StartDate matches startDate via exact alias'
      );
      x.test(
        parser3.parseString('Start_date')?.name === 'startAttrDate',
        'ExactPriority: Start_date matches startAttrDate via exact alias'
      );

      // 6.2 Case insensitive exact match
      x.test(
        parser3.parseString('startdate')?.name === 'startDate',
        'ExactPriority: startdate (lowercase) matches startDate'
      );
      x.test(
        parser3.parseString('start_date')?.name === 'startAttrDate',
        'ExactPriority: start_date (lowercase) matches startAttrDate'
      );
      x.test(
        parser3.parseString('STARTDATE')?.name === 'startDate',
        'ExactPriority: STARTDATE (uppercase) matches startDate'
      );
      x.test(
        parser3.parseString('START_DATE')?.name === 'startAttrDate',
        'ExactPriority: START_DATE (uppercase) matches startAttrDate'
      );

      // 6.3 Another collision pair - EndDate vs End_date
      x.test(
        parser3.parseString('EndDate')?.name === 'endDate',
        'ExactPriority: EndDate matches endDate via exact alias'
      );
      x.test(
        parser3.parseString('End_date')?.name === 'endAttrDate',
        'ExactPriority: End_date matches endAttrDate via exact alias'
      );
      x.test(
        parser3.parseString('enddate')?.name === 'endDate',
        'ExactPriority: enddate (lowercase) matches endDate'
      );
      x.test(
        parser3.parseString('end_date')?.name === 'endAttrDate',
        'ExactPriority: end_date (lowercase) matches endAttrDate'
      );

      // 6.4 Third collision pair - CreatedDate vs Created_date
      x.test(
        parser3.parseString('CreatedDate')?.name === 'createdDate',
        'ExactPriority: CreatedDate matches createdDate via exact alias'
      );
      x.test(
        parser3.parseString('Created_date')?.name === 'createdAttrDate',
        'ExactPriority: Created_date matches createdAttrDate via exact alias'
      );

      // 6.5 Normalized fallback still works when no exact match
      x.test(
        parser3.parseString('START DATE')?.name === 'startDate',
        'ExactPriority: START DATE falls back to normalized match for startDate'
      );

      // 6.6 Column list with collision-prone headers
      var list9 = parser3.parseString('StartDate, Start_date, EndDate, End_date', 'columnList');
      x.test(
        list9?.length === 4 &&
        list9[0]?.name === 'startDate' &&
        list9[1]?.name === 'startAttrDate' &&
        list9[2]?.name === 'endDate' &&
        list9[3]?.name === 'endAttrDate',
        'ExactPriority List: All collision-prone headers match correctly'
      );

      // 6.7 Mixed case in list
      var list10 = parser3.parseString('startdate, start_date', 'columnList');
      x.test(
        list10?.length === 2 &&
        list10[0]?.name === 'startDate' &&
        list10[1]?.name === 'startAttrDate',
        'ExactPriority List: Lowercase collision headers match correctly'
      );
    }
  ]
});
