/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "json",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "JSONParser",                                         flags: "js|java" },
    { name: "OutputterMode",                                      flags: "js|java" },
    { name: "ClassReferenceParserTest",                           flags: "js&test|java&test" },
    { name: "DateParserTest",                                     flags: "js&test|java&test" },
    { name: "PropertyReferenceParserTest",                        flags: "js&test|java&test" },
    { name: "UnknownFObject",                                     flags: "js|java" },
    { name: "OutputJSON",                                         flags: "js|java" },
    { name: "UnknownFObjectArray",                                flags: "js|java" },
    { name: "test/FObjectParserJavaTest",                         flags: "js&test|java&test" },
    { name: "test/ParserOptimizationTest",                        flags: "js&test|java&test" },
    { name: "test/JSONDateParserTest",                            flags: "js&test|java&test" },
    { name: "StringToStringArrayParserTest",                      flags: "js&test|java&test" },
    { name: "RawMapParserTest",                                   flags: "js&test|java&test" },
    { name: "UnknownFObjectParserTest",                           flags: "js&test|java&test" },
    { name: "JSONParserReentrancyTest",                           flags: "js&test|java&test" },
  ],

  javaFiles: [
    { name: "PropertyReferenceParser" },
    { name: "BooleanParser" },
    { name: "DoubleParser" },
    { name: "Outputter" },
    { name: "CommentParser" },
    { name: "ListParser" },
    { name: "UnknownFObjectParser" },
    { name: "Util" },
    { name: "ASCIIEscapeParser" },
    { name: "ShortParser" },
    { name: "KeyValueParser" },
    { name: "UnknownPropertiesParser" },
    { name: "ByteParser" },
    { name: "MaybeFObjectParser" },
    { name: "ExprParser" },
    { name: "UnknownParser" },
    { name: "UnknownFObjectArrayParser" },
    { name: "AnyParser" },
    { name: "UnknownKeyValueParser0" },
    { name: "EnumParserFactory" },
    { name: "RawMapValueParser" },
    { name: "DateParser" },
    { name: "RawMapParser" },
    { name: "ClassReferenceParser" },
    { name: "UnicodeParser" },
    { name: "AnyKeyParser" },
    { name: "IdParser" },
    { name: "KeyValueParser0" },
    { name: "ObjectNullParser" },
    { name: "HexCharParser" },
    { name: "UnknownObjectParser" },
    { name: "ArrayParser" },
    { name: "IdentifierStartParser" },
    { name: "StringArrayParser" },
    { name: "StringToStringArrayParser" },
    { name: "NullParser" },
    { name: "PropertyParser" },
    { name: "UnknownPropertyParser" },
    { name: "KeyParser" },
    { name: "FloatParser" },
    { name: "FObjectParser" },
    { name: "StringParser" },
    { name: "LongParser" },
    { name: "ObjectDateParser" },
    { name: "UnknownStringParser" },
    { name: "UnknownArrayParser" },
    { name: "ModelParserFactory" },
    { name: "FObjectArrayParser" },
    { name: "MapParser" },
    { name: "IntParser" },
    { name: "UnknownReferenceParser" },
    { name: "Whitespace" },
    { name: "StringDoubleArrayParser" },
    { name: "GlyphPropertyParser" },
    { name: "test/FObjectParserJavaTestClass",                    flags: "test" },
  ],

  journalFiles: [
    { name: "tests",                                              flags: "test" }
  ]
});
