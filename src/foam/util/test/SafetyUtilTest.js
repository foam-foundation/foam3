/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'SafetyUtilTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.User',
    'foam.util.SafetyUtil',
  ],
  documentation: 'test utility functions',

  methods: [
    {
    name: 'runTest',
    javaCode: `
      SafetyUtilTest_equalsIgnoreCase();
      SafetyUtilTest_compare_primitive_array();
      SafetyUtilTest_compare_object_array();
      SafetyUtilTest_compare_fobject_array();
    `,
    },
    {
      name: 'SafetyUtilTest_equalsIgnoreCase',
      javaCode: `
        String message = "Strings are euqal -- ignores case";
        String s1 = "abc";
        String s2 = "aBc";
        String s3 = "AbCdEfGh";
        String s4 = "abcdEFGH";
        String s5 = "123456aabb";
        String s6 = "123456AABB";
        String s7 = "12AbCdEfGh34";
        String s8 = "12abcdEFGH34";
        String s9 = "AbCd1122EfGh";
        String s10 = "abcd1122EFGH";
        String s11 = "notEqual";
        String s12 = "NOT_EQUAL";
        String empty = "";
        String nptr = null;
        test( SafetyUtil.equalsIgnoreCase( s1, s2 ), message );
        test( SafetyUtil.equalsIgnoreCase( s3, s4 ), message );
        test( SafetyUtil.equalsIgnoreCase( s5, s6 ), message );
        test( SafetyUtil.equalsIgnoreCase( s7, s8 ), message );
        test( SafetyUtil.equalsIgnoreCase( s9, s10 ), message );
        test( !SafetyUtil.equalsIgnoreCase( s11, s12 ), "Not equal -- different string" );
        test( !SafetyUtil.equalsIgnoreCase( empty, s11 ), "Not equal -- empty string" );
        test( !SafetyUtil.equalsIgnoreCase( s1, empty ), "Not equal -- empty string" );
        test( SafetyUtil.equalsIgnoreCase( empty, empty ), "Equal -- both empty string" );
        test( SafetyUtil.equalsIgnoreCase( nptr, nptr ), "Equal -- both null" );
        test( !SafetyUtil.equalsIgnoreCase( empty, nptr ), "Not equal -- empty string and null" );
        test( !SafetyUtil.equalsIgnoreCase( nptr, empty ), "Not equal -- empty string and null" );
        test( !SafetyUtil.equalsIgnoreCase( nptr, s8 ), "Not equal -- empty string and string" );
      `
    },
    {
      name: 'SafetyUtilTest_compare_primitive_array',
      javaCode: `
        Object arr1 = new int[] { 1,2,3,4,5 };
        Object arr2 = new int[] { 1,2,3,4,5 };
        Object arr3 = new int[] { 1,2,3,4,5,6 };

        test(SafetyUtil.compare(arr1, arr2) ==  0, "Compare primitive array, arr1 == arr2");
        test(SafetyUtil.compare(arr1, arr3) == -1, "Compare primitive array, arr1 < arr3");
        test(SafetyUtil.compare(arr3, arr2) ==  1, "Compare primitive array, arr3 > arr2");
      `
    },
    {
      name: 'SafetyUtilTest_compare_object_array',
      javaCode: `
        Object arr1 = new Integer[] { 1,2,3,4,5 };
        Object arr2 = new Integer[] { 1,2,3,4,5 };
        Object arr3 = new Integer[] { 1,2,3,4,5,6 };

        test(SafetyUtil.compare(arr1, arr2) ==  0, "Compare object array, arr1 == arr2");
        test(SafetyUtil.compare(arr1, arr3) == -1, "Compare object array, arr1 < arr3");
        test(SafetyUtil.compare(arr3, arr2) ==  1, "Compare object array, arr3 > arr2");
      `
    },
    {
      name: 'SafetyUtilTest_compare_fobject_array',
      javaCode: `
        var u1 = new User(); u1.setId(1);
        var u2 = new User(); u2.setId(2);
        var u3 = new User(); u3.setId(3);

        Object arr1 = new Object[] { u1, u2 };
        Object arr2 = new Object[] { u1, u2 };
        Object arr3 = new Object[] { u1, u2, u3 };

        test(SafetyUtil.compare(arr1, arr2) ==  0, "Compare fobject array, arr1 == arr2");
        test(SafetyUtil.compare(arr1, arr3) == -1, "Compare fobject array, arr1 < arr3");
        test(SafetyUtil.compare(arr3, arr2) ==  1, "Compare fobject array, arr3 > arr2");
      `
    }
  ]
});
