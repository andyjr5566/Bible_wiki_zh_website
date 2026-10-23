var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  __defProp(target, "default", { value: mod, enumerable: true }) ,
  mod
));

// ../../../../site-ux/node_modules/inline-style-parser/cjs/index.js
var require_cjs = __commonJS({
  "../../../../site-ux/node_modules/inline-style-parser/cjs/index.js"(exports, module) {
    var COMMENT_REGEX = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;
    var NEWLINE_REGEX = /\n/g;
    var WHITESPACE_REGEX = /^\s*/;
    var PROPERTY_REGEX = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/;
    var COLON_REGEX = /^:\s*/;
    var VALUE_REGEX = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/;
    var SEMICOLON_REGEX = /^[;\s]*/;
    var TRIM_REGEX = /^\s+|\s+$/g;
    var NEWLINE = "\n";
    var FORWARD_SLASH = "/";
    var ASTERISK = "*";
    var EMPTY_STRING = "";
    var TYPE_COMMENT = "comment";
    var TYPE_DECLARATION = "declaration";
    function index2(style, options) {
      if (typeof style !== "string") {
        throw new TypeError("First argument must be a string");
      }
      if (!style) return [];
      options = options || {};
      var lineno = 1;
      var column = 1;
      function updatePosition(str) {
        var lines = str.match(NEWLINE_REGEX);
        if (lines) lineno += lines.length;
        var i2 = str.lastIndexOf(NEWLINE);
        column = ~i2 ? str.length - i2 : column + str.length;
      }
      function position3() {
        var start2 = { line: lineno, column };
        return function(node) {
          node.position = new Position(start2);
          whitespace2();
          return node;
        };
      }
      function Position(start2) {
        this.start = start2;
        this.end = { line: lineno, column };
        this.source = options.source;
      }
      Position.prototype.content = style;
      function error(msg) {
        var err = new Error(
          options.source + ":" + lineno + ":" + column + ": " + msg
        );
        err.reason = msg;
        err.filename = options.source;
        err.line = lineno;
        err.column = column;
        err.source = style;
        if (options.silent) ;
        else {
          throw err;
        }
      }
      function match(re2) {
        var m2 = re2.exec(style);
        if (!m2) return;
        var str = m2[0];
        updatePosition(str);
        style = style.slice(str.length);
        return m2;
      }
      function whitespace2() {
        match(WHITESPACE_REGEX);
      }
      function comments(rules) {
        var c2;
        rules = rules || [];
        while (c2 = comment()) {
          if (c2 !== false) {
            rules.push(c2);
          }
        }
        return rules;
      }
      function comment() {
        var pos = position3();
        if (FORWARD_SLASH != style.charAt(0) || ASTERISK != style.charAt(1)) return;
        var i2 = 2;
        while (EMPTY_STRING != style.charAt(i2) && (ASTERISK != style.charAt(i2) || FORWARD_SLASH != style.charAt(i2 + 1))) {
          ++i2;
        }
        i2 += 2;
        if (EMPTY_STRING === style.charAt(i2 - 1)) {
          return error("End of comment missing");
        }
        var str = style.slice(2, i2 - 2);
        column += 2;
        updatePosition(str);
        style = style.slice(i2);
        column += 2;
        return pos({
          type: TYPE_COMMENT,
          comment: str
        });
      }
      function declaration() {
        var pos = position3();
        var prop = match(PROPERTY_REGEX);
        if (!prop) return;
        comment();
        if (!match(COLON_REGEX)) return error("property missing ':'");
        var val = match(VALUE_REGEX);
        var ret = pos({
          type: TYPE_DECLARATION,
          property: trim(prop[0].replace(COMMENT_REGEX, EMPTY_STRING)),
          value: val ? trim(val[0].replace(COMMENT_REGEX, EMPTY_STRING)) : EMPTY_STRING
        });
        match(SEMICOLON_REGEX);
        return ret;
      }
      function declarations() {
        var decls = [];
        comments(decls);
        var decl;
        while (decl = declaration()) {
          if (decl !== false) {
            decls.push(decl);
            comments(decls);
          }
        }
        return decls;
      }
      whitespace2();
      return declarations();
    }
    function trim(str) {
      return str ? str.replace(TRIM_REGEX, EMPTY_STRING) : EMPTY_STRING;
    }
    module.exports = index2;
  }
});

// ../../../../site-ux/node_modules/style-to-object/cjs/index.js
var require_cjs2 = __commonJS({
  "../../../../site-ux/node_modules/style-to-object/cjs/index.js"(exports) {
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = StyleToObject;
    var inline_style_parser_1 = __importDefault(require_cjs());
    function StyleToObject(style, iterator) {
      let styleObject = null;
      if (!style || typeof style !== "string") {
        return styleObject;
      }
      const declarations = (0, inline_style_parser_1.default)(style);
      const hasIterator = typeof iterator === "function";
      declarations.forEach((declaration) => {
        if (declaration.type !== "declaration") {
          return;
        }
        const { property, value } = declaration;
        if (hasIterator) {
          iterator(property, value, declaration);
        } else if (value) {
          styleObject = styleObject || {};
          styleObject[property] = value;
        }
      });
      return styleObject;
    }
  }
});

// ../../../../site-ux/node_modules/style-to-js/cjs/utilities.js
var require_utilities = __commonJS({
  "../../../../site-ux/node_modules/style-to-js/cjs/utilities.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.camelCase = void 0;
    var CUSTOM_PROPERTY_REGEX = /^--[a-zA-Z0-9_-]+$/;
    var HYPHEN_REGEX = /-([a-z])/g;
    var NO_HYPHEN_REGEX = /^[^-]+$/;
    var VENDOR_PREFIX_REGEX = /^-(webkit|moz|ms|o|khtml)-/;
    var MS_VENDOR_PREFIX_REGEX = /^-(ms)-/;
    var skipCamelCase = function(property) {
      return !property || NO_HYPHEN_REGEX.test(property) || CUSTOM_PROPERTY_REGEX.test(property);
    };
    var capitalize = function(match, character) {
      return character.toUpperCase();
    };
    var trimHyphen = function(match, prefix) {
      return "".concat(prefix, "-");
    };
    var camelCase = function(property, options) {
      if (options === void 0) {
        options = {};
      }
      if (skipCamelCase(property)) {
        return property;
      }
      property = property.toLowerCase();
      if (options.reactCompat) {
        property = property.replace(MS_VENDOR_PREFIX_REGEX, trimHyphen);
      } else {
        property = property.replace(VENDOR_PREFIX_REGEX, trimHyphen);
      }
      return property.replace(HYPHEN_REGEX, capitalize);
    };
    exports.camelCase = camelCase;
  }
});

// ../../../../site-ux/node_modules/style-to-js/cjs/index.js
var require_cjs3 = __commonJS({
  "../../../../site-ux/node_modules/style-to-js/cjs/index.js"(exports, module) {
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var style_to_object_1 = __importDefault(require_cjs2());
    var utilities_1 = require_utilities();
    function StyleToJS(style, options) {
      var output = {};
      if (!style || typeof style !== "string") {
        return output;
      }
      (0, style_to_object_1.default)(style, function(property, value) {
        if (property && value) {
          output[(0, utilities_1.camelCase)(property, options)] = value;
        }
      });
      return output;
    }
    StyleToJS.default = StyleToJS;
    module.exports = StyleToJS;
  }
});

// ../../config/bible-books.json
var bible_books_default = {
  groups: [
    {
      id: "torah",
      name: "\u6469\u897F\u4E94\u7D93",
      testament: "ot"
    },
    {
      id: "history",
      name: "\u6B77\u53F2\u66F8",
      testament: "ot"
    },
    {
      id: "wisdom",
      name: "\u8A69\u6B4C\u667A\u6167\u66F8",
      testament: "ot"
    },
    {
      id: "prophets",
      name: "\u5148\u77E5\u66F8",
      testament: "ot"
    },
    {
      id: "gospels",
      name: "\u798F\u97F3\u66F8",
      testament: "nt"
    },
    {
      id: "acts",
      name: "\u4F7F\u5F92\u884C\u50B3",
      testament: "nt"
    },
    {
      id: "epistles",
      name: "\u66F8\u4FE1",
      testament: "nt"
    },
    {
      id: "revelation",
      name: "\u555F\u793A\u9304",
      testament: "nt"
    }
  ],
  books: [
    {
      num: 1,
      name: "\u5275\u4E16\u8A18",
      chapters: 50,
      short: "\u5275",
      group: "torah"
    },
    {
      num: 2,
      name: "\u51FA\u57C3\u53CA\u8A18",
      chapters: 40,
      short: "\u51FA",
      group: "torah"
    },
    {
      num: 3,
      name: "\u5229\u672A\u8A18",
      chapters: 27,
      short: "\u5229",
      group: "torah"
    },
    {
      num: 4,
      name: "\u6C11\u6578\u8A18",
      chapters: 36,
      short: "\u6C11",
      group: "torah"
    },
    {
      num: 5,
      name: "\u7533\u547D\u8A18",
      chapters: 34,
      short: "\u7533",
      group: "torah"
    },
    {
      num: 6,
      name: "\u7D04\u66F8\u4E9E\u8A18",
      chapters: 24,
      short: "\u66F8",
      group: "history"
    },
    {
      num: 7,
      name: "\u58EB\u5E2B\u8A18",
      chapters: 21,
      short: "\u58EB",
      group: "history"
    },
    {
      num: 8,
      name: "\u8DEF\u5F97\u8A18",
      chapters: 4,
      short: "\u5F97",
      group: "history"
    },
    {
      num: 9,
      name: "\u6492\u6BCD\u8033\u8A18\u4E0A",
      chapters: 31,
      short: "\u6492\u4E0A",
      group: "history"
    },
    {
      num: 10,
      name: "\u6492\u6BCD\u8033\u8A18\u4E0B",
      chapters: 24,
      short: "\u6492\u4E0B",
      group: "history"
    },
    {
      num: 11,
      name: "\u5217\u738B\u7D00\u4E0A",
      chapters: 22,
      short: "\u738B\u4E0A",
      group: "history"
    },
    {
      num: 12,
      name: "\u5217\u738B\u7D00\u4E0B",
      chapters: 25,
      short: "\u738B\u4E0B",
      group: "history"
    },
    {
      num: 13,
      name: "\u6B77\u4EE3\u5FD7\u4E0A",
      chapters: 29,
      short: "\u4EE3\u4E0A",
      group: "history"
    },
    {
      num: 14,
      name: "\u6B77\u4EE3\u5FD7\u4E0B",
      chapters: 36,
      short: "\u4EE3\u4E0B",
      group: "history"
    },
    {
      num: 15,
      name: "\u4EE5\u65AF\u62C9\u8A18",
      chapters: 10,
      short: "\u62C9",
      group: "history"
    },
    {
      num: 16,
      name: "\u5C3C\u5E0C\u7C73\u8A18",
      chapters: 13,
      short: "\u5C3C",
      group: "history"
    },
    {
      num: 17,
      name: "\u4EE5\u65AF\u5E16\u8A18",
      chapters: 10,
      short: "\u65AF",
      group: "history"
    },
    {
      num: 18,
      name: "\u7D04\u4F2F\u8A18",
      chapters: 42,
      short: "\u4F2F",
      group: "wisdom"
    },
    {
      num: 19,
      name: "\u8A69\u7BC7",
      chapters: 150,
      short: "\u8A69",
      group: "wisdom"
    },
    {
      num: 20,
      name: "\u7BB4\u8A00",
      chapters: 31,
      short: "\u7BB4",
      group: "wisdom"
    },
    {
      num: 21,
      name: "\u50B3\u9053\u66F8",
      chapters: 12,
      short: "\u50B3",
      group: "wisdom"
    },
    {
      num: 22,
      name: "\u96C5\u6B4C",
      chapters: 8,
      short: "\u6B4C",
      group: "wisdom"
    },
    {
      num: 23,
      name: "\u4EE5\u8CFD\u4E9E\u66F8",
      chapters: 66,
      short: "\u8CFD",
      group: "prophets"
    },
    {
      num: 24,
      name: "\u8036\u5229\u7C73\u66F8",
      chapters: 52,
      short: "\u8036",
      group: "prophets"
    },
    {
      num: 25,
      name: "\u8036\u5229\u7C73\u54C0\u6B4C",
      chapters: 5,
      short: "\u54C0",
      group: "prophets"
    },
    {
      num: 26,
      name: "\u4EE5\u897F\u7D50\u66F8",
      chapters: 48,
      short: "\u7D50",
      group: "prophets"
    },
    {
      num: 27,
      name: "\u4F46\u4EE5\u7406\u66F8",
      chapters: 12,
      short: "\u4F46",
      group: "prophets"
    },
    {
      num: 28,
      name: "\u4F55\u897F\u963F\u66F8",
      chapters: 14,
      short: "\u4F55",
      group: "prophets"
    },
    {
      num: 29,
      name: "\u7D04\u73E5\u66F8",
      chapters: 3,
      short: "\u73E5",
      group: "prophets"
    },
    {
      num: 30,
      name: "\u963F\u6469\u53F8\u66F8",
      chapters: 9,
      short: "\u6469",
      group: "prophets"
    },
    {
      num: 31,
      name: "\u4FC4\u5DF4\u5E95\u4E9E\u66F8",
      chapters: 1,
      short: "\u4FC4",
      group: "prophets"
    },
    {
      num: 32,
      name: "\u7D04\u62FF\u66F8",
      chapters: 4,
      short: "\u62FF",
      group: "prophets"
    },
    {
      num: 33,
      name: "\u5F4C\u8FE6\u66F8",
      chapters: 7,
      short: "\u5F4C",
      group: "prophets"
    },
    {
      num: 34,
      name: "\u90A3\u9D3B\u66F8",
      chapters: 3,
      short: "\u9D3B",
      group: "prophets"
    },
    {
      num: 35,
      name: "\u54C8\u5DF4\u8C37\u66F8",
      chapters: 3,
      short: "\u54C8",
      group: "prophets"
    },
    {
      num: 36,
      name: "\u897F\u756A\u96C5\u66F8",
      chapters: 3,
      short: "\u756A",
      group: "prophets"
    },
    {
      num: 37,
      name: "\u54C8\u8A72\u66F8",
      chapters: 2,
      short: "\u8A72",
      group: "prophets"
    },
    {
      num: 38,
      name: "\u6492\u8FE6\u5229\u4E9E\u66F8",
      chapters: 14,
      short: "\u4E9E",
      group: "prophets"
    },
    {
      num: 39,
      name: "\u746A\u62C9\u57FA\u66F8",
      chapters: 4,
      short: "\u746A",
      group: "prophets"
    },
    {
      num: 40,
      name: "\u99AC\u592A\u798F\u97F3",
      chapters: 28,
      short: "\u592A",
      group: "gospels"
    },
    {
      num: 41,
      name: "\u99AC\u53EF\u798F\u97F3",
      chapters: 16,
      short: "\u53EF",
      group: "gospels"
    },
    {
      num: 42,
      name: "\u8DEF\u52A0\u798F\u97F3",
      chapters: 24,
      short: "\u8DEF",
      group: "gospels"
    },
    {
      num: 43,
      name: "\u7D04\u7FF0\u798F\u97F3",
      chapters: 21,
      short: "\u7D04",
      group: "gospels"
    },
    {
      num: 44,
      name: "\u4F7F\u5F92\u884C\u50B3",
      chapters: 28,
      short: "\u5F92",
      group: "acts"
    },
    {
      num: 45,
      name: "\u7F85\u99AC\u66F8",
      chapters: 16,
      short: "\u7F85",
      group: "epistles"
    },
    {
      num: 46,
      name: "\u54E5\u6797\u591A\u524D\u66F8",
      chapters: 16,
      short: "\u6797\u524D",
      group: "epistles"
    },
    {
      num: 47,
      name: "\u54E5\u6797\u591A\u5F8C\u66F8",
      chapters: 13,
      short: "\u6797\u5F8C",
      group: "epistles"
    },
    {
      num: 48,
      name: "\u52A0\u62C9\u592A\u66F8",
      chapters: 6,
      short: "\u52A0",
      group: "epistles"
    },
    {
      num: 49,
      name: "\u4EE5\u5F17\u6240\u66F8",
      chapters: 6,
      short: "\u5F17",
      group: "epistles"
    },
    {
      num: 50,
      name: "\u8153\u7ACB\u6BD4\u66F8",
      chapters: 4,
      short: "\u8153",
      group: "epistles"
    },
    {
      num: 51,
      name: "\u6B4C\u7F85\u897F\u66F8",
      chapters: 4,
      short: "\u897F",
      group: "epistles"
    },
    {
      num: 52,
      name: "\u5E16\u6492\u7F85\u5C3C\u8FE6\u524D\u66F8",
      chapters: 5,
      short: "\u5E16\u524D",
      group: "epistles"
    },
    {
      num: 53,
      name: "\u5E16\u6492\u7F85\u5C3C\u8FE6\u5F8C\u66F8",
      chapters: 3,
      short: "\u5E16\u5F8C",
      group: "epistles"
    },
    {
      num: 54,
      name: "\u63D0\u6469\u592A\u524D\u66F8",
      chapters: 6,
      short: "\u63D0\u524D",
      group: "epistles"
    },
    {
      num: 55,
      name: "\u63D0\u6469\u592A\u5F8C\u66F8",
      chapters: 4,
      short: "\u63D0\u5F8C",
      group: "epistles"
    },
    {
      num: 56,
      name: "\u63D0\u591A\u66F8",
      chapters: 3,
      short: "\u591A",
      group: "epistles"
    },
    {
      num: 57,
      name: "\u8153\u5229\u9580\u66F8",
      chapters: 1,
      short: "\u9580",
      group: "epistles"
    },
    {
      num: 58,
      name: "\u5E0C\u4F2F\u4F86\u66F8",
      chapters: 13,
      short: "\u4F86",
      group: "epistles"
    },
    {
      num: 59,
      name: "\u96C5\u5404\u66F8",
      chapters: 5,
      short: "\u96C5",
      group: "epistles"
    },
    {
      num: 60,
      name: "\u5F7C\u5F97\u524D\u66F8",
      chapters: 5,
      short: "\u5F7C\u524D",
      group: "epistles"
    },
    {
      num: 61,
      name: "\u5F7C\u5F97\u5F8C\u66F8",
      chapters: 3,
      short: "\u5F7C\u5F8C",
      group: "epistles"
    },
    {
      num: 62,
      name: "\u7D04\u7FF0\u4E00\u66F8",
      chapters: 5,
      short: "\u7D04\u4E00",
      group: "epistles"
    },
    {
      num: 63,
      name: "\u7D04\u7FF0\u4E8C\u66F8",
      chapters: 1,
      short: "\u7D04\u4E8C",
      group: "epistles"
    },
    {
      num: 64,
      name: "\u7D04\u7FF0\u4E09\u66F8",
      chapters: 1,
      short: "\u7D04\u4E09",
      group: "epistles"
    },
    {
      num: 65,
      name: "\u7336\u5927\u66F8",
      chapters: 1,
      short: "\u7336",
      group: "epistles"
    },
    {
      num: 66,
      name: "\u555F\u793A\u9304",
      chapters: 22,
      short: "\u555F",
      group: "revelation"
    }
  ]
};

// ../../quartz/util/bibleBooks.ts
var BOOK_GROUPS = bible_books_default.groups;
var BIBLE_BOOKS = bible_books_default.books;
function folderSlug(book) {
  return String(book.num).padStart(2, "0") + "-" + book.name;
}
function groupBooks(testament) {
  return BOOK_GROUPS.filter((group) => testament === void 0 || group.testament === testament).map(
    (group) => ({
      group,
      books: BIBLE_BOOKS.filter((book) => book.group === group.id)
    })
  );
}
function decodePath(value) {
  const path = value.trim().split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
function canonicalSlugPath(value) {
  return decodePath(value).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\.html$/i, "").replace(/[\s]+/g, "-");
}
function bookByFolderSlug(s2) {
  const canonical = canonicalSlugPath(s2);
  const folder = canonical.split("/").at(-1);
  return BIBLE_BOOKS.find((book) => folderSlug(book) === folder);
}

// ../../quartz/util/bookCatalog.ts
function normalizedParts(slug) {
  return canonicalSlugPath(slug).split("/");
}
function parseBookSlug(slug) {
  const parts = normalizedParts(slug);
  if (parts.length !== 2) return null;
  const [folder, page] = parts;
  const book = bookByFolderSlug(folder);
  if (!book) return null;
  const chapterMatch = /^第(\d+)章$/.exec(page);
  if (chapterMatch) {
    const chapter = Number(chapterMatch[1]);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
    return { book, kind: "chapter", chapter };
  }
  if (page === "\u5168\u66F8\u76EE\u9304\u53CA\u7DB1\u8981") return { book, kind: "toc" };
  if (page === "\u66F8\u5377\u5C0E\u8AD6") return { book, kind: "intro" };
  return null;
}
function buildCatalog(slugs) {
  const chapters = /* @__PURE__ */ new Map();
  const toc = /* @__PURE__ */ new Set();
  const intro = /* @__PURE__ */ new Set();
  for (const slug of slugs) {
    const parsed = parseBookSlug(slug);
    if (!parsed) continue;
    if (parsed.kind === "chapter" && parsed.chapter !== void 0) {
      const known = chapters.get(parsed.book.num) ?? /* @__PURE__ */ new Set();
      known.add(parsed.chapter);
      chapters.set(parsed.book.num, known);
    } else if (parsed.kind === "toc") {
      toc.add(parsed.book.num);
    } else {
      intro.add(parsed.book.num);
    }
  }
  return BIBLE_BOOKS.map((book) => {
    const foundChapters = [...chapters.get(book.num) ?? []].sort((a2, b2) => a2 - b2);
    const hasToc = toc.has(book.num);
    const hasIntro = intro.has(book.num);
    const status = foundChapters.length > 0 ? "ready" : hasToc || hasIntro ? "outline" : "empty";
    return { book, status, chapters: foundChapters, hasToc, hasIntro };
  });
}
function chapterSlug(book, n2) {
  return folderSlug(book) + "/\u7B2C" + n2 + "\u7AE0";
}
function tocSlug(book) {
  return folderSlug(book) + "/\u5168\u66F8\u76EE\u9304\u53CA\u7DB1\u8981";
}
function introSlug(book) {
  return folderSlug(book) + "/\u66F8\u5377\u5C0E\u8AD6";
}

// ../book-picker/src/lib/pickerLogic.ts
function isBookOpen(entry) {
  return entry.status !== "empty";
}
function bookLinkSlug(entry) {
  if (!isBookOpen(entry)) return void 0;
  if (entry.hasToc) return tocSlug(entry.book);
  if (entry.chapters.length > 0) return chapterSlug(entry.book, entry.chapters[0]);
  return entry.hasIntro ? introSlug(entry.book) : void 0;
}
function openBooksSummary(catalog) {
  const open = catalog.filter(isBookOpen).sort((a2, b2) => a2.book.num - b2.book.num);
  const runs = [];
  for (const entry of open) {
    const last = runs.at(-1);
    if (last && last.at(-1).book.num === entry.book.num - 1) last.push(entry);
    else runs.push([entry]);
  }
  return runs.map((run) => run.length === 1 ? run[0].book.name : `${run[0].book.name}\u5230${run.at(-1).book.name}`).join("\u3001");
}
function relativeHref(fromSlug, toSlug) {
  const depth = fromSlug.split("/").filter(Boolean).length - 1;
  const prefix = depth <= 0 ? "." : Array.from({ length: depth }, () => "..").join("/");
  return `${prefix}/${toSlug}`;
}

// ../../../../site-ux/node_modules/preact/dist/preact.mjs
var n;
var l;
var u;
var w = [];
function k(l2, u3, t2) {
  var i2, r2, o2, e2 = {};
  for (o2 in u3) "key" == o2 ? i2 = u3[o2] : "ref" == o2 ? r2 = u3[o2] : e2[o2] = u3[o2];
  if (arguments.length > 2 && (e2.children = arguments.length > 3 ? n.call(arguments, 2) : t2), "function" == typeof l2 && null != l2.defaultProps) for (o2 in l2.defaultProps) void 0 === e2[o2] && (e2[o2] = l2.defaultProps[o2]);
  return x(l2, e2, i2, r2, null);
}
function x(n2, t2, i2, r2, o2) {
  var e2 = { type: n2, props: t2, key: i2, ref: r2, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o2 ? ++u : o2, __i: -1, __u: 0 };
  return null != l.vnode && l.vnode(e2), e2;
}
function S(n2) {
  return n2.children;
}
n = w.slice, l = { __e: function(n2, l2, u3, t2) {
  for (var i2, r2, o2; l2 = l2.__; ) if ((i2 = l2.__c) && !i2.__) try {
    if ((r2 = i2.constructor) && null != r2.getDerivedStateFromError && (i2.setState(r2.getDerivedStateFromError(n2)), o2 = i2.__d), null != i2.componentDidCatch && (i2.componentDidCatch(n2, t2 || {}), o2 = i2.__d), o2) return i2.__E = i2;
  } catch (l3) {
    n2 = l3;
  }
  throw n2;
} }, u = 0, "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, Math.random().toString(8);

// ../../../../site-ux/node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
var f2 = 0;
function u2(e2, t2, n2, o2, i2, u3) {
  t2 || (t2 = {});
  var a2, c2, p2 = t2;
  if ("ref" in p2) for (c2 in p2 = {}, t2) "ref" == c2 ? a2 = t2[c2] : p2[c2] = t2[c2];
  var l2 = { type: e2, props: p2, key: n2, ref: a2, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f2, __i: -1, __u: 0, __source: i2, __self: u3 };
  if ("function" == typeof e2 && (a2 = e2.defaultProps)) for (c2 in a2) void 0 === p2[c2] && (p2[c2] = a2[c2]);
  return l.vnode && l.vnode(l2), l2;
}

// ../book-picker/src/components/BookGrid.tsx
var TESTAMENT_LABEL = { ot: "\u820A\u7D04", nt: "\u65B0\u7D04" };
var TESTAMENTS = ["ot", "nt"];
function bookCount(testament) {
  return groupBooks(testament).reduce((sum, { books }) => sum + books.length, 0);
}
function BookItem({
  book,
  entry,
  fromSlug,
  current
}) {
  const slug = bookLinkSlug(entry);
  if (!slug) {
    return /* @__PURE__ */ u2("button", { type: "button", class: "bwz-bg-book is-locked", "aria-disabled": "true", "data-book": book.name, children: book.name });
  }
  return /* @__PURE__ */ u2("a", { class: "bwz-bg-book", href: relativeHref(fromSlug, slug), "aria-current": current ? "true" : void 0, children: book.name });
}
function BookGrid({
  catalog,
  fromSlug,
  idPrefix,
  currentBookNum,
  defaultTestament = "ot",
  autoTab = true,
  layout = "chips"
}) {
  const entries = new Map(catalog.map((entry) => [entry.book.num, entry]));
  const summary = openBooksSummary(catalog);
  const auto = autoTab && currentBookNum === void 0;
  return /* @__PURE__ */ u2(
    "div",
    {
      class: `bwz-bookgrid bwz-bookgrid--${layout}`,
      "data-open-summary": summary,
      "data-auto-tab": auto ? "true" : void 0,
      children: [
        /* @__PURE__ */ u2("div", { class: "bwz-bg-tabs", role: "tablist", "aria-label": "\u820A\u7D04\u6216\u65B0\u7D04", children: TESTAMENTS.map((testament) => {
          const selected = testament === defaultTestament;
          return /* @__PURE__ */ u2(
            "button",
            {
              type: "button",
              role: "tab",
              class: "bwz-bg-tab",
              id: `${idPrefix}-tab-${testament}`,
              "data-testament": testament,
              "aria-selected": selected ? "true" : "false",
              "aria-controls": `${idPrefix}-panel-${testament}`,
              tabindex: selected ? 0 : -1,
              children: [
                TESTAMENT_LABEL[testament],
                " ",
                bookCount(testament),
                " \u5377"
              ]
            }
          );
        }) }),
        TESTAMENTS.map((testament) => /* @__PURE__ */ u2(
          "div",
          {
            role: "tabpanel",
            class: "bwz-bg-panel",
            id: `${idPrefix}-panel-${testament}`,
            "aria-labelledby": `${idPrefix}-tab-${testament}`,
            hidden: testament !== defaultTestament,
            children: groupBooks(testament).map(({ group, books }) => /* @__PURE__ */ u2("div", { class: "bwz-bg-group", role: "group", "aria-labelledby": `${idPrefix}-g-${group.id}`, children: [
              /* @__PURE__ */ u2("div", { class: "bwz-bg-gh", id: `${idPrefix}-g-${group.id}`, children: group.name }),
              /* @__PURE__ */ u2("div", { class: "bwz-bg-books", children: books.map((book) => /* @__PURE__ */ u2(
                BookItem,
                {
                  book,
                  entry: entries.get(book.num),
                  fromSlug,
                  current: book.num === currentBookNum
                }
              )) })
            ] }))
          }
        ))
      ]
    }
  );
}

// src/lib/catalogData.ts
function compactCatalog(catalog) {
  return catalog.filter((entry) => entry.status !== "empty").map((entry) => [entry.book.num, entry.chapters, entry.hasToc ? 1 : 0, entry.hasIntro ? 1 : 0]);
}

// src/lib/masthead.ts
var MASTHEAD_ATTR = "data-bwz-masthead";
var isBlankText = (node) => node.type === "text" && node.value.trim() === "";
var isSignificant = (node) => node.type !== "comment" && !isBlankText(node);
var isElement = (node, tagName) => node?.type === "element" && node.tagName === tagName;
var hasContent = (node) => {
  if (node.type === "text") return node.value.trim() !== "";
  if (node.type !== "element") return false;
  return node.tagName === "img" || node.children.some(hasContent);
};
function clone(node, keepId) {
  if (node.type !== "element") return structuredClone(node);
  const { id, ...rest } = node.properties ?? {};
  return {
    ...node,
    properties: keepId && id !== void 0 ? { id, ...rest } : rest,
    children: node.children.map((child) => clone(child, false))
  };
}
var isRoot = (tree) => typeof tree === "object" && tree !== null && tree.type === "root" && Array.isArray(tree.children);
function extractMasthead(tree) {
  if (!isRoot(tree)) return null;
  const [first, second, third] = tree.children.filter(isSignificant);
  if (!isElement(first, "h1") || !hasContent(first)) return null;
  const hasIntro = isElement(second, "blockquote") && hasContent(second);
  const last = hasIntro ? third : second;
  return {
    nodes: (hasIntro ? [first, second] : [first]).map((node) => clone(node, node === first)),
    hasIntro,
    hasRule: isElement(last, "hr")
  };
}
var mastheadPattern = (masthead) => ["h1", masthead.hasIntro && "blockquote", masthead.hasRule && "hr"].filter(Boolean).join(" ");

// ../../../../site-ux/node_modules/comma-separated-tokens/index.js
function stringify(values, options) {
  const settings = {};
  const input = values[values.length - 1] === "" ? [...values, ""] : values;
  return input.join(
    (settings.padRight ? " " : "") + "," + (settings.padLeft === false ? "" : " ")
  ).trim();
}

// ../../../../site-ux/node_modules/devlop/lib/default.js
function ok() {
}

// ../../../../site-ux/node_modules/estree-util-is-identifier-name/lib/index.js
var nameRe = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var nameReJsx = /^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var emptyOptions = {};
function name(name2, options) {
  const settings = emptyOptions;
  const re2 = settings.jsx ? nameReJsx : nameRe;
  return re2.test(name2);
}

// ../../../../site-ux/node_modules/hast-util-whitespace/lib/index.js
var re = /[ \t\n\f\r]/g;
function whitespace(thing) {
  return typeof thing === "object" ? thing.type === "text" ? empty(thing.value) : false : empty(thing);
}
function empty(value) {
  return value.replace(re, "") === "";
}

// ../../../../site-ux/node_modules/property-information/lib/util/schema.js
var Schema = class {
  /**
   * @param {SchemaType['property']} property
   *   Property.
   * @param {SchemaType['normal']} normal
   *   Normal.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Schema.
   */
  constructor(property, normal, space) {
    this.normal = normal;
    this.property = property;
    if (space) {
      this.space = space;
    }
  }
};
Schema.prototype.normal = {};
Schema.prototype.property = {};
Schema.prototype.space = void 0;

// ../../../../site-ux/node_modules/property-information/lib/util/merge.js
function merge(definitions, space) {
  const property = {};
  const normal = {};
  for (const definition of definitions) {
    Object.assign(property, definition.property);
    Object.assign(normal, definition.normal);
  }
  return new Schema(property, normal, space);
}

// ../../../../site-ux/node_modules/property-information/lib/normalize.js
function normalize(value) {
  return value.toLowerCase();
}

// ../../../../site-ux/node_modules/property-information/lib/util/info.js
var Info = class {
  /**
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @returns
   *   Info.
   */
  constructor(property, attribute) {
    this.attribute = attribute;
    this.property = property;
  }
};
Info.prototype.attribute = "";
Info.prototype.booleanish = false;
Info.prototype.boolean = false;
Info.prototype.commaOrSpaceSeparated = false;
Info.prototype.commaSeparated = false;
Info.prototype.defined = false;
Info.prototype.mustUseProperty = false;
Info.prototype.number = false;
Info.prototype.overloadedBoolean = false;
Info.prototype.property = "";
Info.prototype.spaceSeparated = false;
Info.prototype.space = void 0;

// ../../../../site-ux/node_modules/property-information/lib/util/types.js
var types_exports = {};
__export(types_exports, {
  boolean: () => boolean,
  booleanish: () => booleanish,
  commaOrSpaceSeparated: () => commaOrSpaceSeparated,
  commaSeparated: () => commaSeparated,
  number: () => number,
  overloadedBoolean: () => overloadedBoolean,
  spaceSeparated: () => spaceSeparated
});
var powers = 0;
var boolean = increment();
var booleanish = increment();
var overloadedBoolean = increment();
var number = increment();
var spaceSeparated = increment();
var commaSeparated = increment();
var commaOrSpaceSeparated = increment();
function increment() {
  return 2 ** ++powers;
}

// ../../../../site-ux/node_modules/property-information/lib/util/defined-info.js
var checks = (
  /** @type {ReadonlyArray<keyof typeof types>} */
  Object.keys(types_exports)
);
var DefinedInfo = class extends Info {
  /**
   * @constructor
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @param {number | null | undefined} [mask]
   *   Mask.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Info.
   */
  constructor(property, attribute, mask, space) {
    let index2 = -1;
    super(property, attribute);
    mark(this, "space", space);
    if (typeof mask === "number") {
      while (++index2 < checks.length) {
        const check = checks[index2];
        mark(this, checks[index2], (mask & types_exports[check]) === types_exports[check]);
      }
    }
  }
};
DefinedInfo.prototype.defined = true;
function mark(values, key, value) {
  if (value) {
    values[key] = value;
  }
}

// ../../../../site-ux/node_modules/property-information/lib/util/create.js
function create(definition) {
  const properties = {};
  const normals = {};
  for (const [property, value] of Object.entries(definition.properties)) {
    const info = new DefinedInfo(
      property,
      definition.transform(definition.attributes || {}, property),
      value,
      definition.space
    );
    if (definition.mustUseProperty && definition.mustUseProperty.includes(property)) {
      info.mustUseProperty = true;
    }
    properties[property] = info;
    normals[normalize(property)] = property;
    normals[normalize(info.attribute)] = property;
  }
  return new Schema(properties, normals, definition.space);
}

// ../../../../site-ux/node_modules/property-information/lib/aria.js
var aria = create({
  properties: {
    ariaActiveDescendant: null,
    ariaAtomic: booleanish,
    ariaAutoComplete: null,
    ariaBusy: booleanish,
    ariaChecked: booleanish,
    ariaColCount: number,
    ariaColIndex: number,
    ariaColSpan: number,
    ariaControls: spaceSeparated,
    ariaCurrent: null,
    ariaDescribedBy: spaceSeparated,
    ariaDetails: null,
    ariaDisabled: booleanish,
    ariaDropEffect: spaceSeparated,
    ariaErrorMessage: null,
    ariaExpanded: booleanish,
    ariaFlowTo: spaceSeparated,
    ariaGrabbed: booleanish,
    ariaHasPopup: null,
    ariaHidden: booleanish,
    ariaInvalid: null,
    ariaKeyShortcuts: null,
    ariaLabel: null,
    ariaLabelledBy: spaceSeparated,
    ariaLevel: number,
    ariaLive: null,
    ariaModal: booleanish,
    ariaMultiLine: booleanish,
    ariaMultiSelectable: booleanish,
    ariaOrientation: null,
    ariaOwns: spaceSeparated,
    ariaPlaceholder: null,
    ariaPosInSet: number,
    ariaPressed: booleanish,
    ariaReadOnly: booleanish,
    ariaRelevant: null,
    ariaRequired: booleanish,
    ariaRoleDescription: spaceSeparated,
    ariaRowCount: number,
    ariaRowIndex: number,
    ariaRowSpan: number,
    ariaSelected: booleanish,
    ariaSetSize: number,
    ariaSort: null,
    ariaValueMax: number,
    ariaValueMin: number,
    ariaValueNow: number,
    ariaValueText: null,
    role: null
  },
  transform(_2, property) {
    return property === "role" ? property : "aria-" + property.slice(4).toLowerCase();
  }
});

// ../../../../site-ux/node_modules/property-information/lib/util/case-sensitive-transform.js
function caseSensitiveTransform(attributes, attribute) {
  return attribute in attributes ? attributes[attribute] : attribute;
}

// ../../../../site-ux/node_modules/property-information/lib/util/case-insensitive-transform.js
function caseInsensitiveTransform(attributes, property) {
  return caseSensitiveTransform(attributes, property.toLowerCase());
}

// ../../../../site-ux/node_modules/property-information/lib/html.js
var html = create({
  attributes: {
    acceptcharset: "accept-charset",
    classname: "class",
    htmlfor: "for",
    httpequiv: "http-equiv"
  },
  mustUseProperty: ["checked", "multiple", "muted", "selected"],
  properties: {
    // Standard Properties.
    abbr: null,
    accept: commaSeparated,
    acceptCharset: spaceSeparated,
    accessKey: spaceSeparated,
    action: null,
    allow: null,
    allowFullScreen: boolean,
    allowPaymentRequest: boolean,
    allowUserMedia: boolean,
    alpha: boolean,
    alt: null,
    as: null,
    async: boolean,
    autoCapitalize: null,
    autoComplete: spaceSeparated,
    autoFocus: boolean,
    autoPlay: boolean,
    blocking: spaceSeparated,
    capture: null,
    charSet: null,
    checked: boolean,
    cite: null,
    className: spaceSeparated,
    closedBy: null,
    colorSpace: null,
    cols: number,
    colSpan: number,
    command: null,
    commandFor: null,
    content: null,
    contentEditable: booleanish,
    controls: boolean,
    controlsList: spaceSeparated,
    coords: number | commaSeparated,
    crossOrigin: null,
    data: null,
    dateTime: null,
    decoding: null,
    default: boolean,
    defer: boolean,
    dir: null,
    dirName: null,
    disabled: boolean,
    download: overloadedBoolean,
    draggable: booleanish,
    encType: null,
    enterKeyHint: null,
    fetchPriority: null,
    form: null,
    formAction: null,
    formEncType: null,
    formMethod: null,
    formNoValidate: boolean,
    formTarget: null,
    headers: spaceSeparated,
    height: number,
    hidden: overloadedBoolean,
    high: number,
    href: null,
    hrefLang: null,
    htmlFor: spaceSeparated,
    httpEquiv: spaceSeparated,
    id: null,
    imageSizes: null,
    imageSrcSet: null,
    inert: boolean,
    inputMode: null,
    integrity: null,
    is: null,
    isMap: boolean,
    itemId: null,
    itemProp: spaceSeparated,
    itemRef: spaceSeparated,
    itemScope: boolean,
    itemType: spaceSeparated,
    kind: null,
    label: null,
    lang: null,
    language: null,
    list: null,
    loading: null,
    loop: boolean,
    low: number,
    manifest: null,
    max: null,
    maxLength: number,
    media: null,
    method: null,
    min: null,
    minLength: number,
    multiple: boolean,
    muted: boolean,
    name: null,
    nonce: null,
    noModule: boolean,
    noValidate: boolean,
    onAbort: null,
    onAfterPrint: null,
    onAuxClick: null,
    onBeforeMatch: null,
    onBeforePrint: null,
    onBeforeToggle: null,
    onBeforeUnload: null,
    onBlur: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onContextLost: null,
    onContextMenu: null,
    onContextRestored: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFormData: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLanguageChange: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadEnd: null,
    onLoadStart: null,
    onMessage: null,
    onMessageError: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRejectionHandled: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onScrollEnd: null,
    onSecurityPolicyViolation: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onSlotChange: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnhandledRejection: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onWheel: null,
    open: boolean,
    optimum: number,
    pattern: null,
    ping: spaceSeparated,
    placeholder: null,
    playsInline: boolean,
    popover: null,
    popoverTarget: null,
    popoverTargetAction: null,
    poster: null,
    preload: null,
    readOnly: boolean,
    referrerPolicy: null,
    rel: spaceSeparated,
    required: boolean,
    reversed: boolean,
    rows: number,
    rowSpan: number,
    sandbox: spaceSeparated,
    scope: null,
    scoped: boolean,
    seamless: boolean,
    selected: boolean,
    shadowRootClonable: boolean,
    shadowRootCustomElementRegistry: boolean,
    shadowRootDelegatesFocus: boolean,
    shadowRootMode: null,
    shadowRootSerializable: boolean,
    shape: null,
    size: number,
    sizes: null,
    slot: null,
    span: number,
    spellCheck: booleanish,
    src: null,
    srcDoc: null,
    srcLang: null,
    srcSet: null,
    start: number,
    step: null,
    style: null,
    tabIndex: number,
    target: null,
    title: null,
    translate: null,
    type: null,
    typeMustMatch: boolean,
    useMap: null,
    value: booleanish,
    width: number,
    wrap: null,
    writingSuggestions: null,
    // Legacy.
    // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
    align: null,
    // Several. Use CSS `text-align` instead,
    aLink: null,
    // `<body>`. Use CSS `a:active {color}` instead
    archive: spaceSeparated,
    // `<object>`. List of URIs to archives
    axis: null,
    // `<td>` and `<th>`. Use `scope` on `<th>`
    background: null,
    // `<body>`. Use CSS `background-image` instead
    bgColor: null,
    // `<body>` and table elements. Use CSS `background-color` instead
    border: number,
    // `<table>`. Use CSS `border-width` instead,
    borderColor: null,
    // `<table>`. Use CSS `border-color` instead,
    bottomMargin: number,
    // `<body>`
    cellPadding: null,
    // `<table>`
    cellSpacing: null,
    // `<table>`
    char: null,
    // Several table elements. When `align=char`, sets the character to align on
    charOff: null,
    // Several table elements. When `char`, offsets the alignment
    classId: null,
    // `<object>`
    clear: null,
    // `<br>`. Use CSS `clear` instead
    code: null,
    // `<object>`
    codeBase: null,
    // `<object>`
    codeType: null,
    // `<object>`
    color: null,
    // `<font>` and `<hr>`. Use CSS instead
    compact: boolean,
    // Lists. Use CSS to reduce space between items instead
    declare: boolean,
    // `<object>`
    event: null,
    // `<script>`
    face: null,
    // `<font>`. Use CSS instead
    frame: null,
    // `<table>`
    frameBorder: null,
    // `<iframe>`. Use CSS `border` instead
    hSpace: number,
    // `<img>` and `<object>`
    leftMargin: number,
    // `<body>`
    link: null,
    // `<body>`. Use CSS `a:link {color: *}` instead
    longDesc: null,
    // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
    lowSrc: null,
    // `<img>`. Use a `<picture>`
    marginHeight: number,
    // `<body>`
    marginWidth: number,
    // `<body>`
    noResize: boolean,
    // `<frame>`
    noHref: boolean,
    // `<area>`. Use no href instead of an explicit `nohref`
    noShade: boolean,
    // `<hr>`. Use background-color and height instead of borders
    noWrap: boolean,
    // `<td>` and `<th>`
    object: null,
    // `<applet>`
    profile: null,
    // `<head>`
    prompt: null,
    // `<isindex>`
    rev: null,
    // `<link>`
    rightMargin: number,
    // `<body>`
    rules: null,
    // `<table>`
    scheme: null,
    // `<meta>`
    scrolling: booleanish,
    // `<frame>`. Use overflow in the child context
    standby: null,
    // `<object>`
    summary: null,
    // `<table>`
    text: null,
    // `<body>`. Use CSS `color` instead
    topMargin: number,
    // `<body>`
    valueType: null,
    // `<param>`
    version: null,
    // `<html>`. Use a doctype.
    vAlign: null,
    // Several. Use CSS `vertical-align` instead
    vLink: null,
    // `<body>`. Use CSS `a:visited {color}` instead
    vSpace: number,
    // `<img>` and `<object>`
    // Non-standard Properties.
    allowTransparency: null,
    autoCorrect: null,
    autoSave: null,
    credentialless: boolean,
    disablePictureInPicture: boolean,
    disableRemotePlayback: boolean,
    exportParts: commaSeparated,
    part: spaceSeparated,
    prefix: null,
    property: null,
    results: number,
    security: null,
    unselectable: null
  },
  space: "html",
  transform: caseInsensitiveTransform
});

// ../../../../site-ux/node_modules/property-information/lib/svg.js
var svg = create({
  attributes: {
    accentHeight: "accent-height",
    alignmentBaseline: "alignment-baseline",
    arabicForm: "arabic-form",
    baselineShift: "baseline-shift",
    capHeight: "cap-height",
    className: "class",
    clipPath: "clip-path",
    clipRule: "clip-rule",
    colorInterpolation: "color-interpolation",
    colorInterpolationFilters: "color-interpolation-filters",
    colorProfile: "color-profile",
    colorRendering: "color-rendering",
    crossOrigin: "crossorigin",
    dataType: "datatype",
    dominantBaseline: "dominant-baseline",
    enableBackground: "enable-background",
    fillOpacity: "fill-opacity",
    fillRule: "fill-rule",
    floodColor: "flood-color",
    floodOpacity: "flood-opacity",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontSizeAdjust: "font-size-adjust",
    fontStretch: "font-stretch",
    fontStyle: "font-style",
    fontVariant: "font-variant",
    fontWeight: "font-weight",
    glyphName: "glyph-name",
    glyphOrientationHorizontal: "glyph-orientation-horizontal",
    glyphOrientationVertical: "glyph-orientation-vertical",
    hrefLang: "hreflang",
    horizAdvX: "horiz-adv-x",
    horizOriginX: "horiz-origin-x",
    horizOriginY: "horiz-origin-y",
    imageRendering: "image-rendering",
    letterSpacing: "letter-spacing",
    lightingColor: "lighting-color",
    markerEnd: "marker-end",
    markerMid: "marker-mid",
    markerStart: "marker-start",
    maskType: "mask-type",
    navDown: "nav-down",
    navDownLeft: "nav-down-left",
    navDownRight: "nav-down-right",
    navLeft: "nav-left",
    navNext: "nav-next",
    navPrev: "nav-prev",
    navRight: "nav-right",
    navUp: "nav-up",
    navUpLeft: "nav-up-left",
    navUpRight: "nav-up-right",
    onAbort: "onabort",
    onActivate: "onactivate",
    onAfterPrint: "onafterprint",
    onBeforePrint: "onbeforeprint",
    onBegin: "onbegin",
    onCancel: "oncancel",
    onCanPlay: "oncanplay",
    onCanPlayThrough: "oncanplaythrough",
    onChange: "onchange",
    onClick: "onclick",
    onClose: "onclose",
    onCopy: "oncopy",
    onCueChange: "oncuechange",
    onCut: "oncut",
    onDblClick: "ondblclick",
    onDrag: "ondrag",
    onDragEnd: "ondragend",
    onDragEnter: "ondragenter",
    onDragExit: "ondragexit",
    onDragLeave: "ondragleave",
    onDragOver: "ondragover",
    onDragStart: "ondragstart",
    onDrop: "ondrop",
    onDurationChange: "ondurationchange",
    onEmptied: "onemptied",
    onEnd: "onend",
    onEnded: "onended",
    onError: "onerror",
    onFocus: "onfocus",
    onFocusIn: "onfocusin",
    onFocusOut: "onfocusout",
    onHashChange: "onhashchange",
    onInput: "oninput",
    onInvalid: "oninvalid",
    onKeyDown: "onkeydown",
    onKeyPress: "onkeypress",
    onKeyUp: "onkeyup",
    onLoad: "onload",
    onLoadedData: "onloadeddata",
    onLoadedMetadata: "onloadedmetadata",
    onLoadStart: "onloadstart",
    onMessage: "onmessage",
    onMouseDown: "onmousedown",
    onMouseEnter: "onmouseenter",
    onMouseLeave: "onmouseleave",
    onMouseMove: "onmousemove",
    onMouseOut: "onmouseout",
    onMouseOver: "onmouseover",
    onMouseUp: "onmouseup",
    onMouseWheel: "onmousewheel",
    onOffline: "onoffline",
    onOnline: "ononline",
    onPageHide: "onpagehide",
    onPageShow: "onpageshow",
    onPaste: "onpaste",
    onPause: "onpause",
    onPlay: "onplay",
    onPlaying: "onplaying",
    onPopState: "onpopstate",
    onProgress: "onprogress",
    onRateChange: "onratechange",
    onRepeat: "onrepeat",
    onReset: "onreset",
    onResize: "onresize",
    onScroll: "onscroll",
    onSeeked: "onseeked",
    onSeeking: "onseeking",
    onSelect: "onselect",
    onShow: "onshow",
    onStalled: "onstalled",
    onStorage: "onstorage",
    onSubmit: "onsubmit",
    onSuspend: "onsuspend",
    onTimeUpdate: "ontimeupdate",
    onToggle: "ontoggle",
    onUnload: "onunload",
    onVolumeChange: "onvolumechange",
    onWaiting: "onwaiting",
    onZoom: "onzoom",
    overlinePosition: "overline-position",
    overlineThickness: "overline-thickness",
    paintOrder: "paint-order",
    panose1: "panose-1",
    pointerEvents: "pointer-events",
    referrerPolicy: "referrerpolicy",
    renderingIntent: "rendering-intent",
    shapeRendering: "shape-rendering",
    stopColor: "stop-color",
    stopOpacity: "stop-opacity",
    strikethroughPosition: "strikethrough-position",
    strikethroughThickness: "strikethrough-thickness",
    strokeDashArray: "stroke-dasharray",
    strokeDashOffset: "stroke-dashoffset",
    strokeLineCap: "stroke-linecap",
    strokeLineJoin: "stroke-linejoin",
    strokeMiterLimit: "stroke-miterlimit",
    strokeOpacity: "stroke-opacity",
    strokeWidth: "stroke-width",
    tabIndex: "tabindex",
    textAnchor: "text-anchor",
    textDecoration: "text-decoration",
    textRendering: "text-rendering",
    transformOrigin: "transform-origin",
    typeOf: "typeof",
    underlinePosition: "underline-position",
    underlineThickness: "underline-thickness",
    unicodeBidi: "unicode-bidi",
    unicodeRange: "unicode-range",
    unitsPerEm: "units-per-em",
    vAlphabetic: "v-alphabetic",
    vHanging: "v-hanging",
    vIdeographic: "v-ideographic",
    vMathematical: "v-mathematical",
    vectorEffect: "vector-effect",
    vertAdvY: "vert-adv-y",
    vertOriginX: "vert-origin-x",
    vertOriginY: "vert-origin-y",
    wordSpacing: "word-spacing",
    writingMode: "writing-mode",
    xHeight: "x-height",
    // These were camelcased in Tiny. Now lowercased in SVG 2
    playbackOrder: "playbackorder",
    timelineBegin: "timelinebegin"
  },
  properties: {
    about: commaOrSpaceSeparated,
    accentHeight: number,
    accumulate: null,
    additive: null,
    alignmentBaseline: null,
    alphabetic: number,
    amplitude: number,
    arabicForm: null,
    ascent: number,
    attributeName: null,
    attributeType: null,
    azimuth: number,
    bandwidth: null,
    baselineShift: null,
    baseFrequency: null,
    baseProfile: null,
    bbox: null,
    begin: null,
    bias: number,
    by: null,
    calcMode: null,
    capHeight: number,
    className: spaceSeparated,
    clip: null,
    clipPath: null,
    clipPathUnits: null,
    clipRule: null,
    color: null,
    colorInterpolation: null,
    colorInterpolationFilters: null,
    colorProfile: null,
    colorRendering: null,
    content: null,
    contentScriptType: null,
    contentStyleType: null,
    crossOrigin: null,
    cursor: null,
    cx: null,
    cy: null,
    d: null,
    dataType: null,
    defaultAction: null,
    descent: number,
    diffuseConstant: number,
    direction: null,
    display: null,
    dur: null,
    divisor: number,
    dominantBaseline: null,
    download: boolean,
    dx: null,
    dy: null,
    edgeMode: null,
    editable: null,
    elevation: number,
    enableBackground: null,
    end: null,
    event: null,
    exponent: number,
    externalResourcesRequired: null,
    fill: null,
    fillOpacity: number,
    fillRule: null,
    filter: null,
    filterRes: null,
    filterUnits: null,
    floodColor: null,
    floodOpacity: null,
    focusable: null,
    focusHighlight: null,
    fontFamily: null,
    fontSize: null,
    fontSizeAdjust: null,
    fontStretch: null,
    fontStyle: null,
    fontVariant: null,
    fontWeight: null,
    format: null,
    fr: null,
    from: null,
    fx: null,
    fy: null,
    g1: commaSeparated,
    g2: commaSeparated,
    glyphName: commaSeparated,
    glyphOrientationHorizontal: null,
    glyphOrientationVertical: null,
    glyphRef: null,
    gradientTransform: null,
    gradientUnits: null,
    handler: null,
    hanging: number,
    hatchContentUnits: null,
    hatchUnits: null,
    height: null,
    href: null,
    hrefLang: null,
    horizAdvX: number,
    horizOriginX: number,
    horizOriginY: number,
    id: null,
    ideographic: number,
    imageRendering: null,
    initialVisibility: null,
    in: null,
    in2: null,
    intercept: number,
    k: number,
    k1: number,
    k2: number,
    k3: number,
    k4: number,
    kernelMatrix: commaOrSpaceSeparated,
    kernelUnitLength: null,
    keyPoints: null,
    // SEMI_COLON_SEPARATED
    keySplines: null,
    // SEMI_COLON_SEPARATED
    keyTimes: null,
    // SEMI_COLON_SEPARATED
    kerning: null,
    lang: null,
    lengthAdjust: null,
    letterSpacing: null,
    lightingColor: null,
    limitingConeAngle: number,
    local: null,
    markerEnd: null,
    markerMid: null,
    markerStart: null,
    markerHeight: null,
    markerUnits: null,
    markerWidth: null,
    mask: null,
    maskContentUnits: null,
    maskType: null,
    maskUnits: null,
    mathematical: null,
    max: null,
    media: null,
    mediaCharacterEncoding: null,
    mediaContentEncodings: null,
    mediaSize: number,
    mediaTime: null,
    method: null,
    min: null,
    mode: null,
    name: null,
    navDown: null,
    navDownLeft: null,
    navDownRight: null,
    navLeft: null,
    navNext: null,
    navPrev: null,
    navRight: null,
    navUp: null,
    navUpLeft: null,
    navUpRight: null,
    numOctaves: null,
    observer: null,
    offset: null,
    onAbort: null,
    onActivate: null,
    onAfterPrint: null,
    onBeforePrint: null,
    onBegin: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnd: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFocusIn: null,
    onFocusOut: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadStart: null,
    onMessage: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onMouseWheel: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRepeat: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onShow: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onZoom: null,
    opacity: null,
    operator: null,
    order: null,
    orient: null,
    orientation: null,
    origin: null,
    overflow: null,
    overlay: null,
    overlinePosition: number,
    overlineThickness: number,
    paintOrder: null,
    panose1: null,
    path: null,
    pathLength: number,
    patternContentUnits: null,
    patternTransform: null,
    patternUnits: null,
    phase: null,
    ping: spaceSeparated,
    pitch: null,
    playbackOrder: null,
    pointerEvents: null,
    points: null,
    pointsAtX: number,
    pointsAtY: number,
    pointsAtZ: number,
    preserveAlpha: null,
    preserveAspectRatio: null,
    primitiveUnits: null,
    propagate: null,
    property: commaOrSpaceSeparated,
    r: null,
    radius: null,
    referrerPolicy: null,
    refX: null,
    refY: null,
    rel: commaOrSpaceSeparated,
    rev: commaOrSpaceSeparated,
    renderingIntent: null,
    repeatCount: null,
    repeatDur: null,
    requiredExtensions: commaOrSpaceSeparated,
    requiredFeatures: commaOrSpaceSeparated,
    requiredFonts: commaOrSpaceSeparated,
    requiredFormats: commaOrSpaceSeparated,
    resource: null,
    restart: null,
    result: null,
    rotate: null,
    rx: null,
    ry: null,
    scale: null,
    seed: null,
    shapeRendering: null,
    side: null,
    slope: null,
    snapshotTime: null,
    specularConstant: number,
    specularExponent: number,
    spreadMethod: null,
    spacing: null,
    startOffset: null,
    stdDeviation: null,
    stemh: null,
    stemv: null,
    stitchTiles: null,
    stopColor: null,
    stopOpacity: null,
    strikethroughPosition: number,
    strikethroughThickness: number,
    string: null,
    stroke: null,
    strokeDashArray: commaOrSpaceSeparated,
    strokeDashOffset: null,
    strokeLineCap: null,
    strokeLineJoin: null,
    strokeMiterLimit: number,
    strokeOpacity: number,
    strokeWidth: null,
    style: null,
    surfaceScale: number,
    syncBehavior: null,
    syncBehaviorDefault: null,
    syncMaster: null,
    syncTolerance: null,
    syncToleranceDefault: null,
    systemLanguage: commaOrSpaceSeparated,
    tabIndex: number,
    tableValues: null,
    target: null,
    targetX: number,
    targetY: number,
    textAnchor: null,
    textDecoration: null,
    textRendering: null,
    textLength: null,
    timelineBegin: null,
    title: null,
    transformBehavior: null,
    type: null,
    typeOf: commaOrSpaceSeparated,
    to: null,
    transform: null,
    transformOrigin: null,
    u1: null,
    u2: null,
    underlinePosition: number,
    underlineThickness: number,
    unicode: null,
    unicodeBidi: null,
    unicodeRange: null,
    unitsPerEm: number,
    values: null,
    vAlphabetic: number,
    vMathematical: number,
    vectorEffect: null,
    vHanging: number,
    vIdeographic: number,
    version: null,
    vertAdvY: number,
    vertOriginX: number,
    vertOriginY: number,
    viewBox: null,
    viewTarget: null,
    visibility: null,
    width: null,
    widths: null,
    wordSpacing: null,
    writingMode: null,
    x: null,
    x1: null,
    x2: null,
    xChannelSelector: null,
    xHeight: number,
    y: null,
    y1: null,
    y2: null,
    yChannelSelector: null,
    z: null,
    zoomAndPan: null
  },
  space: "svg",
  transform: caseSensitiveTransform
});

// ../../../../site-ux/node_modules/property-information/lib/xlink.js
var xlink = create({
  properties: {
    xLinkActuate: null,
    xLinkArcRole: null,
    xLinkHref: null,
    xLinkRole: null,
    xLinkShow: null,
    xLinkTitle: null,
    xLinkType: null
  },
  space: "xlink",
  transform(_2, property) {
    return "xlink:" + property.slice(5).toLowerCase();
  }
});

// ../../../../site-ux/node_modules/property-information/lib/xmlns.js
var xmlns = create({
  attributes: { xmlnsxlink: "xmlns:xlink" },
  properties: { xmlnsXLink: null, xmlns: null },
  space: "xmlns",
  transform: caseInsensitiveTransform
});

// ../../../../site-ux/node_modules/property-information/lib/xml.js
var xml = create({
  properties: { xmlBase: null, xmlLang: null, xmlSpace: null },
  space: "xml",
  transform(_2, property) {
    return "xml:" + property.slice(3).toLowerCase();
  }
});

// ../../../../site-ux/node_modules/property-information/lib/hast-to-react.js
var hastToReact = {
  classId: "classID",
  dataType: "datatype",
  itemId: "itemID",
  strokeDashArray: "strokeDasharray",
  strokeDashOffset: "strokeDashoffset",
  strokeLineCap: "strokeLinecap",
  strokeLineJoin: "strokeLinejoin",
  strokeMiterLimit: "strokeMiterlimit",
  typeOf: "typeof",
  xLinkActuate: "xlinkActuate",
  xLinkArcRole: "xlinkArcrole",
  xLinkHref: "xlinkHref",
  xLinkRole: "xlinkRole",
  xLinkShow: "xlinkShow",
  xLinkTitle: "xlinkTitle",
  xLinkType: "xlinkType",
  xmlnsXLink: "xmlnsXlink"
};

// ../../../../site-ux/node_modules/property-information/lib/find.js
var cap = /[A-Z]/g;
var dash = /-[a-z]/g;
var valid = /^data[-\w.:]+$/i;
function find(schema, value) {
  const normal = normalize(value);
  let property = value;
  let Type = Info;
  if (normal in schema.normal) {
    return schema.property[schema.normal[normal]];
  }
  if (normal.length > 4 && normal.slice(0, 4) === "data" && valid.test(value)) {
    if (value.charAt(4) === "-") {
      const rest = value.slice(5).replace(dash, camelcase);
      property = "data" + rest.charAt(0).toUpperCase() + rest.slice(1);
    } else {
      const rest = value.slice(4);
      if (!dash.test(rest)) {
        let dashes = rest.replace(cap, kebab);
        if (dashes.charAt(0) !== "-") {
          dashes = "-" + dashes;
        }
        value = "data" + dashes;
      }
    }
    Type = DefinedInfo;
  }
  return new Type(property, value);
}
function kebab($0) {
  return "-" + $0.toLowerCase();
}
function camelcase($0) {
  return $0.charAt(1).toUpperCase();
}

// ../../../../site-ux/node_modules/property-information/index.js
var html2 = merge([aria, html, xlink, xmlns, xml], "html");
var svg2 = merge([aria, svg, xlink, xmlns, xml], "svg");

// ../../../../site-ux/node_modules/space-separated-tokens/index.js
function stringify2(values) {
  return values.join(" ").trim();
}

// ../../../../site-ux/node_modules/hast-util-to-jsx-runtime/lib/index.js
var import_style_to_js = __toESM(require_cjs3());
var pointStart = point("start");
function point(type) {
  return point3;
  function point3(node) {
    const point4 = node && node.position && node.position[type] || {};
    if (typeof point4.line === "number" && point4.line > 0 && typeof point4.column === "number" && point4.column > 0) {
      return {
        line: point4.line,
        column: point4.column,
        offset: typeof point4.offset === "number" && point4.offset > -1 ? point4.offset : void 0
      };
    }
  }
}

// ../../../../site-ux/node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position2(value.position);
  }
  if ("start" in value || "end" in value) {
    return position2(value);
  }
  if ("line" in value || "column" in value) {
    return point2(value);
  }
  return "";
}
function point2(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position2(pos) {
  return point2(pos && pos.start) + "-" + point2(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// ../../../../site-ux/node_modules/vfile-message/lib/index.js
var VFileMessage = class extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(causeOrReason, optionsOrParentOrPlace, origin) {
    super();
    if (typeof optionsOrParentOrPlace === "string") {
      origin = optionsOrParentOrPlace;
      optionsOrParentOrPlace = void 0;
    }
    let reason = "";
    let options = {};
    let legacyCause = false;
    if (optionsOrParentOrPlace) {
      if ("line" in optionsOrParentOrPlace && "column" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("start" in optionsOrParentOrPlace && "end" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("type" in optionsOrParentOrPlace) {
        options = {
          ancestors: [optionsOrParentOrPlace],
          place: optionsOrParentOrPlace.position
        };
      } else {
        options = { ...optionsOrParentOrPlace };
      }
    }
    if (typeof causeOrReason === "string") {
      reason = causeOrReason;
    } else if (!options.cause && causeOrReason) {
      legacyCause = true;
      reason = causeOrReason.message;
      options.cause = causeOrReason;
    }
    if (!options.ruleId && !options.source && typeof origin === "string") {
      const index2 = origin.indexOf(":");
      if (index2 === -1) {
        options.ruleId = origin;
      } else {
        options.source = origin.slice(0, index2);
        options.ruleId = origin.slice(index2 + 1);
      }
    }
    if (!options.place && options.ancestors && options.ancestors) {
      const parent = options.ancestors[options.ancestors.length - 1];
      if (parent) {
        options.place = parent.position;
      }
    }
    const start2 = options.place && "start" in options.place ? options.place.start : options.place;
    this.ancestors = options.ancestors || void 0;
    this.cause = options.cause || void 0;
    this.column = start2 ? start2.column : void 0;
    this.fatal = void 0;
    this.file = "";
    this.message = reason;
    this.line = start2 ? start2.line : void 0;
    this.name = stringifyPosition(options.place) || "1:1";
    this.place = options.place || void 0;
    this.reason = this.message;
    this.ruleId = options.ruleId || void 0;
    this.source = options.source || void 0;
    this.stack = legacyCause && options.cause && typeof options.cause.stack === "string" ? options.cause.stack : "";
    this.actual = void 0;
    this.expected = void 0;
    this.note = void 0;
    this.url = void 0;
  }
};
VFileMessage.prototype.file = "";
VFileMessage.prototype.name = "";
VFileMessage.prototype.reason = "";
VFileMessage.prototype.message = "";
VFileMessage.prototype.stack = "";
VFileMessage.prototype.column = void 0;
VFileMessage.prototype.line = void 0;
VFileMessage.prototype.ancestors = void 0;
VFileMessage.prototype.cause = void 0;
VFileMessage.prototype.fatal = void 0;
VFileMessage.prototype.place = void 0;
VFileMessage.prototype.ruleId = void 0;
VFileMessage.prototype.source = void 0;

// ../../../../site-ux/node_modules/hast-util-to-jsx-runtime/lib/index.js
var own = {}.hasOwnProperty;
var emptyMap = /* @__PURE__ */ new Map();
var cap2 = /[A-Z]/g;
var tableElements = /* @__PURE__ */ new Set(["table", "tbody", "thead", "tfoot", "tr"]);
var tableCellElement = /* @__PURE__ */ new Set(["td", "th"]);
var docs = "https://github.com/syntax-tree/hast-util-to-jsx-runtime";
function toJsxRuntime(tree, options) {
  if (!options || options.Fragment === void 0) {
    throw new TypeError("Expected `Fragment` in options");
  }
  const filePath = options.filePath || void 0;
  let create2;
  if (options.development) {
    if (typeof options.jsxDEV !== "function") {
      throw new TypeError(
        "Expected `jsxDEV` in options when `development: true`"
      );
    }
    create2 = developmentCreate(filePath, options.jsxDEV);
  } else {
    if (typeof options.jsx !== "function") {
      throw new TypeError("Expected `jsx` in production options");
    }
    if (typeof options.jsxs !== "function") {
      throw new TypeError("Expected `jsxs` in production options");
    }
    create2 = productionCreate(filePath, options.jsx, options.jsxs);
  }
  const state = {
    Fragment: options.Fragment,
    ancestors: [],
    components: options.components || {},
    create: create2,
    elementAttributeNameCase: options.elementAttributeNameCase || "react",
    evaluater: options.createEvaluater ? options.createEvaluater() : void 0,
    filePath,
    ignoreInvalidStyle: options.ignoreInvalidStyle || false,
    passKeys: options.passKeys !== false,
    passNode: options.passNode || false,
    schema: options.space === "svg" ? svg2 : html2,
    stylePropertyNameCase: options.stylePropertyNameCase || "dom",
    tableCellAlignToStyle: options.tableCellAlignToStyle !== false
  };
  const result = one(state, tree, void 0);
  if (result && typeof result !== "string") {
    return result;
  }
  return state.create(
    tree,
    state.Fragment,
    { children: result || void 0 },
    void 0
  );
}
function one(state, node, key) {
  if (node.type === "element") {
    return element(state, node, key);
  }
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    return mdxExpression(state, node);
  }
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    return mdxJsxElement(state, node, key);
  }
  if (node.type === "mdxjsEsm") {
    return mdxEsm(state, node);
  }
  if (node.type === "root") {
    return root(state, node, key);
  }
  if (node.type === "text") {
    return text(state, node);
  }
}
function element(state, node, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node.tagName.toLowerCase() === "svg" && parentSchema.space === "html") {
    schema = svg2;
    state.schema = schema;
  }
  state.ancestors.push(node);
  const type = findComponentFromName(state, node.tagName, false);
  const props = createElementProps(state, node);
  let children = createChildren(state, node);
  if (tableElements.has(node.tagName)) {
    children = children.filter(function(child) {
      return typeof child === "string" ? !whitespace(child) : true;
    });
  }
  addNode(state, props, type, node);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node, type, props, key);
}
function mdxExpression(state, node) {
  if (node.data && node.data.estree && state.evaluater) {
    const program = node.data.estree;
    const expression = program.body[0];
    ok(expression.type === "ExpressionStatement");
    return (
      /** @type {Child | undefined} */
      state.evaluater.evaluateExpression(expression.expression)
    );
  }
  crashEstree(state, node.position);
}
function mdxEsm(state, node) {
  if (node.data && node.data.estree && state.evaluater) {
    return (
      /** @type {Child | undefined} */
      state.evaluater.evaluateProgram(node.data.estree)
    );
  }
  crashEstree(state, node.position);
}
function mdxJsxElement(state, node, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node.name === "svg" && parentSchema.space === "html") {
    schema = svg2;
    state.schema = schema;
  }
  state.ancestors.push(node);
  const type = node.name === null ? state.Fragment : findComponentFromName(state, node.name, true);
  const props = createJsxElementProps(state, node);
  const children = createChildren(state, node);
  addNode(state, props, type, node);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node, type, props, key);
}
function root(state, node, key) {
  const props = {};
  addChildren(props, createChildren(state, node));
  return state.create(node, state.Fragment, props, key);
}
function text(_2, node) {
  return node.value;
}
function addNode(state, props, type, node) {
  if (typeof type !== "string" && type !== state.Fragment && state.passNode) {
    props.node = node;
  }
}
function addChildren(props, children) {
  if (children.length > 0) {
    const value = children.length > 1 ? children : children[0];
    if (value) {
      props.children = value;
    }
  }
}
function productionCreate(_2, jsx, jsxs) {
  return create2;
  function create2(_3, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const fn = isStaticChildren ? jsxs : jsx;
    return key ? fn(type, props, key) : fn(type, props);
  }
}
function developmentCreate(filePath, jsxDEV) {
  return create2;
  function create2(node, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const point3 = pointStart(node);
    return jsxDEV(
      type,
      props,
      key,
      isStaticChildren,
      {
        columnNumber: point3 ? point3.column - 1 : void 0,
        fileName: filePath,
        lineNumber: point3 ? point3.line : void 0
      },
      void 0
    );
  }
}
function createElementProps(state, node) {
  const props = {};
  let alignValue;
  let prop;
  for (prop in node.properties) {
    if (prop !== "children" && own.call(node.properties, prop)) {
      const result = createProperty(state, prop, node.properties[prop]);
      if (result) {
        const [key, value] = result;
        if (state.tableCellAlignToStyle && key === "align" && typeof value === "string" && tableCellElement.has(node.tagName)) {
          alignValue = value;
        } else {
          props[key] = value;
        }
      }
    }
  }
  if (alignValue) {
    const style = (
      /** @type {Style} */
      props.style || (props.style = {})
    );
    style[state.stylePropertyNameCase === "css" ? "text-align" : "textAlign"] = alignValue;
  }
  return props;
}
function createJsxElementProps(state, node) {
  const props = {};
  for (const attribute of node.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      if (attribute.data && attribute.data.estree && state.evaluater) {
        const program = attribute.data.estree;
        const expression = program.body[0];
        ok(expression.type === "ExpressionStatement");
        const objectExpression = expression.expression;
        ok(objectExpression.type === "ObjectExpression");
        const property = objectExpression.properties[0];
        ok(property.type === "SpreadElement");
        Object.assign(
          props,
          state.evaluater.evaluateExpression(property.argument)
        );
      } else {
        crashEstree(state, node.position);
      }
    } else {
      const name2 = attribute.name;
      let value;
      if (attribute.value && typeof attribute.value === "object") {
        if (attribute.value.data && attribute.value.data.estree && state.evaluater) {
          const program = attribute.value.data.estree;
          const expression = program.body[0];
          ok(expression.type === "ExpressionStatement");
          value = state.evaluater.evaluateExpression(expression.expression);
        } else {
          crashEstree(state, node.position);
        }
      } else {
        value = attribute.value === null ? true : attribute.value;
      }
      props[name2] = /** @type {Props[keyof Props]} */
      value;
    }
  }
  return props;
}
function createChildren(state, node) {
  const children = [];
  let index2 = -1;
  const countsByName = state.passKeys ? /* @__PURE__ */ new Map() : emptyMap;
  while (++index2 < node.children.length) {
    const child = node.children[index2];
    let key;
    if (state.passKeys) {
      const name2 = child.type === "element" ? child.tagName : child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement" ? child.name : void 0;
      if (name2) {
        const count = countsByName.get(name2) || 0;
        key = name2 + "-" + count;
        countsByName.set(name2, count + 1);
      }
    }
    const result = one(state, child, key);
    if (result !== void 0) children.push(result);
  }
  return children;
}
function createProperty(state, prop, value) {
  const info = find(state.schema, prop);
  if (value === null || value === void 0 || typeof value === "number" && Number.isNaN(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value = info.commaSeparated ? stringify(value) : stringify2(value);
  }
  if (info.property === "style") {
    let styleObject = typeof value === "object" ? value : parseStyle(state, String(value));
    if (state.stylePropertyNameCase === "css") {
      styleObject = transformStylesToCssCasing(styleObject);
    }
    return ["style", styleObject];
  }
  return [
    state.elementAttributeNameCase === "react" && info.space ? hastToReact[info.property] || info.property : info.attribute,
    value
  ];
}
function parseStyle(state, value) {
  try {
    return (0, import_style_to_js.default)(value, { reactCompat: true });
  } catch (error) {
    if (state.ignoreInvalidStyle) {
      return {};
    }
    const cause = (
      /** @type {Error} */
      error
    );
    const message = new VFileMessage("Cannot parse `style` attribute", {
      ancestors: state.ancestors,
      cause,
      ruleId: "style",
      source: "hast-util-to-jsx-runtime"
    });
    message.file = state.filePath || void 0;
    message.url = docs + "#cannot-parse-style-attribute";
    throw message;
  }
}
function findComponentFromName(state, name2, allowExpression) {
  let result;
  if (!allowExpression) {
    result = { type: "Literal", value: name2 };
  } else if (name2.includes(".")) {
    const identifiers = name2.split(".");
    let index2 = -1;
    let node;
    while (++index2 < identifiers.length) {
      const prop = name(identifiers[index2]) ? { type: "Identifier", name: identifiers[index2] } : { type: "Literal", value: identifiers[index2] };
      node = node ? {
        type: "MemberExpression",
        object: node,
        property: prop,
        computed: Boolean(index2 && prop.type === "Literal"),
        optional: false
      } : prop;
    }
    result = node;
  } else {
    result = name(name2) && !/^[a-z]/.test(name2) ? { type: "Identifier", name: name2 } : { type: "Literal", value: name2 };
  }
  if (result.type === "Literal") {
    const name3 = (
      /** @type {string | number} */
      result.value
    );
    return own.call(state.components, name3) ? state.components[name3] : name3;
  }
  if (state.evaluater) {
    return state.evaluater.evaluateExpression(result);
  }
  crashEstree(state);
}
function crashEstree(state, place) {
  const message = new VFileMessage(
    "Cannot handle MDX estrees without `createEvaluater`",
    {
      ancestors: state.ancestors,
      place,
      ruleId: "mdx-estree",
      source: "hast-util-to-jsx-runtime"
    }
  );
  message.file = state.filePath || void 0;
  message.url = docs + "#cannot-handle-mdx-estrees-without-createevaluater";
  throw message;
}
function transformStylesToCssCasing(domCasing) {
  const cssCasing = {};
  let from;
  for (from in domCasing) {
    if (own.call(domCasing, from)) {
      cssCasing[transformStyleToCssCasing(from)] = domCasing[from];
    }
  }
  return cssCasing;
}
function transformStyleToCssCasing(from) {
  let to = from.replace(cap2, toDash);
  if (to.slice(0, 3) === "ms-") to = "-" + to;
  return to;
}
function toDash($0) {
  return "-" + $0.toLowerCase();
}

// ../../../../site-ux/node_modules/@quartz-community/utils/dist/jsx.js
function childrenToString(children) {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  return String(children ?? "");
}
var builtinComponents = {
  table: (props) => /* @__PURE__ */ u2("div", { class: "table-container", children: /* @__PURE__ */ u2("table", { ...props }) }),
  style: ({ children, ...rest }) => k("style", { ...rest, dangerouslySetInnerHTML: { __html: childrenToString(children) } }),
  script: ({ children, ...rest }) => k("script", { ...rest, dangerouslySetInnerHTML: { __html: childrenToString(children) } })
};
function htmlToJsx(tree, components) {
  return toJsxRuntime(tree, {
    Fragment: S,
    jsx: u2,
    jsxs: u2,
    elementAttributeNameCase: "html",
    components: { ...builtinComponents, ...components }
  });
}

// src/components/Masthead.tsx
function Masthead({ masthead }) {
  const root2 = { type: "root", children: masthead.nodes };
  const attrs = { [MASTHEAD_ATTR]: mastheadPattern(masthead) };
  return /* @__PURE__ */ u2("div", { class: "bwz-masthead", ...attrs, children: htmlToJsx(root2) });
}

// src/components/scripts/early.inline.ts
var early_inline_default = 'var m={groups:[{id:"torah",name:"\\u6469\\u897F\\u4E94\\u7D93",testament:"ot"},{id:"history",name:"\\u6B77\\u53F2\\u66F8",testament:"ot"},{id:"wisdom",name:"\\u8A69\\u6B4C\\u667A\\u6167\\u66F8",testament:"ot"},{id:"prophets",name:"\\u5148\\u77E5\\u66F8",testament:"ot"},{id:"gospels",name:"\\u798F\\u97F3\\u66F8",testament:"nt"},{id:"acts",name:"\\u4F7F\\u5F92\\u884C\\u50B3",testament:"nt"},{id:"epistles",name:"\\u66F8\\u4FE1",testament:"nt"},{id:"revelation",name:"\\u555F\\u793A\\u9304",testament:"nt"}],books:[{num:1,name:"\\u5275\\u4E16\\u8A18",chapters:50,short:"\\u5275",group:"torah"},{num:2,name:"\\u51FA\\u57C3\\u53CA\\u8A18",chapters:40,short:"\\u51FA",group:"torah"},{num:3,name:"\\u5229\\u672A\\u8A18",chapters:27,short:"\\u5229",group:"torah"},{num:4,name:"\\u6C11\\u6578\\u8A18",chapters:36,short:"\\u6C11",group:"torah"},{num:5,name:"\\u7533\\u547D\\u8A18",chapters:34,short:"\\u7533",group:"torah"},{num:6,name:"\\u7D04\\u66F8\\u4E9E\\u8A18",chapters:24,short:"\\u66F8",group:"history"},{num:7,name:"\\u58EB\\u5E2B\\u8A18",chapters:21,short:"\\u58EB",group:"history"},{num:8,name:"\\u8DEF\\u5F97\\u8A18",chapters:4,short:"\\u5F97",group:"history"},{num:9,name:"\\u6492\\u6BCD\\u8033\\u8A18\\u4E0A",chapters:31,short:"\\u6492\\u4E0A",group:"history"},{num:10,name:"\\u6492\\u6BCD\\u8033\\u8A18\\u4E0B",chapters:24,short:"\\u6492\\u4E0B",group:"history"},{num:11,name:"\\u5217\\u738B\\u7D00\\u4E0A",chapters:22,short:"\\u738B\\u4E0A",group:"history"},{num:12,name:"\\u5217\\u738B\\u7D00\\u4E0B",chapters:25,short:"\\u738B\\u4E0B",group:"history"},{num:13,name:"\\u6B77\\u4EE3\\u5FD7\\u4E0A",chapters:29,short:"\\u4EE3\\u4E0A",group:"history"},{num:14,name:"\\u6B77\\u4EE3\\u5FD7\\u4E0B",chapters:36,short:"\\u4EE3\\u4E0B",group:"history"},{num:15,name:"\\u4EE5\\u65AF\\u62C9\\u8A18",chapters:10,short:"\\u62C9",group:"history"},{num:16,name:"\\u5C3C\\u5E0C\\u7C73\\u8A18",chapters:13,short:"\\u5C3C",group:"history"},{num:17,name:"\\u4EE5\\u65AF\\u5E16\\u8A18",chapters:10,short:"\\u65AF",group:"history"},{num:18,name:"\\u7D04\\u4F2F\\u8A18",chapters:42,short:"\\u4F2F",group:"wisdom"},{num:19,name:"\\u8A69\\u7BC7",chapters:150,short:"\\u8A69",group:"wisdom"},{num:20,name:"\\u7BB4\\u8A00",chapters:31,short:"\\u7BB4",group:"wisdom"},{num:21,name:"\\u50B3\\u9053\\u66F8",chapters:12,short:"\\u50B3",group:"wisdom"},{num:22,name:"\\u96C5\\u6B4C",chapters:8,short:"\\u6B4C",group:"wisdom"},{num:23,name:"\\u4EE5\\u8CFD\\u4E9E\\u66F8",chapters:66,short:"\\u8CFD",group:"prophets"},{num:24,name:"\\u8036\\u5229\\u7C73\\u66F8",chapters:52,short:"\\u8036",group:"prophets"},{num:25,name:"\\u8036\\u5229\\u7C73\\u54C0\\u6B4C",chapters:5,short:"\\u54C0",group:"prophets"},{num:26,name:"\\u4EE5\\u897F\\u7D50\\u66F8",chapters:48,short:"\\u7D50",group:"prophets"},{num:27,name:"\\u4F46\\u4EE5\\u7406\\u66F8",chapters:12,short:"\\u4F46",group:"prophets"},{num:28,name:"\\u4F55\\u897F\\u963F\\u66F8",chapters:14,short:"\\u4F55",group:"prophets"},{num:29,name:"\\u7D04\\u73E5\\u66F8",chapters:3,short:"\\u73E5",group:"prophets"},{num:30,name:"\\u963F\\u6469\\u53F8\\u66F8",chapters:9,short:"\\u6469",group:"prophets"},{num:31,name:"\\u4FC4\\u5DF4\\u5E95\\u4E9E\\u66F8",chapters:1,short:"\\u4FC4",group:"prophets"},{num:32,name:"\\u7D04\\u62FF\\u66F8",chapters:4,short:"\\u62FF",group:"prophets"},{num:33,name:"\\u5F4C\\u8FE6\\u66F8",chapters:7,short:"\\u5F4C",group:"prophets"},{num:34,name:"\\u90A3\\u9D3B\\u66F8",chapters:3,short:"\\u9D3B",group:"prophets"},{num:35,name:"\\u54C8\\u5DF4\\u8C37\\u66F8",chapters:3,short:"\\u54C8",group:"prophets"},{num:36,name:"\\u897F\\u756A\\u96C5\\u66F8",chapters:3,short:"\\u756A",group:"prophets"},{num:37,name:"\\u54C8\\u8A72\\u66F8",chapters:2,short:"\\u8A72",group:"prophets"},{num:38,name:"\\u6492\\u8FE6\\u5229\\u4E9E\\u66F8",chapters:14,short:"\\u4E9E",group:"prophets"},{num:39,name:"\\u746A\\u62C9\\u57FA\\u66F8",chapters:4,short:"\\u746A",group:"prophets"},{num:40,name:"\\u99AC\\u592A\\u798F\\u97F3",chapters:28,short:"\\u592A",group:"gospels"},{num:41,name:"\\u99AC\\u53EF\\u798F\\u97F3",chapters:16,short:"\\u53EF",group:"gospels"},{num:42,name:"\\u8DEF\\u52A0\\u798F\\u97F3",chapters:24,short:"\\u8DEF",group:"gospels"},{num:43,name:"\\u7D04\\u7FF0\\u798F\\u97F3",chapters:21,short:"\\u7D04",group:"gospels"},{num:44,name:"\\u4F7F\\u5F92\\u884C\\u50B3",chapters:28,short:"\\u5F92",group:"acts"},{num:45,name:"\\u7F85\\u99AC\\u66F8",chapters:16,short:"\\u7F85",group:"epistles"},{num:46,name:"\\u54E5\\u6797\\u591A\\u524D\\u66F8",chapters:16,short:"\\u6797\\u524D",group:"epistles"},{num:47,name:"\\u54E5\\u6797\\u591A\\u5F8C\\u66F8",chapters:13,short:"\\u6797\\u5F8C",group:"epistles"},{num:48,name:"\\u52A0\\u62C9\\u592A\\u66F8",chapters:6,short:"\\u52A0",group:"epistles"},{num:49,name:"\\u4EE5\\u5F17\\u6240\\u66F8",chapters:6,short:"\\u5F17",group:"epistles"},{num:50,name:"\\u8153\\u7ACB\\u6BD4\\u66F8",chapters:4,short:"\\u8153",group:"epistles"},{num:51,name:"\\u6B4C\\u7F85\\u897F\\u66F8",chapters:4,short:"\\u897F",group:"epistles"},{num:52,name:"\\u5E16\\u6492\\u7F85\\u5C3C\\u8FE6\\u524D\\u66F8",chapters:5,short:"\\u5E16\\u524D",group:"epistles"},{num:53,name:"\\u5E16\\u6492\\u7F85\\u5C3C\\u8FE6\\u5F8C\\u66F8",chapters:3,short:"\\u5E16\\u5F8C",group:"epistles"},{num:54,name:"\\u63D0\\u6469\\u592A\\u524D\\u66F8",chapters:6,short:"\\u63D0\\u524D",group:"epistles"},{num:55,name:"\\u63D0\\u6469\\u592A\\u5F8C\\u66F8",chapters:4,short:"\\u63D0\\u5F8C",group:"epistles"},{num:56,name:"\\u63D0\\u591A\\u66F8",chapters:3,short:"\\u591A",group:"epistles"},{num:57,name:"\\u8153\\u5229\\u9580\\u66F8",chapters:1,short:"\\u9580",group:"epistles"},{num:58,name:"\\u5E0C\\u4F2F\\u4F86\\u66F8",chapters:13,short:"\\u4F86",group:"epistles"},{num:59,name:"\\u96C5\\u5404\\u66F8",chapters:5,short:"\\u96C5",group:"epistles"},{num:60,name:"\\u5F7C\\u5F97\\u524D\\u66F8",chapters:5,short:"\\u5F7C\\u524D",group:"epistles"},{num:61,name:"\\u5F7C\\u5F97\\u5F8C\\u66F8",chapters:3,short:"\\u5F7C\\u5F8C",group:"epistles"},{num:62,name:"\\u7D04\\u7FF0\\u4E00\\u66F8",chapters:5,short:"\\u7D04\\u4E00",group:"epistles"},{num:63,name:"\\u7D04\\u7FF0\\u4E8C\\u66F8",chapters:1,short:"\\u7D04\\u4E8C",group:"epistles"},{num:64,name:"\\u7D04\\u7FF0\\u4E09\\u66F8",chapters:1,short:"\\u7D04\\u4E09",group:"epistles"},{num:65,name:"\\u7336\\u5927\\u66F8",chapters:1,short:"\\u7336",group:"epistles"},{num:66,name:"\\u555F\\u793A\\u9304",chapters:22,short:"\\u555F",group:"revelation"}]};var w=m.groups,l=m.books;function c(e){return String(e.num).padStart(2,"0")+"-"+e.name}function B(e){let t=e.trim().split(/[?#]/,1)[0];try{return decodeURIComponent(t)}catch{return t}}function h(e){return B(e).replace(/\\\\/g,"/").replace(/^\\/+|\\/+$/g,"").replace(/\\.html$/i,"").replace(/[\\s]+/g,"-")}function p(e){let o=h(e).split("/").at(-1);return l.find(s=>c(s)===o)}function I(e){return h(e).split("/")}function d(e){let t=I(e);if(t.length!==2)return null;let[o,s]=t,r=p(o);if(!r)return null;let a=/^\u7B2C(\\d+)\u7AE0$/.exec(s);if(a){let n=Number(a[1]);return!Number.isInteger(n)||n<1||n>r.chapters?null:{book:r,kind:"chapter",chapter:n}}return s==="\\u5168\\u66F8\\u76EE\\u9304\\u53CA\\u7DB1\\u8981"?{book:r,kind:"toc"}:s==="\\u66F8\\u5377\\u5C0E\\u8AD6"?{book:r,kind:"intro"}:null}var f="bwz-reading",u={v:1,books:{}};function g(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function N(e){return Number.isNaN(e)?0:Math.min(1,Math.max(0,e))}function E(e){return e===Number.POSITIVE_INFINITY?e:Number.isFinite(e)?Math.max(0,Math.floor(e)):0}function b(e){if(e==null)return u;let t;try{t=JSON.parse(e)}catch{return u}if(!g(t)||t.v!==1||!g(t.books))return u;let o={};for(let[s,r]of Object.entries(t.books)){if(!g(r))continue;let{slug:a,ratio:n,t:i}=r;typeof a!="string"||typeof n!="number"||!Number.isFinite(n)||typeof i!="number"||!Number.isFinite(i)||(o[s]={slug:a,ratio:N(n),t:i})}return{v:1,books:o}}function R(e,t){let o=[];for(let[s,r]of Object.entries(e.books)){let a=p(s),n=d(r.slug);!a||!n||n.kind!=="chapter"||n.book.num!==a.num||o.push({...r,book:a,chapter:n.chapter})}return o.sort((s,r)=>r.t-s.t).slice(0,E(t))}function k(){try{return typeof localStorage>"u"?null:localStorage}catch{return null}}function O(e=k()){if(!e)return u;try{return b(e.getItem(f))}catch{return u}}function S(e=k()){return R(O(e),1).length>0}var A="data-bwz-reading";function v(e){return S(e)?"has":"none"}function y(e=document.documentElement,t){let o=v(t);return e.setAttribute(A,o),o}y();\n';

// src/components/scripts/hub.inline.ts
var hub_inline_default = 'var x={groups:[{id:"torah",name:"\\u6469\\u897F\\u4E94\\u7D93",testament:"ot"},{id:"history",name:"\\u6B77\\u53F2\\u66F8",testament:"ot"},{id:"wisdom",name:"\\u8A69\\u6B4C\\u667A\\u6167\\u66F8",testament:"ot"},{id:"prophets",name:"\\u5148\\u77E5\\u66F8",testament:"ot"},{id:"gospels",name:"\\u798F\\u97F3\\u66F8",testament:"nt"},{id:"acts",name:"\\u4F7F\\u5F92\\u884C\\u50B3",testament:"nt"},{id:"epistles",name:"\\u66F8\\u4FE1",testament:"nt"},{id:"revelation",name:"\\u555F\\u793A\\u9304",testament:"nt"}],books:[{num:1,name:"\\u5275\\u4E16\\u8A18",chapters:50,short:"\\u5275",group:"torah"},{num:2,name:"\\u51FA\\u57C3\\u53CA\\u8A18",chapters:40,short:"\\u51FA",group:"torah"},{num:3,name:"\\u5229\\u672A\\u8A18",chapters:27,short:"\\u5229",group:"torah"},{num:4,name:"\\u6C11\\u6578\\u8A18",chapters:36,short:"\\u6C11",group:"torah"},{num:5,name:"\\u7533\\u547D\\u8A18",chapters:34,short:"\\u7533",group:"torah"},{num:6,name:"\\u7D04\\u66F8\\u4E9E\\u8A18",chapters:24,short:"\\u66F8",group:"history"},{num:7,name:"\\u58EB\\u5E2B\\u8A18",chapters:21,short:"\\u58EB",group:"history"},{num:8,name:"\\u8DEF\\u5F97\\u8A18",chapters:4,short:"\\u5F97",group:"history"},{num:9,name:"\\u6492\\u6BCD\\u8033\\u8A18\\u4E0A",chapters:31,short:"\\u6492\\u4E0A",group:"history"},{num:10,name:"\\u6492\\u6BCD\\u8033\\u8A18\\u4E0B",chapters:24,short:"\\u6492\\u4E0B",group:"history"},{num:11,name:"\\u5217\\u738B\\u7D00\\u4E0A",chapters:22,short:"\\u738B\\u4E0A",group:"history"},{num:12,name:"\\u5217\\u738B\\u7D00\\u4E0B",chapters:25,short:"\\u738B\\u4E0B",group:"history"},{num:13,name:"\\u6B77\\u4EE3\\u5FD7\\u4E0A",chapters:29,short:"\\u4EE3\\u4E0A",group:"history"},{num:14,name:"\\u6B77\\u4EE3\\u5FD7\\u4E0B",chapters:36,short:"\\u4EE3\\u4E0B",group:"history"},{num:15,name:"\\u4EE5\\u65AF\\u62C9\\u8A18",chapters:10,short:"\\u62C9",group:"history"},{num:16,name:"\\u5C3C\\u5E0C\\u7C73\\u8A18",chapters:13,short:"\\u5C3C",group:"history"},{num:17,name:"\\u4EE5\\u65AF\\u5E16\\u8A18",chapters:10,short:"\\u65AF",group:"history"},{num:18,name:"\\u7D04\\u4F2F\\u8A18",chapters:42,short:"\\u4F2F",group:"wisdom"},{num:19,name:"\\u8A69\\u7BC7",chapters:150,short:"\\u8A69",group:"wisdom"},{num:20,name:"\\u7BB4\\u8A00",chapters:31,short:"\\u7BB4",group:"wisdom"},{num:21,name:"\\u50B3\\u9053\\u66F8",chapters:12,short:"\\u50B3",group:"wisdom"},{num:22,name:"\\u96C5\\u6B4C",chapters:8,short:"\\u6B4C",group:"wisdom"},{num:23,name:"\\u4EE5\\u8CFD\\u4E9E\\u66F8",chapters:66,short:"\\u8CFD",group:"prophets"},{num:24,name:"\\u8036\\u5229\\u7C73\\u66F8",chapters:52,short:"\\u8036",group:"prophets"},{num:25,name:"\\u8036\\u5229\\u7C73\\u54C0\\u6B4C",chapters:5,short:"\\u54C0",group:"prophets"},{num:26,name:"\\u4EE5\\u897F\\u7D50\\u66F8",chapters:48,short:"\\u7D50",group:"prophets"},{num:27,name:"\\u4F46\\u4EE5\\u7406\\u66F8",chapters:12,short:"\\u4F46",group:"prophets"},{num:28,name:"\\u4F55\\u897F\\u963F\\u66F8",chapters:14,short:"\\u4F55",group:"prophets"},{num:29,name:"\\u7D04\\u73E5\\u66F8",chapters:3,short:"\\u73E5",group:"prophets"},{num:30,name:"\\u963F\\u6469\\u53F8\\u66F8",chapters:9,short:"\\u6469",group:"prophets"},{num:31,name:"\\u4FC4\\u5DF4\\u5E95\\u4E9E\\u66F8",chapters:1,short:"\\u4FC4",group:"prophets"},{num:32,name:"\\u7D04\\u62FF\\u66F8",chapters:4,short:"\\u62FF",group:"prophets"},{num:33,name:"\\u5F4C\\u8FE6\\u66F8",chapters:7,short:"\\u5F4C",group:"prophets"},{num:34,name:"\\u90A3\\u9D3B\\u66F8",chapters:3,short:"\\u9D3B",group:"prophets"},{num:35,name:"\\u54C8\\u5DF4\\u8C37\\u66F8",chapters:3,short:"\\u54C8",group:"prophets"},{num:36,name:"\\u897F\\u756A\\u96C5\\u66F8",chapters:3,short:"\\u756A",group:"prophets"},{num:37,name:"\\u54C8\\u8A72\\u66F8",chapters:2,short:"\\u8A72",group:"prophets"},{num:38,name:"\\u6492\\u8FE6\\u5229\\u4E9E\\u66F8",chapters:14,short:"\\u4E9E",group:"prophets"},{num:39,name:"\\u746A\\u62C9\\u57FA\\u66F8",chapters:4,short:"\\u746A",group:"prophets"},{num:40,name:"\\u99AC\\u592A\\u798F\\u97F3",chapters:28,short:"\\u592A",group:"gospels"},{num:41,name:"\\u99AC\\u53EF\\u798F\\u97F3",chapters:16,short:"\\u53EF",group:"gospels"},{num:42,name:"\\u8DEF\\u52A0\\u798F\\u97F3",chapters:24,short:"\\u8DEF",group:"gospels"},{num:43,name:"\\u7D04\\u7FF0\\u798F\\u97F3",chapters:21,short:"\\u7D04",group:"gospels"},{num:44,name:"\\u4F7F\\u5F92\\u884C\\u50B3",chapters:28,short:"\\u5F92",group:"acts"},{num:45,name:"\\u7F85\\u99AC\\u66F8",chapters:16,short:"\\u7F85",group:"epistles"},{num:46,name:"\\u54E5\\u6797\\u591A\\u524D\\u66F8",chapters:16,short:"\\u6797\\u524D",group:"epistles"},{num:47,name:"\\u54E5\\u6797\\u591A\\u5F8C\\u66F8",chapters:13,short:"\\u6797\\u5F8C",group:"epistles"},{num:48,name:"\\u52A0\\u62C9\\u592A\\u66F8",chapters:6,short:"\\u52A0",group:"epistles"},{num:49,name:"\\u4EE5\\u5F17\\u6240\\u66F8",chapters:6,short:"\\u5F17",group:"epistles"},{num:50,name:"\\u8153\\u7ACB\\u6BD4\\u66F8",chapters:4,short:"\\u8153",group:"epistles"},{num:51,name:"\\u6B4C\\u7F85\\u897F\\u66F8",chapters:4,short:"\\u897F",group:"epistles"},{num:52,name:"\\u5E16\\u6492\\u7F85\\u5C3C\\u8FE6\\u524D\\u66F8",chapters:5,short:"\\u5E16\\u524D",group:"epistles"},{num:53,name:"\\u5E16\\u6492\\u7F85\\u5C3C\\u8FE6\\u5F8C\\u66F8",chapters:3,short:"\\u5E16\\u5F8C",group:"epistles"},{num:54,name:"\\u63D0\\u6469\\u592A\\u524D\\u66F8",chapters:6,short:"\\u63D0\\u524D",group:"epistles"},{num:55,name:"\\u63D0\\u6469\\u592A\\u5F8C\\u66F8",chapters:4,short:"\\u63D0\\u5F8C",group:"epistles"},{num:56,name:"\\u63D0\\u591A\\u66F8",chapters:3,short:"\\u591A",group:"epistles"},{num:57,name:"\\u8153\\u5229\\u9580\\u66F8",chapters:1,short:"\\u9580",group:"epistles"},{num:58,name:"\\u5E0C\\u4F2F\\u4F86\\u66F8",chapters:13,short:"\\u4F86",group:"epistles"},{num:59,name:"\\u96C5\\u5404\\u66F8",chapters:5,short:"\\u96C5",group:"epistles"},{num:60,name:"\\u5F7C\\u5F97\\u524D\\u66F8",chapters:5,short:"\\u5F7C\\u524D",group:"epistles"},{num:61,name:"\\u5F7C\\u5F97\\u5F8C\\u66F8",chapters:3,short:"\\u5F7C\\u5F8C",group:"epistles"},{num:62,name:"\\u7D04\\u7FF0\\u4E00\\u66F8",chapters:5,short:"\\u7D04\\u4E00",group:"epistles"},{num:63,name:"\\u7D04\\u7FF0\\u4E8C\\u66F8",chapters:1,short:"\\u7D04\\u4E8C",group:"epistles"},{num:64,name:"\\u7D04\\u7FF0\\u4E09\\u66F8",chapters:1,short:"\\u7D04\\u4E09",group:"epistles"},{num:65,name:"\\u7336\\u5927\\u66F8",chapters:1,short:"\\u7336",group:"epistles"},{num:66,name:"\\u555F\\u793A\\u9304",chapters:22,short:"\\u555F",group:"revelation"}]};var ye=x.groups,f=x.books;function g(e){return String(e.num).padStart(2,"0")+"-"+e.name}function re(e){let t=e.trim().split(/[?#]/,1)[0];try{return decodeURIComponent(t)}catch{return t}}function l(e){return re(e).replace(/\\\\/g,"/").replace(/^\\/+|\\/+$/g,"").replace(/\\.html$/i,"").replace(/[\\s]+/g,"-")}function b(e){let n=l(e).split("/").at(-1);return f.find(r=>g(r)===n)}function L(e){let t;try{t=JSON.parse(e??"")}catch{return[]}if(!Array.isArray(t))return[];let n=[];for(let r of t){if(!Array.isArray(r)||typeof r[0]!="number"||!Array.isArray(r[1]))continue;let o=f.find(p=>p.num===r[0]);if(!o)continue;let a=r[1].filter(p=>Number.isInteger(p)),s=r[2]===1,i=r[3]===1,u=a.length>0?"ready":s||i?"outline":"empty";n.push({book:o,status:u,chapters:a,hasToc:s,hasIntro:i})}return n}function oe(e){return l(e).split("/")}function h(e){let t=oe(e);if(t.length!==2)return null;let[n,r]=t,o=b(n);if(!o)return null;let a=/^\u7B2C(\\d+)\u7AE0$/.exec(r);if(a){let s=Number(a[1]);return!Number.isInteger(s)||s<1||s>o.chapters?null:{book:o,kind:"chapter",chapter:s}}return r==="\\u5168\\u66F8\\u76EE\\u9304\\u53CA\\u7DB1\\u8981"?{book:o,kind:"toc"}:r==="\\u66F8\\u5377\\u5C0E\\u8AD6"?{book:o,kind:"intro"}:null}function _(e){return g(e)+"/\\u5168\\u66F8\\u76EE\\u9304\\u53CA\\u7DB1\\u8981"}var w="bwz-reading",d={v:1,books:{}},ae=1e3,se=.02;function E(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function R(e){return Number.isNaN(e)?0:Math.min(1,Math.max(0,e))}function I(e){return e===Number.POSITIVE_INFINITY?e:Number.isFinite(e)?Math.max(0,Math.floor(e)):0}function N(e){if(e==null)return d;let t;try{t=JSON.parse(e)}catch{return d}if(!E(t)||t.v!==1||!E(t.books))return d;let n={};for(let[r,o]of Object.entries(t.books)){if(!E(o))continue;let{slug:a,ratio:s,t:i}=o;typeof a!="string"||typeof s!="number"||!Number.isFinite(s)||typeof i!="number"||!Number.isFinite(i)||(n[r]={slug:a,ratio:R(s),t:i})}return{v:1,books:n}}function A(e){return JSON.stringify(e)}function M(e,t){let n=h(t.slug);if(!n||n.kind!=="chapter")return e;let r=g(n.book);return{v:1,books:{...e.books,[r]:{slug:t.slug,ratio:R(t.ratio),t:t.t}}}}function v(e,t){let n=[];for(let[r,o]of Object.entries(e.books)){let a=b(r),s=h(o.slug);!a||!s||s.kind!=="chapter"||s.book.num!==a.num||n.push({...o,book:a,chapter:s.chapter})}return n.sort((r,o)=>o.t-r.t).slice(0,I(t))}function P(e,t,n){let r=new Map(t.map(a=>[a.book.num,a])),o=[];for(let a of v(e,Number.POSITIVE_INFINITY)){let s=r.get(a.book.num);!s||s.status==="empty"||(s.chapters.includes(a.chapter)?o.push({book:a.book,slug:a.slug,chapter:a.chapter,ratio:a.ratio,t:a.t,kind:"chapter"}):o.push({book:a.book,slug:_(a.book),ratio:0,t:a.t,kind:"toc"}))}return o.slice(0,I(n))}function C(e,t,n){let r=Math.max(0,t-n);return!Number.isFinite(r)||r===0?0:R(e/r)}function D(e,t,n){let r=Math.max(0,t-n);return!Number.isFinite(r)||r===0?0:Math.min(r,Math.max(0,R(e)*r))}function F({prevRatio:e,ratio:t,now:n,lastSavedAt:r}){return e===void 0?!0:n-r>=ae&&Math.abs(t-e)>=se}function T(){try{return typeof localStorage>"u"?null:localStorage}catch{return null}}function S(e=T()){if(!e)return d;try{return N(e.getItem(w))}catch{return d}}function H(e=T()){return v(S(e),1).length>0}function z(e,t=T()){if(!t)return!1;try{let n=S(t),r=M(n,e);return r===n?!1:(t.setItem(w,A(r)),!0)}catch{return!1}}var ie="data-bwz-reading";function ue(e){return H(e)?"has":"none"}function k(e=document.documentElement,t){let n=ue(t);return e.setAttribute(ie,n),n}var O="bwz-resume-pending",G=60*1e3;function pe(e){if(!e)return null;try{let t=JSON.parse(e);return!t||typeof t.slug!="string"||typeof t.ratio!="number"||!Number.isFinite(t.ratio)||typeof t.t!="number"||!Number.isFinite(t.t)?null:{slug:t.slug,ratio:t.ratio,t:t.t}}catch{return null}}function ce(e,t,n){return!e||n-e.t>G||e.t-n>G?!1:l(e.slug)===l(t)}function $(){try{return typeof sessionStorage>"u"?null:sessionStorage}catch{return null}}function Y(e,t,n,r=$()){try{r?.setItem(O,JSON.stringify({slug:e,ratio:t,t:n}))}catch{}}function K(e,t,n=$()){if(!n)return null;let r=null;try{r=pe(n.getItem(O)),r&&n.removeItem(O)}catch{return null}return ce(r,e,t)?r:null}function U(e,t={}){if(h(e)?.kind!=="chapter")return()=>{};let n,r=0,o=p=>{if(t.suspended?.())return;let m=C(window.scrollY,document.documentElement.scrollHeight,window.innerHeight),y=Date.now();!p&&!F({prevRatio:n,ratio:m,now:y,lastSavedAt:r})||z({slug:e,ratio:m,t:y})&&(n=m,r=y,k())},a=()=>o(!1),s=()=>{document.visibilityState==="hidden"&&o(!0)},i=()=>o(!0);window.addEventListener("scroll",a,{passive:!0}),document.addEventListener("visibilitychange",s),window.addEventListener("pagehide",i),document.addEventListener("prenav",i);let u=()=>{window.removeEventListener("scroll",a),document.removeEventListener("visibilitychange",s),window.removeEventListener("pagehide",i),document.removeEventListener("prenav",i)};return window.addCleanup?.(u),u}function c(e,t,n){let r=document.createElement(e);return r.className=t,n!==void 0&&(r.textContent=n),r}function V(e){return`${document.body.dataset.basepath??""}/${e.split("/").map(encodeURIComponent).join("/")}`}function W(e,t){if(e.replaceChildren(),e.dataset.state=t?"ready":"empty",!t)return;let{main:n,recent:r}=t,o=c("div","bwz-resume");o.append(c("span","bwz-resume-kicker","\\u7E7C\\u7E8C\\u95B1\\u8B80")),o.append(c("span","bwz-resume-title",n.title)),o.append(c("span","bwz-resume-meta",n.meta));let a=c("a","bwz-resume-go","\\u7E7C\\u7E8C \\u203A");if(a.href=V(n.slug),a.setAttribute("aria-label",n.ariaLabel),n.restoreScroll&&a.addEventListener("click",()=>Y(n.slug,n.ratio,Date.now())),o.append(a),e.append(o),r.length===0)return;let s=c("p","bwz-resume-more","\\u6700\\u8FD1\\u4E5F\\u8B80\\u4E86\\uFF1A");for(let i of r){let u=c("a","bwz-resume-link",i.label);u.href=V(i.slug),s.append(u)}e.append(s)}function me(e){return e>=.1?e<.35?"\\u524D\\u6BB5":e<.65?"\\u4E2D\\u6BB5":"\\u5F8C\\u6BB5":"\\u958B\\u982D"}function q(e){let t=new Date(e);return new Date(t.getFullYear(),t.getMonth(),t.getDate()).getTime()}function le(e,t){let n=new Date(q(e)),r=new Date(q(t));return Math.round((Date.UTC(r.getFullYear(),r.getMonth(),r.getDate())-Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()))/864e5)}function J(e,t){if(!Number.isFinite(e)||t-e<3e5)return"\\u525B\\u525B";let n=le(e,t);if(n<=0)return"\\u4ECA\\u5929";if(n===1)return"\\u6628\\u5929";if(n<7)return`${n} \\u5929\\u524D`;let r=new Date(e);return`${r.getMonth()+1} \\u6708 ${r.getDate()} \\u65E5`}function j(e,t,n){return`\\u4E0A\\u6B21\\u8B80\\u5230\\u9019\\u4E00\\u7AE0\\u7684${me(e)} \\xB7 ${J(t,n)}`}function Q(e,t){return`\\u4E0A\\u6B21\\u8B80\\u904E\\u9019\\u4E00\\u5377 \\xB7 ${J(e,t)}`}var de=2;function B(e,t){return e.kind==="chapter"?t?`${e.book.name} \\u7B2C ${e.chapter} \\u7AE0`:`${e.book.name}\\u7B2C ${e.chapter} \\u7AE0`:e.book.name}function X(e,t,n){let r=P(e,t,1+de),[o,...a]=r;if(!o)return null;let s=o.kind==="chapter";return{main:{slug:o.slug,ratio:o.ratio,title:B(o,!0),meta:s?j(o.ratio,o.t,n):Q(o.t,n),ariaLabel:`\\u7E7C\\u7E8C\\u95B1\\u8B80${B(o,!1)}`,restoreScroll:s},recent:a.map(i=>({slug:i.slug,label:B(i,!0)}))}}function Z({now:e,startedAt:t,height:n,lastHeight:r,lastChangeAt:o}){return e-t>=3e3?"done":r===void 0||n!==r?"apply":e-o>=500?"done":"wait"}var ee=["wheel","touchstart","keydown","mousedown"];function te(e){let t=!1,n=0,r=Date.now(),o,a=r,s=()=>{if(!t){t=!0,window.clearTimeout(n);for(let u of ee)window.removeEventListener(u,s)}},i=()=>{if(t)return;let u=Date.now(),p=document.documentElement.scrollHeight,m=Z({now:u,startedAt:r,height:p,lastHeight:o,lastChangeAt:a});if(m==="done")return s();m==="apply"&&(p!==o&&(a=u),o=p,window.scrollTo({top:D(e,p,window.innerHeight),behavior:"instant"})),n=window.setTimeout(i,100)};for(let u of ee)window.addEventListener(u,s,{passive:!0});return i(),{active:()=>!t,cancel:s}}function he(){return document.body.dataset.slug??""}function fe(e){let t=e.querySelector("[data-hub-search]");if(!t||t.dataset.bound)return;t.dataset.bound="1",t.addEventListener("click",()=>{document.querySelector(".search-button")?.click()});let n=e.querySelector("[data-hub-kbd]");n&&/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)&&(n.textContent="\\u2318 K")}function be(){let e=document.querySelector(".bwz-hub");if(!e)return;fe(e);let t=e.querySelector("[data-hub-resume]");if(!t)return;let n=X(S(),L(e.dataset.catalog),Date.now());W(t,n)}function Re(){let e=he();k(),be();let t=K(e,Date.now()),n=t?te(t.ratio):null;U(e,{suspended:()=>n?.active()??!1})}document.addEventListener("nav",Re);\n';

// ../book-picker/src/components/styles/bookGrid.scss
var bookGrid_default = '@charset "UTF-8";\n/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n   \u5171\u7528\u6A23\u5F0F\uFF1A\u66F8\u5377\u683C\u5B50\uFF08BookGrid\uFF09\u8207\u7AE0\u865F\u683C\uFF08ChapterGrid\uFF09\u3002\n   \u5DE6\u6B04\u9078\u64C7\u5668\u3001\u624B\u6A5F\u7AE0\u672B\u3001\u9996\u9801\u5165\u53E3\u90FD\u7528\u9019\u4E00\u4EFD\uFF0C\u4E0D\u8981\u5728\u5225\u8655\u8907\u88FD\u3002\n   \u53EA\u7528\u7DB2\u7AD9\u65E2\u6709\u7684\u984F\u8272\u8B8A\u6578\uFF1B\u5F37\u8ABF\u8272\u7528\u52A0\u6DF1\u904E\u7684 --bwz-accent-strong\uFF08\u6DF1\u8272\u6A21\u5F0F\u662F\u6DFA\u7D2B\uFF09\u3002\n   \u5916\u89C0\u5C6C\u6027\u5927\u591A\u5E36 !important\uFF1A\u5916\u639B\u7684 CSS \u5728\u6700\u4F4E\u7684 quartz-base \u5C64\uFF0C\u4E3B\u984C\u5916\u639B\uFF08\u8F03\u9AD8\u7684\u5C64\uFF09\u5C0D a\u3001li\u3001button\u3001h2 \u7684\n   \u9023\u7D50\u8272\u3001\u7C97\u9AD4\u3001\u5167\u8DDD\u6703\u84CB\u904E\u9019\u88E1\u7684\u4E00\u822C\u5BA3\u544A\uFF1B!important \u5728\u5C64\u88E1\u662F\u53CD\u904E\u4F86\u7684\uFF08\u6700\u4F4E\u5C64\u8D0F\uFF09\uFF0C\u6240\u4EE5\u9019\u6A23\u5BEB\u624D\u7A69\u3002\n   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */\n/* \u5BE6\u5FC3\u6309\u9215\u4E0A\u7684\u5B57\uFF1A\u6DFA\u8272\u6A21\u5F0F\u7528\u767D\uFF0C\u6DF1\u8272\u6A21\u5F0F\u7684\u5F37\u8ABF\u8272\u662F\u6DFA\u7D2B\uFF0C\u6539\u7528\u6DF1\u8272\u5B57\u624D\u6709\u8DB3\u5920\u5C0D\u6BD4 */\n/* \u7070\u8272\uFF08\u5C1A\u672A\u958B\u653E\uFF09\u7684\u5B57\uFF1A\u6BD4 --gray \u6DF1\uFF0C\u5C0D\u6BD4 \u2265 4.5:1\uFF1B\u9760\u865B\u7DDA\u6846\u548C\u300C\u7070\u300D\u611F\u5340\u5206\uFF0C\u4E0D\u9760\u8B8A\u6DE1 */\n/* \u683C\u5B50\u7684\u6846\u7DDA\uFF1A--lightgray \u5728\u6DFA\u8272\u7684\u62BD\u5C5C\u5E95\uFF08\u4E5F\u662F\u6DFA\u7070\uFF09\u4E0A\u5E7E\u4E4E\u770B\u4E0D\u898B\uFF0C\u6DF7\u4E00\u9EDE --gray \u8B93\u6BCF\u4E00\u683C\u90FD\u770B\u5F97\u51FA\u908A\u754C */\n.bwz-sr-only {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n  border: 0;\n}\n\n/* ---------- \u66F8\u5377\u683C\u5B50 ---------- */\n.bwz-bookgrid {\n  --bwz-bg-cell-h: 34px; /* \u684C\u6A5F\u5DE6\u6B04\uFF1B\u624B\u6A5F\u8207\u89F8\u63A7\u88DD\u7F6E\u5728\u4E0B\u9762\u6539\u6210 44px */\n  color: var(--dark) !important;\n  text-align: left;\n}\n.bwz-bookgrid .bwz-bg-tabs {\n  display: inline-flex;\n  gap: 0.25rem;\n  padding: 0.2rem !important;\n  margin-bottom: 0.25rem;\n  border-radius: 10px !important;\n  background: var(--lightgray) !important;\n}\n.bwz-bookgrid .bwz-bg-tab {\n  min-height: 32px;\n  margin: 0 !important;\n  padding: 0.2rem 0.7rem !important;\n  border: 0 !important;\n  border-radius: 8px !important;\n  background: transparent !important;\n  color: var(--darkgray) !important;\n  font: inherit !important;\n  font-size: 0.88rem !important;\n  white-space: nowrap;\n  cursor: pointer;\n}\n.bwz-bookgrid .bwz-bg-tab[aria-selected=true] {\n  background: var(--light) !important;\n  color: var(--dark) !important;\n  font-weight: 700 !important;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);\n}\n.bwz-bookgrid .bwz-bg-gh {\n  margin: 0.7rem 0 0.3rem !important;\n  color: var(--darkgray) !important;\n  font-size: 0.8rem !important;\n  font-weight: 600 !important;\n  letter-spacing: 0.04em;\n}\n.bwz-bookgrid .bwz-bg-books {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.3rem;\n}\n.bwz-bookgrid .bwz-bg-book {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  min-height: var(--bwz-bg-cell-h);\n  margin: 0 !important;\n  padding: 0.1rem 0.5rem !important;\n  border: 1px solid color-mix(in srgb, var(--gray) 40%, var(--lightgray)) !important;\n  border-radius: 8px !important;\n  background: transparent !important;\n  font: inherit !important;\n  font-size: 0.88rem !important;\n  line-height: 1.2 !important;\n  text-align: center;\n  text-decoration: none !important;\n}\n.bwz-bookgrid {\n  /* \u5DF2\u958B\u653E\uFF1A\u53EF\u9EDE\u7684\u9023\u7D50\uFF0C\u7528\u5F37\u8ABF\u8272 */\n}\n.bwz-bookgrid a.bwz-bg-book {\n  border-color: color-mix(in srgb, var(--bwz-accent-strong, var(--secondary)) 50%, var(--lightgray)) !important;\n  background: color-mix(in srgb, var(--bwz-accent-strong, var(--secondary)) 7%, transparent) !important;\n  color: var(--bwz-accent-strong, var(--secondary)) !important;\n  font-weight: 700 !important;\n}\n.bwz-bookgrid a.bwz-bg-book:hover {\n  background: color-mix(in srgb, var(--bwz-accent-strong, var(--secondary)) 14%, transparent) !important;\n}\n.bwz-bookgrid a.bwz-bg-book[aria-current=true] {\n  border-color: transparent !important;\n  background: var(--bwz-accent-strong, var(--secondary)) !important;\n  color: #fff !important;\n}\n.bwz-bookgrid {\n  /* \u7070\u8272\uFF1A\u9084\u5728\u6574\u7406\u4E2D\u3002\u4ECD\u53EF\u805A\u7126\u3001\u53EF\u9EDE\uFF08\u9EDE\u4E86\u8DF3\u63D0\u793A\uFF09\uFF0C\u6240\u4EE5\u4E0D\u662F disabled \u800C\u662F aria-disabled */\n}\n.bwz-bookgrid .bwz-bg-book.is-locked {\n  border-style: dashed !important;\n  color: color-mix(in srgb, var(--darkgray) 70%, var(--light)) !important;\n  cursor: help;\n}\n.bwz-bookgrid .bwz-bg-book.is-locked:hover {\n  background: var(--lightgray) !important;\n}\n.bwz-bookgrid {\n  /* \u9996\u9801\u7528\u7684\u7B49\u5BEC\u683C\uFF1A\u6BCF\u683C\u540C\u5BEC\uFF0C\u6BD4\u5DE6\u6B04\u7684\u5C0F\u6A19\u7C64\u5927\u4E00\u9EDE */\n}\n.bwz-bookgrid.bwz-bookgrid--grid {\n  --bwz-bg-cell-h: 44px;\n}\n.bwz-bookgrid.bwz-bookgrid--grid .bwz-bg-books {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(5.6rem, 1fr));\n  gap: 0.4rem;\n}\n.bwz-bookgrid.bwz-bookgrid--grid .bwz-bg-book {\n  font-size: 0.92rem !important;\n}\n.bwz-bookgrid .bwz-bg-tab:focus-visible,\n.bwz-bookgrid .bwz-bg-book:focus-visible {\n  outline: 2px solid var(--secondary);\n  outline-offset: 2px;\n}\n\n/* ---------- \u7AE0\u865F\u683C ---------- */\n.bwz-chgrid-wrap {\n  --bwz-ch-h: 34px;\n  --bwz-ch-gap: 0.25rem;\n  /* \u7AE0\u6578\u5F88\u591A\uFF08\u8A69\u7BC7 150 \u7AE0\uFF09\u6642\u6700\u591A\u7D04 8 \u884C\u9AD8\uFF0C\u8D85\u904E\u5728\u6846\u5167\u6372\u52D5 */\n  max-height: calc(8 * var(--bwz-ch-h) + 7 * var(--bwz-ch-gap) + 4px);\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  scrollbar-gutter: stable;\n  padding: 2px !important;\n}\n\n.bwz-chgrid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));\n  gap: var(--bwz-ch-gap);\n  margin: 0 !important;\n  padding: 0 !important;\n  list-style: none;\n}\n.bwz-chgrid li {\n  margin: 0 !important;\n  padding: 0 !important;\n  list-style: none;\n}\n.bwz-chgrid .bwz-ch {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  min-height: var(--bwz-ch-h);\n  border: 1px solid color-mix(in srgb, var(--gray) 40%, var(--lightgray)) !important;\n  border-radius: 8px !important;\n  background: transparent !important;\n  color: var(--dark) !important;\n  font-size: 0.9rem !important;\n  font-variant-numeric: tabular-nums;\n  text-decoration: none !important;\n}\n.bwz-chgrid a.bwz-ch:hover {\n  background: var(--lightgray) !important;\n}\n.bwz-chgrid a.bwz-ch[aria-current=page] {\n  border-color: transparent !important;\n  background: var(--bwz-accent-strong, var(--secondary)) !important;\n  color: #fff !important;\n  font-weight: 700 !important;\n}\n.bwz-chgrid .bwz-ch.is-missing {\n  border-style: dashed !important;\n  color: color-mix(in srgb, var(--darkgray) 70%, var(--light)) !important;\n}\n.bwz-chgrid a.bwz-ch:focus-visible {\n  outline: 2px solid var(--secondary);\n  outline-offset: 2px;\n}\n\n/* \u624B\u6A5F\u8207\u89F8\u63A7\u88DD\u7F6E\uFF1A\u89F8\u63A7\u76EE\u6A19 \u2265 44px */\n@media (max-width: 800px), (pointer: coarse) {\n  .bwz-bookgrid {\n    --bwz-bg-cell-h: 44px;\n  }\n  .bwz-bookgrid .bwz-bg-tab {\n    min-height: 40px;\n  }\n  .bwz-chgrid-wrap {\n    --bwz-ch-h: 44px;\n    --bwz-ch-gap: 0.35rem;\n  }\n  .bwz-chgrid {\n    grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));\n  }\n}\n/* \u6DF1\u8272\u6A21\u5F0F\u7684\u5F37\u8ABF\u8272\u662F\u6DFA\u7D2B\uFF0C\u5BE6\u5FC3\u5E95\u4E0A\u7684\u5B57\u6539\u6DF1\u8272\uFF08\u5C0D\u6BD4 \u2265 4.5:1\uFF09 */\nhtml[saved-theme=dark] .bwz-bookgrid a.bwz-bg-book[aria-current=true],\nhtml[saved-theme=dark] .bwz-chgrid a.bwz-ch[aria-current=page] {\n  color: #16121f !important;\n}';

// src/components/styles/hub.scss
var hub_default = '@charset "UTF-8";\n.popover-hint:has(> .bwz-hub) {\n  display: flex;\n  flex-direction: column;\n}\n.popover-hint:has(> .bwz-hub) > .bwz-hub {\n  order: 1;\n}\n.popover-hint:has(> .bwz-hub) > .wiki-tour-launcher {\n  order: 0;\n}\n\nhtml[data-bwz-reading=has] .popover-hint:has(> .bwz-hub) > .bwz-hub {\n  order: 0;\n}\nhtml[data-bwz-reading=has] .popover-hint:has(> .bwz-hub) > .wiki-tour-launcher {\n  order: 1;\n}\n\n.bwz-hub {\n  display: flex;\n  flex-direction: column;\n  gap: 0.75rem;\n  margin: 0.25rem 0 1.5rem;\n}\n.bwz-hub .bwz-resume-go,\n.bwz-hub .bwz-resume-link,\n.bwz-hub .bwz-hub-links a {\n  text-decoration: none;\n  background: none;\n}\n\n/* ---------- \u641C\u5C0B ---------- */\n.bwz-hub-search {\n  display: flex;\n  align-items: center;\n  gap: 0.6rem;\n  width: 100%;\n  min-height: 48px;\n  padding: 0.75rem 1rem;\n  border: 1px solid var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n  color: var(--darkgray);\n  font: inherit;\n  font-size: 1rem;\n  text-align: left;\n  cursor: pointer;\n}\n.bwz-hub-search .bwz-hub-search-text {\n  flex: 1;\n  min-width: 0;\n}\n.bwz-hub-search kbd {\n  font: inherit;\n  font-size: 0.75rem;\n  border: 1px solid var(--lightgray);\n  border-radius: 6px;\n  padding: 0.1rem 0.4rem;\n  color: var(--gray);\n}\n.bwz-hub-search:focus-visible {\n  outline: 2px solid var(--bwz-accent-strong, var(--secondary));\n  outline-offset: 2px;\n}\n@media (max-width: 800px) {\n  .bwz-hub-search .bwz-hub-wide,\n  .bwz-hub-search kbd {\n    display: none;\n  }\n}\n\n/* ---------- \u7E7C\u7E8C\u95B1\u8B80 ---------- */\n.bwz-hub-resume {\n  display: flex;\n  flex-direction: column;\n  gap: 0.6rem;\n}\n.bwz-hub-resume[data-state=empty] {\n  display: none;\n}\n.bwz-hub-resume[data-state=pending] {\n  min-height: 5.5rem;\n}\n\nhtml:not([data-bwz-reading=has]) .bwz-hub-resume {\n  display: none;\n}\n\n.bwz-resume {\n  position: relative;\n  display: grid;\n  grid-template-columns: 1fr auto;\n  column-gap: 1rem;\n  padding: 0.85rem 1rem;\n  border: 1px solid var(--lightgray);\n  border-left: 4px solid var(--bwz-accent-strong, var(--secondary));\n  border-radius: 12px;\n  background: var(--light);\n  color: var(--dark);\n}\n.bwz-resume .bwz-resume-kicker,\n.bwz-resume .bwz-resume-title,\n.bwz-resume .bwz-resume-meta {\n  grid-column: 1;\n}\n.bwz-resume .bwz-resume-kicker {\n  font-size: 0.8rem;\n  color: var(--darkgray);\n}\n.bwz-resume .bwz-resume-title {\n  font-family: var(--headerFont);\n  font-size: 1.25rem;\n  font-weight: 700;\n  color: var(--dark);\n}\n.bwz-resume .bwz-resume-meta {\n  font-size: 0.85rem;\n  color: var(--darkgray);\n}\n.bwz-resume .bwz-resume-go {\n  grid-column: 2;\n  grid-row: 1/4;\n  align-self: center;\n  display: inline-flex;\n  align-items: center;\n  min-height: 44px;\n  padding: 0.55rem 1rem;\n  box-sizing: border-box;\n  border-radius: 999px;\n  background: var(--bwz-accent-strong, var(--secondary));\n  color: #fff;\n  font-weight: 700;\n  white-space: nowrap;\n  line-height: 1.3;\n}\n.bwz-resume .bwz-resume-go::after {\n  content: "";\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n}\n.bwz-resume .bwz-resume-go:focus-visible {\n  outline: 2px solid var(--dark);\n  outline-offset: 2px;\n}\n\n.bwz-resume-more {\n  margin: 0;\n  padding: 0 0.25rem;\n  font-size: 0.9rem;\n  color: var(--darkgray);\n}\n.bwz-resume-more .bwz-resume-link {\n  display: inline-flex;\n  align-items: center;\n  box-sizing: border-box;\n  min-height: 44px;\n  margin-left: 0.5rem;\n  color: var(--bwz-accent-strong, var(--secondary));\n  font-weight: 600;\n}\n\n/* ---------- \u6309\u66F8\u5377\u8B80\u7D93 ---------- */\n.bwz-hub-books {\n  padding: 0.75rem 0.9rem 0.5rem;\n  border: 1px solid var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n}\n\n.bwz-hub-h {\n  margin: 0 0 0.5rem;\n  font-family: var(--headerFont);\n  font-size: 1.05rem;\n  font-weight: 700;\n  color: var(--dark);\n}\n\n.bwz-hub-note {\n  margin: 0.6rem 0 0.2rem;\n  font-size: 0.8rem;\n  color: var(--darkgray);\n}\n\n/* ---------- \u5FEB\u901F\u5165\u9580\u3001\u4E92\u52D5\u7DB2\u7AD9\u3001\u9644\u9304 ---------- */\n.bwz-hub-links {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.5rem;\n}\n.bwz-hub-links a {\n  display: inline-flex;\n  align-items: center;\n  box-sizing: border-box;\n  min-height: 44px;\n  padding: 0.4rem 0.9rem;\n  border: 1px solid var(--lightgray);\n  border-radius: 999px;\n  background: var(--light);\n  color: var(--darkgray);\n  font-size: 0.92rem;\n}\n\nhtml[saved-theme=dark] .bwz-resume .bwz-resume-go {\n  color: #16121f;\n}';

// src/components/styles/masthead.scss
var masthead_default = '.popover-hint:has(> .bwz-hub) > .bwz-masthead {\n  order: -1;\n}\n\n.center:has(.bwz-masthead[data-bwz-masthead]) > article > .markdown-rendered > h1:first-child,\n.center:has(.bwz-masthead[data-bwz-masthead~=blockquote]) > article > .markdown-rendered > h1:first-child + blockquote,\n.center:has(.bwz-masthead[data-bwz-masthead="h1 hr"]) > article > .markdown-rendered > h1:first-child + hr,\n.center:has(.bwz-masthead[data-bwz-masthead="h1 blockquote hr"]) > article > .markdown-rendered > h1:first-child + blockquote + hr {\n  display: none !important;\n}\n\n.popover .bwz-masthead {\n  display: none;\n}';

// src/components/HomeHub.tsx
var APPENDIX_INDEX = "appendix/index";
var WEBSITE_HUB = "appendix/website/index";
var QUICK_START = "\u6559\u5B78/\u5FEB\u901F\u5165\u9580";
var HomeHub = ({ fileData, allFiles, tree }) => {
  const isIndex = fileData.slug === "index" || fileData.slug === "";
  if (!isIndex) return null;
  const catalog = buildCatalog(allFiles.map((file) => file.slug ?? ""));
  const link = (slug) => "./" + slug.split("/").map(encodeURIComponent).join("/");
  const masthead = extractMasthead(tree);
  const hub = /* @__PURE__ */ u2("section", { class: "bwz-hub", "aria-label": "\u8B80\u7D93\u5165\u53E3", "data-catalog": JSON.stringify(compactCatalog(catalog)), children: [
    /* @__PURE__ */ u2("button", { type: "button", class: "bwz-hub-search", "data-hub-search": true, children: [
      /* @__PURE__ */ u2("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "aria-hidden": "true", children: [
        /* @__PURE__ */ u2("circle", { cx: "11", cy: "11", r: "7" }),
        /* @__PURE__ */ u2("path", { d: "m20 20-3.5-3.5" })
      ] }),
      /* @__PURE__ */ u2("span", { class: "bwz-hub-search-text", children: [
        "\u641C\u5C0B\u7D93\u6587\u3001\u4EBA\u7269\u3001\u4E3B\u984C",
        /* @__PURE__ */ u2("span", { class: "bwz-hub-wide", children: "\uFF0C\u6216\u8F38\u5165\u300C\u51FA 12:3\u300D" })
      ] }),
      /* @__PURE__ */ u2("kbd", { "aria-hidden": "true", "data-hub-kbd": true, children: "Ctrl K" })
    ] }),
    /* @__PURE__ */ u2("div", { class: "bwz-hub-resume", "data-hub-resume": true, "data-state": "pending" }),
    /* @__PURE__ */ u2("div", { class: "bwz-hub-books", children: [
      /* @__PURE__ */ u2("div", { class: "bwz-hub-h", role: "heading", "aria-level": 2, children: "\u6309\u66F8\u5377\u8B80\u7D93" }),
      /* @__PURE__ */ u2(BookGrid, { catalog, fromSlug: "index", idPrefix: "bwz-hub", layout: "grid" }),
      /* @__PURE__ */ u2("p", { class: "bwz-hub-note", children: "\u7070\u8272\u7684\u66F8\u5377\u7814\u8B80\u9801\u9084\u5728\u6574\u7406\u4E2D\uFF0C\u6703\u9678\u7E8C\u958B\u653E\u3002" })
    ] }),
    /* @__PURE__ */ u2("div", { class: "bwz-hub-links", children: [
      /* @__PURE__ */ u2("a", { href: link(QUICK_START), children: "\u5FEB\u901F\u5165\u9580" }),
      /* @__PURE__ */ u2("a", { href: link(WEBSITE_HUB), children: "\u4E92\u52D5\u7DB2\u7AD9" }),
      /* @__PURE__ */ u2("a", { href: link(APPENDIX_INDEX), children: "\u9644\u9304" })
    ] })
  ] });
  return /* @__PURE__ */ u2(S, { children: [
    masthead && /* @__PURE__ */ u2(Masthead, { masthead }),
    hub
  ] });
};
HomeHub.beforeDOMLoaded = early_inline_default;
HomeHub.afterDOMLoaded = hub_inline_default;
HomeHub.css = `${bookGrid_default}
${hub_default}
${masthead_default}`;
var HomeHub_default = (() => HomeHub);

// src/index.ts
var manifest = {
  name: "home-hub",
  displayName: "\u9996\u9801\u5165\u53E3",
  category: "component",
  version: "1.0.0",
  quartzVersion: ">=5.0.0",
  components: {
    HomeHub: {
      displayName: "HomeHub",
      defaultPosition: "beforeBody",
      defaultPriority: 4
    }
  }
};

export { HomeHub_default as HomeHub, manifest };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map