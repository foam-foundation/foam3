foam.CLASS({
  package: 'foam.demos.u2',
  name: 'MarkdownViewDemo',
  extends: 'foam.u2.Controller',

  requires: [ 'foam.u2.view.MarkdownView' ],

  properties: [
    {
      class: 'String',
      name: 'markdown',
      onKey: true,
      view: { class: 'foam.u2.tag.TextArea', rows: 16, cols: 90 },
      value: `
# Extended Markdown Features
## Text Formatting
This is **bold** and this is *italic* and this is ~~strikethrough~~.
You can also use __bold__ and _italic_ alternatives.
Here is some \`inline code\`.

## Code Blocks
\`\`\`javascript
function hello(name) {
  console.log("Hello, " + name);
}
\`\`\`

## Lists

### Unordered Lists
- First item
    nested stuff here
    more nested stuff here
    - a nested
    - list
- Second item
- Third item

### Ordered Lists
1. First step
2. Second step
3. Third step

## Blockquotes
> This is a blockquote.
> It can span multiple lines.

## Links and Images
Check out [FOAM3](https://github.com/kgrgreer/foam3).
![Google](/foam3/src/com/google/auth/images/google.svg)
![Google](/foam3/src/com/google/auth/images/google.svg "Title")

## Horizontal Rule

---

## Tables

| Header 1 | Header 2 | Header 3 |
|:---------|:--------:|---------:|
| Left     | Center   | Right    |
| aligned  | aligned  | aligned  |
| text     | text     | text     |`
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.start().add(this.MARKDOWN).end();
      this.start()
        .start(this.MarkdownView, { data$: this.markdown$ })
        .end()
      .end();
    }
  ]
});
